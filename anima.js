// ============================================================================
// SCENE MANAGEMENT - MUST BE FIRST (used throughout the code)
// ============================================================================
// © 2025 David Dalmazzo.All Rights Reserved.

// This code and associated research materials are proprietary and confidential.This work is part of the ANIMA MSCA Postdoctoral Fellowship(Project ID: 101203318) funded by the European Union's Horizon Europe program.
// Usage Terms:

// Academic Citation: Permitted with proper attribution to the author and project
// Non - Commercial Research: Contact for collaboration inquiries
// Commercial Use: Strictly prohibited without explicit written permission
// Code Distribution: Not permitted without authorization
// Unauthorized copying, distribution, modification, or commercial use of this software, algorithms, or associated methods is strictly prohibited.

// Attribution

// When referencing this work in academic publications, please cite:

// Dalmazzo, D. (2025).ANIMA Harmonic Eigenspace: 4D Psychoacoustic
// Dissonance Visualization for Microtonal Harmony.MSCA Project 101203318.
// ============================================================================
const Scenes = {
    EIGENSPACE: 0,
    MODALSTUDIO: 1,
    KEYBOARD: 2
};

let currentScene = Scenes.EIGENSPACE;

// ============================================================================
// SCENE CONTRACT + CENTRAL HANDLER (router)
// Each scene (EigenspaceScene in eigenspace.js, ModalStudioScene in
// modal_studio_app.js) implements: enter / exit / draw / mousePressed /
// mouseDragged / mouseReleased / keyPressed / resize. The single p5 sketch and
// the global listeners delegate to SceneManager.active ONLY — an inactive scene
// is never drawn or sent events. Add a scene: implement the shape + register it.
// ============================================================================
const SceneManager = {
    scenes: {},
    active: null,

    register(name, scene) { scene.name = name; this.scenes[name] = scene; },

    switchTo(name) {
        const next = this.scenes[name];
        if (!next) {
            console.warn('[ANIMA] Unknown scene:', name);
            return;
        }
        if (this.active && this.active.exit) this.active.exit();
        this.active = next;
        currentScene = name; // keep global in sync (OfApp guards, launchpad, listeners read it)

        // Body scene class is mutually exclusive: clear every scene's class, then
        // set the active one. (CSS keys off these, e.g. disabling EigenSpace pointer
        // events while Modal Studio is active — both classes present would freeze it.)
        Object.values(this.scenes).forEach(s => {
            if (s.bodyClass) document.body.classList.remove(s.bodyClass);
        });
        if (next.bodyClass) document.body.classList.add(next.bodyClass);

        if (next.enter) next.enter();
    },
};

SceneManager.register(Scenes.EIGENSPACE, EigenspaceScene);
SceneManager.register(Scenes.MODALSTUDIO, ModalStudioScene);
SceneManager.register(Scenes.KEYBOARD, KeyboardScene);

// Thin wrapper kept for existing callers (nav buttons, window.ANIMA, init).
function switchScene(newScene) {
    if (window.Anima) window.Anima.track('scene_switch', { to: newScene });
    SceneManager.switchTo(newScene);
}

// ============================================================================
// MOUSE EVENT HANDLERS (C++ pattern with switch statements)
// Ensures mouse events are ONLY active for the current scene
// ============================================================================

// Global mouse state tracking
let mouseIsPressed = false;

// Intercept ALL mouse events and route based on current scene
document.addEventListener('mousedown', function(e) {
    mouseIsPressed = true;
    
    switch (currentScene) {
        case Scenes.EIGENSPACE:
            // EigenSpace: Plotly handles its own clicks via plotDiv.on('plotly_click')
            // p5 ADSR (adsr.js) has its own global mousePressed() that will run automatically
            // Don't interfere - let Plotly and p5 manage the event
            break;
            
        case Scenes.MODALSTUDIO:
            // Modal Studio: ONLY process if we're in this scene
            // p5 sketch will call window.app.mousePressed() via its own mousePressed()
            break;
    }
});

