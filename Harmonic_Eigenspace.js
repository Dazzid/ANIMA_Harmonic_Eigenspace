// ============================================================================
// CONFIGURATION FLAGS
// ============================================================================
const ENABLE_DISTANCE_LINES = false; // Set to false to disable line rendering for better performance

// Dissonance calculation (Plomp-Levelt)
// Global storage for computed dissonance data
let globalDissonanceData = null;
let currentBaseFreq = 220.0;
let cachedHarmonicNodes = null; // Cache node positions (in ratio space)
let visualizationMode = 'sectioned'; // 'sectioned' or 'full3d'

const zoneSize = 2.0;
const zoneFull = 2.0;
const chordSize = 9.0;

// Keyboard shortcuts for root note selection
const keyToFreq = {
    'a': 130.81,   // C3
    'w': 138.59,   // C#3
    's': 146.83,   // D3
    'e': 155.56,   // D#3
    'd': 164.81,   // E3
    'f': 174.61,   // F3
    't': 185.00,   // F#3
    'g': 196.00,   // G3
    'y': 207.65,   // G#3
    'h': 220.00,   // A3
    'u': 233.08,   // A#3
    'j': 246.94,   // B3
    'k': 261.63    // C4
};

const freqToName = {
    130.81: 'C3', 138.59: 'C#3', 146.83: 'D3', 155.56: 'D#3',
    164.81: 'E3', 174.61: 'F3', 185.00: 'F#3', 196.00: 'G3',
    207.65: 'G#3', 220.00: 'A3', 233.08: 'A#3', 246.94: 'B3', 261.63: 'C4'
};

//Second version of the dissonance measure with less selective parameters
function dissmeasure(fvec, amp, model = "min") {
    const sorted = fvec.map((f, i) => [f, amp[i]]).sort((a, b) => a[0] - b[0]);
    const fr_sorted = sorted.map(x => x[0]);
    const am_sorted = sorted.map(x => x[1]);

    const Dstar = 0.24;
    const S1 = 0.0207;
    const S2 = 18.96;
    // const C1 = 8, C2 = -8, A1 = -5.0, A2 = -7.0;
    const C1 = 5, C2 = -5, A1 = -3.51, A2 = -5.75;

    let total = 0;
    for (let i = 0; i < fr_sorted.length; i++) {
        for (let j = i + 1; j < fr_sorted.length; j++) {
            const Fmin = fr_sorted[i];
            const S = Dstar / (S1 * Fmin + S2);
            const Fdif = fr_sorted[j] - fr_sorted[i];
            const a = model === "min" ? Math.min(am_sorted[i], am_sorted[j]) : am_sorted[i] * am_sorted[j];
            const SFdif = S * Fdif;
            total += a * (C1 * Math.exp(A1 * SFdif) + C2 * Math.exp(A2 * SFdif));
        }
    }
    return total;
}

// Helper function to calculate dissonance at a specific point
function calculateDissonanceAt(alpha, beta, gamma, baseFreq, numHarmonics, model = "min") {
    const freqBase = [];
    const ampBase = [];
    for (let h = 1; h <= numHarmonics; h++) {
        freqBase.push(baseFreq * h);
        ampBase.push(1.0);
    }

    const freqAlpha = freqBase.map(f => f * alpha);
    const freqBeta = freqBase.map(f => f * beta);
    const freqGamma = freqBase.map(f => f * gamma);

    const allFreq = freqBase.concat(freqAlpha, freqBeta, freqGamma);
    const allAmp = ampBase.concat(ampBase, ampBase, ampBase);

    return dissmeasure(allFreq, allAmp, model);
}

// Stochastic refinement - "shake" nodes to find true minimum
function refineNodeStochastic(node, baseFreq, numHarmonics, iterations = 100) {
    let bestAlpha = node.alpha;
    let bestBeta = node.beta;
    let bestGamma = node.gamma;
    let bestDiss = node.dissonance;

    const initialStep = 0.015;
    let stepSize = initialStep;
    let noImprovement = 0;

    for (let i = 0; i < iterations; i++) {
        const testAlpha = bestAlpha + (Math.random() - 0.5) * stepSize;
        const testBeta = bestBeta + (Math.random() - 0.5) * stepSize;
        const testGamma = bestGamma + (Math.random() - 0.5) * stepSize;

        if (testAlpha >= 1.0 && testAlpha <= 2.0 &&
            testBeta >= 1.0 && testBeta <= 2.0 &&
            testGamma >= 1.0 && testGamma <= 2.0 &&
            testAlpha <= testBeta && testBeta <= testGamma) {

            const testDiss = calculateDissonanceAt(testAlpha, testBeta, testGamma, baseFreq, numHarmonics);

            if (testDiss < bestDiss) {
                bestAlpha = testAlpha;
                bestBeta = testBeta;
                bestGamma = testGamma;
                bestDiss = testDiss;
                noImprovement = 0;
                stepSize = initialStep;
            } else {
                noImprovement++;
            }
        }

        if (noImprovement > 10) {
            stepSize *= 0.8;
            noImprovement = 0;
        }
    }

    return { alpha: bestAlpha, beta: bestBeta, gamma: bestGamma, dissonance: bestDiss };
}

// Audio synthesis with p5.sound -----------------------------------------------------
let audioCtx;
let reverbNode;
let audioInitialized = false;

// Audio parameters - controlled by GUI
let audioParams = {
    waveType: 'sine',
    attack: 0.2,
    sustain: 1.5, // Max 2 seconds total
    release: 0.3,
    attackLevel: 1.0,    // peak amplitude after attack
    sustainLevel: 0.7,    // sustain amplitude level
    dryWet: 0.5
};

// Create reverb impulse response
function createReverb() {
    const convolver = audioCtx.createConvolver();
    const rate = audioCtx.sampleRate;
    const length = rate * 2;
    const impulse = audioCtx.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    convolver.buffer = impulse;
    return convolver;
}

// Initialize audio on first user interaction
async function initAudio() {
    if (audioInitialized) return;

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await audioCtx.resume();
        reverbNode = createReverb();
        reverbNode.connect(audioCtx.destination);

        // PRE-WARM: Play a silent note to prime the audio graph
        const warmupOsc = audioCtx.createOscillator();
        const warmupGain = audioCtx.createGain();
        warmupGain.gain.value = 0.0001;
        warmupOsc.connect(warmupGain);
        warmupGain.connect(audioCtx.destination);
        warmupOsc.start();
        warmupOsc.stop(audioCtx.currentTime + 0.01);

        audioInitialized = true;
        document.getElementById('click-output').textContent = 'Click any point to hear the chord';
    } catch (e) {
        console.error('Audio initialization failed:', e);
    }
}

