// ============================================================================
// SESSION SAVE / LOAD  (see STRATEGY.md §6)
// ============================================================================
// © 2025 David Dalmazzo. All Rights Reserved. ANIMA MSCA Postdoctoral
// Fellowship (Project ID: 101203318), EU Horizon Europe.
// ----------------------------------------------------------------------------
// Persists a working session to a local JSON file and reloads it:
//   • Save Session — downloads session_<date>_<time>.json
//   • Load Session — drag-or-click a file → validate → REPLACE app state
//
// A session contains exactly two things:
//   1. Chord Memory grid   (grid.js  → getGrid().exportData()/importData())
//   2. Modal Interchange 8×8 grid (modal_studio: app.getSession()/applySession())
//
// Load is gated by 3 layers before ANY state changes: JSON.parse → signature →
// null-tolerant shape. Nothing here re-runs the modal-interchange calculation.
// ============================================================================

(function () {
    'use strict';

    const SIGNATURE = 'ANIMA-EIGENSPACE-SESSION';
    const VERSION = 1;

    // ---- helpers -----------------------------------------------------------

    function chordMemoryGrid() {
        // gridSketch is a top-level global in grid.js (shared classic-script scope).
        if (typeof gridSketch !== 'undefined' && gridSketch && gridSketch.getGrid) {
            return gridSketch.getGrid();
        }
        return null;
    }

    function timestampName() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
            `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
        return `session_${stamp}.json`;
    }

    function downloadJSON(obj, name) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // ---- SAVE --------------------------------------------------------------

    function buildSession() {
        const session = {
            signature: SIGNATURE,
            version: VERSION,
            savedAt: new Date().toISOString(),
            chordMemory: null,
            modalStudio: { grid: [] }
        };
        const cm = chordMemoryGrid();
        if (cm && typeof cm.exportData === 'function') {
            session.chordMemory = cm.exportData();
        }
        if (window.app && typeof window.app.getSession === 'function') {
            session.modalStudio = window.app.getSession();
        }
        return session;
    }

    function save() {
        try {
            downloadJSON(buildSession(), timestampName());
            console.log('[session] saved');
        } catch (e) {
            console.error('[session] save failed', e);
            alert('Could not save the session: ' + e.message);
        }
    }

    // ---- LOAD: 3-layer validation gate -------------------------------------

    // Returns { ok:true, data } or { ok:false, error }. Layer 1 (JSON.parse) is
    // done by the caller so it can distinguish "not JSON" from "not ours".
    function validateSession(obj) {
        // Layer 2 — signature
        if (!obj || obj.signature !== SIGNATURE || obj.version !== VERSION) {
            return { ok: false, error: 'Not an ANIMA Eigenspace session file.' };
        }
        // Layer 3 — shape (structure only, null-tolerant)
        const cm = obj.chordMemory;
        if (cm && (cm.gridSize !== 8 || !Array.isArray(cm.storage) || cm.storage.length !== 8)) {
            return { ok: false, error: 'Session file is corrupt (Chord Memory shape).' };
        }
        const ms = obj.modalStudio;
        if (ms && ms.grid && (!Array.isArray(ms.grid) || ms.grid.length !== 64)) {
            return { ok: false, error: 'Session file is corrupt (Modal grid shape).' };
        }
        return { ok: true, data: obj };
    }

    // Apply a validated session — REPLACE. Each part guarded so a surprise in one
    // can't abort the other or half-load. Modal grid retries if OfApp isn't ready.
    function applySession(obj) {
        // 1) Chord Memory
        try {
            const cm = chordMemoryGrid();
            if (obj.chordMemory && cm && typeof cm.importData === 'function') {
                cm.importData(obj.chordMemory);
                if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
            }
        } catch (e) {
            console.error('[session] Chord Memory restore failed', e);
        }

        // 2) Modal Interchange grid (retry until OfApp/Grid is ready)
        if (obj.modalStudio && Array.isArray(obj.modalStudio.grid)) {
            applyModalWithRetry(obj.modalStudio, 0);
        }
    }

    function applyModalWithRetry(ms, attempt) {
        try {
            if (window.app && typeof window.app.applySession === 'function') {
                if (window.app.applySession(ms)) return; // success
            }
        } catch (e) {
            console.error('[session] Modal grid restore failed', e);
            return;
        }
        if (attempt < 15) { // ~3s of retries for late OfApp init
            setTimeout(() => applyModalWithRetry(ms, attempt + 1), 200);
        } else {
            console.warn('[session] Modal Studio not ready; grid not restored.');
        }
    }

    function handleFile(file, onResult) {
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => onResult({ ok: false, error: 'Could not read the file.' });
        reader.onload = () => {
            let obj;
            try {
                obj = JSON.parse(reader.result); // Layer 1
            } catch (e) {
                return onResult({ ok: false, error: 'Not a valid JSON file.' });
            }
            const v = validateSession(obj);
            if (!v.ok) return onResult(v);
            applySession(v.data);
            onResult({ ok: true });
        };
        reader.readAsText(file);
    }

    // ---- LOAD: drag + click overlay ----------------------------------------

    let overlayEl = null;

    function buildOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'session-load-overlay';
        overlay.innerHTML = `
            <div class="session-card">
                <button class="session-close" title="Close">&times;</button>
                <div class="session-title">Load Session</div>
                <div class="session-drop" id="session-drop">
                    <div class="session-drop-icon">⬇</div>
                    <div class="session-drop-text">Drop a <b>session_*.json</b> here<br>or click to browse</div>
                </div>
                <div class="session-msg" id="session-msg"></div>
                <input type="file" id="session-file-input" accept=".json,application/json" hidden>
            </div>`;
        document.body.appendChild(overlay);

        const drop = overlay.querySelector('#session-drop');
        const input = overlay.querySelector('#session-file-input');
        const msg = overlay.querySelector('#session-msg');

        const setMsg = (text, kind) => {
            msg.textContent = text || '';
            msg.className = 'session-msg' + (kind ? ' ' + kind : '');
        };

        const onResult = (res) => {
            if (res.ok) {
                setMsg('Session loaded ✓', 'ok');
                setTimeout(closeOverlay, 700);
            } else {
                setMsg(res.error || 'Could not load the file.', 'err');
            }
        };

        drop.addEventListener('click', () => input.click());
        input.addEventListener('change', () => {
            if (input.files && input.files[0]) handleFile(input.files[0], onResult);
            input.value = ''; // allow re-selecting the same file
        });
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('hover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('hover');
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) handleFile(f, onResult);
        });

        overlay.querySelector('.session-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

        return overlay;
    }

    function openLoadDialog() {
        if (!overlayEl) overlayEl = buildOverlay();
        const msg = overlayEl.querySelector('#session-msg');
        if (msg) { msg.textContent = ''; msg.className = 'session-msg'; }
        overlayEl.style.display = 'flex';
    }

    function closeOverlay() {
        if (overlayEl) overlayEl.style.display = 'none';
    }

    // ---- styles ------------------------------------------------------------

    function injectStyles() {
        if (document.getElementById('session-styles')) return;
        const s = document.createElement('style');
        s.id = 'session-styles';
        s.textContent = `
        #session-load-overlay {
            position: fixed; inset: 0; z-index: 100000; display: none;
            align-items: center; justify-content: center;
            background: rgba(8, 10, 16, 0.62); backdrop-filter: blur(2px);
            font-family: 'Source Code Pro', monospace;
        }
        #session-load-overlay .session-card {
            position: relative; width: 420px; max-width: 90vw;
            background: rgba(20, 22, 30, 0.98); color: #fff;
            border: 1px solid rgba(255,255,255,0.14); border-radius: 12px;
            padding: 22px 22px 18px; box-shadow: 0 18px 50px rgba(0,0,0,0.5);
        }
        #session-load-overlay .session-close {
            position: absolute; top: 10px; right: 12px; width: 28px; height: 28px;
            border: none; background: transparent; color: #aaa; font-size: 22px;
            cursor: pointer; line-height: 1; border-radius: 6px;
        }
        #session-load-overlay .session-close:hover { color: #fff; background: rgba(255,255,255,0.08); }
        #session-load-overlay .session-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
        #session-load-overlay .session-drop {
            border: 2px dashed rgba(255,255,255,0.28); border-radius: 10px;
            padding: 30px 16px; text-align: center; cursor: pointer;
            transition: all 0.15s ease; background: rgba(255,255,255,0.02);
        }
        #session-load-overlay .session-drop:hover,
        #session-load-overlay .session-drop.hover {
            border-color: #4aa3ff; background: rgba(74,163,255,0.10);
        }
        #session-load-overlay .session-drop-icon { font-size: 26px; opacity: 0.7; margin-bottom: 8px; }
        #session-load-overlay .session-drop-text { font-size: 12.5px; line-height: 1.5; color: #cfd3da; }
        #session-load-overlay .session-msg { min-height: 18px; margin-top: 12px; font-size: 12.5px; text-align: center; }
        #session-load-overlay .session-msg.ok  { color: #57d977; }
        #session-load-overlay .session-msg.err { color: #ff6b6b; }
        `;
        document.head.appendChild(s);
    }

    // ---- public API --------------------------------------------------------

    window.AnimaSession = {
        save: save,
        openLoadDialog: openLoadDialog,
        // exposed for testing
        buildSession: buildSession,
        validateSession: validateSession
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

    console.log('[session] module loaded');
})();