document.addEventListener('mousemove', function(e) {
    if (!mouseIsPressed) return;
    
    switch (currentScene) {
        case Scenes.EIGENSPACE:
            // EigenSpace: p5 ADSR (adsr.js) has its own global mouseDragged()
            break;
            
        case Scenes.MODALSTUDIO:
            // Modal Studio: p5 sketch handles via mouseDragged()
            break;
    }
});

document.addEventListener('mouseup', function(e) {
    mouseIsPressed = false;
    
    switch (currentScene) {
        case Scenes.EIGENSPACE:
            // EigenSpace: p5 ADSR (adsr.js) has its own global mouseReleased()
            break;
            
        case Scenes.MODALSTUDIO:
            // Modal Studio: p5 sketch handles via mouseReleased()
            break;
    }
});

// ============================================================================
// KEYBOARD HANDLER (C++ pattern with switch statements)
// ============================================================================

// Global scene shortcuts: Shift+1 / Shift+2 / Shift+3 → EigenSpace / Modal Studio
// / Keyboard. Capture phase + stopImmediatePropagation so it fires BEFORE the
// scenes' own keydown listeners (notably KL, where 1/2/3 are hex keys). Plain
// digits still reach the scenes.
const SCENE_HOTKEYS = { Digit1: Scenes.EIGENSPACE, Digit2: Scenes.MODALSTUDIO, Digit3: Scenes.KEYBOARD };

// Toggle the ACTIVE scene's Audio Settings (ADSR) panel. Each scene shows the
// shared ADSR canvas in its own container, so the toggle differs per scene.
function toggleAudioSettings() {
    switch (currentScene) {
        case Scenes.EIGENSPACE: {
            const ag = document.getElementById('eigenspace-audio-gui');
            if (ag) ag.style.display = (!ag.style.display || ag.style.display === 'none') ? 'block' : 'none';
            break;
        }
        case Scenes.MODALSTUDIO: {
            const btn = document.getElementById('audio-toggle'); // its handler reparents the ADSR canvas
            if (btn) btn.click();
            break;
        }
        case Scenes.KEYBOARD:
            if (typeof window.toggleKeyboardAudio === 'function') window.toggleKeyboardAudio();
            break;
    }
}
window.toggleAudioSettings = toggleAudioSettings;

window.addEventListener('keydown', function(e) {
    if (!e.shiftKey) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;

    // Shift+A → toggle the active scene's Audio Settings panel.
    if (e.code === 'KeyA') {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleAudioSettings();
        return;
    }

    const target = SCENE_HOTKEYS[e.code];
    if (target === undefined) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    switchScene(target);
}, true); // capture phase — beats the scenes' bubble-phase handlers