// Play chord with given frequency ratios -------------------------------------------------------------
function playChord(alpha, beta, gamma, baseFreq = 220.0) {
    if (!audioInitialized) {
        initAudio();
        return;
    }

    if (!audioCtx || !reverbNode) {
        return;
    }

    // Remove this entire block - it's causing the delay
    // if (audioCtx.state === 'suspended') {
    //     audioCtx.resume();
    // }

    const t = audioCtx.currentTime;
    const harmonics = [1, 2, 3, 4, 5, 6];
    const amplitudes = [1, 0.41, 0.333, 0.27, 0.13, 0.11];

    const notes = [1, alpha, beta, gamma];
    for (let multiplier of notes) {
        createNote(baseFreq * multiplier, harmonics, amplitudes, t);
    }
}

// Create Note with ADSR envelope and amplitude levels -------------------------------------------------
function createNote(freq, harmonics, amplitudes, startTime) {
    const masterGain = audioCtx.createGain();
    const dryGain = audioCtx.createGain();
    const wetGain = audioCtx.createGain();

    console.log(audioParams.dryWet);

    // Equal-power crossfade (prevents volume dip in middle)
    dryGain.gain.value = Math.sqrt(1.0 - audioParams.dryWet);
    wetGain.gain.value = Math.sqrt(audioParams.dryWet) * 2.0;

    masterGain.connect(dryGain);
    masterGain.connect(wetGain);
    dryGain.connect(audioCtx.destination);
    wetGain.connect(reverbNode);

    masterGain.gain.value = 0.15; //0.20 = louder, clip on consonant chords

    // Create each harmonic as separate oscillator
    for (let i = 0; i < harmonics.length; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = audioParams.waveType;
        osc.frequency.value = freq * harmonics[i];

        osc.connect(gain);
        gain.connect(masterGain);

        let attack = audioParams.attack;
        let sustain = audioParams.sustain;
        let release = audioParams.release;

        // Envelope with amplitude control
        const attackAmp = amplitudes[i] * audioParams.attackLevel;
        const sustainAmp = amplitudes[i] * audioParams.sustainLevel;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(attackAmp, startTime + attack);
        gain.gain.exponentialRampToValueAtTime(sustainAmp, startTime + attack + sustain);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + attack + sustain + release);

        const length = attack + sustain + release;
        osc.start(startTime);
        osc.stop(startTime + length);
    }
}
//End audio synthesis ------------------------------------------------------------------

function get12tetRatio(semitones) {
    return Math.pow(2, semitones / 12.0);
}

function get53tetRatio(steps) {
    return Math.pow(2, steps / 53.0);
}

function get31tetRatio(steps) {
    return Math.pow(2, steps / 31.0);
}

function get12TETChordPositions() {
    const chords = [];
    const r = get12tetRatio;
    // Standard voicings (within one octave)
    chords.push(
        ["Maj7", r(4), r(7), r(11)],
        ["min7", r(3), r(7), r(10)],
        ["Dom7", r(4), r(7), r(10)],
        ["Half-Dim7", r(3), r(6), r(10)],
        ["Dim7", r(3), r(6), r(9)],
        ["minMaj7", r(3), r(7), r(11)],
        ["7sus2", r(2), r(7), r(10)],
        ["7sus4", r(5), r(7), r(10)],
        ["Maj6", r(4), r(7), r(9)],
        ["min6", r(3), r(7), r(9)],
        ["power", r(5), r(7), r(12)],
        // ["iim7", r(2), r(5), r(12)]
    );
    return chords;
}

function get31TETChordPositions() {
    const chords = [];

    // 31-TET interval mappings
    const thirds = {
        sm: 7,   // subminor third
        m: 8,    // minor third
        n: 9,    // neutral third
        M: 10,   // major third
        SM: 11   // supermajor third
    };

    const fifths = {
        dim: 17,  // diminished fifth
        P: 18,    // perfect fifth
        aug: 19   // augmented fifth
    };

    const sevenths = {
        sm: 24,  // subminor seventh
        m: 25,   // minor seventh
        n: 27,   // neutral seventh
        M: 28,   // major seventh
        SM: 29   // supermajor seventh
    };

    const r = get31tetRatio;

    // Supermajor third chords
    chords.push(
        ["SMSM7", r(11), r(18), r(29)],
        ["SMM7", r(11), r(18), r(28)],
        ["SMn7", r(11), r(18), r(27)],
        ["SMm7", r(11), r(18), r(26)],
        ["SMsm7", r(11), r(18), r(25)]
    );

    // Major third chords
    chords.push(
        ["MSM7", r(10), r(18), r(29)],
        ["Maj7", r(10), r(18), r(28)],
        ["Mn7", r(10), r(18), r(27)],
        ["Dom7", r(10), r(18), r(26)],
        ["Msm7", r(10), r(18), r(25)]
    );

    // Neutral third chords
    chords.push(
        ["nSM7", r(9), r(18), r(29)],
        ["nM7", r(9), r(18), r(28)],
        ["nn7", r(9), r(18), r(27)],
        ["nm7", r(9), r(18), r(26)],
        ["nsm7", r(9), r(18), r(25)]
    );

    // Minor third chords
    chords.push(
        ["mSM7", r(8), r(18), r(29)],
        ["mM7", r(8), r(18), r(28)],
        ["mn7", r(8), r(18), r(27)],
        ["min7", r(8), r(18), r(26)],
        ["msm7", r(8), r(18), r(25)]
    );

    // Subminor third chords
    chords.push(
        ["smSM7", r(7), r(18), r(29)],
        ["smM7", r(7), r(18), r(28)],
        ["smn7", r(7), r(18), r(27)],
        ["smm7", r(7), r(18), r(26)],
        ["smsm7", r(7), r(18), r(25)]
    );

    // Half-diminished (minor third + diminished fifth + minor seventh)
    chords.push(
        ["ø7", r(8), r(16), r(26)]
    );

    // Diminished (minor third + diminished fifth + diminished seventh)
    chords.push(
        ["o7", r(8), r(16), r(21)]
    );

    // Augmented (major third + augmented fifth + minor seventh)
    chords.push(
        ["M+7", r(10), r(16), r(21)]
    );

    return chords;
}

