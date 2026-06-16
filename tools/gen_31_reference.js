// Generate 31_reference_notes.json — the 31-EDO reference table (STRATEGY.md §6.1, Phase 3c).
//
//     node tools/gen_31_reference.js
//
// Anchored at the SAME pitch as 53_reference_notes.json: reference 0 = A1 = 55.18012 Hz, so a
// given root stays the same Hz when MS switches 53 ↔ 31. Schema mirrors the 53 file:
//   { reference, frequency, MIDI, bend, noteName }.

const fs = require('fs');
const path = require('path');

require('../temperament.js');
const T = globalThis.Temperament.get(31);

// The app builds everything from starting_note (C). The 53 grid anchors its C (ref -40 = C1)
// at ≈ 32.69 Hz; 31 must put its C (ref -23 = C1) at the SAME Hz so the ROOT is identical across
// temperaments. The previous A1-anchor (55.18) left 31's C ~16 cents sharp — the "bad approximation".
const REF53_AT0 = 55.180120000000002;            // 53 reference table value at ref 0
const C_HZ      = REF53_AT0 * Math.pow(2, -40 / 53);  // 53's C1 (ref -40) — shared root anchor (≈32.69 Hz)
const ANCHOR    = -23;                           // 31's C1 = Temperament31.startingNote

const notes = [];
for (let r = -40; r <= 200; r++) {       // ≈ G0 … C8 — wide enough for the KL hex keyboard's ~5-octave
                                         // span (displayed refs ~4..160) plus margin; was -31..155.
  const frequency = C_HZ * Math.pow(2, (r - ANCHOR) / 31);
  const midiExact = 69 + 12 * Math.log2(frequency / 440);
  const MIDI = Math.floor(midiExact);
  const bend = midiExact - MIDI;         // fractional semitone [0,1), same convention as the 53 file

  const pc = T.noteName(r);              // pitch class
  // A-anchored octave numbering, matching the 53 reference file (octave boundary at A, so the C a
  // minor-third above A0 reads "C0"). Keeps note labels consistent when switching 53 ↔ 31.
  const octave = Math.floor((r + 31) / 31);
  const noteName = pc + octave;

  notes.push({ reference: r, frequency, MIDI, bend, noteName });
}

// Must live where loadJSONData fetches from: dataset/ (beside 53_reference_notes.json).
const out = path.join(__dirname, '..', 'dataset', '31_reference_notes.json');
fs.writeFileSync(out, JSON.stringify({ notes }));

const at = (ref) => notes.find(n => n.reference === ref);
console.log(`wrote 31_reference_notes.json — ${notes.length} notes`);
console.log(`  ref   0 → ${at(0).noteName}  ${at(0).frequency.toFixed(3)} Hz  (anchor; 53 has A1 here too)`);
console.log(`  ref -31 → ${at(-31).noteName}  ${at(-31).frequency.toFixed(3)} Hz  (53 has A0 = 27.590)`);
console.log(`  ref  18 → ${at(18).noteName}  ${at(18).frequency.toFixed(3)} Hz  (P5 above A1 = E)`);
console.log(`  octave at ref 8 → ${at(8).noteName} (expect C2), ref 6 → ${at(6).noteName} (expect Cb2), ref 7 → ${at(7).noteName} (expect B#1)`);
