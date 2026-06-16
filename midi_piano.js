// ============================================================================
// MIDI PIANO INPUT HANDLER
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
// Receives MIDI input from physical keyboard (e.g., Oxygen 49)
// Maps incoming notes to dynamic 53-TET scale while preserving C as root
// Sends retuned notes via MPE output

// Name a chord pressed on the MIDI keyboard for the Chord Memory grid. MIDI keys are
// physical 12-TET semitones, so we read the shape relative to the lowest held key (the
// bass = the root, which also resolves the pitch-class ambiguities Cm7≡Eb6, Csus2≡Gsus4
// the way the player hears them). Rather than a flat template per chord — which explodes
// once 9ths/11ths/13ths and their alterations are added — we work analytically:
//   1. read the core (third, fifth, seventh / sixth) → a base quality token,
//   2. whatever pitch classes are left over are extensions (b9 9 #9, 11 #11, b13 13),
//   3. compose: natural extensions stack into the chord number (9/11/13) for 7th-family
//      chords, altered extensions are appended (e.g. maj7#11, 7b9, 13#11, 7#9).
// Returns the quality label, 'cust' for an unrecognized 2+ note cluster, or null for a
// single pitch. The label is the root-position quality; the grid stores the root (Hz)
// separately. The 53-TET path (keyboard.js) follows the same core+extension scheme.
function midiChordName12TET(midiNotes) {
    if (!midiNotes || midiNotes.length === 0) return null;
    const distinct = [...new Set(midiNotes.map(n => ((n % 12) + 12) % 12))];
    if (distinct.length < 2) return null;

    const rootPc = ((Math.min(...midiNotes) % 12) + 12) % 12;
    const S = new Set(distinct.map(pc => (((pc - rootPc) % 12) + 12) % 12)); // relative to root
    const has = (i) => S.has(i);
    const used = new Set([0]);

    // ---- core tones ----
    let third = null;                                  // 'M' | 'm' | null(sus/power)
    if (has(4)) { third = 'M'; used.add(4); }
    else if (has(3)) { third = 'm'; used.add(3); }

    let fifth = null;                                  // 'P' | 'dim' | 'aug' | null
    if (has(7)) { fifth = 'P'; used.add(7); }
    else if (has(6)) { fifth = 'dim'; used.add(6); }
    else if (has(8)) { fifth = 'aug'; used.add(8); }

    let seventh = null;                                // 'M7' | 'm7' | null
    if (has(11)) { seventh = 'M7'; used.add(11); }
    else if (has(10)) { seventh = 'm7'; used.add(10); }

    let sixth = false, dimSeventh = false;
    if (has(9) && !used.has(9)) {
        if (third === 'm' && fifth === 'dim' && !seventh) { dimSeventh = true; used.add(9); }
        else if (!seventh) { sixth = true; used.add(9); }
        // else: a 9 alongside a 7th is the 13th — handled as an extension below
    }

    // ---- base quality token ----
    let base = null;
    if (third === null) {
        const susAllowed = (fifth === 'P') || (seventh !== null); // avoid naming clusters
        let sus = null;
        if (susAllowed && has(5)) { sus = 'sus4'; used.add(5); }
        else if (susAllowed && has(2)) { sus = 'sus2'; used.add(2); }
        if (sus) {
            base = seventh === 'm7' ? '7' + sus : seventh === 'M7' ? 'maj7' + sus : sus;
        } else if (fifth === 'P' && S.size === 2) {
            base = '5';                                 // power chord
        }
    } else if (third === 'M') {
        if (fifth === 'aug') {
            base = seventh === 'm7' ? '7#5' : seventh === 'M7' ? 'maj7#5' : 'aug';
        } else {
            base = seventh === 'M7' ? 'maj7' : seventh === 'm7' ? '7' : sixth ? '6' : 'maj';
        }
    } else { // minor third
        if (fifth === 'dim') {
            base = dimSeventh ? 'dim7' : seventh === 'm7' ? 'm7b5'
                : seventh === 'M7' ? 'mMaj7b5' : 'dim';
        } else if (fifth === 'aug') {
            base = seventh === 'm7' ? 'm7#5' : seventh === 'M7' ? 'mMaj7#5' : 'm#5';
        } else {
            base = seventh === 'M7' ? 'mMaj7' : seventh === 'm7' ? 'm7' : sixth ? 'm6' : 'min';
        }
    }
    if (base === null) return 'cust';

    // ---- extensions (leftover scale degrees) ----
    const alts = [];                                    // altered: b9 #9 #11 b13 (pitch order)
    for (const [pc, label] of [[1, 'b9'], [3, '#9'], [6, '#11'], [8, 'b13']]) {
        if (has(pc) && !used.has(pc)) { alts.push(label); used.add(pc); }
    }
    const nat9 = has(2) && !used.has(2);
    const nat11 = has(5) && !used.has(5);
    const nat13 = has(9) && !used.has(9);
    const stack = nat13 ? '13' : nat11 ? '11' : nat9 ? '9' : null; // highest natural

    // ---- compose ----
    const seventhFamily = {
        '7': (n) => n, 'maj7': (n) => 'maj' + n, 'm7': (n) => 'm' + n,
        'mMaj7': (n) => 'mMaj' + n, 'm7b5': (n) => 'm' + n + 'b5'
    };
    let name = base;
    if (stack && seventhFamily[base]) {
        name = seventhFamily[base](stack);              // 7→9/11/13, maj7→maj9, m7→m9, …
    } else if (stack) {
        // triads / 6 / aug / dim7 / sus etc.: write the natural as an add (6+9 → 6/9).
        // Major/minor triads use the idiomatic add form (Cadd9, Cmadd9).
        if (base === '6' || base === 'm6') name = base + '/9';
        else if (base === 'maj') name = 'add' + stack;          // major triad add (e.g. add9)
        else if (base === 'min') name = 'm' + 'add' + stack;    // minor triad add (e.g. madd9)
        else name = base + 'add' + stack;
    }
    name += alts.join('');
    return name;
}

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

        // ONE-TIME startup check (nothing watches for later plug-ins): if a
        // usable keyboard input is already connected, start ENABLED — no trip
        // to MIDI Settings just to click the button. A keyboard connected
        // after startup is enabled manually, as before.
        this.isEnabled = this.hasUsableInput();
        console.log(this.isEnabled
            ? 'MIDI Piano: keyboard detected → auto-enabled'
            : 'MIDI Piano: Ready to receive input (disabled)');

        return true;
    }

    // A "usable" input is anything that isn't the selected output's loopback
    // or a Launchpad — the same skip rules as setupInputListeners().
    hasUsableInput() {
        if (!this.midiAccess) return false;
        const outputDeviceName = window.midiController?.selectedOutput?.name;
        for (const input of this.midiAccess.inputs.values()) {
            if (outputDeviceName && input.name === outputDeviceName) continue;
            if (input.name && /launchpad/i.test(input.name)) continue;
            return true;
        }
        return false;
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

            // Skip Launchpad: handled by launchpadHandler, must not trigger piano notes.
            if (input.name && /launchpad/i.test(input.name)) {
                console.log(`MIDI Piano: [SKIPPED] ${input.name} (Launchpad — routed to launchpadHandler)`);
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

        // Keyboard (KL) scene: a physical MIDI key lights up its hex on the 53-TET
        // grid as soon as the key is sent — the visual mirror of the computer-keyboard
        // mapping. The key is remapped to a MICROTONAL pitch by the active scale (not
        // 12-TET), so we light the hex matching that remapped frequency. Done here
        // (before the enable gate) so the hex shows whenever the MIDI keyboard is
        // active, not only when the MIDI Piano audio toggle is on. Note-off clears it
        // via handleNoteOff above.
        if (command === 0x90 && velocity > 0 && this.isKeyboardScene()
            && typeof window.keyboardHighlightMidiNote === 'function') {
            // Use the key's remapped microtonal pitch when a scale is loaded;
            // before any chord/scale defines a mapping, fall back to plain 12-TET
            // as a neutral starting point (440·2^((n−69)/12)).
            const freq = (this.currentScale && this.rootMidiNote)
                ? this.midiNoteToFrequency(note)
                : 440 * Math.pow(2, (note - 69) / 12);
            if (freq) window.keyboardHighlightMidiNote(note, true, freq);
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

        //console.log('MIDI Piano: Scale updated');
        //console.log(`  Root frequency: ${rootFreq.toFixed(2)} Hz`);
        //console.log(`  13-note scale:`, scale13Notes.map(n => n.freq.toFixed(2) + ' Hz'));

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

        //console.log(`MIDI Piano: Root ${this.rootFrequency.toFixed(2)} Hz → MIDI note ${closestMidiNote}`);
        //console.log(`  Scale[0] will be mapped to MIDI ${closestMidiNote}`);
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

    // True when the hex Keyboard (KL) scene is the active scene.
    isKeyboardScene() {
        const A = window.ANIMA;
        return !!(A && A.Scenes && A.getCurrentScene() === A.Scenes.KEYBOARD);
    }

    // Handle MIDI Note On
    handleNoteOn(midiNote, velocity) {
        if (!this.isEnabled) {
            console.warn('MIDI Piano: input disabled');
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

        // Use the active scale's microtonal pitch when a chord/scale is loaded; otherwise
        // fall back to plain 12-TET so the keyboard ALWAYS plays + drives MIDI-out (Ableton),
        // even before any chord has been selected (was: bail when no scale → silent keyboard).
        const frequency = (this.currentScale && this.rootMidiNote)
            ? this.midiNoteToFrequency(midiNote)
            : 440 * Math.pow(2, (midiNote - 69) / 12);
        if (!frequency) return;

        console.log(`MIDI Piano: Note ON - MIDI ${midiNote}, Vel ${velocity}, Freq ${frequency.toFixed(2)} Hz`);

        // KL scene: the physical keyboard mirrors the hex chord menu — each key plays the
        // SELECTED chord (quality + 9/11, or a single note in single-note mode) rooted at this
        // key, to local audio + MIDI-out. Returns the chord's note-ids (array) for note-off.
        if (this.isKeyboardScene() && typeof window.klPlayMidiKeyChord === 'function') {
            const ids = window.klPlayMidiKeyChord(frequency);
            this.activeNotes.set(midiNote, (ids && ids.length) ? ids : `viz_${midiNote}`);
            this.captureHeldChord();
            return;
        }

        // Other scenes: play a single note through the existing system (web audio + MIDI out).
        if (window.playNote) {
            const noteId = window.playNote(frequency);
            // Store noteId (even if null) so we can track for visualization
            this.activeNotes.set(midiNote, noteId || `viz_${midiNote}`);
        } else {
            console.error('MIDI Piano: playNote function not available');
        }

        // Record the chord currently being held as the "last chord pressed" for the
        // app-wide Chord Memory grid. As a chord is pressed, each note-on grows the
        // held set, so the final note leaves the complete chord pending — exactly like
        // clicking a chord. Storing still happens when the user clicks a grid cell.
        this.captureHeldChord();
    }

    // Snapshot the currently-held MIDI notes (as absolute Hz, low→high) into the
    // app-wide Chord Memory as the pending chord. Mirrors keyboard.js captureKeyboardChord.
    captureHeldChord() {
        if (typeof window.captureChord !== 'function' || this.activeNotes.size === 0) return;
        const seen = new Set();
        const freqs = [];
        for (const midiNote of this.activeNotes.keys()) {
            const f = this.midiNoteToFrequency(midiNote);
            if (!f) continue;
            const k = Math.round(f * 100); // dedup near-identical pitches
            if (!seen.has(k)) { seen.add(k); freqs.push(f); }
        }
        if (freqs.length === 0) return;
        freqs.sort((a, b) => a - b);

        // Name the chord from the 12-TET shape of the held keys: known quality → its
        // label, an unrecognized 2+ note cluster → 'cust', a single note → no name.
        const chordName = midiChordName12TET([...this.activeNotes.keys()]);

        const Scenes = (window.ANIMA && window.ANIMA.Scenes) ? window.ANIMA.Scenes : null;
        window.captureChord({
            frequencies: freqs,
            root: freqs[0],
            chordName: chordName,
            cellColor: null,
            sourceScene: Scenes ? Scenes.MODALSTUDIO : 1
        });
    }

    // Handle MIDI Note Off
    handleNoteOff(midiNote) {
        // CRITICAL: Always process note-offs even when disabled
        // This prevents channel leaks when MIDI Piano is disabled while keys are held
        console.log(`MIDI Piano: Note OFF - MIDI ${midiNote}`);

        // Clear any KL hex highlight lit on note-on. Unconditional (no scene
        // check) so a note released after switching scenes can't leave a hex stuck.
        if (typeof window.keyboardHighlightMidiNote === 'function') {
            window.keyboardHighlightMidiNote(midiNote, false);
        }

        const stored = this.activeNotes.get(midiNote);
        if (stored) {
            // Release the MIDI note(s). A KL chord stores an ARRAY of note-ids; a single note
            // stores one id; a viz-only placeholder ('viz_…') has nothing to stop.
            if (window.midiController) {
                const ids = Array.isArray(stored)
                    ? stored
                    : (String(stored).startsWith('viz_') ? [] : [stored]);
                if (ids.length) window.midiController.stopSpecificNotes(ids);
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

    // Initial state mirrors the handler (auto-enabled at startup when a
    // keyboard was already connected), not a hardcoded "Disabled".
    const enabled = window.midiPianoHandler.isEnabled;
    toggleBtn.textContent = enabled ? 'MIDI Piano: Enabled' : 'MIDI Piano: Disabled';
    toggleBtn.classList.toggle('disabled', !enabled);
    toggleBtn.disabled = false;

    console.log('MIDI Piano: UI button ready');
}

// Export the setup function for external use
window.setupMidiPianoUI = setupMidiPianoUI;

console.log('MIDI Piano Handler loaded and ready');