function get53TETChordPositions() {
    const chords = [];

    // Interval mappings from the wheel
    const thirds = {
        sm: 11, vm: 12, m: 13, '^m': 14, n: 15,
        N: 16, vM: 17, M: 18, '^M': 19, SM: 20
    };

    const fifths = {
        subdim: 29, dim: 30, vP: 30, P: 31, '^P': 32, aug: 32, upaug: 33
    };

    const sevenths = {
        sm: 42, vm: 43, m: 44, '^m': 45, n: 46,
        N: 47, vM: 48, M: 49, '^M': 50, SM: 51
    };

    const r = get53tetRatio;

    // Super-major combinations
    chords.push(
        ["SMSM7", r(20), r(31), r(51)],
        ["SM^M7", r(20), r(31), r(50)],
        ["SMmaj7", r(20), r(31), r(49)],
        ["SMvM7", r(20), r(31), r(48)],
        ["SMN7", r(20), r(31), r(47)],
        ["SMn7", r(20), r(31), r(46)],
        ["SM^m7", r(20), r(31), r(45)],
        ["SMm7", r(20), r(31), r(44)],
        ["SMvm7", r(20), r(31), r(43)],
        ["SMsm7", r(20), r(31), r(42)]
    );

    // Up-major combinations
    chords.push(
        ["^MSM7", r(19), r(31), r(51)],
        ["^M^M7", r(19), r(31), r(50)],
        ["^Mmaj7", r(19), r(31), r(49)],
        ["^MvM7", r(19), r(31), r(48)],
        ["^MN7", r(19), r(31), r(47)],
        ["^Mn7", r(19), r(31), r(46)],
        ["^M^m7", r(19), r(31), r(45)],
        ["^Mm7", r(19), r(31), r(44)],
        ["^Mvm7", r(19), r(31), r(43)],
        ["^Msm7", r(19), r(31), r(42)]
    );

    // Major combinations
    chords.push(
        ["MSM7", r(18), r(31), r(51)],
        ["M^M7", r(18), r(31), r(50)],
        ["maj7", r(18), r(31), r(49)],
        ["MvM7", r(18), r(31), r(48)],
        ["MN7", r(18), r(31), r(47)],
        ["Mn7", r(18), r(31), r(46)],
        ["M^m7", r(18), r(31), r(45)],
        ["Mm7", r(18), r(31), r(44)],
        ["Mvm7", r(18), r(31), r(43)],
        ["Msm7", r(18), r(31), r(42)]
    );

    // Down-major combinations
    chords.push(
        ["vMSM7", r(17), r(31), r(51)],
        ["vM^M7", r(17), r(31), r(50)],
        ["vMmaj7", r(17), r(31), r(49)],
        ["vMvM7", r(17), r(31), r(48)],
        ["vMN7", r(17), r(31), r(47)],
        ["vMn7", r(17), r(31), r(46)],
        ["vM^m7", r(17), r(31), r(45)],
        ["vMm7", r(17), r(31), r(44)],
        ["vMvm7", r(17), r(31), r(43)],
        ["vMsm7", r(17), r(31), r(42)]
    );

    // Neutral-major combinations
    chords.push(
        ["NSM7", r(16), r(31), r(51)],
        ["N^M7", r(16), r(31), r(50)],
        ["Nmaj7", r(16), r(31), r(49)],
        ["NvM7", r(16), r(31), r(48)],
        ["NN7", r(16), r(31), r(47)],
        ["Nn7", r(16), r(31), r(46)],
        ["N^m7", r(16), r(31), r(45)],
        ["Nm7", r(16), r(31), r(44)],
        ["Nvm7", r(16), r(31), r(43)],
        ["Nsm7", r(16), r(31), r(42)]
    );

    // Neutral-minor combinations
    chords.push(
        ["nSM7", r(15), r(31), r(51)],
        ["n^M7", r(15), r(31), r(50)],
        ["nmaj7", r(15), r(31), r(49)],
        ["nvM7", r(15), r(31), r(48)],
        ["nN7", r(15), r(31), r(47)],
        ["nn7", r(15), r(31), r(46)],
        ["n^m7", r(15), r(31), r(45)],
        ["nm7", r(15), r(31), r(44)],
        ["nvm7", r(15), r(31), r(43)],
        ["nsm7", r(15), r(31), r(42)]
    );

    // Up-minor combinations
    chords.push(
        ["^mSM7", r(14), r(31), r(51)],
        ["^m^M7", r(14), r(31), r(50)],
        ["^mmaj7", r(14), r(31), r(49)],
        ["^mvM7", r(14), r(31), r(48)],
        ["^mN7", r(14), r(31), r(47)],
        ["^mn7", r(14), r(31), r(46)],
        ["^m^m7", r(14), r(31), r(45)],
        ["^mm7", r(14), r(31), r(44)],
        ["^mvm7", r(14), r(31), r(43)],
        ["^msm7", r(14), r(31), r(42)]
    );

    // Minor combinations
    chords.push(
        ["mSM7", r(13), r(31), r(51)],
        ["m^M7", r(13), r(31), r(50)],
        ["mmaj7", r(13), r(31), r(49)],
        ["mvM7", r(13), r(31), r(48)],
        ["mN7", r(13), r(31), r(47)],
        ["mn7", r(13), r(31), r(46)],
        ["m^m7", r(13), r(31), r(45)],
        ["m7", r(13), r(31), r(44)],
        ["mvm7", r(13), r(31), r(43)],
        ["msm7", r(13), r(31), r(42)],
        ["m7*", r(13), r(30), r(44)],  // downperfect fifth
        ["m7**", r(13), r(32), r(44)]  // upperfect fifth
    );

    // Down-minor combinations
    chords.push(
        ["vmSM7", r(12), r(31), r(51)],
        ["vm^M7", r(12), r(31), r(50)],
        ["vmmaj7", r(12), r(31), r(49)],
        ["vmvM7", r(12), r(31), r(48)],
        ["vmN7", r(12), r(31), r(47)],
        ["vmn7", r(12), r(31), r(46)],
        ["vm^m7", r(12), r(31), r(45)],
        ["vm7", r(12), r(31), r(44)],
        ["vmvm7", r(12), r(31), r(43)],
        ["vmsm7", r(12), r(31), r(42)]
    );

    // Sub-minor combinations
    chords.push(
        ["smSM7", r(11), r(31), r(51)],
        ["sm^M7", r(11), r(31), r(50)],
        ["smmaj7", r(11), r(31), r(49)],
        ["smvM7", r(11), r(31), r(48)],
        ["smN7", r(11), r(31), r(47)],
        ["smn7", r(11), r(31), r(46)],
        ["sm^m7", r(11), r(31), r(45)],
        ["sm7", r(11), r(31), r(44)],
        ["smvm7", r(11), r(31), r(43)],
        ["smsm7", r(11), r(31), r(42)]
    );

    // Half diminished upminor combinations
    chords.push(
        ["øSM7", r(14), r(30), r(51)],
        ["ø^M7", r(14), r(30), r(50)],
        ["ømaj7", r(14), r(30), r(49)],
        ["øvM7", r(14), r(30), r(48)],
        ["øN7", r(14), r(30), r(47)],
        ["øn7", r(14), r(30), r(46)],
        ["ø^m7", r(14), r(30), r(45)],
        ["ø7", r(14), r(30), r(44)],
        ["øvm7", r(14), r(30), r(43)],
        ["øsm7", r(14), r(30), r(42)]
    );

    // Half-Diminished minor combinations
    chords.push(
        ["øS7", r(13), r(30), r(51)],
        ["ø^M7-m", r(13), r(30), r(50)],
        ["ømaj7-m", r(13), r(30), r(49)],
        ["øvM7-m", r(13), r(30), r(48)],
        ["øNM7", r(13), r(30), r(47)],
        ["øn7-m", r(13), r(30), r(46)],
        ["øv7", r(13), r(30), r(45)],
        ["ø7-m", r(13), r(30), r(44)],
        ["øvm7-m", r(13), r(30), r(43)],
        ["øsm7-m", r(13), r(30), r(42)]
    );

    // Half Diminished downminor combinations
    chords.push(
        ["vøS7", r(12), r(30), r(51)],
        ["vø^M7", r(12), r(30), r(50)],
        ["vømaj7", r(12), r(30), r(49)],
        ["vøvM7", r(12), r(30), r(48)],
        ["vøN7", r(12), r(30), r(47)],
        ["vøn7", r(12), r(30), r(46)],
        ["vø^m7", r(12), r(30), r(45)],
        ["vø7", r(12), r(30), r(44)],
        ["vøvm7", r(12), r(30), r(43)],
        ["vøsm7", r(12), r(30), r(42)]
    );

    // Half Diminished subminor combinations
    chords.push(
        ["søS7", r(11), r(30), r(51)],
        ["sø^M7", r(11), r(30), r(50)],
        ["sømaj7", r(11), r(30), r(49)],
        ["søvM7", r(11), r(30), r(48)],
        ["søN7", r(11), r(30), r(47)],
        ["søn7", r(11), r(30), r(46)],
        ["sø^m7", r(11), r(30), r(45)],
        ["sø7", r(11), r(30), r(44)],
        ["søvm7", r(11), r(30), r(43)],
        ["søsm7", r(11), r(30), r(42)]
    );

    // Full diminished
    chords.push(
        ["o^7", r(13), r(30), r(45)],   // minor_diminished_updiminished
        ["o7", r(13), r(30), r(42)],    // minor_diminished_diminished
        ["ov7", r(13), r(30), r(43)],   // minor_diminished_downdiminished
        ["ovv7", r(13), r(30), r(41)]   // minor_diminished_subdiminished
    );

    // Augmented combinations
    chords.push(
        ["M+S7", r(18), r(32), r(51)],
        ["M+^M7", r(18), r(32), r(50)],
        ["M+maj7", r(18), r(32), r(49)],
        ["M+vM7", r(18), r(32), r(48)],
        ["M+NM7", r(18), r(32), r(47)],
        ["M+N7", r(18), r(32), r(46)],
        ["M+n7", r(18), r(32), r(46)],
        ["M+m7", r(18), r(32), r(44)],
        ["M+vm7", r(18), r(32), r(43)],
        ["M+sm7", r(18), r(32), r(42)]
    );

    // Special downperfect ones
    chords.push(
        ["vMvM*", r(17), r(30), r(48)],     // downmajor_downperfect_downmajor
        ["Nøvm", r(16), r(30), r(43)],      // neutralmajor_diminished_downminor
        ["nøN", r(15), r(30), r(47)]        // neutralminor_diminished_neutralmajor
    );

    chords.push(
        ["7Sus4", r(22), r(31), r(44)],
    )

    return chords;
}

