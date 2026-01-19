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

        // Protection against rapid-fire duplicate messages
        this.recentMessages = new Map(); // midiNote -> timestamp
        this.messageThrottleMs = 50; // Ignore duplicate note-ons within 50ms

        console.log('MIDI Piano Handler initialized');
    }

    // Initialize Web MIDI API and setup input listeners
    async initialize() {
        console.log('MIDI Piano: Attempting to initialize...');

        // CRITICAL: Reuse the main MIDI controller's access instead of requesting our own
        // This prevents conflicts and ensures we're using the same MIDI system
        if (window.midiController && window.midiController.midiAccess) {
            console.log('MIDI Piano: Using shared MIDI access from main controller');
            this.midiAccess = window.midiController.midiAccess;
        } else {
            console.warn('MIDI Piano: Main MIDI controller not initialized yet, requesting own access');
            try {
                this.midiAccess = await navigator.requestMIDIAccess();
            } catch (error) {
                console.error('MIDI Piano: Failed to get MIDI access', error);
                return false;
            }
        }

        console.log('MIDI Piano: Access granted');

        // List available MIDI inputs
        this.listInputDevices();

        // Setup listeners for all MIDI inputs
        this.setupInputListeners();

        this.isEnabled = false; // Start disabled, user can enable via button
        console.log('MIDI Piano: Ready to receive input');

        return true;
    }

    // List all available MIDI input devices
    listInputDevices() {
        const inputs = Array.from(this.midiAccess.inputs.values());
        const outputs = Array.from(this.midiAccess.outputs.values());

        console.log('========================================');
        console.log('MIDI Piano: Available INPUT devices:');
        inputs.forEach((input, index) => {
            console.log(`  INPUT ${index + 1}: ${input.name} (${input.manufacturer}) [ID: ${input.id}]`);
        });

        console.log('MIDI Piano: Available OUTPUT devices:');
        outputs.forEach((output, index) => {
            console.log(`  OUTPUT ${index + 1}: ${output.name} (${output.manufacturer}) [ID: ${output.id}]`);
        });
        console.log('========================================');

        if (inputs.length === 0) {
            console.warn('MIDI Piano: No MIDI input devices found');
        }
    }

    // Setup MIDI input listeners for all connected devices
    setupInputListeners() {
        console.log('MIDI Piano: Setting up input listeners...');

        // Get the selected output device NAME to avoid feedback loop
        const outputDeviceName = window.midiController?.selectedOutput?.name;

        // First, clear any existing listeners
        for (let input of this.midiAccess.inputs.values()) {
            input.onmidimessage = null;
        }

        // Then attach new listeners (skipping output device BY NAME)
        for (let input of this.midiAccess.inputs.values()) {
            // CRITICAL: Skip any input that matches the output device NAME (prevents feedback loop)
            if (outputDeviceName && input.name === outputDeviceName) {
                console.warn(`MIDI Piano: [SKIPPED] ${input.name} (matches output device NAME - would create feedback loop)`);
                continue;
            }

            console.log(`MIDI Piano: [LISTENER ATTACHED] ${input.name} (ID: ${input.id}, Type: ${input.type}, State: ${input.state})`);

            // Store the device name for debugging
            const deviceName = input.name;

            input.onmidimessage = (message) => {
                console.log(`[MIDI Input from: ${deviceName}]`);
                this.handleMidiMessage(message);
            };
        }
        console.log(`MIDI Piano: Attached listeners to ${this.midiAccess.inputs.size} input device(s)`);
    }

    // Reinitialize input listeners (call when output device changes)
    reinitializeInputs() {
        if (this.midiAccess) {
            console.log('MIDI Piano: Reinitializing inputs to exclude new output device');
            this.setupInputListeners();
        }
    }

    // Handle incoming MIDI messages
    handleMidiMessage(message) {
        const [status, note, velocity] = message.data;
        const command = status & 0xf0;
        const channel = status & 0x0f;

        // LOG EVERYTHING to diagnose the issue
        console.log(`[MIDI Piano Input] Status: 0x${status.toString(16).padStart(2, '0')}, Note: ${note}, Vel: ${velocity}, Cmd: 0x${command.toString(16)}, Ch: ${channel}`);

        // Always allow note-offs to prevent stuck notes
        if (command === 0x80 || (command === 0x90 && velocity === 0)) {
            console.log(`[MIDI Piano Input] → Note OFF (note ${note})`);
            this.handleNoteOff(note);
            return;
        }

        // Block all other messages when disabled
        if (!this.isEnabled) {
            console.log(`[MIDI Piano Input] → BLOCKED (Piano disabled)`);
            return;
        }

        // Note On (0x90) - only process when enabled
        if (command === 0x90 && velocity > 0) {
            console.log(`[MIDI Piano Input] → Note ON (note ${note}, vel ${velocity})`);
            this.handleNoteOn(note, velocity);
        } else {
            console.log(`[MIDI Piano Input] → IGNORED (Unknown command: 0x${command.toString(16)})`);
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
    // Standard piano octave = 12 semitones. Map to first 12 notes of scale.
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

        // Standard piano: 12 semitones per octave
        const octaveOffset = Math.floor(semitonesFromRoot / 12);
        let scaleDegree = ((semitonesFromRoot % 12) + 12) % 12;

        // Use first 12 notes from the 13-note scale (13th is the octave)
        const baseNote = this.currentScale[scaleDegree];

        // Multiply by powers of 2 for each octave
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

        // PROTECTION: Throttle rapid duplicate note-ons (possible feedback loop)
        const now = Date.now();
        const lastMessage = this.recentMessages.get(midiNote);
        if (lastMessage && (now - lastMessage) < this.messageThrottleMs) {
            console.warn(`MIDI Piano: Ignoring duplicate note-on for MIDI ${midiNote} (too soon: ${now - lastMessage}ms)`);
            return;
        }
        this.recentMessages.set(midiNote, now);

        // Check if this note is already playing
        if (this.activeNotes.has(midiNote)) {
            console.warn(`MIDI Piano: Note ${midiNote} already playing, stopping it first`);
            this.handleNoteOff(midiNote);
        }

        const frequency = this.midiNoteToFrequency(midiNote);
        if (!frequency) return;

        console.log(`MIDI Piano: Note ON - MIDI ${midiNote}, Vel ${velocity}, Freq ${frequency.toFixed(2)} Hz`);

        // Play the note through the existing system
        // This will trigger both web audio and MIDI output
        if (window.playNote) {
            const noteId = window.playNote(frequency);
            // Store noteId (even if null) so we can track for visualization
            this.activeNotes.set(midiNote, noteId || `viz_${midiNote}`);
        } else {
            console.error('MIDI Piano: playNote function not available');
        }
    }

    // Handle MIDI Note Off
    handleNoteOff(midiNote) {
        // CRITICAL: Always process note-offs even when disabled
        // This prevents channel leaks when MIDI Piano is disabled while keys are held
        console.log(`MIDI Piano: Note OFF - MIDI ${midiNote}`);

        const noteId = this.activeNotes.get(midiNote);
        if (noteId) {
            // Stop the audio (only if it's a real noteId, not a visualization ID)
            if (window.midiController && !String(noteId).startsWith('viz_')) {
                window.midiController.stopSpecificNotes([noteId]);
            }
            this.activeNotes.delete(midiNote);
        }
    }

    // Enable/disable MIDI piano input
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`MIDI Piano: ${enabled ? 'Enabled' : 'Disabled'}`);

        // CRITICAL: When disabling, stop all active notes to free channels
        if (!enabled) {
            console.log('MIDI Piano: Disabling - stopping all active notes');
            this.stopAllNotes();
        }
    }

    updateChordVisualization() {
        if (!window.setMIDIActiveNotes) return;

        const midiNotes = [];
        this.activeNotes.forEach((noteId, midiNote) => {
            const freq = this.midiNoteToFrequency(midiNote);
            if (freq) {
                midiNotes.push({ freq: freq, velocity: 100, midiNote });
            }
        });

        window.setMIDIActiveNotes(midiNotes);
    }

    // Call this repeatedly to update visualization (called from outside)
    updateVisualizationLoop() {
        this.updateChordVisualization();
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
        
        // Clear chord visualization
    }
}

// Create global instance
window.midiPianoHandler = new MidiPianoHandler();

// Update visualization every frame
setInterval(() => {
    if (window.midiPianoHandler) {
        window.midiPianoHandler.updateVisualizationLoop();
    }
}, 16); // ~60fpslicate listeners
let isButtonSetup = false;

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

    // Only add event listener once to prevent duplicate handlers
    if (!isButtonSetup) {
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

        isButtonSetup = true;
        console.log('MIDI Piano: Event listener attached');
    } else {
        console.log('MIDI Piano: Event listener already exists, skipping');
    }

    // Set initial state (disabled by default)
    toggleBtn.textContent = 'MIDI Piano: Disabled';
    toggleBtn.classList.add('disabled');
    toggleBtn.disabled = false;

    console.log('MIDI Piano: UI button ready');
}

// Export the setup function for external use
window.setupMidiPianoUI = setupMidiPianoUI;

console.log('MIDI Piano Handler loaded and ready');