// ============================================================================
// DYNAMIC 12-NOTE KEYBOARD MAPPING
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
// Maps keyboard keys to dynamically calculated notes based on clicked chord
// Uses 53-TET (53 equal divisions of the octave) calculated mathematically

// Keyboard layout: z s x d c v g b h n j m , (13 keys for chromatic scale)
const KEYBOARD_KEYS = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm', ','];

const scale_len = 13;

// Current dynamic keyboard mapping
let currentKeyboardMap = {};

// Track active notes for note-off
let activeKeyNotes = {}; // key -> noteId mapping

// Tuning math now delegates to the active temperament (temperament.js). During
// Phase 1 the active temperament is always 53-TET, so results are byte-identical.
function get53tetRatio(steps) {
    return window.Temperament.active.stepToRatio(steps);
}

// Find closest step for a given frequency ratio relative to root.
function findClosest53TETStep(ratio) {
    return window.Temperament.active.ratioToStep(ratio);
}

// Calculate 12-note scale from 4 chord notes using 53-TET
function calculateDynamic12Notes(chordFreqs) {
    // chordFreqs should be [root, alpha, beta, gamma]
    if (!chordFreqs || chordFreqs.length !== 4) {
        // console.warn('Invalid chord frequencies for keyboard mapping');
        return null;
    }

    const rootFreq = chordFreqs[0];

    // Step 1: Convert chord frequencies to 53-TET steps relative to root
    const chordSteps = chordFreqs.map(freq => {
        const ratio = freq / rootFreq;
        return findClosest53TETStep(ratio);
    });

    // Sort and remove duplicates
    const uniqueChordSteps = [...new Set(chordSteps)].sort((a, b) => a - b);

    // console.log('Chord notes mapped to 53-TET steps:');
    const labels = ['Root', 'α', 'β', 'γ'];
    chordSteps.forEach((step, i) => {
        const actualRatio = get53tetRatio(step);
        const actualFreq = rootFreq * actualRatio;
        // console.log(`  ${labels[i]}: ${chordFreqs[i].toFixed(2)} Hz → Step ${step} (ratio: ${actualRatio.toFixed(4)}, freq: ${actualFreq.toFixed(2)} Hz)`);
    });

    // Step 2: Build a 13-note scale with chord notes at diatonic positions
    // Keyboard positions: z s x d c v g b h n j m ,
    // Positions:          0 1 2 3 4 5 6 7 8 9 10 11 12

    const rootStep = uniqueChordSteps[0];
    const chordIntervals = uniqueChordSteps.map(step => step - rootStep);

    //console.log(`Chord intervals in 53-TET steps: ${chordIntervals.join(', ')}`);

    // Classify intervals and assign keyboard positions dynamically
    // 53-TET interval ranges (based on just intonation):
    // Minor 3rds: 11-14 (sm=11, vm=12, m=13, ^m=14)
    // Neutral 3rds: 15-16 (n=15, N=16)
    // Major 3rds: 17-20 (vM=17, M=18, ^M=19, SM=20)
    // Perfect 4th: ~22, Perfect 5th: ~31
    // Minor 7ths: 42-45, Neutral 7th: ~46, Major 7ths: 47-51

    const scale12Steps = new Array(12);
    const chordPositions = []; // Will be calculated dynamically

    chordIntervals.forEach((interval, i) => {
        let pos = null;

        if (interval === 0) {
            // Root
            pos = 0; // z
        } else if (interval >= 11 && interval <= 14) {
            // Minor 3rd (sm=11, vm=12, m=13, ^m=14)
            pos = 3; // d
        } else if (interval >= 15 && interval <= 16) {
            // Neutral 3rd (n=15, N=16)
            pos = 3; // d (treat as minor position)
        } else if (interval >= 17 && interval <= 20) {
            // Major 3rd (vM=17, M=18, ^M=19, SM=20)
            pos = 4; // c
        } else if (interval >= 21 && interval <= 24) {
            // Perfect 4th region
            pos = 5; // v
        } else if (interval >= 25 && interval <= 28) {
            // Augmented 4th / Diminished 5th (tritone)
            pos = 6; // g
        } else if (interval >= 29 && interval <= 33) {
            // Perfect 5th (≈31 steps)
            pos = 7; // b
        } else if (interval >= 34 && interval <= 37) {
            // Minor 6th / Augmented 5th
            pos = 8; // h
        } else if (interval >= 38 && interval <= 41) {
            // Major 6th
            pos = 9; // n
        } else if (interval >= 42 && interval <= 45) {
            // Minor 7th
            pos = 10; // j
        } else if (interval === 46) {
            // Neutral 7th
            pos = 10; // j (treat as minor position)
        } else if (interval >= 47 && interval <= 51) {
            // Major 7th
            pos = 11; // m
        } else if (interval >= 52) {
            // Octave (will be handled separately at position 12)
            pos = 12; // ,
        }

        if (pos !== null && pos < 12) {
            scale12Steps[pos] = rootStep + interval;
            chordPositions.push(pos);
        }
    });

    // Fill in the gaps with evenly distributed chromatic steps
    for (let i = 0; i < 12; i++) {
        if (scale12Steps[i] === undefined) {
            // Find the surrounding defined notes
            let prevPos = -1, nextPos = 12;
            for (let j = i - 1; j >= 0; j--) {
                if (scale12Steps[j] !== undefined) {
                    prevPos = j;
                    break;
                }
            }
            for (let j = i + 1; j < 12; j++) {
                if (scale12Steps[j] !== undefined) {
                    nextPos = j;
                    break;
                }
            }

            // Interpolate between surrounding notes
            if (prevPos >= 0 && nextPos < 12) {
                const prevStep = scale12Steps[prevPos];
                const nextStep = scale12Steps[nextPos];
                const range = nextStep - prevStep;
                const positions = nextPos - prevPos;
                const offset = i - prevPos;
                scale12Steps[i] = Math.round(prevStep + (range * offset / positions));
            } else if (prevPos >= 0) {
                // Fill from last defined note to octave
                const prevStep = scale12Steps[prevPos];
                const range = rootStep + window.Temperament.active.octave - prevStep;
                const positions = 12 - prevPos;
                const offset = i - prevPos;
                scale12Steps[i] = Math.round(prevStep + (range * offset / positions));
            } else {
                // Fill from root (shouldn't happen)
                scale12Steps[i] = rootStep + Math.round((i / 12) * window.Temperament.active.N);
            }
        }
    }

    const final12Steps = scale12Steps;

    // Convert steps to frequencies
    const scale12Notes = final12Steps.map(step => {
        const ratio = get53tetRatio(step);
        const freq = rootFreq * ratio;
        const isChordNote = chordSteps.includes(step);
        const chordIndex = chordSteps.indexOf(step);

        return {
            step: step,
            ratio: ratio,
            freq: freq,
            isChordNote: isChordNote,
            chordLabel: isChordNote ? labels[chordIndex] : null
        };
    });

    // ALWAYS add 13th note: root + octave (MUST be rootStep + N)
    // This ensures the ',' key is ALWAYS the octave up, regardless of scale calculation
    const octaveStep = rootStep + window.Temperament.active.octave;
    const octaveRatio = get53tetRatio(octaveStep);
    const octaveFreq = rootFreq * octaveRatio;
    scale12Notes.push({
        step: octaveStep,
        ratio: octaveRatio,
        freq: octaveFreq,
        isChordNote: true,  // It's the root, just an octave up
        chordLabel: 'Root (octave)'
    });

    // console.log('Generated 13-note scale from 53-TET (12 notes + octave):');
    scale12Notes.forEach((note, i) => {
        const keyLabel = KEYBOARD_KEYS[i];
        const chordLabel = note.isChordNote ? ` ★ ${note.chordLabel}` : '';
        // console.log(`  [${keyLabel}] ${i}: Step ${note.step}, ${note.freq.toFixed(2)} Hz (ratio: ${note.ratio.toFixed(4)})${chordLabel}`);
    });

    return scale12Notes;
}