function linspace(start, end, num) {
    const arr = [];
    const step = (end - start) / (num - 1);
    for (let i = 0; i < num; i++) {
        arr.push(start + step * i);
    }
    return arr;
}

async function calculate3dDissonanceMap(baseFreq, rLow, rHigh, nPoints, numHarmonics, method = "min") {
    const alphaRange = linspace(rLow, rHigh, nPoints);
    const betaRange = linspace(rLow, rHigh, nPoints);
    const gammaRange = linspace(rLow, rHigh, nPoints);

    const freqBase = Array.from({ length: numHarmonics }, (_, i) => baseFreq * (i + 1));
    const ampBase = Array(numHarmonics).fill(1);

    const dissonance3d = [];

    for (let i = 0; i < nPoints; i++) {
        const linearProgress = i / nPoints;
        const easedProgress = 1 - Math.pow(1 - linearProgress, 2);
        const percent = Math.round(100 * easedProgress);

        document.getElementById('progress-container').style.display = 'block';
        document.getElementById('progress-bar').style.setProperty('--progress', `${percent}%`);
        document.getElementById('progress-text').textContent = `Computing: ${percent}%`;
        document.getElementById('click-output').style.display = 'none';

        await new Promise(resolve => setTimeout(resolve, 0)); // Let browser repaint

        dissonance3d[i] = [];
        for (let j = 0; j < nPoints; j++) {
            dissonance3d[i][j] = [];
            for (let k = j; k < nPoints; k++) {
                const alpha = alphaRange[i];
                const beta = betaRange[j];
                const gamma = gammaRange[k];

                if (!(alpha <= beta && beta <= gamma)) {
                    dissonance3d[i][j][k] = NaN;
                    continue;
                }

                const f = [
                    ...freqBase,
                    ...freqBase.map(x => x * alpha),
                    ...freqBase.map(x => x * beta),
                    ...freqBase.map(x => x * gamma)
                ];
                const a = [...ampBase, ...ampBase, ...ampBase, ...ampBase];
                dissonance3d[i][j][k] = dissmeasure(f, a, method);
            }
        }
    }

    return { alphaRange, betaRange, gammaRange, dissonance3d };
}

