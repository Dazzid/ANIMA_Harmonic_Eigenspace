// Phase 0 oracle for the 31-TET work (STRATEGY.md §6.1).
//
// Pins the mechanical "kind-A" tuning math so the Phase 1 refactor cannot silently
// change 53-TET behavior. Runs in plain Node — no test framework:
//
//     node tools/temperament_check.js
//
// It loads temperament.js (which attaches to globalThis), then asserts the math
// against the legacy formulas used throughout the app:
//   get53tetRatio(s)        = Math.pow(2, s/53)
//   findClosest53TETStep(r) = Math.round(53 * Math.log2(r))
//   octave-reduction        = ((x % 53) + 53) % 53

require('../temperament.js');
const T = globalThis.Temperament;

let failures = 0;
function check(label, got, want) {
  const ok = Object.is(got, want);
  if (!ok) { failures++; console.error(`  ✗ ${label}: got ${got}, want ${want}`); }
  else { console.log(`  ✓ ${label}`); }
}

// Legacy formulas, copied verbatim from key_map.js / modal_studio_KeyMap.js.
const legacyRatio = (s, N) => Math.pow(2, s / N);
const legacyStep  = (r, N) => Math.round(N * Math.log2(r));
const legacyMod   = (x, N) => ((x % N) + N) % N;

for (const id of [53, 31]) {
  const t = T.get(id);
  console.log(`\n[${t.name}]`);

  check('N', t.N, id);
  check('interModel sums to N', t.interModel.reduce((a, b) => a + b, 0), id);
  check('stepToRatio(0) = 1', t.stepToRatio(0), 1);
  check('stepToRatio(N) = 2 (octave)', t.stepToRatio(id), 2);
  check('octave = N', t.octave, id);

  // Roundtrip + parity with the legacy formulas across a full octave (+ negatives).
  let ratioParity = true, stepParity = true, roundtrip = true, modParity = true;
  for (let s = -id; s <= 2 * id; s++) {
    if (!Object.is(t.stepToRatio(s), legacyRatio(s, id))) ratioParity = false;
    if (t.ratioToStep(t.stepToRatio(s)) !== s) roundtrip = false;
    if (t.mod(s) !== legacyMod(s, id)) modParity = false;
  }
  for (let k = 1; k <= 2 * id; k++) {
    const r = legacyRatio(k, id) * 1.0001; // jittered so rounding is exercised
    if (t.ratioToStep(r) !== legacyStep(r, id)) stepParity = false;
  }
  check('stepToRatio parity with legacy', ratioParity, true);
  check('ratioToStep parity with legacy', stepParity, true);
  check('ratioToStep∘stepToRatio roundtrip', roundtrip, true);
  check('mod parity with legacy ((x%N)+N)%N', modParity, true);
}

// Landmark sanity: the perfect fifth (3:2) must round to the known step in each EDO.
console.log('\n[landmarks]');
check('53-TET P5 ≈ 31', T.get(53).ratioToStep(1.5), 31);
check('31-TET P5 ≈ 18', T.get(31).ratioToStep(1.5), 18);
check('53-TET M3 (5:4) ≈ 17', T.get(53).ratioToStep(1.25), 17);
check('31-TET M3 (5:4) ≈ 10', T.get(31).ratioToStep(1.25), 10);

console.log(failures === 0
  ? '\nALL PASS — 53-TET math is pinned; safe to route call sites through Temperament.active.'
  : `\n${failures} FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