// 53-TET note names (53 notes per octave)
// Array index represents steps from A (step 0 = A)
const TET53_NOTE_NAMES = [
    'A', '^A', '^^A', 'vBb', 'Bb', '^Bb', '^^Bb', 'vvB', 'vB', 'B', '^B', '^^B', 'vC',
    'C', '^C', '^^C', 'vvC#', 'vC#', 'C#', '^C#', '^^C#', 'vD', 'D', '^D', '^^D',
    'vvD#', 'vD#', 'D#', '^^Eb', 'vvE', 'vE', 'E', '^E', '^^E', 'vF', 'F', '^F', '^^F',
    'vvF#', 'vF#', 'F#', '^F#', '^^F#', 'vG', 'G', '^G', '^^G', 'vvG#', 'vG#', 'G#', '^G#', 'vvA', 'vA'
];

// Get 53-TET note name for a given step
// Step 0 = A, step 13 = C, step 31 = E, etc.
function get53TETNoteName(step) {
    const normalizedStep = ((step % 53) + 53) % 53; // Handle negative steps
    return TET53_NOTE_NAMES[normalizedStep];
}

// Determine which 53-TET note (relative to A=0) a frequency corresponds to
function getRootNoteStep(freq) {
    // A4 = 440 Hz is step 0 in our reference system
    const A4 = 440.0;
    const ratio = freq / A4;
    const steps = window.Temperament.active.ratioToStep(ratio);
    return steps;
}