function findHarmonicNodes(alphaRange, betaRange, gammaRange, dissonance3d, numNodes = 15, filterSize = 5) {
    const nodes = [];
    const stepSize = (alphaRange[alphaRange.length - 1] - alphaRange[0]) / alphaRange.length;
    const boundaryMargin = Math.max(3, Math.floor(0.1 * alphaRange.length));
    const prominenceRadius = Math.max(6, filterSize * 2);

    // Find local minima
    for (let i = boundaryMargin; i < alphaRange.length - boundaryMargin; i++) {
        for (let j = boundaryMargin; j < betaRange.length - boundaryMargin; j++) {
            for (let k = boundaryMargin; k < gammaRange.length - boundaryMargin; k++) {
                const value = dissonance3d[i][j][k];
                if (isNaN(value)) continue;

                const alphaVal = alphaRange[i];
                const betaVal = betaRange[j];
                const gammaVal = gammaRange[k];

                // Check spacing
                if (Math.abs(alphaVal - betaVal) < stepSize * 2 || Math.abs(betaVal - gammaVal) < stepSize * 2) {
                    continue;
                }

                // Check if local minimum
                let isMin = true;
                for (let di = -filterSize; di <= filterSize && isMin; di++) {
                    for (let dj = -filterSize; dj <= filterSize && isMin; dj++) {
                        for (let dk = -filterSize; dk <= filterSize && isMin; dk++) {
                            if (di === 0 && dj === 0 && dk === 0) continue;
                            const ni = i + di, nj = j + dj, nk = k + dk;
                            if (ni >= 0 && ni < alphaRange.length && nj >= 0 && nj < betaRange.length && nk >= 0 && nk < gammaRange.length) {
                                if (value >= dissonance3d[ni][nj][nk]) {
                                    isMin = false;
                                }
                            }
                        }
                    }
                }

                if (!isMin) continue;

                // Calculate prominence
                let maxInRadius = value;
                for (let di = -prominenceRadius; di <= prominenceRadius; di++) {
                    for (let dj = -prominenceRadius; dj <= prominenceRadius; dj++) {
                        for (let dk = -prominenceRadius; dk <= prominenceRadius; dk++) {
                            const ni = i + di, nj = j + dj, nk = k + dk;
                            if (ni >= 0 && ni < alphaRange.length && nj >= 0 && nj < betaRange.length && nk >= 0 && nk < gammaRange.length) {
                                if (!isNaN(dissonance3d[ni][nj][nk])) {
                                    maxInRadius = Math.max(maxInRadius, dissonance3d[ni][nj][nk]);
                                }
                            }
                        }
                    }
                }

                const prominence = maxInRadius - value;
                if (prominence < 0.001) continue;

                // Calculate gradient
                let gradientSum = 0, gradientCount = 0;
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        for (let dk = -1; dk <= 1; dk++) {
                            if (di === 0 && dj === 0 && dk === 0) continue;
                            const ni = i + di, nj = j + dj, nk = k + dk;
                            if (ni >= 0 && ni < alphaRange.length && nj >= 0 && nj < betaRange.length && nk >= 0 && nk < gammaRange.length) {
                                if (!isNaN(dissonance3d[ni][nj][nk])) {
                                    gradientSum += Math.abs(dissonance3d[ni][nj][nk] - value);
                                    gradientCount++;
                                }
                            }
                        }
                    }
                }

                const avgGradient = gradientCount > 0 ? gradientSum / gradientCount : 0;
                const curvature = prominence * (1 + avgGradient * 10);

                nodes.push({ alpha: alphaVal, beta: betaVal, gamma: gammaVal, dissonance: value, curvature });
            }
        }
    }

    nodes.sort((a, b) => b.curvature - a.curvature);
    return nodes.slice(0, numNodes);
}

function percentile(arr, p) {
    const sorted = arr.filter(x => !isNaN(x)).sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p / 100);
    return sorted[index];
}

// Look up dissonance value at a specific point (with interpolation)
function getDissonanceAtPoint(alpha, beta, gamma, alphaRange, betaRange, gammaRange, dissonance3d) {
    // Find nearest indices
    let iAlpha = 0, iBeta = 0, iGamma = 0;
    let minDistAlpha = Infinity, minDistBeta = Infinity, minDistGamma = Infinity;

    for (let i = 0; i < alphaRange.length; i++) {
        const dist = Math.abs(alphaRange[i] - alpha);
        if (dist < minDistAlpha) {
            minDistAlpha = dist;
            iAlpha = i;
        }
    }

    for (let j = 0; j < betaRange.length; j++) {
        const dist = Math.abs(betaRange[j] - beta);
        if (dist < minDistBeta) {
            minDistBeta = dist;
            iBeta = j;
        }
    }

    for (let k = 0; k < gammaRange.length; k++) {
        const dist = Math.abs(gammaRange[k] - gamma);
        if (dist < minDistGamma) {
            minDistGamma = dist;
            iGamma = k;
        }
    }

    // Return the dissonance value at nearest point
    const value = dissonance3d[iAlpha][iBeta][iGamma];
    return isNaN(value) ? null : value;
}

