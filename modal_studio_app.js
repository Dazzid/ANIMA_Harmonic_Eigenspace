// ============================================================================
// MODAL STUDIO APP
// Port of C++ ofApp.cpp: grid + chord scenes, dragging chords, voicing/scale
// editors. Hosts the OfApp class and the ModalStudioScene contract object.
// Split out of anima.js (see STRATEGY §6.1). Loads AFTER eigenspace.js and
// BEFORE anima.js. References Scenes/currentScene/window.app at runtime only.
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

// ofApp.js - Direct port from C++ ofApp.cpp
class OfApp {
    constructor() {
        // C++ ofApp.h member variables
        this.fiftyThree = [];
        this.referenceMap = new Map();
        this.modes = [];

        // Constants from C++ ofApp.h lines 100-115
        this.SCALE_SIZE = 7;
        this.size_x = 100;
        this.size_y = 52;
        this.round = 11;

        this.interModel = [9, 9, 4, 9, 9, 9, 4];
        this.starting_note = -40; // C++ ofApp.h line 154
        this.numOctaves = 5; // C++ ofApp.h line 155

        //Modes positioning
        this.modeXStart = 10;
        this.modeYOffset = 35;

        // Colors from C++ ofApp.h lines 122-130
        this.darkBackground = [230, 229, 228]; // Changed from [26, 25, 24]
        this.textColor = [0, 0, 0]; // Changed to black for light background
        this.buttonColor = [230, 230, 230];

        this.MODE_NAMES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'];

        this.scaleEditorY = 10;
        this.scaleEditorX = 0;

        // Audio engine
        this.audioEngine = new AudioEngine();

        // Scale Editor
        this.scaleEditor = new ScaleEditor();
        this.scaleEditorInitialized = false;

        // Voicing Editor (C++ ofApp.h - VoicingEditor member)
        this.voicingEditor = new VoicingEditor();
        this.voicingEditorInitialized = false;

        // Grid (C++ ofApp.h - Grid member)
        this.grid = new Grid();
        this.gridInitialized = false;

        // DraggingChords (C++ ofApp.h - DraggingChords member)
        this.draggingChords = null;
        this.draggingChordsInitialized = false;

        // Scene management
        this.currentScene = 'grid'; // 'chord' or 'grid'

        // Track selected chord for VoicingEditor updates (C++ Grid.cpp selectedCellRow/Col)
        this.selectedChord = null;
        this.selectedMode = null;
    }

    // C++: void ofApp::loadJSONData(string filename)
    async loadJSONData(filename) {
        try {
            const response = await fetch('dataset/' + filename);
            const data = await response.json();
            this.fiftyThree = data.notes;
            console.log(`✓ Loaded ${this.fiftyThree.length} notes`);
            return true;
        } catch (error) {
            console.error('Error loading JSON:', error);
            return false;
        }
    }

    // C++: void ofApp::setupReferenceMap()
    setupReferenceMap() {
        this.referenceMap.clear();
        for (let i = 0; i < this.fiftyThree.length; i++) {
            this.referenceMap.set(this.fiftyThree[i].reference, i);
        }
        console.log(`✓ Reference map: ${this.referenceMap.size} entries`);
    }

    // C++: FT_Scale* ofApp::findScaleByReference(int referenceNumber)
    findScaleByReference(referenceNumber) {
        const index = this.referenceMap.get(referenceNumber);
        if (index !== undefined) {
            return this.fiftyThree[index];
        }
        return null;
    }

    // Play a single note (for MIDI Piano input)
    playNote(frequency) {
        // Send MIDI first (independent of audio mute)
        let noteId = null;
        if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
            noteId = window.midiController.playSingleNote(frequency);
        }

        // Play audio (audioEngine.playNote checks mute state internally)
        this.audioEngine.playNote(frequency);

