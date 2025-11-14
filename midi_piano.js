// ============================================================================
// MIDI PIANO INPUT HANDLER
// ============================================================================
// Receives MIDI input from physical keyboard (e.g., Oxygen 49)
// Maps incoming notes to dynamic 53-TET scale while preserving C as root
// Sends retuned notes via MPE output

class MidiPianoHandler {
    constructor() {
        this.midiAccess = null;
        this.currentScale = null;  // 13-note scale from clicked chord
        this.rootFrequency = 220.0; // Will be updated from main app
        this.rootMidiNote = null;  // Which MIDI note plays the root
        this.activeNotes = new Map(); // Track playing notes for note-off
        this.isEnabled = false;
        
        console.log('MIDI Piano Handler initialized');
    }

    // Initialize Web MIDI API and setup input listeners
    async initialize() {
        console.log('MIDI Piano: Attempting to initialize...');
        try {
            // Request MIDI access
            this.midiAccess = await navigator.requestMIDIAccess();
            console.log('MIDI Piano: Access granted');

            // List available MIDI inputs
            this.listInputDevices();

            // Setup listeners for all MIDI inputs
            this.setupInputListeners();

            this.isEnabled = false; // Start disabled, user can enable via button
            console.log('MIDI Piano: Ready to receive input');

            return true;
        } catch (error) {
            console.error('MIDI Piano: Failed to initialize', error);
            console.error('Error details:', error);
            return false;
        }
    }

    // List all available MIDI input devices
    listInputDevices() {
        const inputs = Array.from(this.midiAccess.inputs.values());
        console.log('MIDI Piano: Available input devices:');
        inputs.forEach((input, index) => {
            console.log(`  ${index + 1}. ${input.name} (${input.manufacturer})`);
        });
        
        if (inputs.length === 0) {
            console.warn('MIDI Piano: No MIDI input devices found');
        }
    }

    // Setup MIDI input listeners for all connected devices
    setupInputListeners() {
        for (let input of this.midiAccess.inputs.values()) {
            console.log(`MIDI Piano: Listening to ${input.name}`);
            input.onmidimessage = (message) => this.handleMidiMessage(message);
        }
    }