window.addEventListener('keydown', function(e) {
    // Delegate to the active scene only.
    if (SceneManager.active && SceneManager.active.keyPressed) {
        SceneManager.active.keyPressed(e);
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('[ANIMA] Initializing unified application...');
    
    // Wire up navigation buttons
    const eigenBtn = document.getElementById('nav-to-eigenspace');
    const modalBtn = document.getElementById('nav-to-modalstudio');
    
    if (eigenBtn) {
        eigenBtn.addEventListener('click', () => switchScene(Scenes.EIGENSPACE));
    }
    if (modalBtn) {
        modalBtn.addEventListener('click', () => switchScene(Scenes.MODALSTUDIO));
    }
    
    // Dynamically position Modal Studio button based on viz-mode-toggle width
    function updateModalStudioButtonPosition() {
        const vizToggle = document.getElementById('viz-mode-toggle');
        const modalStudioBtn = document.getElementById('nav-to-modalstudio');
        if (vizToggle && modalStudioBtn) {
            const vizToggleRect = vizToggle.getBoundingClientRect();
            const vizToggleRight = window.innerWidth - vizToggleRect.left;
            modalStudioBtn.style.right = (vizToggleRight + 1) + 'px'; // 1px gap
        }
    }
    
    // Update position on load and when toggle button text changes
    // Delay to avoid conflicts with initial page load animations
    setTimeout(updateModalStudioButtonPosition, 100);
    const vizToggle = document.getElementById('viz-mode-toggle');
    if (vizToggle) {
        const observer = new MutationObserver(() => {
            setTimeout(updateModalStudioButtonPosition, 50);
        });
        observer.observe(vizToggle, { childList: true, characterData: true, subtree: true });
    }
    
    // Start with EigenSpace scene
    switchScene(Scenes.EIGENSPACE);
    
    // Debug: Check if buttons exist
    const vizBtn = document.getElementById('viz-mode-toggle');
    const navModalBtn = document.getElementById('nav-to-modalstudio');
    console.log('viz-mode-toggle exists:', !!vizBtn);
    console.log('nav-to-modalstudio exists:', !!navModalBtn);
    
    console.log('[ANIMA] Ready! Press 1 for EigenSpace, 2 for Modal Studio');
});

// Expose globally for debugging
window.ANIMA = {
    switchScene: switchScene,
    getCurrentScene: () => currentScene,
    Scenes: Scenes
};

// ============================================================================
// EXTERNAL AUDIO ENTRY POINT
// ----------------------------------------------------------------------------
// window.playNote is the single shared entry used by external note triggers —
// key_map.js (computer keyboard) and midi_piano.js — in BOTH scenes. It routes
// to Modal Studio's audio engine (app.playNote), which is the established synth
// for these triggers. EigenSpace's own 3D point-clicks use its local playChord()
// in eigenspace.js and are unaffected.
//
// Defined ONCE here, call-time guarded on window.app. Previously eigenspace.js
// set window.playNote and the p5 setup overwrote it — routing depended on script
// load order. This single definition removes that race with no audible change.
// ============================================================================
window.playNote = (freq) => (window.app ? window.app.playNote(freq) : undefined);

// ============================================================================
// APP-WIDE CHORD MEMORY GLUE
// ----------------------------------------------------------------------------
// The Chord Memory grid (grid.js) is a global, scene-independent component. A
// stored cell holds the chord as absolute frequencies (Hz), so ANY scene can
// replay it. These two routers make capture + recall work in every scene:
//
//   window.playChordFrequencies(freqs) — play an absolute-Hz chord through the
//       ACTIVE scene's own synth (EigenSpace / Modal Studio / Keyboard).
//   window.captureChord(descriptor)    — record a just-played chord as the
//       "last chord" and, if the grid panel is open, arm it for storage. This
//       is the generalization of EigenSpace's inline lastClickedChord block.
// ============================================================================
window.playChordFrequencies = function (freqs) {
    if (!Array.isArray(freqs) || freqs.length === 0) return;
    if (typeof gridMuted !== 'undefined' && gridMuted) return; // grid's mute toggle
    switch (currentScene) {
        case Scenes.EIGENSPACE:
            if (typeof window.eigenspacePlayFrequencies === 'function') {
                window.eigenspacePlayFrequencies(freqs);
            }
            break;
        case Scenes.MODALSTUDIO:
            if (window.app && window.app.audioEngine) {
                window.app.audioEngine.playChord(freqs);
            }
            break;
        case Scenes.KEYBOARD:
            if (typeof window.keyboardPlayChord === 'function') {
                window.keyboardPlayChord(freqs);
            }
            break;
    }

    // Also drive the external MIDI device (e.g. Ableton). Chord Memory must reach the DAW
    // in EVERY scene, not just the MS grid. The per-scene handlers above are audio-only
    // (no MIDI), so there's no double-trigger. Notes sustain until the next chord — same as
    // the MS grid — and stopChordNotes() clears the previous chord first.
    if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
        window.midiController.stopChordNotes();
        window.midiController.playChord(freqs, 5);
    }
};

