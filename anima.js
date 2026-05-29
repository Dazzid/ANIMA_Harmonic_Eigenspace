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
    MODALSTUDIO: 1
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
        p.textFont('Source Code Pro');
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

            if (typeof MIDIPianoHandler !== 'undefined') {
                window.midiPianoHandler = new MIDIPianoHandler();
            }
        }, 400);
        
        // Don't call setDark(false) here - it affects the global ADSR from adsr.js
        // Modal Studio components handle their own dark mode via setDarkMode()
        window.app = app;
        window.playNote = (freq) => app.playNote(freq);
    };
    
    // Single p5 loop — delegate to the ACTIVE scene only. When EigenSpace is
    // active its draw() is a no-op, so the Modal Studio app is not rendered.
    p.draw = () => {
        if (SceneManager.active) SceneManager.active.draw(p);
    };

    p.mousePressed = () => {
        if (SceneManager.active) SceneManager.active.mousePressed(p.mouseX, p.mouseY);
    };

    p.mouseDragged = () => {
        if (SceneManager.active) SceneManager.active.mouseDragged(p.mouseX, p.mouseY);
    };

    p.mouseReleased = () => {
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