    // Handle incoming MIDI messages
    handleMidiMessage(message) {
        const [status, note, velocity] = message.data;
        const command = status & 0xf0;

        // Note On (0x90)
        if (command === 0x90 && velocity > 0) {
            this.handleNoteOn(note, velocity);
        }
        // Note Off (0x80) or Note On with velocity 0
        else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
            this.handleNoteOff(note);
        }
    }

    // Update the scale when a new chord is clicked
    updateScale(scale13Notes, rootFreq) {
        this.currentScale = scale13Notes;
        this.rootFrequency = rootFreq;
        
        console.log('MIDI Piano: Scale updated');
        console.log(`  Root frequency: ${rootFreq.toFixed(2)} Hz`);
        console.log(`  13-note scale:`, scale13Notes.map(n => n.freq.toFixed(2) + ' Hz'));
        
        // Find which scale note is closest to the actual root frequency
        this.findClosestToRoot();
    }

    // Find which note in the scale is closest to the actual root (not C!)
    // This preserves the chord's root position on the keyboard
    findClosestToRoot() {
        if (!this.currentScale) return;

        // The root is always the first note (index 0) in our scale
        // We need to find which MIDI note (piano key) should play this root
        
        // Find the MIDI note number closest to our root frequency
        // Standard formula: MIDI note = 69 + 12 * log2(freq / 440)
        const midiNoteFloat = 69 + 12 * Math.log2(this.rootFrequency / 440);
        const closestMidiNote = Math.round(midiNoteFloat);
        
        // Calculate which scale degree this MIDI note represents in a 12-TET system
        // relative to middle C (MIDI 60)
        this.rootMidiNote = closestMidiNote;
        
        console.log(`MIDI Piano: Root ${this.rootFrequency.toFixed(2)} Hz → MIDI note ${closestMidiNote}`);
        console.log(`  Scale[0] will be mapped to MIDI ${closestMidiNote}`);
    }

    // Map MIDI note number to frequency using the 13-note scale
    // Maps the root to its correct piano key, then distributes the scale chromatically
    midiNoteToFrequency(midiNote) {
        if (!this.currentScale || this.currentScale.length !== 13) {
            console.warn('MIDI Piano: No valid scale available');
            return null;
        }

        if (!this.rootMidiNote) {
            console.warn('MIDI Piano: Root MIDI note not calculated');
            return null;
        }

        // Calculate how many semitones away from the root MIDI note
        const semitonesFromRoot = midiNote - this.rootMidiNote;
        
        // Calculate octave offset and scale degree
        // We use 12 semitones per octave (standard piano layout)
        // The 13th note in our scale is the octave, so we only use indices 0-11
        const octaveOffset = Math.floor(semitonesFromRoot / 12);
        let scaleDegree = semitonesFromRoot % 12;
        
        // Handle negative wrapping correctly
        if (scaleDegree < 0) {
            scaleDegree += 12;
        }

        // Get the base frequency from the scale (use only first 12 notes)
        const baseNote = this.currentScale[scaleDegree];
        
        // Apply octave transposition
        const frequency = baseNote.freq * Math.pow(2, octaveOffset);

        console.log(`MIDI ${midiNote} (${semitonesFromRoot >= 0 ? '+' : ''}${semitonesFromRoot} from root) → Scale[${scaleDegree}] × 2^${octaveOffset} = ${frequency.toFixed(2)} Hz`);

        return frequency;
    }

    // Handle MIDI Note On
    handleNoteOn(midiNote, velocity) {
        if (!this.isEnabled || !this.currentScale) {
            console.warn('MIDI Piano: Not ready to play notes');
            return;
        }

        const frequency = this.midiNoteToFrequency(midiNote);
        if (!frequency) return;

        console.log(`MIDI Piano: Note ON - MIDI ${midiNote}, Vel ${velocity}, Freq ${frequency.toFixed(2)} Hz`);

        // Play the note through the existing system
        // This will trigger both web audio and MIDI output
        if (window.playNote) {
            const noteId = window.playNote(frequency);
            this.activeNotes.set(midiNote, noteId);
        } else {
            console.error('MIDI Piano: playNote function not available');
        }
    }

    // Handle MIDI Note Off
    handleNoteOff(midiNote) {
        if (!this.isEnabled) return;

        console.log(`MIDI Piano: Note OFF - MIDI ${midiNote}`);

        const noteId = this.activeNotes.get(midiNote);
        if (noteId && window.midiController) {
            window.midiController.stopSpecificNotes([noteId]);
            this.activeNotes.delete(midiNote);
        }
    }

    // Enable/disable MIDI piano input
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`MIDI Piano: ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    // Stop all currently playing notes (panic button)
    stopAllNotes() {
        console.log('MIDI Piano: Stopping all notes');
        this.activeNotes.forEach((noteId) => {
            if (window.midiController) {
                window.midiController.stopSpecificNotes([noteId]);
            }
        });
        this.activeNotes.clear();
    }
}

// Create global instance
window.midiPianoHandler = new MidiPianoHandler();

// Setup UI toggle button
function setupMidiPianoUI(isInitialized) {
    const toggleBtn = document.getElementById('midi-piano-toggle');
    if (!toggleBtn) {
        console.error('MIDI Piano: Button not found in HTML!');
        return;
    }

    console.log('MIDI Piano: Setting up UI button');
    
    // Always show the button
    toggleBtn.style.display = 'block';

    // If MIDI not initialized, disable the button
    if (!isInitialized) {
        toggleBtn.textContent = 'MIDI Piano: Not Available';
        toggleBtn.classList.add('disabled');
        toggleBtn.disabled = true;
        return;
    }

    // Toggle handler
    toggleBtn.addEventListener('click', () => {
        const newState = !window.midiPianoHandler.isEnabled;
        window.midiPianoHandler.setEnabled(newState);

        if (newState) {
            toggleBtn.textContent = 'MIDI Piano: Enabled';
            toggleBtn.classList.remove('disabled');
        } else {
            toggleBtn.textContent = 'MIDI Piano: Disabled';
            toggleBtn.classList.add('disabled');
            window.midiPianoHandler.stopAllNotes();
        }
    });

    // Set initial state (disabled by default)
    toggleBtn.textContent = 'MIDI Piano: Disabled';
    toggleBtn.classList.add('disabled');
    toggleBtn.disabled = false;
    
    console.log('MIDI Piano: UI button ready');
}

// Auto-initialize when page loads
window.addEventListener('load', () => {
    console.log('MIDI Piano: Page loaded, waiting for initialization...');
    
    // Show button immediately (will update state after init)
    setupMidiPianoUI(false);
    
    // Wait a bit for MIDI controller to initialize, then try to init MIDI input
    setTimeout(async () => {
        console.log('MIDI Piano: Attempting initialization...');
        const success = await window.midiPianoHandler.initialize();
        
        // Update button state
        setupMidiPianoUI(success);
        
        if (!success) {
            console.warn('MIDI Piano: Initialization failed - button will be disabled');
        }
    }, 1500);
});
