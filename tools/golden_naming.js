// Phase 2 naming regression guard (STRATEGY.md §6.1).
//
//     node tools/golden_naming.js
//
// The chord-quality maps + chordNameTable were lifted out of modal_studio_Chord.js into
// Temperament53 and proven byte-identical at migration time. The source literals are now
// gone (Chord.js references Temperament). This guard freezes that proven state in
// tools/golden_naming_53.json and deep-equals Temperament53 against it, so any ACCIDENTAL
// future edit to those tables (e.g. while authoring the 31-TET set in Phase 3) is caught.

const fs = require('fs');
const path = require('path');

require('../temperament.js');
const T = globalThis.Temperament.get(53);
const frozen = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden_naming_53.json'), 'utf8'));

function deepEqualFlat(a, b) {
  if (!a || !b) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

let fails = 0;
for (const name of ['thirdQualityMap', 'fifthQualityMap', 'seventhQualityMap', 'chordNameTable']) {
  if (deepEqualFlat(frozen[name], T[name])) {
    console.log(`  ✓ ${name} (${Object.keys(frozen[name]).length} entries)`);
  } else {
    fails++; console.error(`  ✗ ${name} drifted from the frozen 53-TET snapshot`);
  }
}

console.log(fails === 0
  ? 'NAMING GOLDEN PASS — Temperament53 tables match the frozen snapshot.'
  : `\n${fails} DRIFT(S) from snapshot.`);
process.exit(fails === 0 ? 0 : 1);