// Update keyboard mapping based on new chord
// Global storage for current scale color
let currentScaleColor = [255, 255, 255];

function updateKeyboardMapping(chordFreqs, color) {
    // The MS computer keyboard is the FIXED KL Lumatone 53-TET map
    // (window.klNoteForKeyCode): every key is a fixed 53-TET note, chord-independent,
    // no scale imposed. Nothing to update per chord — kept as a no-op for the caller.
}

// Update MIDI Piano scale separately (so x2 buttons don't affect it)
function updateMidiPianoScale(chordFreqs) {
    const scale12 = calculateDynamic12Notes(chordFreqs);

    if (!scale12) return;

    // Update MIDI piano handler with the new scale
    if (window.midiPianoHandler && scale12) {
        const rootFreq = chordFreqs[0];
        window.midiPianoHandler.updateScale(scale12, rootFreq);
    }
}

// Play a key's note. MS keyboard = the KL Lumatone 53-TET map: each physical key
// (event.code) is a FIXED 53-TET note (window.klNoteForKeyCode), no scale imposed.
function playKeyboardNote(code) {
    if (typeof window.klNoteForKeyCode !== 'function') return false;
    const note = window.klNoteForKeyCode(code);
    if (!note) return false;
    if (typeof window.playNote === 'function') {
        activeKeyNotes[code] = window.playNote(note.frequency);
    }
    return true;
}

// Stop a key's note on release.
function stopKeyboardNote(code) {
    const noteId = activeKeyNotes[code];
    if (noteId && window.midiController) window.midiController.stopSpecificNotes([noteId]);
    delete activeKeyNotes[code];
}

// Keyboard event listener
document.addEventListener('keydown', (event) => {
    // Ignore key repeats (this is the key for low latency!)
    if (event.repeat) return;

    const key = event.key;

    // console.log(`[key_map] Key pressed: '${key}' (shiftKey: ${event.shiftKey})`);

    // In the Keyboard scene, keyboard.js owns all key input (hex notes via its
    // own keydown). Bail so we don't also fire a Modal Studio note.
    if (window.ANIMA && window.ANIMA.getCurrentScene() === window.ANIMA.Scenes.KEYBOARD) {
        return;
    }

    // Shortcuts (handled before the note-key block so the letters don't also
    // trigger notes). The Keyboard scene already bailed above.
    //   Shift+M — toggle the Chord Memory grid (app-wide: EigenSpace + Modal Studio)
    //   Shift+L — toggle the Layered / Full 3D view (EigenSpace only)
    if (event.shiftKey) {
        const inEigenspace = !window.ANIMA
            || window.ANIMA.getCurrentScene() === window.ANIMA.Scenes.EIGENSPACE;
        const shifted = key.toLowerCase();
        if (shifted === 'm' && typeof window.toggleChordGrid === 'function') {
            event.preventDefault();
            window.toggleChordGrid();
            return;
        }
        if (inEigenspace && shifted === 'l') {
            const vizToggle = document.getElementById('viz-mode-toggle');
            if (vizToggle) {
                event.preventDefault();
                vizToggle.click();
                return;
            }
        }
    }

    // In EigenSpace, note keys are handled by EigenspaceScene.keyPressed (53-TET
    // root selection using the Keyboard scene's map), played through ES's own
    // synth. So key_map only provides the Shift shortcuts above here — bail before
    // the Modal Studio note playback below. (key_map's note playback is for MS.)
    if (window.ANIMA && window.ANIMA.getCurrentScene() === window.ANIMA.Scenes.EIGENSPACE) {
        return;
    }

    // MS: the whole keyboard is the KL Lumatone 53-TET map. Each physical key is a
    // fixed 53-TET note; pressing it plays that note (the Frequency Spectrum shows it).
    if (playKeyboardNote(event.code)) {
        event.preventDefault();
    }
});

// Keyup — stop the note for that physical key.
document.addEventListener('keyup', (event) => {
    if (activeKeyNotes[event.code] !== undefined) {
        event.preventDefault();
        stopKeyboardNote(event.code);
    }
});

// Export functions for use in other files
window.updateKeyboardMapping = updateKeyboardMapping;
window.updateMidiPianoScale = updateMidiPianoScale;
window.playKeyboardNote = playKeyboardNote;
window.KEYBOARD_KEYS = KEYBOARD_KEYS;

// console.log('Dynamic keyboard mapping initialized');
// console.log(`Keys: ${KEYBOARD_KEYS.join(' ')}`);