        return noteId;
    }

    // Record a just-played chord into the app-wide Chord Memory (grid.js). The
    // chord is stored as absolute frequencies so it can be recalled in any scene;
    // `color` (the chord's own MS color) tints the CM cell. Accepts an [r,g,b]
    // array or a p5 color and normalizes to [r,g,b].
    captureChordToMemory(frequencies, name, color) {
        if (typeof window.captureChord !== 'function') return;
        if (!Array.isArray(frequencies) || frequencies.length === 0) return;
        let cellColor = null;
        if (color) {
            if (Array.isArray(color) && color.length >= 3) {
                cellColor = [color[0], color[1], color[2]];
            } else if (color.levels && color.levels.length >= 3) {
                cellColor = [color.levels[0], color.levels[1], color.levels[2]];
            }
        }
        // getChordQuality() returns a {note, quality, ...} object, not a string;
        // CM draws chordName as text, so reduce it to a readable label (e.g. "maj7").
        let chordName = null;
        if (typeof name === 'string') {
            chordName = name;
        } else if (name && typeof name === 'object') {
            chordName = name.quality || (name.note ? (name.note + (name.quality || '')) : null);
        }
        window.captureChord({
            frequencies: [...frequencies],
            root: frequencies[0],
            chordName: chordName,
            cellColor: cellColor,
            sourceScene: (window.ANIMA && window.ANIMA.Scenes) ? window.ANIMA.Scenes.MODALSTUDIO : 1
        });
    }

    // ---- Session save/load (Modal Interchange grid; see STRATEGY §6) --------
    // Save/restore the entire 8×8 grid directly — no Scale Editor, no recalc.
    getSession() {
        if (!this.gridInitialized || !this.grid) return { grid: [] };
        return { grid: this.grid.serializeAll() };
    }

    applySession(ms) {
        if (!ms || !Array.isArray(ms.grid)) return false;
        if (!this.gridInitialized || !this.grid) return false; // caller may stash + retry
        this.grid.restoreAll(ms.grid);
        return true;
    }

    // C++: vector<string> ofApp::getNames(const vector<int> &references)
    getNames(references) {
        const names = [];
        for (let i = 0; i < references.length; i++) {
            const scale = this.findScaleByReference(references[i]);
            names.push(scale ? scale.noteName : '?');
        }
        return names;
    }

    // C++: vector<int> ofApp::generateMode(const vector<int> &model, int rotation)
    generateMode(model, rotation) {
        const rotated = [];
        for (let i = 0; i < model.length; i++) {
            rotated.push(model[(i + rotation) % model.length]);
        }
        return rotated;
    }

    // C++: vector<int> ofApp::accumulateIntervals(const vector<int> &intervals, int noteRef, int numOctaves)
    accumulateIntervals(intervals, noteRef, numOctaves) {
        const totalSteps = intervals.length * numOctaves + 1;
        const accumulated = new Array(totalSteps);
        accumulated[0] = noteRef;

        let currentStep = 0;
        for (let octave = 0; octave < numOctaves; octave++) {
            for (let i = 0; i < intervals.length; i++) {
                currentStep++;
                accumulated[currentStep] = accumulated[currentStep - 1] + intervals[i];
            }
        }

        return accumulated;
    }

    // C++: void ofApp::generateAllModes()
    generateAllModes(p) {
        this.p = p;
        this.generateModeGroup(this.interModel, this.modeXStart, this.modeYOffset, this.starting_note, this.numOctaves);

        // Initialize gradient manager
        if (!window.shaderManager) {
            window.shaderManager = new ShaderManager();
            window.shaderManager.initShaders(p);
        }

        // Initialize Scale Editor after JSON loaded
        if (!this.scaleEditorInitialized && this.fiftyThree.length > 0) {
            const radius = this.scaleEditor.outerRingSize;
            const initialNodes = 7;
            // Position Scale Editor: 10px from top and right borders
            // Frame width = 2 * (radius * scaleEditor.factorSize)
            const frameWidth = 2 * (radius * this.scaleEditor.factorSize);
            const canvasWidth = this.p.width; // Use canvas width instead of window width
            this.scaleEditorX = Math.max(10, canvasWidth - frameWidth - 24);

            const topLeft = { x: this.scaleEditorX, y: this.scaleEditorY };

            // console.log('🔧 Scale Editor Initial Calc:', {
            //     canvasWidth,
            //     frameWidth,
            //     this.scaleEditorX,
            //     topLeft,
            //     'p.windowWidth': this.p.windowWidth
            // });

            this.scaleEditor.setup(radius, initialNodes, topLeft, this.fiftyThree);
            this.scaleEditor.setIntervals(this.interModel);

            // C++ ofApp.cpp line 110: Connect callback to update modes when scale changes
            this.scaleEditor.onConfigurationChanged = (newConfig) => {
                this.onEditorConfigChanged(newConfig);
            };

            // C++ doesn't use callbacks - inversion is applied in mouseReleased()
            // See ofApp::mouseReleased() lines 630-644

            this.scaleEditor.setDarkMode(false); // Light mode
            this.scaleEditorInitialized = true;

            // Ensure position is correct after initialization
            this.updatePositions(p);

            console.log('✅ Scale Editor initialized');

            // C++ ofApp.cpp line 30: Initialize VoicingEditor
            if (!this.voicingEditorInitialized) {
                const voicingRadius = this.scaleEditor.outerRingSize; // Match ScaleEditor size
                // Position VoicingEditor 10px below ScaleEditor
                // ScaleEditor frame height = 2 * (radius * factorSize)
                const voicingEditorX = this.scaleEditorX;
                const voicingEditorY = this.scaleEditorY + (2 * radius * this.scaleEditor.factorSize) + 1;
                const voicingTopLeft = { x: voicingEditorX, y: voicingEditorY };
                console.log('Initializing Voicing Editor at', voicingTopLeft);

                // Setup with radius, position, and note data
                this.voicingEditor.setup(voicingRadius, voicingTopLeft, this.fiftyThree);
                this.voicingEditor.setDarkMode(false); // Match ScaleEditor mode

                // C++ ofApp.cpp line 72: Connect callback (Grid.cpp updateSelectedChordVoicing)
                this.voicingEditor.onVoicingChanged = (newVoicing) => {
                    // C++ ofApp.cpp lines 93-102
                    switch (this.currentScene) {
                        case 'grid':
                            if (this.gridInitialized) {
                                this.grid.updateSelectedChordVoicing(newVoicing);
                            }
                            break;
                        case 'chord':
                            // Update all modes - each checks its own selectedChordIndex
                            for (let i = 0; i < this.modes.length; i++) {
                                this.modes[i].updateSelectedChordVoicing(newVoicing);
                            }
                            break;
                    }
                };

                this.voicingEditorInitialized = true;
                console.log('✅ Voicing Editor initialized');
            }

            // C++ ofApp.cpp line 28: Initialize DraggingChords
            if (!this.draggingChordsInitialized) {
                const draggingX = 10;
                const draggingY = (this.size_y * 8) + (10 * 8) + this.modeYOffset; // Below scene buttons

                this.draggingChords = new DraggingChords();
                this.draggingChords.setup(draggingX, draggingY, this.size_x, this.size_y, this.modes);
                this.draggingChords.setDarkMode(false);
                this.draggingChords.setRound(this.round);

                // Set up callbacks
                this.draggingChords.onCleanup = () => {
                    if (this.gridInitialized) {
                        this.grid.cleanAllChords();
                    }
                };

                this.draggingChordsInitialized = true;
                console.log('✅ DraggingChords initialized');
            }

            // C++ ofApp.cpp line 28: Initialize Grid
            if (!this.gridInitialized) {
                const gridX = 10;
                const gridY = 40; // Below dragging chords (70 + ~200 for dragging area)

                // Use interModel to generate initial scale
                const scalePositions = this.accumulateIntervals(this.interModel, this.starting_note, this.numOctaves);
                const scaleNames = this.getNames(scalePositions);

                console.log('Initializing Grid at', { x: gridX, y: gridY });
                this.grid.p = p; // Store p5 instance
                this.grid.setup(gridX, gridY, this.size_x, this.size_y, scalePositions, scaleNames);
                this.grid.setModes(this.modes);
                this.grid.setDarkMode(false);
                this.grid.setRound(this.round);

                // Connect Grid callback to VoicingEditor (C++ Grid.cpp onChordSelected)
                this.grid.onChordSelected = (notes, voicing, chord, mode) => {
                    // Validate data before sending to VoicingEditor
                    if (!notes || notes.length === 0) {
                        console.warn('Grid selected cell has no notes');
                        return;
                    }
                    if (!voicing || voicing.length === 0) {
                        console.warn('Grid selected cell has no voicing');
                        return;
                    }
                    if (notes.length < voicing.length) {
                        console.warn('Voicing array longer than notes array');
                        return;
                    }

                    // Store which chord is selected (CRITICAL for voicing edits!)
                    this.selectedChord = chord;
                    this.selectedMode = mode;

                    //console.log(`✓ Grid chord selected: ${notes.length} notes, voicing: [${voicing.join(', ')}]`);
                    this.voicingEditor.setCurrentScale(notes);
                    this.voicingEditor.updateCurrentVoicing(notes, voicing);

                    // Play chord audio (C++ ofApp.cpp mousePressed on chords)
                    const frequencies = voicing.map(pos => {
                        const scale = this.findScaleByReference(pos);
                        return scale ? scale.frequency : 440;
                    });

                    // Send MIDI/MPE output if controller is available and connected
                    if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
                        window.midiController.stopChordNotes();
                        window.midiController.playChord(frequencies, 5);
                    }

                    // Update MIDI Piano keyboard mapping with the scale frequencies
                    if (window.modalStudioKeyMap) {
                        const scaleFreqs = notes.map(note => {
                            const scaleData = this.findScaleByReference(note.ft_note);
                            return scaleData ? scaleData.frequency : null;
                        }).filter(f => f != null);
                        window.modalStudioKeyMap.updateMidiPiano(scaleFreqs);

                        // Update ScaleEditor chromatic nodes from KeyMap
                        if (this.scaleEditor) {
                            this.scaleEditor.syncChromaticNotesFromKeyMap();
                        }
                    }

                    this.audioEngine.playChord(frequencies);
                    this.captureChordToMemory(frequencies, chord.getChordQuality ? chord.getChordQuality() : null, chord.getColor ? chord.getColor() : null);
                    //console.log('▶ Playing grid chord:', frequencies.length, 'notes');
                };

                this.gridInitialized = true;
                console.log('✅ Grid initialized');
            }

            // Initialize KeyMap and sync chromatic notes on first load
            if (window.modalStudioKeyMap && this.modes.length > 0 && this.modes[0].scale) {
                const scaleFreqs = this.modes[0].scale.slice(0, 7).map(note => {
                    const scaleData = this.findScaleByReference(note.ft_note);
                    return scaleData ? scaleData.frequency : null;
                }).filter(f => f != null);

                if (scaleFreqs.length >= 3) {
                    window.modalStudioKeyMap.updateMidiPiano(scaleFreqs);
                    console.log('✓ Initial KeyMap populated');

                    // Sync ScaleEditor chromatic nodes now that KeyMap is ready
                    if (this.scaleEditor) {
                        this.scaleEditor.syncChromaticNotesFromKeyMap();
                    }
                }
            }
        }
    }

    // C++: void ofApp::generateModeGroup(...)
    generateModeGroup(model, xStart, yOffset, starting_note, numOctaves) {
        this.modes = [];

        for (let i = 0; i < this.SCALE_SIZE; i++) {
            const modeIntervals = this.generateMode(model, i);
            const modeReference = this.accumulateIntervals(modeIntervals, starting_note, numOctaves);
            const noteNames = this.getNames(modeReference);

            const x = xStart;
            const y = yOffset + (i * (this.size_y + 5));

            const inMode = new Mode();
            inMode.setup(x, y, this.size_x, this.size_y, this.round, modeReference, noteNames);
            inMode.setModeName(this.MODE_NAMES[i]);
            inMode.setMode(i);

            this.modes.push(inMode);
        }

        console.log(`✓ Generated ${this.modes.length} modes`);
    }

    // C++: void ofApp::draw() - case CHORDS
    draw(p) {
        // CRITICAL: Only draw if we're in MODALSTUDIO scene
        if (currentScene !== Scenes.MODALSTUDIO) {
            return; // Don't draw Modal Studio when in EigenSpace
        }
        
        p.background(...this.darkBackground);

        if (this.currentScene === 'chord') {
            // Draw Chord Scene
            p.fill(...this.textColor);
            p.textSize(18);
            p.noStroke();
            p.text('Modes Scene', 15, 20);

            for (let i = 0; i < this.modes.length; i++) {
                this.modes[i].draw(p, p.mouseX, p.mouseY);
            }

            // Draw Scale Editor
            if (this.scaleEditorInitialized) {
                this.scaleEditor.update(p);
                this.scaleEditor.draw(p);
            } else {
                // Debug: Show why scale editor not drawing
                if (this.fiftyThree.length === 0) {
                    console.log('Scale Editor not initialized: waiting for JSON');
                }
            }

            // Draw Voicing Editor
            if (this.voicingEditorInitialized) {
                this.voicingEditor.update(p);
                this.voicingEditor.draw(p);
            }
        } else if (this.currentScene === 'grid') {
            p.textSize(18);
            p.noStroke();
            p.text('Modal Interchange Studio', 15, 20);
            // Draw Grid Scene first (background layer)
            if (this.gridInitialized) {
                this.grid.draw(p, p.mouseX, p.mouseY);
                this.grid.update();
            }

            // Draw DraggingChords on top (foreground layer)
            if (this.draggingChordsInitialized) {
                this.draggingChords.update();
                this.draggingChords.draw(p);
            }

            // Draw Scale Editor in Grid scene
            if (this.scaleEditorInitialized) {
                this.scaleEditor.update(p);
                this.scaleEditor.draw(p);
            }

            // Draw Voicing Editor in Grid scene
            if (this.voicingEditorInitialized) {
                this.voicingEditor.update(p);
                this.voicingEditor.draw(p);
            }
        }
    }

    // Update positions when canvas is resized
    updatePositions(p) {
        if (this.scaleEditorInitialized) {
            const radius = this.scaleEditor.outerRingSize;
            const frameWidth = 2 * (radius * this.scaleEditor.factorSize);
            const canvasWidth = p.width;
            this.scaleEditorX = Math.max(10, canvasWidth - frameWidth - 24);

            // Update Scale Editor center position
            const outerRadius = radius * this.scaleEditor.factorSize;
            this.scaleEditor.center = {
                x: this.scaleEditorX + outerRadius,
                y: this.scaleEditorY + outerRadius
            };
            this.scaleEditor.drawCenterY = this.scaleEditor.center.y + 15;
            // CRITICAL: Update all visual node positions after center changes
            this.scaleEditor.updateNodePositions();

            console.log('Updated Scale Editor position:', this.scaleEditor.center, 'canvas width:', canvasWidth);

            // Update Voicing Editor position
            if (this.voicingEditorInitialized) {
                const voicingEditorX = this.scaleEditorX;
                const voicingEditorY = this.scaleEditorY + (2 * radius * this.scaleEditor.factorSize) + 10;
                const voicingOuterRadius = this.voicingEditor.radius * this.voicingEditor.factorSize;
                this.voicingEditor.center = {
                    x: voicingEditorX + voicingOuterRadius,
                    y: voicingEditorY + voicingOuterRadius
                };
                this.voicingEditor.drawCenterY = this.voicingEditor.center.y + 15;
            }
        }
    }

    // Scene switching
    setScene(sceneName) {
        this.currentScene = sceneName;
        console.log('Scene switched to:', sceneName);
    }

    // Original draw continuation
    drawChordScene_backup(p) {
        p.background(...this.darkBackground);

        p.fill(...this.textColor);
        p.textSize(12);
        p.text('Chords', 15, 15);

        for (let i = 0; i < this.modes.length; i++) {
            this.modes[i].draw(p, p.mouseX, p.mouseY);
        }

        // Draw Scale Editor
        if (this.scaleEditorInitialized) {
            this.scaleEditor.update(p);
            this.scaleEditor.draw(p);
        } else {
            // Debug: Show why scale editor not drawing
            if (this.fiftyThree.length === 0) {
                console.log('Scale Editor not initialized: waiting for JSON');
            }
        }

        // Draw Voicing Editor (C++ ofApp.cpp line 373)
        if (this.voicingEditorInitialized) {
            this.voicingEditor.update(p);
            this.voicingEditor.draw(p);
        }
    }

    // C++: void ofApp::mousePressed()
    mousePressed(mouseX, mouseY) {
        // CRITICAL: Only process if we're in MODALSTUDIO scene
        if (currentScene !== Scenes.MODALSTUDIO) {
            return; // Block all Modal Studio mouse events when in EigenSpace
        }
        
        if (this.currentScene === 'chord') {
            // Forward to Voicing Editor first (C++ ofApp.cpp line 608)
            let voicingEditorHandled = false;
            if (this.voicingEditorInitialized) {
                voicingEditorHandled = this.voicingEditor.mousePressed(mouseX, mouseY);
            }

            // Forward to Scale Editor
            if (this.scaleEditorInitialized) {
                this.scaleEditor.mousePressed(mouseX, mouseY);
            }

            // Only check chord buttons if VoicingEditor didn't handle the event
            if (!voicingEditorHandled) {
                for (let i = 0; i < this.modes.length; i++) {
                    const mode = this.modes[i];
                    if (mode.mousePressed(mouseX, mouseY)) {
                        // Find which chord was clicked
                        for (let c = 0; c < mode.chords.length; c++) {
                            const chord = mode.chords[c];
                            if (chord.isClicked()) {
                                //console.log(`Clicked: ${chord.getChordQuality()} (${mode.modeName})`);

                                // C++ Chord.cpp: Use noteVoicing array generated by voicing() method
                                const noteVoicing = chord.getNoteVoicing();
                                //console.log(`Voicing refs: ${noteVoicing.join(', ')}`);

                                const frequencies = noteVoicing.map(ref => {
                                    const scale = this.findScaleByReference(ref);
                                    if (!scale) {
                                        //console.warn(`Reference ${ref} not found in JSON!`);
                                        return 440;
                                    }
                                    return scale.frequency;
                                });

                                //console.log(`Playing ${frequencies.length} notes: ${frequencies.map(f => f.toFixed(2)).join(', ')}`);

                                // Send MIDI/MPE output if controller is available and connected
                                if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
                                    window.midiController.stopChordNotes();
                                    window.midiController.playChord(frequencies, 5);
                                }

                                // Update MIDI Piano keyboard mapping with the chord's scale
                                if (window.modalStudioKeyMap && mode && mode.scale) {
                                    // Get first 7 notes (one octave) and convert ft_note to frequency
                                    const scaleFreqs = mode.scale.slice(0, 7).map(note => {
                                        const scaleData = this.findScaleByReference(note.ft_note);
                                        return scaleData ? scaleData.frequency : null;
                                    }).filter(f => f != null);

                                    if (scaleFreqs.length >= 3) {
                                        // Update computer keyboard mapping (uses first 4 scale notes: root, 3rd, 5th, 7th)
                                        if (typeof window.updateKeyboardMapping === 'function' && scaleFreqs.length >= 4) {
                                            let chordBaseFreqs = scaleFreqs.slice(0, 4); // [root, 2nd, 3rd, 4th] from scale
                                            
                                            // Shift frequencies up to comfortable playing range (around 200-400 Hz root)
                                            while (chordBaseFreqs[0] < 200) {
                                                chordBaseFreqs = chordBaseFreqs.map(f => f * 2);
                                            }
                                            
                                            window.updateKeyboardMapping(chordBaseFreqs);
                                        }
                                        
                                        window.modalStudioKeyMap.updateMidiPiano(scaleFreqs);

                                        // Update ScaleEditor chromatic nodes from KeyMap
                                        if (this.scaleEditor) {
                                            this.scaleEditor.syncChromaticNotesFromKeyMap();
                                        }
                                    }
                                }

                                // Play chord
                                this.audioEngine.playChord(frequencies);
                                this.captureChordToMemory(frequencies, chord.getChordQuality ? chord.getChordQuality() : null, chord.getColor ? chord.getColor() : null);

                                // C++ ofApp.cpp lines 34-35: Send chord to VoicingEditor
                                // C++ Grid.cpp lines 635-656: Store selection state and trigger callback
                                if (this.voicingEditorInitialized) {
                                    // Store which chord is selected (single source of truth)
                                    this.selectedChord = chord;
                                    this.selectedMode = mode;

                                    const chordNotes = chord.notes; // Scale notes for the chord
                                    this.voicingEditor.setCurrentScale(mode.scale);
                                    this.voicingEditor.updateCurrentVoicing(chordNotes, noteVoicing);

                                    //console.log(`📍 Selected: ${chord.getChordQuality()} from ${mode.modeName}`);
                                }

                                return;
                            }
                        }
                    }
                }
            }
        } else if (this.currentScene === 'grid') {
            // C++ Grid.cpp line 636: Grid forwards to its internal draggingChords
            if (this.draggingChordsInitialized) {
                this.draggingChords.mousePressed(mouseX, mouseY);
            }
            // C++ ofApp.cpp lines 607-611: GRID scene
            if (this.gridInitialized) {
                this.grid.mousePressed(mouseX, mouseY);
            }
            if (this.scaleEditorInitialized) {
                this.scaleEditor.mousePressed(mouseX, mouseY);
            }
            if (this.voicingEditorInitialized) {
                this.voicingEditor.mousePressed(mouseX, mouseY);
            }
        }
    }

    // Original mousePressed continuation (for reference)
    mousePressedChordScene_backup(mouseX, mouseY) {
        // Forward to Voicing Editor first (C++ ofApp.cpp line 608)
        if (this.voicingEditorInitialized) {
            this.voicingEditor.mousePressed(mouseX, mouseY);
        }

        // Forward to Scale Editor
        if (this.scaleEditorInitialized) {
            this.scaleEditor.mousePressed(mouseX, mouseY);
        }

        // Check if a chord button was clicked
        for (let i = 0; i < this.modes.length; i++) {
            const mode = this.modes[i];
            if (mode.mousePressed(mouseX, mouseY)) {
                // Find which chord was clicked
                for (let c = 0; c < mode.chords.length; c++) {
                    const chord = mode.chords[c];
                    if (chord.isClicked()) {
                        console.log(`Clicked: ${chord.getChordQuality()} (${mode.modeName})`);

                        // C++ Chord.cpp: Use noteVoicing array generated by voicing() method
                        const noteVoicing = chord.getNoteVoicing();
                        console.log(`Voicing refs: ${noteVoicing.join(', ')}`);

                        const frequencies = noteVoicing.map(ref => {
                            const scale = this.findScaleByReference(ref);
                            if (!scale) {
                                console.warn(`Reference ${ref} not found in JSON!`);
                                return 440;
                            }
                            return scale.frequency;
                        });

                        console.log(`Playing ${frequencies.length} notes: ${frequencies.map(f => f.toFixed(2)).join(', ')}`);

                        // Send MIDI/MPE output if controller is available and connected
                        if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
                            window.midiController.stopChordNotes();
                            window.midiController.playChord(frequencies, 5);
                        }

                        // Update MIDI Piano keyboard mapping with the mode scale
                        if (window.modalStudioKeyMap && mode && mode.scale) {
                            // Get first 7 notes (one octave) and convert ft_note to frequency
                            const scaleFreqs = mode.scale.slice(0, 7).map(note => {
                                const scaleData = this.findScaleByReference(note.ft_note);
                                return scaleData ? scaleData.frequency : null;
                            }).filter(f => f != null);

                            if (scaleFreqs.length >= 3) {
                                window.modalStudioKeyMap.updateMidiPiano(scaleFreqs);

                                // Update ScaleEditor chromatic nodes from KeyMap
                                if (this.scaleEditor) {
                                    this.scaleEditor.syncChromaticNotesFromKeyMap();
                                }
                            }
                        }

                        // Play chord
                        this.audioEngine.playChord(frequencies);
                        this.captureChordToMemory(frequencies, chord.getChordQuality ? chord.getChordQuality() : null, chord.getColor ? chord.getColor() : null);

                        // C++ ofApp.cpp lines 34-35: Send chord to VoicingEditor
                        // C++ Grid.cpp lines 635-656: Store selection state and trigger callback
                        if (this.voicingEditorInitialized) {
                            // Store which chord is selected (single source of truth)
                            this.selectedChord = chord;
                            this.selectedMode = mode;

                            const chordNotes = chord.notes; // Scale notes for the chord
                            this.voicingEditor.setCurrentScale(mode.scale);
                            this.voicingEditor.updateCurrentVoicing(chordNotes, noteVoicing);

                            console.log(`📍 Selected: ${chord.getChordQuality()} from ${mode.modeName}`);
                        }

                        return;
                    }
                }
            }
        }
    }

    // C++: void ofApp::mouseDragged()
    mouseDragged(mouseX, mouseY) {
        // CRITICAL: Only process if we're in MODALSTUDIO scene
        if (currentScene !== Scenes.MODALSTUDIO) {
            return; // Block all Modal Studio drag events when in EigenSpace
        }
        
        // Only send drag events to the editor that's currently interacting
        const scaleEditorInteracting = this.scaleEditorInitialized && this.scaleEditor.isInteracting;
        const voicingEditorInteracting = this.voicingEditorInitialized && this.voicingEditor.isInteracting;

        if (this.currentScene === 'chord') {
            // Only forward drag to the editor that's currently interacting
            if (voicingEditorInteracting && this.voicingEditorInitialized) {
                this.voicingEditor.mouseDragged(mouseX, mouseY);
            } else if (scaleEditorInteracting && this.scaleEditorInitialized) {
                this.scaleEditor.mouseDragged(mouseX, mouseY);
            }
        } else if (this.currentScene === 'grid') {
            // C++ Grid.cpp line 668: Grid forwards to its internal draggingChords
            if (this.draggingChordsInitialized) {
                this.draggingChords.mouseDragged(mouseX, mouseY);
            }
            // C++ ofApp.cpp lines 588-591: GRID scene
            if (this.gridInitialized) {
                this.grid.mouseDragged(mouseX, mouseY);
            }
            // Only forward drag to the editor that's currently interacting
            if (voicingEditorInteracting && this.voicingEditorInitialized) {
                this.voicingEditor.mouseDragged(mouseX, mouseY);
            } else if (scaleEditorInteracting && this.scaleEditorInitialized) {
                this.scaleEditor.mouseDragged(mouseX, mouseY);
            }
        }
    }

    // Original mouseDragged continuation
    mouseDraggedChordScene_backup(mouseX, mouseY) {
        // Forward to Voicing Editor (C++ ofApp.cpp line 584)
        if (this.voicingEditorInitialized) {
            this.voicingEditor.mouseDragged(mouseX, mouseY);
        }

        if (this.scaleEditorInitialized) {
            this.scaleEditor.mouseDragged(mouseX, mouseY);
        }
    }

    // C++: void ofApp::mouseReleased()
    mouseReleased(mouseX, mouseY) {
        // CRITICAL: Only process if we're in MODALSTUDIO scene
        if (currentScene !== Scenes.MODALSTUDIO) {
            return; // Block all Modal Studio release events when in EigenSpace
        }
        
        // C++ ofApp.cpp line 630: Get current inversion on every mouse release
        const myInversion = this.scaleEditorInitialized ? this.scaleEditor.getInversion() : 0;

        if (this.currentScene === 'chord') {
            // C++ ofApp.cpp lines 641-646: CHORDS scene
            // Apply inversion to all modes on every mouse release
            for (let i = 0; i < this.modes.length; i++) {
                this.modes[i].setInversions(myInversion);
                this.modes[i].mouseReleased();
            }

            if (this.scaleEditorInitialized) {
                this.scaleEditor.mouseReleased(mouseX, mouseY);
            }

            if (this.voicingEditorInitialized) {
                this.voicingEditor.mouseReleased(mouseX, mouseY);
            }
        } else if (this.currentScene === 'grid') {
            // C++ Grid.cpp line 671: Grid forwards to its internal draggingChords
            if (this.draggingChordsInitialized) {
                this.draggingChords.mouseReleased(mouseX, mouseY, this.grid);
            }
            // C++ ofApp.cpp lines 633-639: GRID scene
            if (this.gridInitialized) {
                this.grid.mouseReleased(mouseX, mouseY);
            }
            if (this.scaleEditorInitialized) {
                this.scaleEditor.mouseReleased(mouseX, mouseY);
            }
            if (this.voicingEditorInitialized) {
                this.voicingEditor.mouseReleased(mouseX, mouseY);
            }
            // C++ line 639: Apply inversion ONLY to dragging chords (not grid cells)
            if (this.draggingChordsInitialized) {
                this.draggingChords.setInversions(myInversion);
            }
        }
    }

    // Original mouseReleased continuation
    mouseReleasedChordScene_backup(mouseX, mouseY) {
        // Forward to Voicing Editor (C++ ofApp.cpp line 638)
        if (this.voicingEditorInitialized) {
            this.voicingEditor.mouseReleased(mouseX, mouseY);
        }

        if (this.scaleEditorInitialized) {
            this.scaleEditor.mouseReleased(mouseX, mouseY);
        }

        // Release all chord buttons
        for (let i = 0; i < this.modes.length; i++) {
            this.modes[i].mouseReleased();
        }
    }

    // C++ ofApp.cpp lines 174-210 - Callback when ScaleEditor configuration changes
    onEditorConfigChanged(newConfig) {
        console.log('🔄 Scale configuration changed:', newConfig);
        this.interModel = [...newConfig];
        this.starting_note = this.scaleEditor.startingStep;

        // C++ ofApp.cpp lines 189-205: Regenerate all modes with new intervals
        this.generateModeGroup(this.interModel, this.modeXStart, this.modeYOffset, this.starting_note, this.numOctaves);

        // Update Grid with new scale (C++ Grid.cpp updateScale)
        if (this.gridInitialized) {
            const scalePositions = this.accumulateIntervals(this.interModel, this.starting_note, this.numOctaves);
            const scaleNames = this.getNames(scalePositions);
            this.grid.updateScale(scalePositions, scaleNames);
            this.grid.setModes(this.modes);
            console.log('✓ Grid updated with new scale');
        }

        // Update DraggingChords with new modes and inversions (C++ ofApp.cpp lines 185-187, 200-201)
        if (this.draggingChordsInitialized && this.scaleEditorInitialized) {
            const inversionNumber = this.scaleEditor.getInversion();
            this.draggingChords.setInversions(inversionNumber);
            this.draggingChords.updateScale(this.modes);
            console.log('✓ DraggingChords updated with new modes');
        }

        // Log the first mode's chords to verify update
        if (this.modes.length > 0 && this.modes[0].chords.length > 0) {
            const firstChordQuality = this.modes[0].chords[0].getChordQuality();
            console.log('✓ Mode 0 (Ionian) first chord:', firstChordQuality);
        }

        // Update MIDI Piano keyboard mapping with the new scale
        if (window.modalStudioKeyMap && this.modes.length > 0 && this.modes[0].scale) {
            // Get first 7 notes (one octave) and convert ft_note to frequency
            const scaleFreqs = this.modes[0].scale.slice(0, 7).map(note => {
                const scaleData = this.findScaleByReference(note.ft_note);
                return scaleData ? scaleData.frequency : null;
            }).filter(f => f != null);

            if (scaleFreqs.length >= 3) {
                window.modalStudioKeyMap.updateMidiPiano(scaleFreqs);
                console.log('✓ KeyMap updated with new scale frequencies');

                // Update ScaleEditor chromatic nodes from KeyMap
                if (this.scaleEditor) {
                    this.scaleEditor.syncChromaticNotesFromKeyMap();
                }
            }
        }

        console.log('✓ All 7 modes regenerated with new scale');
    }
}

