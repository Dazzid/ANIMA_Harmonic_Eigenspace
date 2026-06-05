// ============================================================================
// ANIMA NAVIGATION MENU
// ----------------------------------------------------------------------------
// A single professional slide-in menu (hamburger top-right) that replaces the
// scattered per-scene top-right buttons. It does NOT re-implement any feature:
// each item delegates to the existing handler — either by .click()-ing the
// (now CSS-hidden) legacy button, or by calling the already-exposed global
// (window.toggleInfo, window.midiController.toggleUI, window.ANIMA.switchScene).
// The body is rebuilt scene-aware every time the panel opens so labels/state
// (e.g. "Switch to Layered View" ↔ "Switch to Full 3D View", grid shown/hidden)
// mirror the live controls.
//
// © 2025 David Dalmazzo. All Rights Reserved.
// ============================================================================

(function () {
    'use strict';

    let toggleBtn, overlay, panel, body, isOpen = false;

    // ---- small helpers -----------------------------------------------------
    // Reuse a legacy button's own click handler (it stays in the DOM, just
    // hidden via menu.css). Returns the element's current text so the menu item
    // can mirror its label/state.
    function clickLegacy(id) {
        const el = document.getElementById(id);
        if (el) el.click();
    }
    function legacyText(id, fallback) {
        const el = document.getElementById(id);
        const t = el ? el.textContent.trim() : '';
        return t || fallback;
    }
    function activeScene() {
        return (window.ANIMA && typeof window.ANIMA.getCurrentScene === 'function')
            ? window.ANIMA.getCurrentScene()
            : null;
    }
    function sceneEnum() {
        return (window.ANIMA && window.ANIMA.Scenes) || { EIGENSPACE: 0, MODALSTUDIO: 1 };
    }

    // ---- item factory ------------------------------------------------------
    // opts: { icon, badge, active, disabled, onClick }
    function makeItem(label, opts) {
        opts = opts || {};
        const btn = document.createElement('button');
        btn.className = 'anima-menu-item'
            + (opts.active ? ' active' : '')
            + (opts.disabled ? ' disabled' : '');

        if (opts.icon) {
            const ic = document.createElement('span');
            ic.className = 'anima-menu-icon';
            ic.textContent = opts.icon;
            btn.appendChild(ic);
        }
        const lab = document.createElement('span');
        lab.className = 'anima-menu-label';
        lab.textContent = label;
        btn.appendChild(lab);

        if (opts.badge) {
            const bd = document.createElement('span');
            bd.className = 'anima-menu-badge';
            bd.textContent = opts.badge;
            btn.appendChild(bd);
        }

        // Keyboard-shortcut hint, rendered as a keycap on the right.
        if (opts.shortcut) {
            const kbd = document.createElement('span');
            kbd.className = 'anima-menu-kbd';
            kbd.textContent = opts.shortcut;
            btn.appendChild(kbd);
        }

        if (!opts.disabled && typeof opts.onClick === 'function') {
            // Launcher pattern: run the item's action, then close the menu.
            btn.addEventListener('click', () => { opts.onClick(); close(); });
        }
        return btn;
    }

    function makeSection(title) {
        const sec = document.createElement('div');
        sec.className = 'anima-menu-section';
        const h = document.createElement('div');
        h.className = 'anima-menu-section-title';
        h.textContent = title;
        sec.appendChild(h);
        return sec;
    }

    // ---- build the scene-aware body ---------------------------------------
    function render() {
        body.innerHTML = '';
        const S = sceneEnum();
        const scene = activeScene();
        const inEigen = scene === S.EIGENSPACE;
        const inModal = scene === S.MODALSTUDIO;

        // ----- SCENES -------------------------------------------------------
        const scenes = makeSection('Scenes');
        scenes.appendChild(makeItem('Eigenspace', {
            icon: '◉', active: inEigen,
            onClick: () => window.ANIMA.switchScene(S.EIGENSPACE)
        }));
        scenes.appendChild(makeItem('Modal Studio', {
            icon: '▦', active: inModal,
            onClick: () => window.ANIMA.switchScene(S.MODALSTUDIO)
        }));
        scenes.appendChild(makeItem('Keyboard Layout', {
            icon: '⌨', active: scene === S.KEYBOARD,
            onClick: () => window.ANIMA.switchScene(S.KEYBOARD)
        }));
        body.appendChild(scenes);

        // ----- OPTIONS (scene-dependent) ------------------------------------
        const options = makeSection('Options');

        // Chord Memory is app-wide — surfaced in every scene. grid-toggle text is
        // the source of truth: "Chord Grid" (show) / "Hide Grid" (hide).
        const gridShown = legacyText('grid-toggle', 'Chord Grid') === 'Hide Grid';
        options.appendChild(makeItem('Memory: Chord Grid', {
            icon: '▤', active: gridShown, shortcut: '⇧M',
            onClick: () => clickLegacy('grid-toggle')
        }));

        if (inEigen) {
            // viz-mode-toggle's own text is the source of truth for the label.
            options.appendChild(makeItem(legacyText('viz-mode-toggle', 'Switch to Layered View'), {
                icon: '◧', shortcut: '⇧L',
                onClick: () => clickLegacy('viz-mode-toggle')
            }));
            // Audio Settings (ADSR) — can be closed via its ✕ button, reopened here.
            const eigenAudio = document.getElementById('eigenspace-audio-gui');
            const eigenAudioShown = !!(eigenAudio && eigenAudio.style.display !== 'none');
            options.appendChild(makeItem(eigenAudioShown ? 'Audio Settings: Hide' : 'Audio Settings: Show', {
                icon: '♪', active: eigenAudioShown,
                onClick: () => {
                    const ag = document.getElementById('eigenspace-audio-gui');
                    if (ag) ag.style.display = ag.style.display === 'none' ? 'block' : 'none';
                }
            }));
        } else if (inModal) {
            // Modal Studio's own controls, surfaced here since #scene-controls is hidden.
            options.appendChild(makeItem(legacyText('scene-label', 'Modal Interchange'), {
                icon: '⇄',
                onClick: () => clickLegacy('scene-toggle')
            }));
            const audioShown = legacyText('audio-label', '').indexOf('Hide') !== -1;
            options.appendChild(makeItem(legacyText('audio-label', 'Audio Settings: Show'), {
                icon: '♪', active: audioShown,
                onClick: () => clickLegacy('audio-toggle')
            }));
        } else if (scene === S.KEYBOARD) {
            // The 53-TET chord selector (incl. the Fixed/Functional toggle) is the
            // floating #chord-panel; the menu just opens/closes it.
            const chordsShown = (() => {
                const cp = document.getElementById('chord-panel');
                return !!(cp && cp.classList.contains('visible'));
            })();
            options.appendChild(makeItem('Chord menu', {
                icon: '▦', active: chordsShown,
                onClick: () => { if (window.toggleChordPanel) window.toggleChordPanel(); }
            }));
            // Shared ADSR (drives the 53-TET synth's envelope/waveform).
            const kbAudioShown = (() => {
                const ag = document.getElementById('keyboard-audio-gui');
                return !!(ag && ag.style.display !== 'none' && ag.style.display !== '');
            })();
            options.appendChild(makeItem(kbAudioShown ? 'Audio Settings: Hide' : 'Audio Settings: Show', {
                icon: '♪', active: kbAudioShown,
                onClick: () => { if (window.toggleKeyboardAudio) window.toggleKeyboardAudio(); }
            }));
        }
        body.appendChild(options);

        // ----- INFO (scenes that have an info overlay) ----------------------
        if (inEigen || inModal) {
            const info = makeSection('Info');
            info.appendChild(makeItem('About this scene', {
                icon: 'ℹ',
                onClick: () => {
                    if (inModal && window.modalStudioInfoOverlay) {
                        window.modalStudioInfoOverlay.toggle();
                    } else if (typeof window.toggleInfo === 'function') {
                        window.toggleInfo();
                    } else {
                        clickLegacy('info-button');
                    }
                }
            }));
            body.appendChild(info);
        }

        // ----- MIDI ---------------------------------------------------------
        const midi = makeSection('MIDI Settings');
        const midiReady = window.midiController && typeof window.midiController.toggleUI === 'function';
        midi.appendChild(makeItem('Open MIDI panel', {
            icon: '🎹',
            badge: midiReady ? null : 'N/A',
            disabled: !midiReady,
            onClick: () => { window.midiController.toggleUI(); }
        }));
        body.appendChild(midi);
    }

    // ---- open / close ------------------------------------------------------
    function open() {
        render();
        isOpen = true;
        toggleBtn.classList.add('open');
        overlay.classList.add('open');
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        toggleBtn.setAttribute('aria-expanded', 'true');
    }
    function close() {
        isOpen = false;
        toggleBtn.classList.remove('open');
        overlay.classList.remove('open');
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }
    function toggle() { isOpen ? close() : open(); }

    // ---- DOM construction --------------------------------------------------
    function build() {
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'anima-menu-toggle';
        toggleBtn.setAttribute('aria-label', 'Menu');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = '<span></span><span></span><span></span>';

        overlay = document.createElement('div');
        overlay.id = 'anima-menu-overlay';

        panel = document.createElement('nav');
        panel.id = 'anima-menu-panel';
        panel.setAttribute('aria-hidden', 'true');
        const title = document.createElement('div');
        title.className = 'anima-menu-title';
        title.textContent = 'Menu';
        body = document.createElement('div');
        body.id = 'anima-menu-body';
        panel.appendChild(title);
        panel.appendChild(body);

        document.body.appendChild(overlay);
        document.body.appendChild(toggleBtn);
        document.body.appendChild(panel);

        toggleBtn.addEventListener('click', toggle);
        overlay.addEventListener('click', close);
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });

        // Debug / programmatic access
        window.ANIMA_MENU = { open, close, toggle, render };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
})();
