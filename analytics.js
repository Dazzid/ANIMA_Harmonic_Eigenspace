// ============================================================================
// ANALYTICS  —  visits (Cloudflare) + anonymous behaviour events (→ CSV)
// ============================================================================
// © 2025 David Dalmazzo. All Rights Reserved. ANIMA MSCA Postdoctoral
// Fellowship (Project ID: 101203318), EU Horizon Europe.
// ----------------------------------------------------------------------------
// Two independent jobs, kept apart on purpose (see ANALYTICS.md):
//
//   1. VISITS  — Cloudflare Web Analytics beacon. Aggregate, cookieless,
//      no consent banner needed. Just "how many people, from where".
//
//   2. BEHAVIOUR — anonymous interaction events (clicks + attention/dwell)
//      POSTed to a Google Apps Script Web App that appends one row per event
//      to a Google Sheet → exportable as CSV into dataset/. NO personal data:
//      no IP, no cookies, no names — only a random per-tab session id so we
//      can group one visit's clicks together. The Apps Script request never
//      receives the client IP, so it cannot be stored.
//
// Touches ZERO app logic: clicks are captured with one delegated listener and
// attention with visibility/idle timers. To get cleaner labels on a specific
// control, add  data-track="my-control-name"  to its element.
//
// SETUP: fill in the two CONFIG values below (see ANALYTICS.md). Until then
// visits + behaviour stay dormant and nothing is sent.
// ============================================================================

(function () {
    'use strict';

    // ---- CONFIG (fill these two in — see ANALYTICS.md) ---------------------
    const CONFIG = {
        cfBeaconToken:    '',     // Cloudflare Web Analytics site token
        behaviorEndpoint: 'https://script.google.com/macros/s/AKfycbwWuFpNr54bqkoO4ywTGGyjpUQD-k7G4Pd-mLQjKOql3ghlHGA7CF6ua7NiAdXv92RP0w/exec',
        enabled:          true,   // master off-switch for behaviour events
        captureClicks:    true,   // record what users click
        captureAttention: true,   // record active time-on-page (dwell)
        idleAfterMs:      60000,  // no input for this long ⇒ "not paying attention"
        heartbeatMs:      30000,  // how often to bank accumulated attention
        flushIntervalMs:  15000,  // how often to ship queued events
        maxBatch:         25,     // ship immediately once queue hits this
        maxTextLen:       48,     // cap on a clicked control's label length
        debug:            false,  // console.log every event locally
    };

    // ---- anonymous, per-tab session id (no cookie, no PII) -----------------
    function sessionId() {
        try {
            let id = sessionStorage.getItem('anima_sid');
            if (!id) {
                id = (window.crypto && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : 'sid-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
                sessionStorage.setItem('anima_sid', id);
            }
            return id;
        } catch (e) {
            return 'sid-nostorage';   // private mode / storage blocked
        }
    }
    const SID  = sessionId();
    const PAGE = (location.pathname.split('/').pop() || 'index.html');

    // ---- 1. CLOUDFLARE WEB ANALYTICS (visits) ------------------------------
    function injectCloudflare() {
        if (!CONFIG.cfBeaconToken) return;
        const s = document.createElement('script');
        s.defer = true;
        s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
        s.setAttribute('data-cf-beacon', JSON.stringify({ token: CONFIG.cfBeaconToken }));
        document.head.appendChild(s);
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
        const ctl = el.closest('[data-track],button,a,[role="button"],input[type="button"],input[type="submit"],.btn,label');
        const node = ctl || el;

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
        injectCloudflare();

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

        track('page_view', { ref: document.referrer || '' });
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
})();
