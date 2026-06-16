// Phase 2 semantic golden (STRATEGY.md §6.1).
//
//     node tools/golden_semantics.js
//
// Phase 2 converts two inline if/else classifiers into data on Temperament53:
//   - modal_studio_KeyMap.calculateChromatic12Notes  → chromaticPosition()
//   - modal_studio_VoicingEditor.determineComponentType → componentType()
// This pins them: the LEGACY if/else below is copied VERBATIM from the live source
// and is the oracle. We assert the data-driven Temperament53 methods reproduce it for
// every interval 0..52. If a range is mistyped during the lift, this fails loudly.

require('../temperament.js');
const T = globalThis.Temperament.get(53);

// --- Legacy: verbatim from modal_studio_KeyMap.js (calculateChromatic12Notes) ---
function legacyChromaticPosition(interval) {
  if (interval === 0) return 0;
  else if (interval >= 3 && interval <= 7) return 1;
  else if (interval >= 8 && interval <= 10) return 2;
  else if (interval >= 11 && interval <= 15) return 3;
  else if (interval >= 16 && interval <= 20) return 4;
  else if (interval >= 21 && interval <= 24) return 5;
  else if (interval >= 25 && interval <= 28) return 6;
  else if (interval >= 29 && interval <= 33) return 7;
  else if (interval >= 34 && interval <= 37) return 8;
  else if (interval >= 38 && interval <= 41) return 9;
  else if (interval >= 42 && interval <= 46) return 10;
  else if (interval >= 47 && interval <= 51) return 11;
  return null;
}

// --- Legacy: verbatim from modal_studio_VoicingEditor.js (determineComponentType) ---
function legacyComponentType(interval) {
  if (interval === 0) return 'ROOT';
  if (interval >= 11 && interval <= 20) return 'THIRD';
  if (interval >= 27 && interval <= 35) return 'FIFTH';
  if (interval >= 42 && interval <= 52) return 'SEVENTH';
  if (interval >= 3 && interval <= 10) return 'NINTH';
  if (interval >= 21 && interval <= 25) return 'ELEVENTH';
  if (interval === 26) return 'SHARP_ELEVENTH';
  if (interval >= 33 && interval <= 41) return 'THIRTEENTH';
  return 'UNKNOWN';
}

let fails = 0;
for (let i = 0; i <= 52; i++) {
  const cp = T.chromaticPosition(i), lcp = legacyChromaticPosition(i);
  if (cp !== lcp) { fails++; console.error(`  ✗ chromaticPosition(${i}): temperament=${cp}, legacy=${lcp}`); }

  const ct = T.componentType(i), lct = legacyComponentType(i);
  if (ct !== lct) { fails++; console.error(`  ✗ componentType(${i}): temperament=${ct}, legacy=${lct}`); }
}

// Landmarks + extension-detection ranges (Phase 2 tail) — lifted from Chord.js
// qualityWithExtensions and VoicingEditor calculateExtendedComponents.
const L = T.landmarks, xr = T.extensionRanges;
function eq(label, got, want) {
  if (got !== want) { fails++; console.error(`  ✗ ${label}: ${got} != ${want}`); }
  else console.log(`  ✓ ${label}`);
}
eq('landmark ninth=9',          L.ninth, 9);
eq('landmark eleventh=22',      L.eleventh, 22);
eq('landmark sharpEleventh=27', L.sharpEleventh, 27);
eq('landmark thirteenth=40',    L.thirteenth, 40);
eq('extRange nat9 3-9',    `${xr.nat9.lo}-${xr.nat9.hi}`,   '3-9');
eq('extRange nat11 21-25', `${xr.nat11.lo}-${xr.nat11.hi}`, '21-25');
eq('extRange nat13 37-41', `${xr.nat13.lo}-${xr.nat13.hi}`, '37-41');
eq('extRange p5 30-32',    `${xr.p5.lo}-${xr.p5.hi}`,       '30-32');

console.log(fails === 0
  ? 'SEMANTIC GOLDEN PASS — classifiers + landmarks + extension ranges match the legacy 53-TET values.'
  : `\n${fails} MISMATCH(ES) — the lifted ranges do not match the live source.`);
process.exit(fails === 0 ? 0 : 1);
