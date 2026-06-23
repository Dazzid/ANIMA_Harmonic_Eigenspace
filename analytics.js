// ============================================================================
// ANALYTICS  —  visits + visitors + behaviour, all into one Google Sheet
// ============================================================================
// © 2025 David Dalmazzo. All Rights Reserved. ANIMA MSCA Postdoctoral
// Fellowship (Project ID: 101203318), EU Horizon Europe.
// ----------------------------------------------------------------------------
// One pipeline → a Google Apps Script Web App → one row per event in a Google
// Sheet (CSV-exportable into dataset/). NO personal data: no cookies, no names.
// Two random ids only:
//   • uid — persistent VISITOR id (localStorage) ⇒ COUNT DISTINCT USERS and see
//     returning behaviour. page_view also carries visit# / returning.
//   • sid — per-tab SESSION id (sessionStorage) ⇒ group one visit's events.
// Neither is linked to any identity. "From where" is a coarse country resolved
// client-side and stored in the Sheet; the client IP itself is never stored.
//
// Touches ZERO app logic: clicks are captured with one delegated listener and
// attention with visibility/idle timers. Musical actions come as SEMANTIC events
// (chord_play, ms_chord, …) emitted by the app — this app is canvas-rendered, so
// a raw canvas click is noise. For cleaner click labels on a DOM control, add
// data-track="my-control-name" to its element.
// ============================================================================

