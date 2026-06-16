// Phase 3 — 31-EDO interval-class layer oracle (STRATEGY.md §6.1).
//
//     node tools/golden_31.js
//
// Pins the derived 31-EDO landmarks + classifier ranges against just-intonation targets
// and basic coverage, so accidental edits while authoring the 31 naming tables are caught.

require('../temperament.js');
const T = globalThis.Temperament.get(31);

let fail = 0;
const ck = (l, g, w) => { if (g !== w) { fail++; console.error(`  ✗ ${l}: ${g} != ${w}`); } else console.log(`  ✓ ${l}`); };

// Landmarks vs nearest 31-EDO step of the just interval.
ck('P5 = round(31·log2 3/2) = 18', T.ratioToStep(1.5), 18);
ck('M3 = round(31·log2 5/4) = 10', T.ratioToStep(1.25), 10);
ck('P4 = round(31·log2 4/3) = 13', T.ratioToStep(4 / 3), 13);
ck('m3 = round(31·log2 6/5) = 8',  T.ratioToStep(1.2), 8);
ck('M6 = round(31·log2 5/3) = 23', T.ratioToStep(5 / 3), 23);

ck('landmark ninth = 5',          T.landmarks.ninth, 5);
ck('landmark eleventh = 13',      T.landmarks.eleventh, 13);
ck('landmark sharpEleventh = 15', T.landmarks.sharpEleventh, 15);  // A4 (meantone: < d5=16)
ck('landmark thirteenth = 23',    T.landmarks.thirteenth, 23);

// Coverage: every chromatic slot 0..11 reachable from some interval.
const slots = new Set();
for (let i = 0; i < 31; i++) { const p = T.chromaticPosition(i); if (p !== null) slots.add(p); }
ck('all 12 chromatic slots present', slots.size, 12);

// Components land on the right landmark steps (meantone: A4=15 #11, d5=16 a flat fifth).
ck('componentType(10) = THIRD',          T.componentType(10), 'THIRD');
ck('componentType(15) = SHARP_ELEVENTH', T.componentType(15), 'SHARP_ELEVENTH');
ck('componentType(16) = FIFTH (d5)',     T.componentType(16), 'FIFTH');
ck('componentType(18) = FIFTH',          T.componentType(18), 'FIFTH');
ck('componentType(28) = SEVENTH',        T.componentType(28), 'SEVENTH');

// Quality maps (5-quality basis).
ck('thirdQualityMap[8] = minor',       T.thirdQualityMap[8], 'minor');
ck('thirdQualityMap[9] = neutral',     T.thirdQualityMap[9], 'neutral');
ck('thirdQualityMap[10] = major',      T.thirdQualityMap[10], 'major');
ck('fifthQualityMap[16] = diminished', T.fifthQualityMap[16], 'diminished');
ck('fifthQualityMap[18] = perfect',    T.fifthQualityMap[18], 'perfect');
ck('seventhQualityMap[26] = minor',    T.seventhQualityMap[26], 'minor');
ck('seventhQualityMap[28] = major',    T.seventhQualityMap[28], 'major');

// chordNameTable spot-checks (confirmed symbol scheme).
ck('chordName major_perfect_major = maj7',         T.chordNameTable['major_perfect_major'], 'maj7');
ck('chordName major_perfect_minor = 7',            T.chordNameTable['major_perfect_minor'], '7');
ck('chordName minor_perfect_minor = m7',           T.chordNameTable['minor_perfect_minor'], 'm7');
ck('chordName neutral_perfect_minor = N7',         T.chordNameTable['neutral_perfect_minor'], 'N7');
ck('chordName minor_diminished_minor = ø7',        T.chordNameTable['minor_diminished_minor'], 'ø7');
ck('chordName minor_diminished_diminished = o7',   T.chordNameTable['minor_diminished_diminished'], 'o7');

// noteName (A-anchored, meantone #/b + half-sharps).
ck('noteName(0) = A',       T.noteName(0), 'A');
ck('noteName(5) = B',       T.noteName(5), 'B');
ck('noteName(8) = C',       T.noteName(8), 'C');
ck('noteName(2) = A#',      T.noteName(2), 'A#');
ck('noteName(3) = Bb',      T.noteName(3), 'Bb');
ck('noteName(1) = A+ (½#)', T.noteName(1), 'A+');

console.log(fail === 0
  ? '31-EDO INTERVAL-CLASS LAYER OK — landmarks + classifiers match the derived 31-EDO map.'
  : `\n${fail} FAILURE(S).`);
process.exit(fail ? 1 : 0);
