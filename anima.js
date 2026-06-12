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
        
        await app.loadJSONData('53_reference_notes.json');
        app.setupReferenceMap();
        app.generateAllModes(p);
        
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