function createVisualization(data, baseFreq, numNodes = 15) {
    const { alphaRange, betaRange, gammaRange, dissonance3d } = data;

    // Sample the data
    const sampleRate = 2;
    const xData = [], yData = [], zData = [], dData = [];

    for (let i = 0; i < alphaRange.length; i += sampleRate) {
        for (let j = 0; j < betaRange.length; j += sampleRate) {
            for (let k = 0; k < gammaRange.length; k += sampleRate) {
                const d = dissonance3d[i][j][k];
                if (!isNaN(d)) {
                    xData.push(alphaRange[i]);
                    yData.push(betaRange[j]);
                    zData.push(gammaRange[k]);
                    dData.push(d);
                }
            }
        }
    }

    const allD = dissonance3d.flat(2);
    const vmin = percentile(allD, 5);
    const vmax = percentile(allD, 95);

    const traces = [];
    const myColor = [
        [0.0, 'rgba(0, 0, 255, 1)'],
        [0.25, 'rgba(0, 200, 255, 1)'],
        [0.5, 'rgba(255, 255, 255, 1)'],
        [0.75, 'rgba(255, 200, 0, 1)'],
        [1.0, 'rgba(255, 0, 0, 1)']
    ];

    let numLayers = 200;
    let windowSize = (vmax - vmin) / 15;
    let thresholds = linspace(vmin, vmax, numLayers);
    const tracesPerLayer = ENABLE_DISTANCE_LINES ? 2 : 1;

    // ========== CREATE FULL 3D TRACE (initially hidden) ==========
    // Use stratified sampling to ensure all dissonance ranges are represented
    const samplingRate = 0.2;
    const sampledX = [], sampledY = [], sampledZ = [], sampledD = [];

    // Group points by dissonance range to ensure even distribution
    const numBins = 10;
    const binSize = (vmax - vmin) / numBins;
    const bins = Array.from({ length: numBins }, () => []);

    // Distribute points into bins
    for (let i = 0; i < xData.length; i++) {
        const d = dData[i];
        if (isNaN(d) || d < vmin || d > vmax) continue;

        const binIndex = Math.min(Math.floor((d - vmin) / binSize), numBins - 1);
        if (binIndex >= 0 && binIndex < numBins) {
            bins[binIndex].push(i);
        }
    }

    // Sample from each bin proportionally
    for (let bin of bins) {
        if (bin.length === 0) continue;

        const sampleCount = Math.ceil(bin.length * samplingRate);
        const sampledIndices = new Set();

        while (sampledIndices.size < sampleCount && sampledIndices.size < bin.length) {
            const randomIndex = Math.floor(Math.random() * bin.length);
            sampledIndices.add(bin[randomIndex]);
        }

        for (let idx of sampledIndices) {
            sampledX.push(xData[idx]);
            sampledY.push(yData[idx]);
            sampledZ.push(zData[idx]);
            sampledD.push(dData[idx]);
        }
    }
    // full zone-node visualization
    traces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: sampledX,
        y: sampledY,
        z: sampledZ,
        marker: {
            symbol: 'circle',
            size: zoneFull,
            color: sampledD,
            colorscale: myColor,
            cmin: vmin,
            cmax: vmax,
            showscale: false,  // Hide Plotly colorbar - we use P5 instead
            opacity: 0.75
        },
        name: 'Full 3D View',
        visible: false, // Hidden initially
        hovertemplate: '<span style="font-family:monaco">' +
            '<b>Ratios</b><br>' +
            'α = %{x:.4f}<br>' +
            'β = %{y:.4f}<br>' +
            'γ = %{z:.4f}' +
            '</span><extra></extra>'
    });

    // ========== CREATE SECTIONED LAYER TRACES ==========
    for (let i = 0; i < numLayers; i++) {
        const threshold = thresholds[i];
        const layerX = [], layerY = [], layerZ = [], layerD = [];

        const lowerBound = threshold - windowSize / 2;
        const upperBound = threshold + windowSize / 2;
        const minSpacing = 0.001;

        for (let j = 0; j < xData.length; j++) {
            if (dData[j] >= lowerBound && dData[j] <= upperBound) {
                const alpha = xData[j];
                const beta = yData[j];
                const gamma = zData[j];

                if ((alpha - 1.0) < minSpacing ||
                    (beta - alpha) < minSpacing ||
                    (gamma - beta) < minSpacing) {
                    continue;
                }

                layerX.push(alpha);
                layerY.push(beta);
                layerZ.push(gamma);
                layerD.push(dData[j]);
            }
        }

        if (layerX.length === 0) continue;

        // CONDITIONAL: Create lines only if ENABLE_DISTANCE_LINES is true
        if (ENABLE_DISTANCE_LINES) {
            const lineX = [], lineY = [], lineZ = [];
            const lineColors = [];
            const maxDistance = 0.02;
            const maxConnectionsPerPoint = 6;

            for (let p = 0; p < layerX.length; p++) {
                const neighbors = [];
                for (let q = 0; q < layerX.length; q++) {
                    if (p === q) continue;
                    const dist = Math.sqrt(
                        Math.pow(layerX[p] - layerX[q], 2) +
                        Math.pow(layerY[p] - layerY[q], 2) +
                        Math.pow(layerZ[p] - layerZ[q], 2)
                    );
                    if (dist < maxDistance) {
                        neighbors.push({ q, dist });
                    }
                }

                neighbors.sort((a, b) => a.dist - b.dist);
                neighbors.slice(0, maxConnectionsPerPoint).forEach(n => {
                    const avgDiss = (layerD[p] + layerD[n.q]) / 2;
                    lineX.push(layerX[p], layerX[n.q], null);
                    lineY.push(layerY[p], layerY[n.q], null);
                    lineZ.push(layerZ[p], layerZ[n.q], null);
                    lineColors.push(avgDiss, avgDiss, avgDiss);
                });
            }

            if (lineX.length > 0) {
                traces.push({
                    type: 'scatter3d',
                    mode: 'lines',
                    x: lineX,
                    y: lineY,
                    z: lineZ,
                    line: {
                        color: lineColors,
                        colorscale: myColor,
                        cmin: vmin,
                        cmax: vmax,
                        width: 1.0
                    },
                    showlegend: false,
                    hoverinfo: 'skip',
                    visible: i === 0,
                    opacity: 0.5
                });
            }
        }

        // Add zone point trace
        traces.push({
            type: 'scatter3d',
            mode: 'markers',
            x: layerX,
            y: layerY,
            z: layerZ,
            marker: {
                symbol: 'square',
                size: zoneSize,
                color: layerD,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                showscale: false,  // Hide Plotly colorbar - we use P5 instead
                opacity: 0.5
            },
            name: `${(threshold - windowSize / 2).toFixed(3)} - ${(threshold + windowSize / 2).toFixed(3)}`,
            visible: i === 0, // Only first layer visible
            hovertemplate: '<span style="font-family:monaco">' +
                '<b>Ratios</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // ========== ADD CHORD MARKERS (both modes) ==========

    // Find nodes - only calculate once, then reuse the cached positions
    if (cachedHarmonicNodes === null) {
        const rawNodes = findHarmonicNodes(alphaRange, betaRange, gammaRange, dissonance3d, numNodes, 5);

        // Refine nodes with stochastic search
        console.log('Refining nodes with stochastic search...');
        cachedHarmonicNodes = rawNodes.map((node, idx) => {
            const refined = refineNodeStochastic(node, baseFreq, 6, 100);
            // const improvement = node.dissonance - refined.dissonance;

            return refined;
        });
    }
    const nodes = cachedHarmonicNodes;

    //Local minima nodes ---------------------------------------------------------------
    if (nodes.length > 0) {
        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: nodes.map(n => n.alpha),
            y: nodes.map(n => n.beta),
            z: nodes.map(n => n.gamma),
            marker: {
                size: chordSize,
                color: 'rgba(235, 235, 235, 1)',
                symbol: 'circle',
                opacity: 1
            },
            text: nodes.map((_, i) => String(i + 1)),
            textposition: 'middle center',
            textfont: { size: 10, color: 'rgba(41, 41, 41, 1)', font: 'avenir' },
            name: 'Harmonic Nodes',
            visible: true,
            hovertemplate: '<span style="font-family:monaco">' +
                '<b>Node %{text}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // Add 12-TET chords ---------------------------------------------------------------
    const chords12TET = get12TETChordPositions();
    const chordData12TET = chords12TET.filter(([name, a, b, g]) =>
        a >= alphaRange[0] && a <= alphaRange[alphaRange.length - 1] &&
        b >= betaRange[0] && b <= betaRange[betaRange.length - 1] &&
        g >= gammaRange[0] && g <= gammaRange[gammaRange.length - 1]
    );

    if (chordData12TET.length > 0) {
        // Get dissonance value for each chord
        const chordDissonances = chordData12TET.map(([name, a, b, g]) =>
            getDissonanceAtPoint(a, b, g, alphaRange, betaRange, gammaRange, dissonance3d)
        );
        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: chordData12TET.map(c => c[1]),
            y: chordData12TET.map(c => c[2]),
            z: chordData12TET.map(c => c[3]),
            customdata: chordData12TET.map((c, i) => `${c[0]} (D: ${chordDissonances[i]?.toFixed(3) || 'N/A'})`),
            marker: {
                size: chordSize,
                color: chordDissonances,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                symbol: 'square',
                line: { color: 'rgba(255, 255, 255, 1)', width: 1 },
                opacity: 1
            },
            text: chordData12TET.map(c => c[0]),
            textposition: 'top center',
            textfont: { size: 12, color: 'rgba(255, 255, 255, 1)' },
            name: '12-TET Chords',
            visible: true,
            hovertemplate: '<span style="font-family:monaco">' +
                '<b>%{customdata}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // Add 31-TET chords --------------------------------------------------------------
    const chords31TET = get31TETChordPositions();
    const chordData31TET = chords31TET.filter(([name, a, b, g]) =>
        a >= alphaRange[0] && a <= alphaRange[alphaRange.length - 1] &&
        b >= betaRange[0] && b <= betaRange[betaRange.length - 1] &&
        g >= gammaRange[0] && g <= gammaRange[gammaRange.length - 1]
    );

    if (chordData31TET.length > 0) {
        // Get dissonance value for each chord
        const chordDissonances = chordData31TET.map(([name, a, b, g]) =>
            getDissonanceAtPoint(a, b, g, alphaRange, betaRange, gammaRange, dissonance3d)
        );
        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: chordData31TET.map(c => c[1]),
            y: chordData31TET.map(c => c[2]),
            z: chordData31TET.map(c => c[3]),
            customdata: chordData31TET.map((c, i) => `${c[0]} (D: ${chordDissonances[i]?.toFixed(3) || 'N/A'})`),
            marker: {
                size: chordSize - 1,
                color: chordDissonances,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                symbol: 'diamond',
                line: { color: 'rgba(255, 200, 0, 1)', width: 2 },
                opacity: 1,
                showscale: false
            },
            text: chordData31TET.map(c => c[0]),
            textposition: 'top center',
            textfont: { size: 12, color: 'rgba(255, 200, 0, 1)' },
            name: '31-TET Chords',
            visible: true,
            hovertemplate: '<span style="font-family:monaco">' +
                '<b>%{customdata}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // Add 53-TET chords --------------------------------------------------------------
    const chords53TET = get53TETChordPositions();
    const chordData53TET = chords53TET.filter(([name, a, b, g]) =>
        a >= alphaRange[0] && a <= alphaRange[alphaRange.length - 1] &&
        b >= betaRange[0] && b <= betaRange[betaRange.length - 1] &&
        g >= gammaRange[0] && g <= gammaRange[gammaRange.length - 1]
    );

    if (chordData53TET.length > 0) {
        // Get dissonance value for each chord
        const chordDissonances = chordData53TET.map(([name, a, b, g]) =>
            getDissonanceAtPoint(a, b, g, alphaRange, betaRange, gammaRange, dissonance3d)
        );

        traces.push({
            type: 'scatter3d',
            mode: 'markers+text',
            x: chordData53TET.map(c => c[1]),
            y: chordData53TET.map(c => c[2]),
            z: chordData53TET.map(c => c[3]),
            customdata: chordData53TET.map((c, i) => `${c[0]} (D: ${chordDissonances[i]?.toFixed(3) || 'N/A'})`),
            marker: {
                size: chordSize,
                color: chordDissonances,
                colorscale: myColor,
                cmin: vmin,
                cmax: vmax,
                symbol: 'circle',
                line: { color: 'rgba(202, 202, 202, 1)', width: 1 },
                opacity: 1,
                showscale: false  // Don't show separate colorbar for chords
            },
            text: chordData53TET.map(c => c[0]),
            textposition: 'top center',
            textfont: { size: 12, color: 'white' },
            name: '53-TET Chords',
            visible: true,  // VISIBLE AT START
            hovertemplate: '<span style="font-family:monaco">' +
                '<b>%{customdata}</b><br>' +
                'α = %{x:.4f}<br>' +
                'β = %{y:.4f}<br>' +
                'γ = %{z:.4f}' +
                '</span><extra></extra>'
        });
    }

    // ========== LAYOUT ==========
    const layout = {
        scene: {
            domain: {
                x: [0.1, 1.0],
                y: [0, 1.0]
            },
            xaxis: {
                title: 'α (2nd note)',
                gridcolor: 'rgba(90, 90, 90, 1)',
                showspikes: true,
                spikecolor: 'rgba(255, 200, 0, 0.8)',
                spikethickness: 1.5,
                spikesides: true,
                spikedash: 'solid',
                range: [1.0, 2.0]
            },
            yaxis: {
                title: 'β (3rd note)',
                gridcolor: 'rgba(90, 90, 90, 1)',
                showspikes: true,
                spikecolor: 'rgba(255, 200, 0, 0.8)',
                spikethickness: 1.5,
                spikesides: true,
                spikedash: 'solid',
                range: [1.0, 2.0]
            },
            zaxis: {
                title: 'γ (4th note)',
                gridcolor: 'rgba(90, 90, 90, 1)',
                showspikes: true,
                spikecolor: 'rgba(255, 200, 0, 0.8)',
                spikethickness: 1.5,
                spikesides: true,
                spikedash: 'solid',
                range: [1.0, 2.0]
            },
            bgcolor: 'rgba(0, 0, 0, 1)',
            aspectmode: 'cube'
        },
        legend: {
            x: 0,
            y: 0.5,
            xanchor: 'left',
            yanchor: 'middle',
            bgcolor: 'rgba(0,0,0,0.7)',
            bordercolor: 'rgba(255,255,255,0.3)',
            borderwidth: 1
        },
        paper_bgcolor: 'rgba(0, 0, 0, 1)',
        font: { color: 'white' },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        clickmode: 'event+select',
        hovermode: 'closest'
    };

    // ========== SLIDER (REMOVED - Using P5 colorbar slider instead) ==========
    // Calculate layer info for P5 slider
    const layerStartIndex = 1;
    const actualNumLayers = Math.floor((traces.length - layerStartIndex - 4) / tracesPerLayer); // -4 for nodes and chords

    // Store thresholds and layer info globally for P5 slider to use
    window.plotlyLayerInfo = {
        thresholds: thresholds,
        windowSize: windowSize,
        tracesPerLayer: tracesPerLayer,
        layerStartIndex: layerStartIndex,
        actualNumLayers: actualNumLayers
    };

    // ========== RENDER ==========
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const config = {
        displayModeBar: true,
        scrollZoom: true,
        responsive: true,
        plotGlPixelRatio: isSafari ? 2.0 : 1.0
    };

    const plotDiv = document.getElementById('plot');

    // Set initial camera
    layout.scene.camera = { eye: { x: 0, y: 1.7, z: 0.4 } };

    Plotly.newPlot('plot', traces, layout, config).then(() => {
        const scene = document.getElementById('plot')._fullLayout.scene._scene;
        const gl = scene.glplot.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // Initialize P5 colorbar slider with threshold data
        if (typeof colorbarP5 !== 'undefined' && window.plotlyLayerInfo) {
            colorbarP5.setThresholds(
                window.plotlyLayerInfo.thresholds,
                window.plotlyLayerInfo.windowSize,
                0  // Start at first layer
            );
        }
    });

    // plotDiv.on('plotly_relayout', function (eventData) {
    //     if (eventData['scene.camera']) {
    //         console.log('Camera updated:', eventData['scene.camera']);
    //     }
    // });

    // Attach click event listener
    plotDiv.on('plotly_click', function (eventData) {
        if (eventData.points && eventData.points.length > 0) {
            const point = eventData.points[0];
            const alpha = point.x;
            const beta = point.y;
            const gamma = point.z;

            const freqRoot = currentBaseFreq;
            const freqAlpha = alpha * currentBaseFreq;
            const freqBeta = beta * currentBaseFreq;
            const freqGamma = gamma * currentBaseFreq;

            document.getElementById('click-output').textContent =
                `Playing: ${freqRoot.toFixed(2)} Hz | α=${freqAlpha.toFixed(2)} Hz | β=${freqBeta.toFixed(2)} Hz | γ=${freqGamma.toFixed(2)} Hz`;

            playChord(alpha, beta, gamma, currentBaseFreq);
        }
    });
}

// Fast toggle function - single update for all traces
function toggleVisualizationMode() {
    const plotDiv = document.getElementById('plot');
    const totalTraces = plotDiv.data.length;
    const tracesPerLayer = ENABLE_DISTANCE_LINES ? 2 : 1;
    const numChordTraces = 4; // nodes + 12TET + 31TET + 53TET
    const numLayerTraces = totalTraces - 1 - numChordTraces; // minus full3D and chord traces

    // Build complete visibility array for ALL traces at once
    const visibilityArray = new Array(totalTraces);

    if (visualizationMode === 'sectioned') {
        // Switch to FULL 3D mode
        visualizationMode = 'full3d';

        visibilityArray[0] = true; // Full 3D trace visible

        // All layer traces hidden
        for (let i = 1; i <= numLayerTraces; i++) {
            visibilityArray[i] = false;
        }

        // Chord traces always visible
        for (let i = numLayerTraces + 1; i < totalTraces; i++) {
            visibilityArray[i] = true;
        }

        // Single update: visibility only (no Plotly slider)
        Plotly.update(plotDiv, { visible: visibilityArray }, {});

    } else {
        // Switch to SECTIONED mode
        visualizationMode = 'sectioned';

        visibilityArray[0] = false; // Full 3D trace hidden

        // Get current step from P5 slider (maintains position)
        let currentLayer = 0;
        if (typeof colorbarP5 !== 'undefined' && colorbarP5.getCurrentStep) {
            currentLayer = colorbarP5.getCurrentStep();
        }

        // Show the layer at current slider position
        const actualNumLayers = Math.floor(numLayerTraces / tracesPerLayer);
        for (let i = 0; i < actualNumLayers; i++) {
            if (ENABLE_DISTANCE_LINES) {
                visibilityArray[1 + i * 2] = (i === currentLayer);
                visibilityArray[1 + i * 2 + 1] = (i === currentLayer);
            } else {
                visibilityArray[1 + i] = (i === currentLayer);
            }
        }

        // Chord traces always visible
        for (let i = numLayerTraces + 1; i < totalTraces; i++) {
            visibilityArray[i] = true;
        }

        // Single update: visibility only (no Plotly slider)
        Plotly.update(plotDiv, { visible: visibilityArray }, {});
    }
}

// Function to update layer visibility - called by P5 colorbar slider
window.updatePlotlyLayer = function (layerIndex) {
    const plotDiv = document.getElementById('plot');
    const totalTraces = plotDiv.data.length;
    const tracesPerLayer = ENABLE_DISTANCE_LINES ? 2 : 1;
    const numChordTraces = 4; // nodes + 12TET + 31TET + 53TET
    const numLayerTraces = totalTraces - 1 - numChordTraces;
    const actualNumLayers = Math.floor(numLayerTraces / tracesPerLayer);

    // Only update if in sectioned mode
    if (visualizationMode !== 'sectioned') return;

    // Build visibility array
    const layerVisibility = Array(actualNumLayers * tracesPerLayer).fill(false);

    if (ENABLE_DISTANCE_LINES) {
        layerVisibility[layerIndex * 2] = true;
        layerVisibility[layerIndex * 2 + 1] = true;
    } else {
        layerVisibility[layerIndex] = true;
    }

    const layerIndices = Array.from({ length: actualNumLayers * tracesPerLayer }, (_, idx) => 1 + idx);

    // Update only the layer traces
    Plotly.restyle(plotDiv, 'visible', layerVisibility, layerIndices);
}

// Save binary
function saveDatasetBinary(data, baseFreq) {
    const { alphaRange, betaRange, gammaRange, dissonance3d } = data;

    // Flatten 3D array
    const flat = [];
    for (let i = 0; i < dissonance3d.length; i++) {
        for (let j = 0; j < dissonance3d[i].length; j++) {
            flat.push(...dissonance3d[i][j]);
        }
    }

    // Pack: [alphaRange, betaRange, gammaRange, dissonance3d]
    const buffer = new Float32Array([
        ...alphaRange,
        ...betaRange,
        ...gammaRange,
        ...flat
    ]);

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harmonic-${baseFreq}Hz.bin`;
    a.click();
}


window.addEventListener('keydown', function (e) {
    const freq = keyToFreq[e.key.toLowerCase()];
    if (freq) {
        currentBaseFreq = freq;
        rootSelector.value = freq;
        document.getElementById('click-output').textContent =
            `Root: ${freqToName[freq]} (${freq.toFixed(2)} Hz) - Click any point to hear`;
    }
});

// Manual test function - call from console: testRootChange(130.81)
window.testRootChange = function (newFreq) {
    currentBaseFreq = newFreq;
    createVisualization(globalDissonanceData, currentBaseFreq, 77);
};

// Run computation
window.addEventListener('load', async () => {
    currentBaseFreq = 220.0;
    const localNodes = 77;
    const harmonics = 6;
    const zoneNodes = 400;

    // Compute dissonance map ONCE - this is the expensive part
    globalDissonanceData = await calculate3dDissonanceMap(currentBaseFreq, 1.0, 2.0, zoneNodes, harmonics, "min");

    // Create visualization
    document.getElementById('click-output').textContent = 'Creating visualization...';
    createVisualization(globalDissonanceData, currentBaseFreq, localNodes);

    // Hide progress, ready to play
    document.getElementById('progress-container').style.display = 'none';
    document.getElementById('click-output').style.display = 'block';
    document.getElementById('click-output').textContent = 'Click any point to initialize audio and hear the chord';

    /// Add root note selector event listener (if it exists)
    const rootSelector = document.getElementById('root-select');

    if (rootSelector) {
        rootSelector.addEventListener('change', function (e) {
            currentBaseFreq = parseFloat(e.target.value);
            const rootName = e.target.options[e.target.selectedIndex].text;

            document.getElementById('click-output').textContent = `Root: ${rootName} (${currentBaseFreq.toFixed(2)} Hz) - Click any point to hear`;
        });
    }

    // Visualization mode toggle button - uses fast restyle instead of recreating plot
    const toggleButton = document.getElementById('viz-mode-toggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', function () {
            toggleVisualizationMode();

            this.textContent = visualizationMode === 'sectioned'
                ? 'Switch to Full 3D View'
                : 'Switch to Sectioned View';
        });
    }
});