(function () {
    'use strict';

    // ---- CONFIG (see ANALYTICS.md) ----------------------------------------
    const CONFIG = {
        behaviorEndpoint: 'https://script.google.com/macros/s/AKfycbwWuFpNr54bqkoO4ywTGGyjpUQD-k7G4Pd-mLQjKOql3ghlHGA7CF6ua7NiAdXv92RP0w/exec',
        geoEndpoint:      'https://get.geojs.io/v1/ip/geo.json', // resolves country only; the IP is never stored
        enabled:          true,   // master off-switch for behaviour events
        persistentVisitorId: true,// persistent uid (localStorage) ⇒ count distinct
                                  // users & returns. false ⇒ per-tab id only, which
                                  // typically needs no consent banner (see ANALYTICS.md).
        captureClicks:    true,   // record what users click
        captureAttention: true,   // record active time-on-page (dwell)
        idleAfterMs:      60000,  // no input for this long ⇒ "not paying attention"
        heartbeatMs:      30000,  // how often to bank accumulated attention
        flushIntervalMs:  15000,  // how often to ship queued events
        maxBatch:         25,     // ship immediately once queue hits this
        maxTextLen:       48,     // cap on a clicked control's label length
        debug:            false,  // console.log every event locally
    };

    function randomId(prefix) {
        return (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : prefix + '-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    }

    // ---- anonymous, per-tab session id (no cookie, no PII) -----------------
    // Lives in sessionStorage ⇒ one id per tab, wiped when the tab closes.
    // Used only to group the events of a single visit together.
    function sessionId() {
        try {
            let id = sessionStorage.getItem('anima_sid');
            if (!id) { id = randomId('sid'); sessionStorage.setItem('anima_sid', id); }
            return id;
        } catch (e) {
            return 'sid-nostorage';   // private mode / storage blocked
        }
    }

    // ---- persistent, anonymous visitor id (no cookie, no PII) --------------
    // Lives in localStorage ⇒ survives tab close and future visits, so we can
    // COUNT DISTINCT USERS and recognise a returning one — WITHOUT knowing who
    // they are. It is a random UUID, carries no identity, and is never linked
    // to a name, email or IP. `visit` increments once per page load so we can
    // tell new from returning at a glance.
    let VISIT = 1;
    function visitorId() {
        // Opt-out ⇒ reuse the per-tab session id, so nothing persists past the tab.
        if (!CONFIG.persistentVisitorId) return SID;
        try {
            let id = localStorage.getItem('anima_uid');
            if (!id) { id = randomId('uid'); localStorage.setItem('anima_uid', id); }
            VISIT = (parseInt(localStorage.getItem('anima_visits'), 10) || 0) + 1;
            localStorage.setItem('anima_visits', String(VISIT));
            return id;
        } catch (e) {
            return 'uid-nostorage';   // private mode / storage blocked
        }
    }

    const SID  = sessionId();
    const UID  = visitorId();
    const PAGE = (location.pathname.split('/').pop() || 'index.html');

    // ---- 1. GEO: country only (answers "from where"), IP never stored ------
    // Resolved client-side, cached per tab session ⇒ at most one API call per
    // visit. No third-party dashboard — the country lands in your own Sheet.
    function resolveGeo(cb) {
        try {
            const c = sessionStorage.getItem('anima_geo');
            if (c) { cb(JSON.parse(c)); return; }
        } catch (e) { /* ignore */ }
        let done = false;
        const finish = function (g) {
            if (done) return; done = true;
            try { sessionStorage.setItem('anima_geo', JSON.stringify(g)); } catch (e) { /* ignore */ }
            cb(g);
        };
        const to = setTimeout(function () { finish({}); }, 2000); // never block the visit record
        try {
            fetch(CONFIG.geoEndpoint)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    clearTimeout(to);
                    finish({                       // coarse geo ONLY — never d.ip / latitude / longitude
                        country:      d.country || '',
                        country_code: d.country_code || '',
                        region:       d.region || '',
                        city:         d.city || ''
                    });
                })
                .catch(function () { clearTimeout(to); finish({}); });
        } catch (e) { clearTimeout(to); finish({}); }
    }

    // ---- 2. BEHAVIOUR EVENT QUEUE ------------------------------------------
    const queue = [];
    let flushTimer = null;

    function track(event, props) {
        if (!CONFIG.enabled || !event) return;
        if (!CONFIG.behaviorEndpoint) {            // not configured → don't pile up
            if (CONFIG.debug) console.log('[analytics:nosink]', event, props || {});
            return;
        }
        queue.push({
            uid:   UID,
            sid:   SID,
            event: String(event),
            page:  PAGE,
            props: props || {},
            ts:    new Date().toISOString(),
        });
        if (CONFIG.debug) console.log('[analytics]', event, props || {});
        if (queue.length >= CONFIG.maxBatch) flush();
        else scheduleFlush();
    }

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(function () { flush(false); }, CONFIG.flushIntervalMs);
    }

    function flush(useBeacon) {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        if (!CONFIG.behaviorEndpoint || queue.length === 0) return;
        const batch = queue.splice(0, queue.length);
        const payload = JSON.stringify({ events: batch });
        try {
            // text/plain ⇒ a "simple" request ⇒ no CORS preflight (Apps Script
            // returns no CORS headers, so a preflighted request would fail).
            if (useBeacon && navigator.sendBeacon) {
                const ok = navigator.sendBeacon(
                    CONFIG.behaviorEndpoint,
                    new Blob([payload], { type: 'text/plain;charset=UTF-8' })
                );
                if (!ok) requeue(batch);
            } else {
                fetch(CONFIG.behaviorEndpoint, {
                    method:  'POST',
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body:    payload,
                    keepalive: true,
                    mode:    'no-cors',     // we don't need to read the response
                }).catch(function () { requeue(batch); });
            }
        } catch (e) { requeue(batch); }
    }

    function requeue(batch) {
        queue.unshift.apply(queue, batch);
        if (queue.length > 200) queue.splice(200);   // bound memory on long outages
    }

    // ---- CLICK CAPTURE (delegated, capture-phase ⇒ catches everything) -----
    // Builds a short, stable label for a clicked control. Never reads the value
    // of <input>/<textarea>/contenteditable, so no user-typed content leaks.
    function describe(el) {
        if (!el || el === document) return null;
        // Only log clicks on real UI controls. This app is canvas-rendered, so a
        // raw click on the <canvas> carries no meaning (which note/chord lives in
        // pixels, not the DOM). Musical actions are captured as SEMANTIC events
        // (chord_play, scene_switch, …) emitted from the app's own handlers.
        const node = el.closest('[data-track],button,a,[role="button"],input[type="button"],input[type="submit"],.btn,label,select');
        if (!node) return null;

        if (node.dataset && node.dataset.track) return node.dataset.track;

        let label =
            node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('title')) || '';
        const tag = (node.tagName || '').toLowerCase();
        const isText = tag === 'input' || tag === 'textarea' || node.isContentEditable;
        if (!label && !isText) {
            label = (node.textContent || '').trim().replace(/\s+/g, ' ');
        }
        if (label.length > CONFIG.maxTextLen) label = label.slice(0, CONFIG.maxTextLen) + '…';

        const id  = node.id ? '#' + node.id : '';
        const cls = (typeof node.className === 'string' && node.className.trim())
            ? '.' + node.className.trim().split(/\s+/)[0] : '';
        return { tag: tag, id: id, cls: cls, label: label };
    }

    function onClick(e) {
        if (!CONFIG.captureClicks) return;
        const d = describe(e.target);
        if (d) track('click', typeof d === 'string' ? { name: d } : d);
    }

    // ---- ATTENTION / DWELL -------------------------------------------------
    // Active time = time the tab is visible AND the user has interacted within
    // the last idleAfterMs. Banked on a heartbeat and on tab-hide/unload.
    let activeStart  = null;          // when the current active span began
    let bankedMs     = 0;             // active ms not yet shipped
    let lastInput    = Date.now();
    let heartbeat    = null;

    function isActive() {
        return document.visibilityState === 'visible' &&
               (Date.now() - lastInput) < CONFIG.idleAfterMs;
    }
    function resumeActive() { if (activeStart === null && isActive()) activeStart = Date.now(); }
    function pauseActive() {
        if (activeStart !== null) { bankedMs += Date.now() - activeStart; activeStart = null; }
    }
    function bankAttention(final) {
        pauseActive();
        if (bankedMs >= 1000 || final) {
            const ms = Math.round(bankedMs);
            bankedMs = 0;
            if (ms > 0) track('attention', { active_ms: ms, final: !!final });
        }
        resumeActive();
    }
    function noteInput() {
        const wasIdle = (Date.now() - lastInput) >= CONFIG.idleAfterMs;
        lastInput = Date.now();
        if (wasIdle) resumeActive();
    }

    // ---- init --------------------------------------------------------------
    function init() {
        if (CONFIG.captureClicks) {
            document.addEventListener('click', onClick, true);
        }

        if (CONFIG.captureAttention) {
            ['mousedown', 'keydown', 'pointerdown', 'touchstart', 'wheel', 'scroll']
                .forEach(function (ev) {
                    window.addEventListener(ev, noteInput, { passive: true, capture: true });
                });
            resumeActive();
            heartbeat = setInterval(function () { bankAttention(false); }, CONFIG.heartbeatMs);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') { bankAttention(true); flush(true); }
            else { lastInput = Date.now(); resumeActive(); }
        });
        window.addEventListener('pagehide', function () { bankAttention(true); flush(true); });

        // Record the visit immediately (counts never lost on a fast bounce). Attach
        // country if already cached this session; otherwise resolve it and emit a
        // 'geo' row (joinable by uid/sid). page_view doubles as the visit record.
        let geoCached = null;
        try { geoCached = JSON.parse(sessionStorage.getItem('anima_geo') || 'null'); } catch (e) { /* ignore */ }
        track('page_view', Object.assign({ ref: document.referrer || '', visit: VISIT, returning: VISIT > 1 }, geoCached || {}));
        if (!geoCached) {
            resolveGeo(function (geo) {
                if (geo && (geo.country || geo.country_code)) track('geo', geo);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ---- public API --------------------------------------------------------
    // Use window.Anima.track('event_name', { any: 'props' }) to add custom
    // events from anywhere (e.g. temperament switch, song played).
    window.Anima = window.Anima || {};
    window.Anima.track  = track;
    window.Anima.flush  = function () { bankAttention(true); flush(true); };
    window.Anima.config = CONFIG;
    window.Anima.sid    = SID;
    window.Anima.uid    = UID;
})();
