// temperament.js — single source of truth for the tuning resolution (EDO).
//
// See STRATEGY.md §6.1. Today the integer 53 is hardcoded ~120× across the MS and
// KL code. This module turns "53 is everywhere" into "N is one place": every scene
// that does tuning math reads N (and, later, note names / interval ranges / naming
// tables) from `Temperament.active` instead of writing a literal 53.
//
// Phase 1 (current): only the mechanical "kind-A" math lives here — step↔ratio,
// modulo, octave, and the diatonic generator. Default active = 53-TET, so behavior
// is byte-for-byte identical to before. Note names, interval-class ranges, the
// chord-naming tables, and the per-temperament reference-note JSON are filled in
// Phases 2–3 (see the TODO markers below).
//
// Loaded as a plain <script> BEFORE every consumer (key_map.js and all modal_studio_*
// modules + keyboard.js). Also attaches to globalThis so the Node oracle can load it.

(function (global) {
  'use strict';

  // Build a temperament from a minimal spec. The math is a pure function of N.
  function makeTemperament(spec) {
    const N = spec.N;
    return {
      id: spec.id,
      name: spec.name,
      N: N,

      // Diatonic generator: the major-scale step pattern (T T s T T T s). Sums to N.
      //   53-TET → [9,9,4,9,9,9,4]   ·   31-TET → [5,5,3,5,5,5,3]
      interModel: spec.interModel.slice(),

      // 12-note chromatic step pattern from C, used by the Scale/Voicing editors to decide which
      // of the N ring steps get a note-name label (shouldDrawNoteAtStep). Cumulative sums give the
      // 12 chromatic steps: 53 → C C# D Eb E F F# G G# A Bb B at 0,5,9,14,18,22,27,31,36,40,44,49;
      // 31 → same names at 0,2,5,8,10,13,15,18,20,23,26,28.
      chromaticStepPattern: spec.chromaticStepPattern || null,

      // 7 voicing templates (1-indexed positions into the chord's 7-note scale stack). 53 keeps
      // its open templates; 31 uses tighter ones so the chord tones sit near the bass, not an
      // octave above (the 53 indices reach octave 3 of the stack — absurd spread in 31).
      voicings: spec.voicings || null,

      // step (root-relative, may be negative or span octaves) → frequency ratio.
      stepToRatio: function (steps) { return Math.pow(2, steps / N); },

      // frequency ratio (vs root) → nearest step.
      ratioToStep: function (ratio) { return Math.round(N * Math.log2(ratio)); },

      // positive modulo into [0, N): the octave-reduction that today is written `((x % 53) + 53) % 53`.
      mod: function (step) { return ((step % N) + N) % N; },

      // one octave, in steps.
      octave: N,

      // reference-notes JSON for this temperament (loaded into OfApp.fiftyThree).
      referenceFile: spec.referenceFile || null,

      // KL (Lumatone hex keyboard) isomorphic layout. The PHYSICAL grid (q,r per hex) is shared —
      // keyboard.js reuses Edo53_settings_new.xml for both temperaments — but each hex's PITCH is
      // recomputed per tuning: note = (notePerQ·q + notePerR·r) mod N, reference = refOrigin +
      // notePerQ·q + notePerR·r, played from this temperament's reference JSON at reference+octaveShift.
      //   53 → q:+9 (M2), r:+5 (A1 chromatic semitone); refOrigin 62 (=N+notePerQ), octaveShift -52 (=-(N-1)).
      //   31 → q:+5 (M2), r:+2 (A1);                     refOrigin 36 (=N+notePerQ), octaveShift -30 (=-(N-1)).
      // The diagonal q−r = diatonic semitone in both (53: 4, 31: 3), so the hex geometry is the same shape.
      kl: spec.kl || null,

      // KL chord menu vocabulary (the floating #chord-panel). `fifth` is the perfect fifth in steps;
      // thirds/sevenths/ninths/elevenths are [step, displaySymbol] rows; sus = full interval templates.
      // 53 lists the 10 comma-variant qualities; 31 collapses to the 5-quality basis (sm/m/N/M/SM) — so
      // the 31 menu is smaller by design (5 triads + 25 sevenths vs 10 + 100).
      klChords: spec.klChords || null,

      // Natural-note pitch classes (JSON/reference frame, A-anchored: A=0) for the functional
      // fundamental selector (C D E F G A B). 53 and 31 differ because the diatonic steps differ.
      klNaturals: spec.klNaturals || null,

      // base reference index the app builds modes/chords from (the C near 32.7 Hz). 53 and 31
      // anchor A at ref 0, so C lands at a DIFFERENT index in each (53: -40, 31: -23).
      startingNote: (spec.startingNote !== undefined ? spec.startingNote : -40),

      // --- Phase 2: interval-class semantics (kind C) ---
      // Ordered range tables in steps-from-root (53 populated; 31 authored in Phase 3).
      chromaticRanges: spec.chromaticRanges || null,
      componentRanges: spec.componentRanges || null,

      // interval (root-relative steps) → chromatic slot 0..11, or null if unclassified.
      // Mirrors the inline if/else in modal_studio_KeyMap.calculateChromatic12Notes.
      chromaticPosition: function (interval) {
        const rs = spec.chromaticRanges;
        if (!rs) return null;
        for (let i = 0; i < rs.length; i++) {
          if (interval >= rs[i].lo && interval <= rs[i].hi) return rs[i].pos;
        }
        return null;
      },

      // interval (root-relative steps) → chord-component token, or 'UNKNOWN'.
      // ORDER MATTERS: mirrors modal_studio_VoicingEditor.determineComponentType, where
      // FIFTH (27–35) is tested before THIRTEENTH (33–41), shadowing steps 33–35.
      componentType: function (interval) {
        const rs = spec.componentRanges;
        if (!rs) return 'UNKNOWN';
        for (let i = 0; i < rs.length; i++) {
          if (interval >= rs[i].lo && interval <= rs[i].hi) return rs[i].type;
        }
        return 'UNKNOWN';
      },

      // Chord-quality maps (step from root → quality token). 53 populated; 31 in Phase 3.
      thirdQualityMap:   spec.thirdQualityMap   || null,
      fifthQualityMap:   spec.fifthQualityMap   || null,
      seventhQualityMap: spec.seventhQualityMap || null,

      // Chord-name lookup: "third_fifth_seventh" quality tuple → display symbol.
      chordNameTable: spec.chordNameTable || null,

      // Named landmark steps + extension-detection ranges (kind C). 53 set; 31 in Phase 3.
      landmarks: spec.landmarks || null,
      extensionRanges: spec.extensionRanges || null,

      // Interval windows for classifying a voiced interval as 3rd/5th/7th when naming FROM a
      // voicing (setChordQualityFromVoicing). Temperament-specific (the regions differ).
      voicingRanges: spec.voicingRanges || null,

      // Interval windows (root-relative steps) used by VoicingEditor.buildLeadingVoicing to find
      // which chord tone is the 3rd/5th/7th when applying a "X on top" voicing preset. Kept
      // SEPARATE from voicingRanges so 53 stays byte-identical to its old hardcoded windows
      // (third 11-20, fifth 26-35, seventh 42-52); 31 uses the meantone regions.
      leadVoicingRanges: spec.leadVoicingRanges || null,

      // step → pitch-class name (anchored at step 0 = A, matching the reference tables).
      // Returns null for temperaments that don't define names here (53 keeps using key_map).
      noteName: function (step) {
        if (!spec.noteNames) return null;
        return spec.noteNames[((step % N) + N) % N];
      },
    };
  }

  const Temperament53 = makeTemperament({
    id: 53, name: '53-TET', N: 53,
    interModel: [9, 9, 4, 9, 9, 9, 4],
    chromaticStepPattern: [0, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4, 5],   // C C# D Eb E F F# G G# A Bb B
    referenceFile: '53_reference_notes.json',
    kl: { notePerQ: 9, notePerR: 5, refOrigin: 62, octaveShift: -52 },
    klChords: {       // exact current keyboard.js tables (53 unchanged)
      fifth: 31,
      thirds:    [[20,'SM'],[19,'^M'],[18,'M'],[17,'vM'],[16,'N'],[15,'n'],[14,'^m'],[13,'m'],[12,'vm'],[11,'sm']],
      sevenths:  [[51,'SM'],[50,'^M'],[49,'maj'],[48,'vM'],[47,'N'],[46,'n'],[45,'^m'],[44,'m'],[43,'vm'],[42,'sm']],
      ninths:    [[64,'SM'],[63,'^M'],[62,'M'],[61,'vM'],[60,'N'],[59,'n'],[58,'^m'],[57,'m'],[56,'vm'],[55,'sm']],
      elevenths: [[82,'SM'],[81,'^M'],[80,'M'],[79,'vM'],[78,'N'],[77,'n'],[76,'^m'],[75,'m'],[74,'vm'],[73,'sm']],
      sus: [ { name: '7sus4', intervals: [0, 22, 31, 44] }, { name: 'sus2', intervals: [0, 9, 22, 31] } ],
    },
    klNaturals: { C: 13, D: 22, E: 31, F: 35, G: 44, A: 0, B: 9 },
    startingNote: -40,   // C1 in the 53 reference table
    voicings: [          // exact current Chord-class defaults (53 unchanged)
      [8, 17, 19, 21, 22],
      [8, 14, 17, 19, 22],
      [8, 14, 17, 19, 21],
      [8, 12, 14, 17, 19, 21],
      [1, 8, 12, 14, 17, 19],
      [1, 7, 12, 14, 17, 19],
      [1, 7, 10, 12, 14, 17],
    ],
    // Phase 2: interval-class tables lifted verbatim from the inline classifiers
    // (proven byte-identical by tools/golden_semantics.js). Steps from the root.
    chromaticRanges: [
      { lo: 0,  hi: 0,  pos: 0 },
      { lo: 3,  hi: 7,  pos: 1 },
      { lo: 8,  hi: 10, pos: 2 },
      { lo: 11, hi: 15, pos: 3 },
      { lo: 16, hi: 20, pos: 4 },
      { lo: 21, hi: 24, pos: 5 },
      { lo: 25, hi: 28, pos: 6 },
      { lo: 29, hi: 33, pos: 7 },
      { lo: 34, hi: 37, pos: 8 },
      { lo: 38, hi: 41, pos: 9 },
      { lo: 42, hi: 46, pos: 10 },
      { lo: 47, hi: 51, pos: 11 },
    ],
    componentRanges: [
      { lo: 0,  hi: 0,  type: 'ROOT' },
      { lo: 11, hi: 20, type: 'THIRD' },
      { lo: 27, hi: 35, type: 'FIFTH' },          // tested before THIRTEENTH (shadows 33–35)
      { lo: 42, hi: 52, type: 'SEVENTH' },
      { lo: 3,  hi: 10, type: 'NINTH' },
      { lo: 21, hi: 25, type: 'ELEVENTH' },
      { lo: 26, hi: 26, type: 'SHARP_ELEVENTH' },
      { lo: 33, hi: 41, type: 'THIRTEENTH' },
    ],
    // Chord-quality maps lifted verbatim from modal_studio_Chord.js (proven
    // deep-equal by tools/golden_naming.js). Step from root → quality token.
    thirdQualityMap: {
      10: "subminor", 11: "subminor", 12: "downminor", 13: "minor", 14: "upminor",
      15: "neutralminor", 16: "neutralmajor", 17: "downmajor", 18: "major",
      19: "upmajor", 20: "supermajor"
    },
    fifthQualityMap: {
      26: "diminished", 27: "diminished", 28: "diminished", 29: "diminished",
      30: "perfect", 31: "perfect", 32: "perfect",
      33: "augmented", 34: "augmented", 35: "augmented", 36: "augmented"
    },
    seventhQualityMap: {
      33: "subdiminished", 34: "downdiminished", 35: "diminished", 36: "updiminished",
      42: "subminor", 43: "downminor", 44: "minor", 45: "upminor",
      46: "neutralminor", 47: "neutralmajor", 48: "downmajor", 49: "major",
      50: "upmajor", 51: "supermajor"
    },
    // chordNameTable lifted verbatim from modal_studio_Chord.js (`chordNames`).
    // key = "third_fifth_seventh" quality tuple → display symbol. Deep-equal proven by
    // tools/golden_naming.js. The 31-TET table (smaller vocabulary) is authored in Phase 3.
    chordNameTable: {
      // Super-major combinations
      "supermajor_perfect_supermajor": "SMSM7",
      "supermajor_perfect_upmajor": "SM^M7",
      "supermajor_perfect_major": "SMmaj7",
      "supermajor_perfect_downmajor": "SMvM7",
      "supermajor_perfect_neutralmajor": "SMN7",
      "supermajor_perfect_neutralminor": "SMn7",
      "supermajor_perfect_upminor": "SM^m7",
      "supermajor_perfect_minor": "SMm7",
      "supermajor_perfect_downminor": "SMvm7",
      "supermajor_perfect_subminor": "SMsm7",

      // Up-major combinations
      "upmajor_perfect_supermajor": "^MSM7",
      "upmajor_perfect_upmajor": "^M^M7",
      "upmajor_perfect_major": "^Mmaj7",
      "upmajor_perfect_downmajor": "^MvM7",
      "upmajor_perfect_neutralmajor": "^MN7",
      "upmajor_perfect_neutralminor": "^Mn7",
      "upmajor_perfect_upminor": "^M^m7",
      "upmajor_perfect_minor": "^Mm7",
      "upmajor_perfect_downminor": "^Mvm7",
      "upmajor_perfect_subminor": "^Msm7",

      // Major combinations
      "major_perfect_supermajor": "MSM7",
      "major_perfect_upmajor": "M^M7",
      "major_perfect_major": "maj7",
      "major_perfect_downmajor": "MvM7",
      "major_perfect_neutralmajor": "MN7",
      "major_perfect_neutralminor": "Mn7",
      "major_perfect_upminor": "M^m7",
      "major_perfect_minor": "Mm7",
      "major_perfect_downminor": "Mvm7",
      "major_perfect_subminor": "Msm7",

      // Down-major combinations
      "downmajor_perfect_supermajor": "vMSM7",
      "downmajor_perfect_upmajor": "vM^M7",
      "downmajor_perfect_major": "vMmaj7",
      "downmajor_perfect_downmajor": "vMvM7",
      "downmajor_perfect_neutralmajor": "vMN7",
      "downmajor_perfect_neutralminor": "vMn7",
      "downmajor_perfect_upminor": "vM^m7",
      "downmajor_perfect_minor": "vMm7",
      "downmajor_perfect_downminor": "vMvm7",
      "downmajor_perfect_subminor": "vMsm7",

      // Neutral-major combinations
      "neutralmajor_perfect_supermajor": "NSM7",
      "neutralmajor_perfect_upmajor": "N^M7",
      "neutralmajor_perfect_major": "Nmaj7",
      "neutralmajor_perfect_downmajor": "NvM7",
      "neutralmajor_perfect_neutralmajor": "NN7",
      "neutralmajor_perfect_neutralminor": "Nn7",
      "neutralmajor_perfect_upminor": "N^m7",
      "neutralmajor_perfect_minor": "Nm7",
      "neutralmajor_perfect_downminor": "Nvm7",
      "neutralmajor_perfect_subminor": "Nsm7",

      // Neutral-minor combinations
      "neutralminor_perfect_supermajor": "nSM7",
      "neutralminor_perfect_upmajor": "n^M7",
      "neutralminor_perfect_major": "nmaj7",
      "neutralminor_perfect_downmajor": "nvM7",
      "neutralminor_perfect_neutralmajor": "nN7",
      "neutralminor_perfect_neutralminor": "nn7",
      "neutralminor_perfect_upminor": "n^m7",
      "neutralminor_perfect_minor": "nm7",
      "neutralminor_perfect_downminor": "nvm7",
      "neutralminor_perfect_subminor": "nsm7",

      // Up-minor combinations
      "upminor_perfect_supermajor": "^mSM7",
      "upminor_perfect_upmajor": "^m^M7",
      "upminor_perfect_major": "^mmaj7",
      "upminor_perfect_downmajor": "^mvM7",
      "upminor_perfect_neutralmajor": "^mN7",
      "upminor_perfect_neutralminor": "^mn7",
      "upminor_perfect_upminor": "^m^m7",
      "upminor_perfect_minor": "^mm7",
      "upminor_perfect_downminor": "^mvm7",
      "upminor_perfect_subminor": "^msm7",

      // Minor combinations
      "minor_perfect_supermajor": "mSM7",
      "minor_perfect_upmajor": "m^M7",
      "minor_perfect_major": "mmaj7",
      "minor_perfect_downmajor": "mvM7",
      "minor_perfect_neutralmajor": "mN7",
      "minor_perfect_neutralminor": "mn7",
      "minor_perfect_upminor": "m^m7",
      "minor_perfect_minor": "m7",
      "minor_perfect_downminor": "mvm7",
      "minor_perfect_subminor": "msm7",
      "minor_downperfect_minor": "m7*",
      "minor_upperfect_minor": "m7*",

      // Down-minor combinations
      "downminor_perfect_supermajor": "vmSM7",
      "downminor_perfect_upmajor": "vm^M7",
      "downminor_perfect_major": "vmmaj7",
      "downminor_perfect_downmajor": "vmvM7",
      "downminor_perfect_neutralmajor": "vmN7",
      "downminor_perfect_neutralminor": "vmn7",
      "downminor_perfect_upminor": "vm^m7",
      "downminor_perfect_minor": "vm7",
      "downminor_perfect_downminor": "vmvm7",
      "downminor_perfect_subminor": "vmsm7",

      // Sub-minor combinations
      "subminor_perfect_supermajor": "smSM7",
      "subminor_perfect_upmajor": "sm^M7",
      "subminor_perfect_major": "smmaj7",
      "subminor_perfect_downmajor": "smvM7",
      "subminor_perfect_neutralmajor": "smN7",
      "subminor_perfect_neutralminor": "smn7",
      "subminor_perfect_upminor": "sm^m7",
      "subminor_perfect_minor": "sm7",
      "subminor_perfect_downminor": "smvm7",
      "subminor_perfect_subminor": "smsm7",

      // Half diminished upminor combinations
      "upminor_diminished_supermajor": "øSM7",
      "upminor_diminished_upmajor": "ø^M7",
      "upminor_diminished_major": "ømaj7",
      "upminor_diminished_downmajor": "øvM7",
      "upminor_diminished_neutralmajor": "øN7",
      "upminor_diminished_neutralminor": "øn7",
      "upminor_diminished_upminor": "ø^m7",
      "upminor_diminished_minor": "ø7",
      "upminor_diminished_downminor": "øvm7",
      "upminor_diminished_subminor": "øsm7",

      // Half_Diminished minor combinations
      "minor_diminished_supermajor": "øS7",
      "minor_diminished_upmajor": "ø^M7",
      "minor_diminished_major": "ømaj7",
      "minor_diminished_downmajor": "øvM7",
      "minor_diminished_neutralmajor": "øNM7",
      "minor_diminished_neutralminor": "øn7",
      "minor_diminished_upminor": "øv7",
      "minor_diminished_minor": "ø7",
      "minor_diminished_downminor": "øvm7",
      "minor_diminished_subminor": "øsm7",

      // Half Diminished downminor combinations
      "downminor_diminished_supermajor": "vøS7",
      "downminor_diminished_upmajor": "vø^M7",
      "downminor_diminished_major": "vømaj7",
      "downminor_diminished_downmajor": "vøvM7",
      "downminor_diminished_neutralmajor": "vøN7",
      "downminor_diminished_neutralminor": "vøn7",
      "downminor_diminished_upminor": "vø^m7",
      "downminor_diminished_minor": "vø7",
      "downminor_diminished_downminor": "vøvm7",
      "downminor_diminished_subminor": "vøsm7",

      // Half Diminished subminor combinations
      "subminor_diminished_supermajor": "søS7",
      "subminor_diminished_upmajor": "sø^M7",
      "subminor_diminished_major": "sømaj7",
      "subminor_diminished_downmajor": "søvM7",
      "subminor_diminished_neutralmajor": "søN7",
      "subminor_diminished_neutralminor": "søn7",
      "subminor_diminished_upminor": "sø^m7",
      "subminor_diminished_minor": "sø7",
      "subminor_diminished_downminor": "søvm7",
      "subminor_diminished_subminor": "søsm7",

      // Full diminished
      "minor_diminished_updiminished": "o^7",
      "minor_diminished_diminished": "o7",
      "minor_diminished_downdiminished": "ov7",
      "minor_diminished_subdiminished": "ovv7",

      // Augmented combinations
      "major_augmented_super-major": "M+S7",
      "major_augmented_upmajor": "M+^M7",
      "major_augmented_major": "M+maj7",
      "major_augmented_downmajor": "M+vM7",
      "major_augmented_neutral-major": "M+NM7",
      "major_augmented_neutral": "M+N7",
      "major_augmented_neutral-minor": "M+n7",
      "major_augmented_minor": "M+m7",
      "major_augmented_downminor": "M+vm7",
      "major_augmented_subminor": "M+sm7",

      // Add downperfect ones
      "downmajor_downperfect_downmajor": "vMvM*",
      "neutralmajor_diminished_downminor": "Nøvm",
      "neutralminor_diminished_neutralmajor": "nøN"
    },
    // Named landmark steps used for default extension placement (calculateExtendedComponents).
    landmarks: {
      ninth: 9,           // M2 — default 9th
      eleventh: 22,       // P4 — default natural 11th
      sharpEleventh: 27,  // A4 / tritone — #11 (b5 = 26, a comma lower, stays distinct in 53)
      thirteenth: 40,     // M6 — default 13th
    },
    // Interval ranges for extension detection in chord names (qualityWithExtensions).
    extensionRanges: {
      nat9:  { lo: 3,  hi: 9  },
      nat11: { lo: 21, hi: 25 },
      nat13: { lo: 37, hi: 41 },
      p5:    { lo: 30, hi: 32 },
    },
    // Exact current setChordQualityFromVoicing windows — 53 behavior preserved verbatim.
    // majorThird/flatSeventh drive isMajorChord (→ #11 reserved to maj7, not dominants).
    voicingRanges: { third: [10, 20], fifth: [26, 36], seventh: [[33, 36], [42, 51]], p5: [30, 32], majorThird: [17, 20], flatSeventh: [42, 46] },
    // buildLeadingVoicing tone-detection windows — EXACTLY the old hardcoded 53 values.
    leadVoicingRanges: { third: [11, 20], fifth: [26, 35], seventh: [42, 52] },
  });

  // Stub: N + generator are correct and usable now; the musical content (names,
  // ranges, naming tables, 31_reference_notes.json) is authored in Phase 3.
  const Temperament31 = makeTemperament({
    id: 31, name: '31-TET', N: 31,
    interModel: [5, 5, 3, 5, 5, 5, 3],
    chromaticStepPattern: [0, 2, 3, 3, 2, 3, 2, 3, 2, 3, 3, 2],   // C C# D Eb E F F# G G# A Bb B (meantone)
    referenceFile: '31_reference_notes.json',
    kl: { notePerQ: 5, notePerR: 2, refOrigin: 36, octaveShift: -30 },
    klChords: {       // 5-quality basis (sm/m/N/M/SM) → a smaller menu than 53's 10 comma-variants.
      fifth: 18,      // P5
      thirds:    [[11,'SM'],[10,'M'],[9,'N'],[8,'m'],[7,'sm']],         // supermajor..subminor
      sevenths:  [[29,'SM'],[28,'maj'],[27,'N'],[26,'m'],[25,'sm']],    // 'maj' = the major 7th
      // 9th = octave + the 2nd region (steps 6/5/4/3/2 = SM2/M2/N2/m2/A1); the menu appends " 9".
      ninths:    [[37,'SM'],[36,'M'],[35,'N'],[34,'m'],[33,'sm']],
      // 11th = octave + the 4th region (steps 16/15/14/13/12); M = #11 (A4), m = P11 (P4). Appends " 11".
      elevenths: [[47,'SM'],[46,'M'],[45,'N'],[44,'m'],[43,'sm']],
      sus: [ { name: '7sus4', intervals: [0, 13, 18, 26] }, { name: 'sus2', intervals: [0, 5, 13, 18] } ],
    },
    klNaturals: { C: 8, D: 13, E: 18, F: 21, G: 26, A: 0, B: 5 },
    startingNote: -23,   // C1 in the 31 reference table (≈ 33 Hz, matching 53's -40 ≈ 32.7 Hz)
    // voicings: null → 31 uses the same scale-stack templates as 53 (C2 E3 G3 B3 C4 base);
    // the spread problem is the 9/11/13 extension placement, not the base voicing.
    // Phase 3 — 31-EDO interval-class layer, derived from the meantone landmarks
    // (M2=5, m3=8, M3=10, P4=13, A4/#11=15, d5=16, P5=18, m6=21, M6=23, m7=25, M7=28).
    // NB meantone (flat 5th) puts A4(15) BELOW d5(16) — opposite of 53-TET's sharp 5th.
    // Boundary choices mirror the 53 ranges scaled to 31 — review-worthy.
    chromaticRanges: [
      { lo: 0,  hi: 0,  pos: 0 },   // C
      { lo: 2,  hi: 4,  pos: 1 },   // C#/Db
      { lo: 5,  hi: 6,  pos: 2 },   // D
      { lo: 7,  hi: 8,  pos: 3 },   // D#/Eb
      { lo: 9,  hi: 11, pos: 4 },   // E
      { lo: 12, hi: 14, pos: 5 },   // F
      { lo: 15, hi: 16, pos: 6 },   // F#/Gb
      { lo: 17, hi: 19, pos: 7 },   // G
      { lo: 20, hi: 21, pos: 8 },   // G#/Ab
      { lo: 22, hi: 24, pos: 9 },   // A
      { lo: 25, hi: 26, pos: 10 },  // A#/Bb
      { lo: 27, hi: 29, pos: 11 },  // B
    ],
    componentRanges: [
      { lo: 0,  hi: 0,  type: 'ROOT' },
      { lo: 2,  hi: 6,  type: 'NINTH' },
      { lo: 7,  hi: 12, type: 'THIRD' },
      { lo: 13, hi: 14, type: 'ELEVENTH' },
      { lo: 15, hi: 15, type: 'SHARP_ELEVENTH' },  // A4 (#11) = 15 in meantone
      { lo: 16, hi: 20, type: 'FIFTH' },           // incl d5 = 16 (meantone: A4 < d5)
      { lo: 21, hi: 24, type: 'THIRTEENTH' },
      { lo: 25, hi: 30, type: 'SEVENTH' },
    ],
    landmarks: {
      ninth: 5,           // M2
      eleventh: 13,       // P4
      sharpEleventh: 15,  // A4 (#11). NB meantone: A4(15) < d5(16), opposite of 53-TET
      thirteenth: 23,     // M6
    },
    // Disjoint from the chord-tone bands (3rd 7-11, 5th 16-20, 7th 24-29) — extensions live
    // in the gaps so a chord tone is never mistaken for a 9/11/13.
    extensionRanges: {
      nat9:  { lo: 2,  hi: 6  },   // compound 2nd (m2 3 … M2 5), below the 3rd (7+)
      nat11: { lo: 13, hi: 14 },   // P4 region, above the 3rd (≤11), below #11 (15)/5th (16+)
      nat13: { lo: 21, hi: 23 },   // m6 … M6, above the 5th (≤20), below the dim7 (24)/7th
      p5:    { lo: 17, hi: 19 },
    },
    // 31 windows for naming from a voicing (3rd 7-11, 5th 16-20, 7th 24-29, P5 17-19).
    // majorThird (10-11) + flatSeventh (dim/sub/minor 24-26) → #11 only on a maj7 (major 3rd, no flat 7th).
    voicingRanges: { third: [7, 11], fifth: [16, 20], seventh: [[24, 29]], p5: [17, 19], majorThird: [10, 11], flatSeventh: [24, 26] },
    // buildLeadingVoicing tone-detection windows — meantone 3rd 7-11, 5th 16-20 (incl d5=16), 7th 24-29.
    leadVoicingRanges: { third: [7, 11], fifth: [16, 20], seventh: [24, 29] },
    // Step → quality token (31-EDO, 5-quality basis), authored from the meantone landmarks.
    // Natural 31-EDO quality steps. Kept disjoint from the extensionRanges below (3rd 7-11,
    // 5th 16-20, 7th 24-29) so chord tones are never mistaken for a 9/11/13 (the "SM7→SM11",
    // "o7→o13" bug). The earlier "unknown→C" issue was the stale palette, not map width.
    thirdQualityMap: {
      7: "subminor", 8: "minor", 9: "neutral", 10: "major", 11: "supermajor"
    },
    fifthQualityMap: {
      16: "diminished", 17: "diminished", 18: "perfect", 19: "augmented", 20: "augmented"
    },
    seventhQualityMap: {
      24: "diminished", 25: "subminor", 26: "minor", 27: "neutral", 28: "major", 29: "supermajor"
    },
    // Seventh-chord names (third_fifth_seventh → symbol) — confirmed scheme: a mirror of
    // 53's letters on the 5-quality subset (no ^/v comma variants). Triads fall back to
    // qualityCore + Chord.THIRD_SYMBOL. noteName(step) authored next.
    chordNameTable: {
      // Complete 5×5 third×seventh on a perfect 5th, plus diminished/augmented + sus —
      // same scheme as 53 (third symbol + seventh suffix), with the conventional shorthands
      // (maj7, 7, m7, mM7, ø7, o7). Third symbols sm/m/N/M/SM; seventh suffixes sm7/m7/N7/maj7/SM7.
      // ——— major third ———
      "major_perfect_major":           "maj7",
      "major_perfect_minor":           "7",        // dominant
      "major_perfect_neutral":         "MN7",
      "major_perfect_subminor":        "Msm7",     // harmonic/septimal dominant
      "major_perfect_supermajor":      "MSM7",
      // ——— minor third ———
      "minor_perfect_minor":           "m7",
      "minor_perfect_major":           "mM7",      // minor-major 7
      "minor_perfect_neutral":         "mN7",
      "minor_perfect_subminor":        "msm7",
      "minor_perfect_supermajor":      "mSM7",
      // ——— neutral third ———
      "neutral_perfect_minor":         "N7",
      "neutral_perfect_major":         "Nmaj7",
      "neutral_perfect_neutral":       "NN7",
      "neutral_perfect_subminor":      "Nsm7",
      "neutral_perfect_supermajor":    "NSM7",
      // ——— subminor third ———
      "subminor_perfect_subminor":     "sm7",
      "subminor_perfect_minor":        "sm7",
      "subminor_perfect_neutral":      "smN7",
      "subminor_perfect_major":        "smmaj7",
      "subminor_perfect_supermajor":   "smSM7",
      // ——— supermajor third ———
      "supermajor_perfect_supermajor": "SM7",
      "supermajor_perfect_major":      "SMmaj7",
      "supermajor_perfect_neutral":    "SMN7",
      "supermajor_perfect_minor":      "SMm7",
      "supermajor_perfect_subminor":   "SMsm7",
      // ——— diminished fifth (half-dim / dim) ———
      "minor_diminished_minor":        "ø7",
      "minor_diminished_subminor":     "ø7",
      "minor_diminished_diminished":   "o7",
      "subminor_diminished_diminished":"o7",
      // ——— augmented fifth ———
      "major_augmented_major":         "maj7+5",
      "major_augmented_minor":         "7+5",
    },
    // 31-EDO pitch-class names, anchored step 0 = A (matches the reference table). Meantone
    // #/b with half-sharp "+" / half-flat "-" for the 10 in-between steps (glyph is just this
    // array — swap "+"/"-" for Unicode demisharp/demiflat later if desired).
    noteNames: [
      'A', 'A+', 'A#', 'Bb', 'B-', 'B', 'Cb', 'B#', 'C', 'C+', 'C#', 'Db', 'D-', 'D', 'D+', 'D#',
      'Eb', 'E-', 'E', 'Fb', 'E#', 'F', 'F+', 'F#', 'Gb', 'G-', 'G', 'G+', 'G#', 'Ab', 'A-'
    ],
  });

  const TEMPERAMENTS = { 53: Temperament53, 31: Temperament31 };

  global.Temperament = {
    TEMPERAMENTS: TEMPERAMENTS,

    // Phase 1 default = 53-TET so nothing changes yet.
    // Per D5 (open): MS + KL likely SHARE this active value; ES is out of scope and
    // never reads it. KL stays pinned to 53 until its 31-TET hex layout exists (Phase 4).
    active: Temperament53,

    get: function (id) { return TEMPERAMENTS[id] || null; },

    setActive: function (id) {
      const t = TEMPERAMENTS[id];
      if (t) this.active = t;
      return this.active;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