// ---- ModalStudioScene contract object ----
const ModalStudioScene = {
    // .name is assigned by SceneManager.register() (anima.js) to avoid a
    // load-time reference to Scenes, which is defined in anima.js (loaded last).
    bodyClass: 'scene-modalstudio',

    enter() {
        const eigenContainer = document.getElementById('eigenspace-app');
        const modalContainer = document.getElementById('modalstudio-app');
        const eigenAudioGui = document.getElementById('eigenspace-audio-gui');

        if (eigenContainer) eigenContainer.style.display = 'none';
        if (modalContainer) modalContainer.style.display = 'block';

        // Disable pointer events on Plotly plot to prevent ghost clicks
        const plotDiv = document.getElementById('plot');
        if (plotDiv) plotDiv.style.pointerEvents = 'none';

        // Note: EigenSpace's interactive p5 sub-components (colorbar, grid, chord
        // visualization) are deactivated by EigenspaceScene.exit(), which the
        // SceneManager runs before this enter(). Nothing to disable here.

        // Hide EigenSpace buttons
        const vizModeToggle = document.getElementById('viz-mode-toggle');
        const navToModalStudio = document.getElementById('nav-to-modalstudio');
        const gridToggle = document.getElementById('grid-toggle');
        const midiToggle = document.getElementById('midi-toggle');
        const infoButton = document.getElementById('info-button');
        if (vizModeToggle) vizModeToggle.style.display = 'none';
        if (navToModalStudio) navToModalStudio.style.display = 'none';
        if (gridToggle) gridToggle.style.display = 'none';
        if (midiToggle) midiToggle.style.display = 'none';
        if (infoButton) infoButton.style.display = 'none';

        // Hide Plotly modebar (legend is part of the plot and hidden with container)
        let modebarModal = document.querySelector('.modebar');
        if (modebarModal) modebarModal.style.display = 'none';

        // ADSR: Hidden by default in Modal Studio (controlled by audioToggle button)
        if (eigenAudioGui) eigenAudioGui.style.display = 'none';

        console.log('[ANIMA] Scene: Modal Studio');
        if (window.launchpadHandler) window.launchpadHandler.setScene(Scenes.MODALSTUDIO);
    },

    exit() { /* no teardown needed */ },

    draw(p) { if (window.app) window.app.draw(p); },
    mousePressed(x, y) { if (window.app) window.app.mousePressed(x, y); },
    mouseDragged(x, y) { if (window.app) window.app.mouseDragged(x, y); },
    mouseReleased(x, y) { if (window.app) window.app.mouseReleased(x, y); },
    resize(p) { if (window.app) window.app.updatePositions(p); },

    keyPressed(e) { /* Modal Studio keyboard handled by p5 sketch */ },
};
