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

        // MS Frequency Spectrum (STRATEGY §6.5) — horizontal multi-octave strip,
        // lazily created in draw() once the 53-TET reference notes are loaded.
        this.msSpectrum = null;
        this.msSpectrumInitialized = false;

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
        this.modeYOffset = 10;

        // Colors from C++ ofApp.h lines 122-130
        this.darkBackground = [230, 229, 228]; // Changed from [26, 25, 24]
        this.textColor = [0, 0, 0]; // Changed to black for light background
        this.buttonColor = [230, 230, 230];

        this.MODE_NAMES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'];

        this.scaleEditorY = 0;
        this.scaleEditorX = 0;

        // Audio engine
        this.audioEngine = new AudioEngine();

        // Scale Editor
        this.scaleEditor = new ScaleEditor();
        this.scaleEditorInitialized = false;

        // Voicing Editor (C++ ofApp.h - VoicingEditor member)
        this.voicingEditor = new VoicingEditor();
        this.voicingEditorInitialized = false;

        // Scale + Voicing share ONE top-right slot, toggled by DOM tabs (§6.4).
        // 'scale' (home) or 'voicing'. Only the active editor draws + gets events.
        this.activeEditorTab = 'scale';

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

    // Audition a voicing as it's edited in the Voicing Editor (add 9/11/13, octave,
    // transpose, preset, drag-release) so the user hears the change without re-clicking
    // the chord. Positions are absolute 53-TET refs → frequencies, same as a chord click.
    // Throttled: playChord doesn't cut previous notes, so rapid sources (wheel
    // transpose, a preset that notifies twice) would otherwise pile up into a mush.
    auditionVoicing(positions) {
        if (!positions || positions.length === 0) return;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (this._lastAuditionAt && (now - this._lastAuditionAt) < 90) return;
        this._lastAuditionAt = now;

        const frequencies = positions.map(pos => {
            const scale = this.findScaleByReference(pos);
            return scale ? scale.frequency : 440;
        });
        if (window.midiController && window.midiController.midiEnabled && window.midiController.selectedOutput) {
            window.midiController.stopChordNotes();
            window.midiController.playChord(frequencies, 5);
        }
        if (this.audioEngine) this.audioEngine.playChord(frequencies);
        if (this.msSpectrumInitialized) this.msSpectrum.setActiveFrequencies(frequencies);
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

        // Light the note on the MS Frequency Spectrum (§6.5) at its exact Hz — this is
        // the computer keyboard (key_map.js → window.playNote) and spectrum clicks.
        if (this.msSpectrumInitialized && currentScene === Scenes.MODALSTUDIO) {
            this.msSpectrum.pulse(frequency);
        }

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
            // Position Scale Editor: flush to the top and right borders
            // (scaleEditorY = 0; right edge at canvasWidth - frameWidth).
            // Frame width = 2 * (radius * scaleEditor.factorSize)
            const frameWidth = 2 * (radius * this.scaleEditor.factorSize);
            const canvasWidth = this.p.width; // Use canvas width instead of window width
            this.scaleEditorX = Math.max(0, canvasWidth - frameWidth);

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
                const voicingRadius = this.scaleEditor.outerRingSize; // Match ScaleEditor ring size
                // §6.4: Scale + Voicing share ONE slot. Both frames are the same
                // size (identical factorSize/radius), so place the Voicing editor at
                // the SAME top-left as the Scale editor — they fully overlap and the
                // tab toggles which one draws. (updatePositions keeps them locked.)
                const voicingTopLeft = { x: this.scaleEditorX, y: this.scaleEditorY };
                console.log('Initializing Voicing Editor at', voicingTopLeft);

                // Setup with radius, position, and note data
                this.voicingEditor.setup(voicingRadius, voicingTopLeft, this.fiftyThree);
                this.voicingEditor.setDarkMode(false); // Match ScaleEditor mode

                // C++ ofApp.cpp line 72: Connect callback (Grid.cpp updateSelectedChordVoicing)
                this.voicingEditor.onVoicingChanged = (newVoicing, extTags, audition = false) => {
                    // C++ ofApp.cpp lines 93-102
                    // extTags = {absoluteTET: extType} for the 9/11/13 notes, persisted
                    // ONTO the chord so the flags survive a chord switch (without this,
                    // switching away and back lets the 9/11/13 buttons stack duplicates).
                    switch (this.currentScene) {
                        case 'grid':
                            if (this.gridInitialized) {
                                // "Over Column": when the toggle is ON and the edit is on a
                                // row-0 chord, the Grid replicates it down the column.
                                this.grid.updateSelectedChordVoicing(newVoicing, extTags, this.voicingEditor.overColumn);
                            }
                            break;
                        case 'chord':
                            // Update all modes - each checks its own selectedChordIndex
                            for (let i = 0; i < this.modes.length; i++) {
                                this.modes[i].updateSelectedChordVoicing(newVoicing, extTags);
                            }
                            break;
                    }
                    // Audition the edit: adding a 9/11/13, an octave/transpose move, a
                    // preset, or a drag-release plays the chord right away so the user
                    // hears it without re-clicking the chord. Per-frame drag passes false.
                    if (audition) this.auditionVoicing(newVoicing);
                };

                // Re-root wheel (Step 4): transpose the SELECTED chord by N commas
                // BEFORE the voicing-change recomputes its quality — shift its notes
                // + root_53 so intervals (and the name) transpose correctly. Each
                // unique Note object is shifted once (root_53/root alias notes[]).
                this.voicingEditor.onTranspose = (deltaSteps) => {
                    const ch = this.selectedChord;
                    if (!ch || !deltaSteps) return;
                    // Build FRESH note objects (never mutate in place): grid cells
                    // share root_53 (and can share notes[]) with the original dragged
                    // chord, so an in-place shift would transpose those too. Replacing
                    // the references de-shares — the transpose stays on THIS chord only.
                    const shifted = (note) => {
                        if (!note) return note;
                        const newFt = note.ft_note + deltaSteps;
                        const ref = this.findScaleByReference(newFt);
                        return {
                            ft_note: newFt,
                            name: (ref && ref.noteName) ? ref.noteName : note.name,
                            interval: note.interval,
                            localInterval: note.localInterval,
                            inScale: note.inScale
                        };
                    };
                    if (Array.isArray(ch.notes)) ch.notes = ch.notes.map(shifted);
                    ch.root_53 = shifted(ch.root_53);
                    ch.root = (Array.isArray(ch.notes) && ch.notes.length) ? ch.notes[0] : shifted(ch.root);
                    if (ch.root_53) ch.note_53 = ch.root_53.ft_note;
                    // Cumulative re-root distance, read by the Grid's "Over Column"
                    // propagation: the column stacks are rebuilt UNtransposed from the
                    // modes on every interchange recalc, so the total shift must be
                    // re-applied there each time (not just this edit's delta).
                    ch._transposeOff = (ch._transposeOff || 0) + deltaSteps;
                };

                // Re-root wheel detent: a soft safe-lock tick per grip line (2 per comma).
                this.voicingEditor.onWheelTick = () => {
                    if (this.audioEngine) this.audioEngine.playTick();
                };

                // "Over Column" switched OFF → the grid drops the voicings it
                // propagated (all columns touched while ON) back to defaults.
                this.voicingEditor.onOverColumnOff = () => {
                    if (this.gridInitialized) this.grid.resetPropagatedColumns();
                };

                // Voicing preset (Step 5): apply the chord's OWN built-in voicing
                // template (musical), then reload the editor from it. type → which
                // chord tone leads (0=root,2=7th,4=5th,6=3rd on top).
                this.voicingEditor.onSelectVoicing = (type) => {
                    const ch = this.selectedChord;
                    if (!ch || typeof ch.voicing !== 'function') return;
                    ch.numVoicing = type;
                    // Apply the RAW template: temporarily clear previousVoicing so
                    // checkAndAddNinth() no-ops — otherwise it can dump a 9th/13th
                    // ABOVE the leading note, knocking the chosen tone off the top.
                    const savedPrev = ch.previousVoicing;
                    ch.previousVoicing = [];
                    ch.voicing(type);                       // rebuilds ch.noteVoicing from the template
                    ch.previousVoicing = savedPrev;
                    this.voicingEditor.reloadVoicing(ch.notes, ch.getNoteVoicing());
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
                    // Clean wipes every chord, so the Voicing Editor's loaded chord
                    // no longer exists — drop it back to the empty placeholder and
                    // forget the selection so a later voicing edit can't target a
                    // wiped cell.
                    if (this.voicingEditorInitialized) {
                        this.voicingEditor.clearChord();
                    }
                    this.selectedChord = null;
                    this.selectedMode = null;
                };

                this.draggingChordsInitialized = true;
                console.log('✅ DraggingChords initialized');
            }

            // C++ ofApp.cpp line 28: Initialize Grid
            if (!this.gridInitialized) {
                const gridX = 10;
                const gridY = 10; // Below dragging chords (70 + ~200 for dragging area)

                // Use interModel to generate initial scale
                const scalePositions = this.accumulateIntervals(this.interModel, this.starting_note, this.numOctaves);
                const scaleNames = this.getNames(scalePositions);

                console.log('Initializing Grid at', { x: gridX, y: gridY });
                this.grid.p = p; // Store p5 instance
                this.grid.setup(gridX, gridY, this.size_x, this.size_y, scalePositions, scaleNames);
                this.grid.setModes(this.modes);
                this.grid.setDarkMode(false);
                this.grid.setRound(this.round);

                // Note-name lookup for the Grid's "Over Column" propagation: a wheel
                // re-root shifts the column chords' notes off the diatonic scale, so
                // their names must come from the full 53-TET table, not the mode.
                this.grid.noteNameResolver = (ft) => {
                    const ref = this.findScaleByReference(ft);
                    return ref ? ref.noteName : null;
                };

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
                    // Pass this cell's persisted 9/11/13 flags so they're restored on
                    // return — without this, every grid cell reloads flagless and the
                    // 9/11/13 buttons stack duplicates (cells 00–03 accumulating notes).
                    this.voicingEditor.updateCurrentVoicing(notes, voicing, chord ? chord.extTags : undefined);
                    // §6.4: selecting a chord auto-switches to the Voicing tab.
                    this.setActiveEditorTab('voicing');

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
                    if (this.msSpectrumInitialized) this.msSpectrum.setActiveFrequencies(frequencies);
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
            p.textSize(15);
            p.noStroke();
            p.text('Modes Scene', 15, 20);

            for (let i = 0; i < this.modes.length; i++) {
                this.modes[i].draw(p, p.mouseX, p.mouseY);
            }

            // Draw the active editor (Scale ⇄ Voicing share one slot, §6.4)
            this.drawActiveEditor(p);
        } else if (this.currentScene === 'grid') {
            // p.textSize(15);
            // p.noStroke();
            // p.text('Modal Interchange Studio', 15, 20);
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

            // Draw the active editor (Scale ⇄ Voicing share one slot, §6.4)
            this.drawActiveEditor(p);
        }

        // MS Frequency Spectrum (§6.5) — drawn on the shared canvas in BOTH sub-scenes.
        // Lazy-init once the 53-TET reference notes are loaded.
        if (!this.msSpectrumInitialized && this.fiftyThree.length > 0 &&
            typeof MSFrequencySpectrum !== 'undefined') {
            this.msSpectrum = new MSFrequencySpectrum();
            this.msSpectrum.setup(this.fiftyThree);
            this.msSpectrumInitialized = true;
        }
        if (this.msSpectrumInitialized) {
            this.msSpectrum.layout(p);
            this.msSpectrum.draw(p);
        }
    }

    // Update positions when canvas is resized
    updatePositions(p) {
        if (this.scaleEditorInitialized) {
            const radius = this.scaleEditor.outerRingSize;
            const frameWidth = 2 * (radius * this.scaleEditor.factorSize);
            const canvasWidth = p.width;
            this.scaleEditorX = Math.max(0, canvasWidth - frameWidth);

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

            // §6.4: Voicing shares the SAME slot as Scale (same-size frame), so
            // pin its center to the Scale editor's center — they fully overlap and
            // the tab toggles which one draws.
            if (this.voicingEditorInitialized) {
                this.voicingEditor.center = {
                    x: this.scaleEditor.center.x,
                    y: this.scaleEditor.center.y
                };
                this.voicingEditor.drawCenterY = this.voicingEditor.center.y + 15;
            }
        }
    }

    // ── Scale ⇄ Voicing tab strip (§6.4) ──────────────────────────────────
    // DOM segmented control overlaid on the active editor's title bar. Built
    // once, repositioned each frame (same getBoundingClientRect math as the
    // Voicing dropdown). Manual switching only.
    getActiveEditor() {
        return this.activeEditorTab === 'voicing' ? this.voicingEditor : this.scaleEditor;
    }

    ensureEditorTabs() {
        if (this._editorTabs) return;
        const wrap = document.createElement('div');
        wrap.className = 'editor-tabs';
        wrap.style.position = 'fixed';
        wrap.style.zIndex = '9998';
        wrap.style.display = 'none';
        const mkTab = (label, key) => {
            const b = document.createElement('div');
            b.className = 'editor-tab';
            b.textContent = label;
            b.dataset.tab = key;
            b.addEventListener('mousedown', (e) => {
                e.stopPropagation(); e.preventDefault();
                this.setActiveEditorTab(key);
            });
            return b;
        };
        this._tabScale = mkTab('Scale', 'scale');
        this._tabVoicing = mkTab('Voicing', 'voicing');
        wrap.appendChild(this._tabScale);
        wrap.appendChild(this._tabVoicing);
        document.body.appendChild(wrap);
        this._editorTabs = wrap;
    }

    setActiveEditorTab(tab) {
        if ((tab !== 'scale' && tab !== 'voicing') || tab === this.activeEditorTab) return;
        const outgoing = this.getActiveEditor();
        this.activeEditorTab = tab;
        const incoming = this.getActiveEditor();
        // Keep both co-located: the newly shown editor adopts the (possibly
        // dragged) position of the one that was visible.
        if (outgoing && incoming && outgoing.center) {
            incoming.center = { x: outgoing.center.x, y: outgoing.center.y };
            incoming.drawCenterY = incoming.center.y + 15;
            if (typeof incoming.updateNodePositions === 'function') incoming.updateNodePositions();
        }
        // Leaving the Voicing tab → hide its leading-voice dropdown.
        if (tab !== 'voicing' && this.voicingEditor) this.voicingEditor.hideMenuDom();
    }

    updateEditorTabs(p) {
        if (currentScene !== Scenes.MODALSTUDIO) { this.hideEditorTabs(); return; }
        if (!this._editorTabs) return;
        const editor = this.getActiveEditor();
        if (!editor || !editor.center) { this.hideEditorTabs(); return; }
        const canvasEl = (p && p.canvas) || document.querySelector('#canvas-container canvas') || document.querySelector('canvas');
        if (!canvasEl) return;
        const r = canvasEl.getBoundingClientRect();
        const outerRadius = editor.radius * editor.factorSize;
        const leftEdge = r.left + editor.center.x - outerRadius;
        const titleTop = r.top + (editor.center.y - outerRadius);
        // Left-align to the frame edge, sit inside the title bar (the right side
        // is clear of the top-right global hamburger menu).
        this._editorTabs.style.right = 'auto';
        this._editorTabs.style.left = (leftEdge + 6) + 'px';
        this._editorTabs.style.top = (titleTop + 2) + 'px';
        this._editorTabs.style.display = 'inline-flex';
        this._tabScale.classList.toggle('active', this.activeEditorTab === 'scale');
        this._tabVoicing.classList.toggle('active', this.activeEditorTab === 'voicing');
    }

    hideEditorTabs() {
        if (this._editorTabs) this._editorTabs.style.display = 'none';
    }

    // Draw ONLY the active editor (Scale or Voicing) into the shared slot, plus
    // the tab strip. Used by both the Modes and Grid scenes.
    drawActiveEditor(p) {
        if (!this.scaleEditorInitialized) {
            if (this.fiftyThree.length === 0) {
                console.log('Scale Editor not initialized: waiting for JSON');
            }
            return;
        }
        this.ensureEditorTabs();
        if (this.activeEditorTab === 'voicing' && this.voicingEditorInitialized) {
            this.voicingEditor.update(p);
            this.voicingEditor.draw(p);
        } else {
            // Scale is active (or Voicing not ready) — keep the Voicing dropdown hidden.
            if (this.voicingEditorInitialized) this.voicingEditor.hideMenuDom();
            this.scaleEditor.update(p);
            this.scaleEditor.draw(p);
        }
        this.updateEditorTabs(p);
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

        // MS Frequency Spectrum (§6.5): a click on the strip plays that 53-TET
        // reference tone and sets the root. Only captures clicks inside the strip.
        if (this.msSpectrumInitialized && this.msSpectrum.mousePressed(mouseX, mouseY)) {
            return;
        }

        if (this.currentScene === 'chord') {
            // §6.4: only the ACTIVE editor (Scale or Voicing) receives events.
            let voicingEditorHandled = false;
            if (this.activeEditorTab === 'voicing') {
                if (this.voicingEditorInitialized) {
                    voicingEditorHandled = this.voicingEditor.mousePressed(mouseX, mouseY);
                }
            } else if (this.scaleEditorInitialized) {
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
                                if (this.msSpectrumInitialized) this.msSpectrum.setActiveFrequencies(frequencies);
                                this.captureChordToMemory(frequencies, chord.getChordQuality ? chord.getChordQuality() : null, chord.getColor ? chord.getColor() : null);

                                // C++ ofApp.cpp lines 34-35: Send chord to VoicingEditor
                                // C++ Grid.cpp lines 635-656: Store selection state and trigger callback
                                if (this.voicingEditorInitialized) {
                                    // Store which chord is selected (single source of truth)
                                    this.selectedChord = chord;
                                    this.selectedMode = mode;

                                    const chordNotes = chord.notes; // Scale notes for the chord
                                    this.voicingEditor.setCurrentScale(mode.scale);
                                    // chord.extTags carries the persisted 9/11/13 flags so they
                                    // survive switching chords (re-clicking a button removes its
                                    // note instead of stacking a duplicate).
                                    this.voicingEditor.updateCurrentVoicing(chordNotes, noteVoicing, chord.extTags);
                                    // §6.4: selecting a chord auto-switches to the Voicing tab.
                                    this.setActiveEditorTab('voicing');

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
            // §6.4: only the ACTIVE editor receives events.
            if (this.activeEditorTab === 'voicing') {
                if (this.voicingEditorInitialized) this.voicingEditor.mousePressed(mouseX, mouseY);
            } else if (this.scaleEditorInitialized) {
                this.scaleEditor.mousePressed(mouseX, mouseY);
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
            // §6.4: only the ACTIVE editor receives the release.
            if (this.activeEditorTab === 'voicing') {
                if (this.voicingEditorInitialized) this.voicingEditor.mouseReleased(mouseX, mouseY);
            } else if (this.scaleEditorInitialized) {
                this.scaleEditor.mouseReleased(mouseX, mouseY);
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

    exit() {
        // Hide the DOM overlays when leaving Modal Studio (their p5 draw stops
        // running, so they can't hide themselves): voicing dropdown + tab strip.
        if (window.app && window.app.voicingEditor) window.app.voicingEditor.hideMenuDom();
        if (window.app && window.app.hideEditorTabs) window.app.hideEditorTabs();
    },

    draw(p) { if (window.app) window.app.draw(p); },
    mousePressed(x, y) { if (window.app) window.app.mousePressed(x, y); },
    mouseDragged(x, y) { if (window.app) window.app.mouseDragged(x, y); },
    mouseReleased(x, y) { if (window.app) window.app.mouseReleased(x, y); },
    resize(p) { if (window.app) window.app.updatePositions(p); },

    keyPressed(e) { /* Modal Studio keyboard handled by p5 sketch */ },
};