// midi_piano.js broadcasts the currently-held MIDI notes (exact Hz, in the active
// scale's tuning) here on a global interval, in every scene. chord_visualization.js
// (ES) defined the original — wrap it so the notes reach whichever Frequency Spectrum
// is on screen: the ES ChordVisualization or the MS strip (§6.5). Keeps micro-tuning
// (53-TET vs 12-TET) visible from the MIDI keyboard in BOTH scenes.
const _esSetMIDIActiveNotes = window.setMIDIActiveNotes;
window.setMIDIActiveNotes = function (notes) {
    switch (currentScene) {
        case Scenes.EIGENSPACE:
            if (typeof _esSetMIDIActiveNotes === 'function') _esSetMIDIActiveNotes(notes);
            break;
        case Scenes.MODALSTUDIO:
            if (window.app && window.app.msSpectrumInitialized) {
                window.app.msSpectrum.setMIDIActiveNotes(notes);
            }
            break;
    }
};

// key_map.js maps the WHOLE computer keyboard to the active scale's exact piano
// frequencies and broadcasts those markers here. Route them scene-aware so the MS
// Frequency Spectrum (§6.5) shows the mapped keys at their exact Hz, like ES.
const _esSetKeyboardMappedScale = window.setKeyboardMappedScale;
window.setKeyboardMappedScale = function (frequencies, color) {
    switch (currentScene) {
        case Scenes.EIGENSPACE:
            if (typeof _esSetKeyboardMappedScale === 'function') _esSetKeyboardMappedScale(frequencies, color);
            break;
        case Scenes.MODALSTUDIO:
            if (window.app && window.app.msSpectrumInitialized) {
                window.app.msSpectrum.setKeyboardMappedScale(frequencies, color);
            }
            break;
    }
};

window.captureChord = function (descriptor) {
    if (!descriptor || !Array.isArray(descriptor.frequencies) || descriptor.frequencies.length === 0) {
        return;
    }
    // Normalize the scene-agnostic fields; scene-specific extras (alpha/beta/...)
    // ride along untouched for EigenSpace reconstruction.
    descriptor.root = descriptor.root ?? descriptor.frequencies[0];
    descriptor.sourceScene = descriptor.sourceScene ?? currentScene;
    descriptor.chordName = descriptor.chordName ?? null;
    descriptor.cellColor = descriptor.cellColor ?? null;

    window.lastClickedChord = descriptor;

    // If the grid panel is open, arm it so the user can click a cell to store now.
    try {
        const container = document.getElementById('grid-container');
        if (container && container.style.display !== 'none' &&
            typeof gridSketch !== 'undefined' && gridSketch && gridSketch.getGrid) {
            const grid = gridSketch.getGrid();
            if (grid && typeof grid.prepareToStore === 'function') {
                grid.prepareToStore(descriptor);
            }
        }
    } catch (e) {
        // Non-fatal: grid may not be initialized yet
    }
};

// ============================================================================
// P5.JS SKETCH INITIALIZATION (from modal_studio_sketch.js)
// ============================================================================

