// ============================================================================
// DYNAMIC 12-NOTE KEYBOARD MAPPING
// ============================================================================
// Maps keyboard keys to dynamically calculated notes based on clicked chord
// Uses 53-TET (53 equal divisions of the octave) calculated mathematically

// Keyboard layout: z s x d c v g b h n j m , (13 keys for chromatic scale)
const KEYBOARD_KEYS = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm', ','];

const scale_len = 13;

// Current dynamic keyboard mapping
let currentKeyboardMap = {};

// 53-TET calculation function
function get53tetRatio(steps) {
    return Math.pow(2, steps / 53.0);
}

// Find closest 53-TET step for a given frequency ratio relative to root
function findClosest53TETStep(ratio) {
    // Convert ratio to 53-TET steps
    const steps = Math.round(53 * Math.log2(ratio));
    return steps;
}

// Calculate 12-note scale from 4 chord notes using 53-TET
function calculateDynamic12Notes(chordFreqs) {
    // chordFreqs should be [root, alpha, beta, gamma]
    if (!chordFreqs || chordFreqs.length !== 4) {
        console.warn('Invalid chord frequencies for keyboard mapping');
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
    
    console.log('Chord notes mapped to 53-TET steps:');
    const labels = ['Root', 'α', 'β', 'γ'];
    chordSteps.forEach((step, i) => {
        const actualRatio = get53tetRatio(step);
        const actualFreq = rootFreq * actualRatio;
        console.log(`  ${labels[i]}: ${chordFreqs[i].toFixed(2)} Hz → Step ${step} (ratio: ${actualRatio.toFixed(4)}, freq: ${actualFreq.toFixed(2)} Hz)`);
    });

    // Step 2: Build a 12-note chromatic scale based on the chord's intervals
    // The 12 notes represent: Root, m2, M2, m3, M3, P4, tritone, P5, m6, M6, m7, M7
    // Their exact 53-TET steps depend on the chord clicked
    
    const rootStep = uniqueChordSteps[0];
    
    // Map the chord notes to approximate scale degrees (0-11)
    // Based on their 53-TET steps relative to root
    const chordIntervals = uniqueChordSteps.map(step => step - rootStep);
    
    console.log(`Chord intervals in 53-TET steps: ${chordIntervals.join(', ')}`);
    
    // Standard 12-TET chromatic in 53-TET steps (for reference):
    // 0, 4-5, 9, 13-14, 18, 22, 27, 31, 35-36, 40, 44-45, 49
    // But we adjust based on the actual chord intervals
    
    // Determine the scale based on chord intervals
    // If we have 3rd, 5th, 7th (like maj7: 18, 31, 49), fill in the chromatic scale
    const scale12Steps = [];
    
    // Always start with root
    scale12Steps.push(rootStep);
    
    // Distribute 11 more notes evenly across the octave (53 steps)
    // But prioritize the actual chord note positions
    for (let degree = 1; degree < 12; degree++) {
        // Target step for this scale degree in a 12-equal division of 53-TET
        const targetStep = rootStep + Math.round((degree / 12) * 53);
        
        // Check if any chord note is close to this target
        let closestToTarget = targetStep;
        let minDist = Infinity;
        
        // Check if a chord interval is near this degree
        for (const chordInterval of chordIntervals) {
            const chordStep = rootStep + chordInterval;
            const dist = Math.abs(chordStep - targetStep);
            if (dist < minDist && dist < 3) { // Within 3 steps tolerance
                minDist = dist;
                closestToTarget = chordStep;
            }
        }
        
        // If no chord note nearby, use the standard chromatic position
        if (minDist === Infinity) {
            closestToTarget = targetStep;
        }
        
        scale12Steps.push(closestToTarget);
    }
    
    // Remove duplicates and sort
    const final12Steps = [...new Set(scale12Steps)].sort((a, b) => a - b).slice(0, 12);
    
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
    
    // Add 13th note: root + octave (53 steps in 53-TET = one octave)
    const octaveStep = rootStep + 53;
    const octaveRatio = get53tetRatio(octaveStep);
    const octaveFreq = rootFreq * octaveRatio;
    scale12Notes.push({
        step: octaveStep,
        ratio: octaveRatio,
        freq: octaveFreq,
        isChordNote: true,  // It's the root, just an octave up
        chordLabel: 'Root (octave)'
    });

    console.log('Generated 13-note scale from 53-TET (12 notes + octave):');
    scale12Notes.forEach((note, i) => {
        const keyLabel = KEYBOARD_KEYS[i];
        const chordLabel = note.isChordNote ? ` ★ ${note.chordLabel}` : '';
        console.log(`  [${keyLabel}] ${i}: Step ${note.step}, ${note.freq.toFixed(2)} Hz (ratio: ${note.ratio.toFixed(4)})${chordLabel}`);
    });

    return scale12Notes;
}

// Update keyboard mapping based on new chord
function updateKeyboardMapping(chordFreqs) {
    const scale12 = calculateDynamic12Notes(chordFreqs);
    
    if (!scale12) return;

    // Map keys to frequencies
    currentKeyboardMap = {};
    KEYBOARD_KEYS.forEach((key, index) => {
        if (index < scale12.length) {
            currentKeyboardMap[key] = scale12[index].freq;
        }
    });

    console.log('Keyboard mapping updated:');
    Object.entries(currentKeyboardMap).forEach(([key, freq]) => {
        console.log(`  ${key}: ${freq.toFixed(2)} Hz`);
    });
}

// Octave shift multiplier (0 = normal, -1 = down octave, +1 = up octave)
let octaveShift = 0;

// Shift octave up or down
function shiftOctave(direction) {
    octaveShift += direction;
    octaveShift = Math.max(-2, Math.min(2, octaveShift)); // Limit to ±2 octaves
    console.log(`Octave shift: ${octaveShift > 0 ? '+' : ''}${octaveShift}`);
}

// Play single note from keyboard
function playKeyboardNote(key) {
    const baseFreq = currentKeyboardMap[key];
    
    if (!baseFreq) {
        console.log(`Key '${key}' not mapped`);
        return;
    }

    // Apply octave shift
    const freq = baseFreq * Math.pow(2, octaveShift);

    console.log(`Playing keyboard note: ${key} → ${freq.toFixed(2)} Hz (octave shift: ${octaveShift})`);

    // Call the playNote function from test.js
    if (typeof window.playNote === 'function') {
        window.playNote(freq);
    } else {
        console.error('playNote function not found');
    }
}

// Keyboard event listener
document.addEventListener('keydown', (event) => {
    // Ignore key repeats (this is the key for low latency!)
    if (event.repeat) return;
    
    const key = event.key;
    
    console.log(`[key_map] Key pressed: '${key}' (shiftKey: ${event.shiftKey})`);
    
    // Check for octave shift keys
    // < = octave down
    // > = octave up
    if (key === '<') {
        console.log('[key_map] Octave shift DOWN');
        event.preventDefault();
        shiftOctave(-1);
        return;
    }
    
    if (key === '>') {
        console.log('[key_map] Octave shift UP');
        event.preventDefault();
        shiftOctave(1);
        return;
    }
    
    // Check if this is one of our keyboard keys
    const lowerKey = key.toLowerCase();
    if (KEYBOARD_KEYS.includes(lowerKey)) {
        console.log(`[key_map] Playing note for key: ${lowerKey}`);
        // Prevent default behavior
        event.preventDefault();
        
        // Play the note
        playKeyboardNote(lowerKey);
    } else {
        console.log(`[key_map] Key '${key}' not in KEYBOARD_KEYS`);
    }
});

// Export functions for use in other files
window.updateKeyboardMapping = updateKeyboardMapping;
window.playKeyboardNote = playKeyboardNote;
window.KEYBOARD_KEYS = KEYBOARD_KEYS;

console.log('Dynamic keyboard mapping initialized');
console.log(`Keys: ${KEYBOARD_KEYS.join(' ')}`);