const sketch = (p) => {
    let app;
    const MIN_WIDTH = 1330;
    const MIN_HEIGHT = 1000;
    
    p.setup = async () => {
        const w = Math.max(p.windowWidth, MIN_WIDTH);
        const h = Math.max(p.windowHeight, MIN_HEIGHT);
        p.createCanvas(w, h);
        p.textFont('Fira Code');
        app = new OfApp();
        
        // Scene toggle button handler
        let isModalScene = false;
        const toggleButton = document.getElementById('scene-toggle');
        const sceneLabel = document.getElementById('scene-label');
        const audioToggle = document.getElementById('audio-toggle');
        const audioLabel = document.getElementById('audio-label');
        const audioGuiContainer = document.getElementById('modalstudio-audio-gui');
        sceneLabel.textContent = 'Modal Scene';
        
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                isModalScene = !isModalScene;
                if (isModalScene) {
                    app.setScene('chord');
                    sceneLabel.textContent = 'Modal Interchange';
                } else {
                    app.setScene('grid');
                    sceneLabel.textContent = 'Modal Scene';
                }
            });
        }
        
        if (audioGuiContainer) {
            audioGuiContainer.style.display = 'none';
        }
        
        if (audioToggle && audioLabel && audioGuiContainer) {
            audioToggle.addEventListener('click', () => {
                if (audioGuiContainer.style.display === 'none') {
                    // Show ADSR in Modal Studio
                    audioGuiContainer.style.display = 'block';
                    audioLabel.textContent = 'Audio Settings: Hide';
                    // Reparent ADSR canvas to Modal Studio container
                    if (window.adsrCanvas) {
                        window.adsrCanvas.parent('modalstudio-audio-gui');
                    }
                    // Set light mode for Modal Studio
                    if (typeof setDark === 'function') {
                        setDark(false);
                    }
                    // Mark that ADSR is controlling Modal Studio audio
                    window.adsrCurrentScene = 'modalstudio';
                } else {
                    // Hide ADSR in Modal Studio (stays hidden until button clicked again)
                    audioGuiContainer.style.display = 'none';
                    audioLabel.textContent = 'Audio Settings: Show';
                    // Keep ADSR in Modal Studio container but hidden
                    // No need to reparent back to EigenSpace
                }
            });
        }
        
        await app.loadJSONData(window.Temperament.active.referenceFile);
        app.setupReferenceMap();
        app.generateAllModes(p);

        // Dev/test hook (Phase 5 will wrap this in the editor toggle + full reset): switch the MS
        // temperament at runtime — reloads the reference table, forces the editors/grid to re-init,
        // and regenerates the modes from the active generator. Try `setMSTemperament(31)` in console.
        window.setMSTemperament = async function (id) {
            const t = window.Temperament.setActive(id);
            await app.loadJSONData(t.referenceFile);
            app.setupReferenceMap();
            // Refresh the generator from the active temperament (was stale at the 53 default
            // [9,9,4,9,9,9,4]; the editor lays out setIntervals(interModel) in an N-step octave,
            // so a 53-sum scale in a 31 wheel broke the nodes/lines/inversion wheel).
            app.interModel = [...t.interModel];
            app.starting_note = t.startingNote;   // C base differs per temperament (53:-40, 31:-23)
            // Full reset (D1): recreate the editors + grid so they re-read N (wheel resolution)
            // in their constructors and drop stale state from the previous temperament (whose
            // step indices map to different pitches here). Then regenerate modes from the
            // active generator.
            // First tear down the outgoing VoicingEditor's body-level dropdown — it's appended
            // to document.body, so replacing the editor would otherwise orphan it (a "Voicing
            // types" button stuck visible across ES/KL). See VoicingEditor.disposeMenuDom.
            if (app.voicingEditor && typeof app.voicingEditor.disposeMenuDom === 'function') {
                app.voicingEditor.disposeMenuDom();
            }
            app.scaleEditor = new ScaleEditor();
            app.voicingEditor = new VoicingEditor();
            app.grid = new Grid();
            app.scaleEditorInitialized = false;
            app.voicingEditorInitialized = false;
            app.gridInitialized = false;
            app.draggingChordsInitialized = false;  // rebuild the palette too — else dragged
                                                    // chords keep 53-TET refs (3rd at ~17 →
                                                    // unclassified in 31 → bare "C" column)
            app.selectedChord = null;
            app.selectedMode = null;
            app.generateAllModes(p);
            // D5 (shared temperament): flip the KL hex keyboard to the same tuning so MS
            // and KL stay in sync — rebuilds its layout, reference table, and chord menu.
            if (typeof window.kbRebuildForTemperament === 'function') {
                try { window.kbRebuildForTemperament(); }
                catch (e) { console.warn('[KL] rebuild on temperament switch failed', e); }
            }
            console.log(`🎛️ MS temperament → ${t.name} (${t.referenceFile})`);
            // Diagnostic for the chord-octave issue: dump a sample chord's note references.
            try {
                const m = app.modes && app.modes[0];
                if (m && m.chords) {
                    console.log('[chord names]', m.chords.slice(0, 7).map(ch => ch.quality || '(unnamed)').join('  |  '));
                    const c = m.chords[0];
                    if (c) console.log('[chord0]', '| voicing:', (c.noteVoicing || []).join(','),
                        '| startingNote:', app.starting_note);
                }
            } catch (e) { console.warn('[sample chord] diag failed', e); }
            return t.name;
        };
        // The temperament toggle now lives in the menu under OPTIONS (Modal Studio scene),
        // labelled by its TARGET ("Switch to 31-TET" / "Switch to 53-TET"). See menu.js.

        // Phase 5a — per-temperament session swap. Each tuning keeps its own modal grid in
        // localStorage; switching parks the current one and brings the other's back, so flipping
        // 53⇄31 no longer silently discards work (no confirmation dialog — just state that follows
        // you). The grid is what setMSTemperament rebuilds/wipes; Chord Memory is absolute Hz and
        // already survives a switch, so it's left shared. localStorage (not a host tmp file — a
        // browser can't write one silently) also makes the parked grids survive a page reload.
        const TET_GRID_KEY = (id) => 'anima_ms_grid_' + id;
        window.switchTemperamentWithSwap = async function (nextId) {
            if (!window.Temperament || typeof window.setMSTemperament !== 'function') return;
            const curId = window.Temperament.active.id;
            if (curId === nextId) return;

            if (window.Anima) window.Anima.track('temperament_switch', { from: curId, to: nextId });

            // 1) Park the CURRENT tuning's modal grid — only when it actually holds data, so a
            //    rapid double-switch (grid not yet re-shown → getSession empty) can't wipe a stash.
            try {
                if (window.app && typeof window.app.getSession === 'function') {
                    const ms = window.app.getSession();
                    if (ms && Array.isArray(ms.grid) && ms.grid.length > 0) {
                        localStorage.setItem(TET_GRID_KEY(curId), JSON.stringify(ms));
                    }
                }
            } catch (e) { console.warn('[tet-swap] park failed', e); }

            // 2) Queue the target tuning's parked grid BEFORE the rebuild. setMSTemperament resets
            //    the grid and then calls generateAllModes(), which re-initializes it AND runs the
            //    restore hook — all synchronously inside the await. If we set the pending grid AFTER
            //    the await (as before), the hook had already run with nothing queued, so the grid
            //    came back empty and the chords stayed erased. Setting it first lets that same
            //    re-init restore it. (setActive(nextId) runs early in setMSTemperament, so the hook's
            //    id check matches.)
            try {
                const raw = localStorage.getItem(TET_GRID_KEY(nextId));
                window.__tetPendingGrid = raw ? { id: nextId, ms: JSON.parse(raw) } : null;
            } catch (e) { window.__tetPendingGrid = null; console.warn('[tet-swap] restore-queue failed', e); }

            // 3) Flip + full rebuild (resets the modal grid, then the hook restores the parked one).
            await window.setMSTemperament(nextId);

            // 4) Safety net: if the grid wasn't ready when the hook ran, apply the parked grid now
            //    that the rebuild has finished (gridInitialized is true post-generateAllModes).
            if (window.__tetPendingGrid && window.__tetPendingGrid.id === nextId) {
                try {
                    if (window.app && window.app.applySession(window.__tetPendingGrid.ms)) {
                        window.__tetPendingGrid = null;
                    }
                } catch (e) { console.warn('[tet-swap] post-rebuild restore failed', e); }
            }
        };

        // Initialize audio on first click
        document.addEventListener('click', async () => {
            if (!app.audioEngine.audioInitialized) {
                await app.audioEngine.initAudio();
                console.log('🔊 Audio system ready');
            }
        }, { once: true });
        
        // Initialize MIDI controller
        setTimeout(async () => {
            if (typeof MIDIController !== 'undefined') {
                window.midiController = new MIDIController();
                const initialized = await window.midiController.initialize();
                if (initialized) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    console.log('🎹 MIDI Controller ready');
                    console.log('Available devices:', window.midiController.getOutputDevices());
                    
                    // Modal Studio MIDI button (already in HTML with id="modalstudio-midi-toggle")
                    const midiButton = document.getElementById('modalstudio-midi-toggle');
                    if (midiButton) {
                        midiButton.style.display = 'flex';
                        midiButton.addEventListener('click', () => {
                            window.midiController.toggleUI();
                        });
                    }

                    // Initialize Launchpad Pro MK3 if not already connected
                    if (window.launchpadHandler && !window.launchpadHandler.connected) {
                        window.launchpadHandler.initialize();
                    }
                }
            }

            // Start the MIDI Piano once at launch (the handler instance comes
            // from midi_piano.js module scope): initialize() runs a ONE-TIME
            // input check and auto-enables when a keyboard is already connected
            // — no trip to MIDI Settings just to click "Enabled". Guarded on the
            // controller's midiAccess so this never fires its own browser
            // permission prompt; without it, the panel-open path still works.
            if (window.midiPianoHandler && !window.midiPianoHandler.midiAccess
                && window.midiController && window.midiController.midiAccess) {
                window.midiPianoHandler.initialize();
            }
        }, 400);
        
        // Don't call setDark(false) here - it affects the global ADSR from adsr.js
        // Modal Studio components handle their own dark mode via setDarkMode()
        window.app = app;
        // window.playNote is defined once at module scope (see EXTERNAL AUDIO
        // ENTRY POINT above) and routes through window.app — no need to set it here.
    };
    
    // Single p5 loop — delegate to the ACTIVE scene only. When EigenSpace is
    // active its draw() is a no-op, so the Modal Studio app is not rendered.
    p.draw = () => {
        if (SceneManager.active) SceneManager.active.draw(p);
    };

    // The Chord Memory grid (grid.js) is an app-wide overlay with its own p5
    // instance handling its clicks. p5's main-sketch mouse callbacks fire on ANY
    // window press, so without this guard a click on the grid panel would ALSO
    // reach the active scene underneath (e.g. play a stray Modal Studio chord).
    const pointerOverChordGrid = () => {
        const c = document.getElementById('grid-container');
        if (!c || c.style.display === 'none') return false;
        const r = c.getBoundingClientRect();
        return p.mouseX >= r.left && p.mouseX <= r.right &&
               p.mouseY >= r.top && p.mouseY <= r.bottom;
    };

    p.mousePressed = () => {
        if (pointerOverChordGrid()) return;
        if (SceneManager.active) SceneManager.active.mousePressed(p.mouseX, p.mouseY);
    };

    p.mouseDragged = () => {
        if (pointerOverChordGrid()) return;
        if (SceneManager.active) SceneManager.active.mouseDragged(p.mouseX, p.mouseY);
    };

    p.mouseReleased = () => {
        if (pointerOverChordGrid()) return;
        if (SceneManager.active) SceneManager.active.mouseReleased(p.mouseX, p.mouseY);
    };

    p.windowResized = () => {
        const w = Math.max(p.windowWidth, MIN_WIDTH);
        const h = Math.max(p.windowHeight, MIN_HEIGHT);
        p.resizeCanvas(w, h);
        if (SceneManager.active) SceneManager.active.resize(p);
    };
};

// Initialize p5 sketch
new p5(sketch, 'canvas-container');

