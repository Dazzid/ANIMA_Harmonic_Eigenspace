// ============================================================================
// LUMATONE 53-TET WEB — Faithful port from C++ (LumaButton.cpp/.hpp)
// Hex grid coordinates computed from XML, positions calculated mathematically
// ============================================================================

// Wrapped in an IIFE so this scene's many module-level names (audioCtx,
// masterGain, noteData, …) don't collide with the unified app's other scripts,
// which share the global script scope. Only KeyboardScene (for anima.js) and
// window.toggleChordPanel (for menu.js) are exposed.
(function () {

let noteData = [];       // frequency lookup from JSON
let xmlButtons = [];     // 280 hex buttons parsed from XML (persistent)
let gridButtons = [];    // all visible hex buttons (XML + generated extras)
let audioCtx = null;
let masterGain = null;
let dryGain = null;
let wetGain = null;
let convolver = null;
let kbP = null;          // the keyboard scene's p5 instance (set in keyboardSketch)

// Hexagon drawing parameters (from C++ LumaButton.hpp)
const NUM_STEPS = 6;
const STEP = (2 * Math.PI) / NUM_STEPS;
const START_ANGLE = 0.23666665; // exact value from C++ code

// Hex grid angle — derived from the original layout's basis vector a ≈ (50, -13)
const HEX_ANGLE = Math.atan2(-13, 50); // ≈ -0.2545 rad

// Inverse basis matrix for computing grid coords from original XML positions
// Original basis vectors: a ≈ (50, -13), b ≈ (14, -49)
// M = [[50, 14], [-13, -49]], det(M) = 50×(-49) - 14×(-13) = -2268
const GRID_REF_X = 88;   // reference origin X (button ID 2)
const GRID_REF_Y = 250;  // reference origin Y (button ID 2)
const GRID_DET = 2268;

// Scaling state
let scaledRadius = 10;
const MIN_RADIUS = 32; // minimum hex size for mobile usability
const MAX_RADIUS = 45; // maximum hex size cap

//Timer
const timer_interval = 5000; // ms

// ── Temperament-driven KL layout (was 53-hardcoded) ──────────────────────────
// keyboard.js was written 53-first. The pitch/vocabulary constants below now read
// from window.Temperament.active via deriveKLTemperament(), so the SAME physical
// hex grid (Edo53_settings_new.xml) plays either tuning. Consumers keep the names.
let KN = 53;              // steps per octave (active N)
let NOTE_PER_Q = 9;      // pitch steps per +q hex (a whole tone)
let NOTE_PER_R = 5;      // pitch steps per +r hex (a chromatic semitone)
let REF_ORIGIN = 62;     // reference at q=0, r=0
let OCTAVE_SHIFT = -52;  // global pitch shift (≈ −1 octave), in steps
let KL_FIFTH = 31;       // perfect fifth, in steps

// Chord tone colors: root, third, fifth, seventh, ninth, eleventh
const CHORD_COLORS = [
  [255, 170, 0],
  [110, 200, 0],
  [0, 200, 255],
  [255, 72, 0],
  [255, 172, 56],
  [165, 201, 56],
];

// Chord menu vocabulary (name + intervals in steps) — rebuilt per temperament by
// deriveKLTemperament() (53: 10 comma-variant qualities; 31: the 5-quality basis).
let CHORDS_53TET = [{ name: 'Single note', intervals: [0] }];
let selectedChord = CHORDS_53TET[0]; // default: single note

// --- Functional Disposition mode ---
// In Functional mode, a hex's chord quality is derived from its degree in the
// major scale rooted at functionalFundamental, instead of using fixed
// intervals. Letter (C,D,E,F,G,A,B) determines degree; sharps stay with their
// root letter, flats fall to their letter (Bb→B, Eb→E, Ab→A, Db→D, Gb→G).
let functionalMode = false;
const LETTER_TO_INDEX = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };
const ROMAN_NUMERALS = ['I','II','III','IV','V','VI','VII'];
// JSON pitch class → hex-side note value: hex = (json − REF_ORIGIN − OCTAVE_SHIFT) mod N.
function jsonNote53ToHex(n) {
  return (((n - REF_ORIGIN - OCTAVE_SHIFT) % KN) + KN) % KN;
}

// All of the following are rebuilt per temperament by deriveKLTemperament().
let NATURAL_NOTE53 = [];                    // [{name, note53(hex)}] for the fundamental selector
let functionalFundamental = 3;             // C (recomputed below)
let functionalDegreeMap = new Array(KN);   // hex note → letter index 0..6
let functionalDegreeChords = [];           // 7 entries: { triad, seventh, ninth, eleventh }
let functionalScaleSet = new Set();        // hex note values in the active scale

let THIRD_NAMES = [], THIRD_STEPS = [];
let SEVENTH_NAMES = [], SEVENTH_STEPS = [];
let NINTH_NAMES = [], NINTH_STEPS = [];
let ELEVENTH_NAMES = [], ELEVENTH_STEPS = [];
let SUS_CHORDS = [];
let THIRDS_53 = {}, SEVENTHS_53 = {};      // step → quality symbol (cluster naming)
let DEFAULT_SCALE_INTERVALS = [0, 9, 18, 22, 31, 40, 49];  // cumsum(interModel)
let MODAL_M2 = 9, MODAL_P4 = 22, MODAL_P5 = 31;            // landmarks off the default scale

// Extension state: null = off, otherwise a step value
let selected9th = null;
let selected11th = null;

// (Re)build every temperament-dependent KL table from window.Temperament.active.
// Called at module init and on a temperament switch (kbRebuildForTemperament).
function deriveKLTemperament() {
  const T = (window.Temperament && window.Temperament.active) || null;
  if (!T) return;
  KN = T.N;
  const kl = T.kl || { notePerQ: 9, notePerR: 5, refOrigin: 62, octaveShift: -52 };
  NOTE_PER_Q = kl.notePerQ; NOTE_PER_R = kl.notePerR;
  REF_ORIGIN = kl.refOrigin; OCTAVE_SHIFT = kl.octaveShift;

  const kc = T.klChords;
  KL_FIFTH = kc.fifth;
  THIRD_NAMES = kc.thirds.map(t => t[1]);       THIRD_STEPS = kc.thirds.map(t => t[0]);
  SEVENTH_NAMES = kc.sevenths.map(t => t[1]);   SEVENTH_STEPS = kc.sevenths.map(t => t[0]);
  NINTH_NAMES = kc.ninths.map(t => t[1]);       NINTH_STEPS = kc.ninths.map(t => t[0]);
  ELEVENTH_NAMES = kc.elevenths.map(t => t[1]); ELEVENTH_STEPS = kc.elevenths.map(t => t[0]);
  THIRDS_53 = {}; for (const [s, n] of kc.thirds) THIRDS_53[s] = n;
  SEVENTHS_53 = {}; for (const [s, n] of kc.sevenths) SEVENTHS_53[s] = n;
  SUS_CHORDS = kc.sus.map(s => ({ name: s.name, intervals: s.intervals.slice(), isSus: true }));

  // Chord menu list: single + triads + 7ths + sus.
  CHORDS_53TET = [{ name: 'Single note', intervals: [0] }];
  for (const [s3, n3] of kc.thirds) CHORDS_53TET.push({ name: `${n3} triad`, intervals: [0, s3, KL_FIFTH] });
  for (const [s3, n3] of kc.thirds)
    for (const [s7, n7] of kc.sevenths)
      CHORDS_53TET.push({ name: `${n3}${n7}7`, intervals: [0, s3, KL_FIFTH, s7] });
  for (const s of SUS_CHORDS) CHORDS_53TET.push(s);
  selectedChord = CHORDS_53TET[0];
  selected9th = null; selected11th = null;

  // Natural anchors (hex space) + fundamental = C.
  const offset = (((REF_ORIGIN + OCTAVE_SHIFT) % KN) + KN) % KN;
  const nat = T.klNaturals;
  NATURAL_NOTE53 = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(name => ({
    name, note53: (((nat[name] - offset) % KN) + KN) % KN
  }));
  functionalFundamental = (((nat.C - offset) % KN) + KN) % KN;
  functionalDegreeMap = new Array(KN);

  // Default major scale = cumulative sum of the generator; M2/P4/P5 off it.
  const im = T.interModel;
  DEFAULT_SCALE_INTERVALS = [0];
  for (let i = 0; i < im.length - 1; i++) DEFAULT_SCALE_INTERVALS.push(DEFAULT_SCALE_INTERVALS[i] + im[i]);
  MODAL_M2 = DEFAULT_SCALE_INTERVALS[1];
  MODAL_P4 = DEFAULT_SCALE_INTERVALS[3];
  MODAL_P5 = DEFAULT_SCALE_INTERVALS[4];
}
deriveKLTemperament();   // Temperament loads before keyboard.js, so this is safe at module init.

// noteData lookup by reference (rebuilt when noteData loads / on temperament switch).
let noteByRef = {};
function rebuildNoteByRef() { noteByRef = {}; for (const n of (noteData || [])) noteByRef[n.reference] = n; }

// Pitch of the hex at grid (q,r) under the active temperament. Single source of truth
// for both the XML seed buttons and the screen-filling extras (kept consistent).
function hexPitch(q, r) {
  const reference = REF_ORIGIN + NOTE_PER_Q * q + NOTE_PER_R * r;
  const note53 = (((NOTE_PER_Q * q + NOTE_PER_R * r) % KN) + KN) % KN;
  const info = noteByRef[reference + OCTAVE_SHIFT];
  return {
    note53, reference,
    frequency: info ? info.frequency : 440 * Math.pow(2, (reference + OCTAVE_SHIFT - REF_ORIGIN) / KN),
    noteName: info ? info.noteName : '?'
  };
}

// Strip octave digits and v/^ accidental modifiers, return the bare letter (C..B).
function letterOf(noteName) {
  if (!noteName) return null;
  let i = 0;
  while (i < noteName.length && (noteName[i] === '^' || noteName[i] === 'v')) i++;
  return noteName[i] || null;
}

// Build functionalDegreeMap[hexNote] = letter index 0..6, derived from noteData.
// The hex note is shifted from the JSON's by -OCTAVE_SHIFT (see jsonNote53ToHex).
function buildDegreeMap() {
  if (!noteData || !noteData.length) return;
  functionalDegreeMap = new Array(KN);
  const seen = new Array(KN);
  for (const n of noteData) {
    const hexNote53 = jsonNote53ToHex(((n.reference % KN) + KN) % KN);
    if (seen[hexNote53]) continue;
    const L = letterOf(n.noteName);
    if (L != null && LETTER_TO_INDEX[L] !== undefined) {
      functionalDegreeMap[hexNote53] = LETTER_TO_INDEX[L];
      seen[hexNote53] = true;
    }
  }
}

// Derive a 7-tone modal scale (intervals from root) from a chord that defines
// a clear mode. Returns null for chords that do not (sus, single note).
//
// Rule (consistent with the user's examples 9 9 4 9 9 9 4, 9 7 6 9 7 9 6,
// 9 10 3 9 10 9 3): scale = [0, 9, third, 22, 31, seventh-9, seventh].
// For a triad (no explicit 7th), pair the 3rd with its symmetric 7th = 3rd+31
// — a perfect fifth stacked on top of the third — which yields the standard
// major/minor/etc. mode for each triad quality.
function getModalScaleFromChord(chord) {
  if (!chord || chord.isSus) return null;
  let third, seventh;
  if (chord.intervals.length === 4) {
    third = chord.intervals[1];
    seventh = chord.intervals[3];
  } else if (chord.intervals.length === 3) {
    third = chord.intervals[1];
    seventh = third + MODAL_P5;
  } else {
    return null; // single note
  }
  return [0, MODAL_M2, third, MODAL_P4, MODAL_P5, seventh - MODAL_M2, seventh];
}

// Build functionalDegreeChords for the given fundamental, using the scale
// implied by the currently-selected chord (or the major default if the chord
// does not define a mode).
function buildFunctionalChords(fundamental) {
  const intervals = getModalScaleFromChord(selectedChord) || DEFAULT_SCALE_INTERVALS;
  const scale = intervals.map(iv => ((fundamental + iv) % KN + KN) % KN);
  functionalScaleSet = new Set(scale);
  functionalDegreeChords = [];
  for (let d = 0; d < 7; d++) {
    const root = scale[d];
    const third    = ((scale[(d+2)%7] - root) % KN + KN) % KN;
    const fifth    = ((scale[(d+4)%7] - root) % KN + KN) % KN;
    const seventh  = ((scale[(d+6)%7] - root) % KN + KN) % KN;
    const ninth    = (((scale[(d+1)%7] - root) % KN + KN) % KN) + KN;
    const eleventh = (((scale[(d+3)%7] - root) % KN + KN) % KN) + KN;
    functionalDegreeChords.push({
      triad:    [0, third, fifth],
      seventh:  [0, third, fifth, seventh],
      ninth, eleventh
    });
  }
}

// Degree of a note relative to the current fundamental's letter (0..6).
function degreeForNote53(note53) {
  const noteLetterIdx = functionalDegreeMap[note53];
  const fundLetterIdx = functionalDegreeMap[functionalFundamental];
  if (noteLetterIdx == null || fundLetterIdx == null) return 0;
  return (noteLetterIdx - fundLetterIdx + 7) % 7;
}

// Set the selected chord and (in functional mode) refresh the derived scale
// only when the chord actually defines a mode — single-note and sus
// preserve the previous functional scale.
function setSelectedChord(chord) {
  selectedChord = chord;
  if (functionalMode && getModalScaleFromChord(chord)) {
    buildFunctionalChords(functionalFundamental);
  }
  // The panel stays open after a chord pick so the user can audition several
  // options. It only closes on an explicit close (× / menu toggle) or when a
  // hex on the layout is played (see hitTestAndPlay).
}

function getActiveIntervals(btn) {
  if (functionalMode && btn && functionalDegreeChords.length === 7) {
    const dc = functionalDegreeChords[degreeForNote53(btn.note53)];
    let intervals;
    if (selectedChord.intervals.length === 1) {
      intervals = [0];
    } else if (selectedChord.isSus || selectedChord.intervals.length === 3) {
      intervals = [...dc.triad];
    } else {
      intervals = [...dc.seventh];
    }
    if (selected9th !== null) intervals.push(dc.ninth);
    if (selected11th !== null) intervals.push(dc.eleventh);
    return intervals;
  }
  const intervals = [...selectedChord.intervals];
  if (selected9th !== null) intervals.push(selected9th);
  if (selected11th !== null) intervals.push(selected11th);
  return intervals;
}

function buildChordPanel() {
  const panel = document.getElementById('chord-panel');
  // Static listeners bind once; the dynamic buttons below are cleared + rebuilt each
  // call so a temperament switch can swap the vocabulary (10 qualities ↔ 5).
  const firstBuild = !buildChordPanel._bound;
  buildChordPanel._bound = true;

  // Single note button
  if (firstBuild) document.getElementById('single-note-btn').addEventListener('click', function() {
    clearSelection();
    this.classList.add('selected');
    setSelectedChord(CHORDS_53TET[0]);
  });

  // --- Mode toggle (Fixed / Functional) ---
  const modeFixedBtn = document.getElementById('mode-fixed-btn');
  const modeFunctionalBtn = document.getElementById('mode-functional-btn');
  const fundSection = document.getElementById('chord-fundamental-section');
  function setMode(useFunctional) {
    functionalMode = !!useFunctional;
    modeFixedBtn.classList.toggle('selected', !functionalMode);
    modeFunctionalBtn.classList.toggle('selected', functionalMode);
    fundSection.style.display = functionalMode ? '' : 'none';
    // Sus chords don't define a clear mode, so they're disallowed in
    // Functional mode — disable their buttons (re-enable when leaving).
    document.querySelectorAll('#chord-sus .sus-btn').forEach(b => {
      b.disabled = functionalMode;
      b.classList.toggle('disabled', functionalMode);
    });
    // If sus is currently selected and we entered Functional, fall back to
    // the major scale until the user picks a modal chord.
    if (functionalMode && selectedChord && selectedChord.isSus) {
      // Don't change selectedChord (depth still applies as triad), but the
      // scale will be the default major until a modal chord is chosen.
    }
    if (functionalMode) buildFunctionalChords(functionalFundamental);
  }
  if (firstBuild) {
    modeFixedBtn.addEventListener('click', function() { setMode(false); });
    modeFunctionalBtn.addEventListener('click', function() { setMode(true); });
  }

  // --- Fundamental selector (C D E F G A B) ---
  const fundDiv = document.getElementById('chord-fundamental');
  fundDiv.innerHTML = '';
  NATURAL_NOTE53.forEach(({ name, note53 }) => {
    const btn = document.createElement('button');
    btn.className = 'chord-btn' + (note53 === functionalFundamental ? ' selected' : '');
    btn.textContent = name;
    btn.addEventListener('click', function() {
      fundDiv.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
      this.classList.add('selected');
      functionalFundamental = note53;
      buildFunctionalChords(functionalFundamental);
    });
    fundDiv.appendChild(btn);
  });

  // --- Triads ---
  const triadsDiv = document.getElementById('chord-triads');
  triadsDiv.innerHTML = '';
  THIRD_NAMES.forEach((n3, i) => {
    const btn = document.createElement('button');
    btn.className = 'chord-btn';
    btn.textContent = n3;
    btn.title = `${n3} triad`;
    btn.addEventListener('click', function() {
      clearSelection();
      this.classList.add('selected');
      setSelectedChord({ name: `${n3} triad`, intervals: [0, THIRD_STEPS[i], KL_FIFTH] });
    });
    triadsDiv.appendChild(btn);
  });

  // --- Sus --- (templates from the active temperament)
  const susDiv = document.getElementById('chord-sus');
  susDiv.innerHTML = '';
  const susChords = SUS_CHORDS;
  susChords.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'chord-btn sus-btn';
    btn.textContent = ch.name;
    btn.addEventListener('click', function() {
      if (this.disabled) return;
      clearSelection();
      this.classList.add('selected');
      setSelectedChord(ch);
    });
    susDiv.appendChild(btn);
  });

  // --- 7th chord grid ---
  const thead = document.querySelector('#chord-grid thead tr');
  thead.innerHTML = '';   // clear the quality columns (rebuilt below; no corner cell in the HTML)
  SEVENTH_NAMES.forEach(n7 => {
    const th = document.createElement('th');
    th.textContent = n7;
    thead.appendChild(th);
  });

  const tbody = document.querySelector('#chord-grid tbody');
  tbody.innerHTML = '';
  THIRD_NAMES.forEach((n3, i) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = n3;
    tr.appendChild(th);

    SEVENTH_NAMES.forEach((n7, j) => {
      const td = document.createElement('td');
      const btn = document.createElement('button');
      const fullName = `${n3}${n7}7`;
      btn.textContent = fullName;
      btn.title = fullName;
      btn.addEventListener('click', function() {
        clearSelection();
        this.classList.add('selected');
        setSelectedChord({
          name: fullName,
          intervals: [0, THIRD_STEPS[i], KL_FIFTH, SEVENTH_STEPS[j]]
        });
      });
      td.appendChild(btn);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  // --- 9th extension (toggle row) ---
  const ninthsDiv = document.getElementById('chord-9ths');
  ninthsDiv.innerHTML = '';
  NINTH_NAMES.forEach((n9, i) => {
    const btn = document.createElement('button');
    btn.className = 'chord-btn ext-btn';
    btn.textContent = `${n9} 9`;
    btn.addEventListener('click', function() {
      if (this.classList.contains('selected')) {
        this.classList.remove('selected');
        selected9th = null;
      } else {
        ninthsDiv.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.classList.add('selected');
        selected9th = NINTH_STEPS[i];
      }
    });
    ninthsDiv.appendChild(btn);
  });

  // --- 11th extension (toggle row) ---
  const eleventhsDiv = document.getElementById('chord-11ths');
  eleventhsDiv.innerHTML = '';
  ELEVENTH_NAMES.forEach((n11, i) => {
    const btn = document.createElement('button');
    btn.className = 'chord-btn ext-btn';
    btn.textContent = `${n11} 11`;
    btn.addEventListener('click', function() {
      if (this.classList.contains('selected')) {
        this.classList.remove('selected');
        selected11th = null;
      } else {
        eleventhsDiv.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        this.classList.add('selected');
        selected11th = ELEVENTH_STEPS[i];
      }
    });
    eleventhsDiv.appendChild(btn);
  });
}

function clearSelection() {
  document.querySelectorAll('#chord-panel-header .selected, #chord-triads .selected, #chord-sus .selected, #chord-grid .selected, #chord-9ths .selected, #chord-11ths .selected').forEach(
    el => el.classList.remove('selected')
  );
  selected9th = null;
  selected11th = null;
}

function kbSetup(p) {
  let cnv = p.createCanvas(p.windowWidth, p.windowHeight);
  cnv.parent('home');
  cnv.style('position', 'absolute');
  cnv.style('top', '0');
  cnv.style('left', '0');
  cnv.style('z-index', '0');
  p.textFont('Fira Code');

  // Build chord selector panel
  buildChordPanel();
  kbLoadData();
}

// Cached Lumatone layout XML — the physical hex grid is shared across tunings, so
// it's fetched once and re-parsed (with temperament-aware pitch) on a switch.
let kbXmlText = null;

// Fetch the layout + the ACTIVE temperament's reference JSON, then rebuild geometry.
// Reused at first setup and on a temperament switch (kbRebuildForTemperament).
function kbLoadData() {
  const refFile = (window.Temperament && window.Temperament.active && window.Temperament.active.referenceFile)
    || '53_reference_notes.json';
  const xmlPromise = kbXmlText ? Promise.resolve(kbXmlText) : fetch('Edo53_settings_new.xml').then(r => r.text());
  return Promise.all([xmlPromise, fetch('dataset/' + refFile).then(r => r.json())])
    .then(([xmlText, jsonData]) => {
      kbXmlText = xmlText;
      noteData = jsonData.notes;
      rebuildNoteByRef();          // before parseXML — hexPitch reads noteByRef
      parseXML(xmlText);
      buildDegreeMap();
      buildFunctionalChords(functionalFundamental);
      computeScale();
    })
    .catch(e => console.error('[KL] data load failed', e));
}

// D5 (shared temperament): rebuild the whole KL layout + chord menu for the active
// tuning. Called by setMSTemperament so MS and KL flip together.
window.kbRebuildForTemperament = function () {
  deriveKLTemperament();   // re-derive generators, vocabulary, naturals, fundamental
  buildChordPanel();       // the menu differs per tuning (53: 10 qualities, 31: 5)
  return kbLoadData();     // re-fetch the reference JSON + recompute the grid
};

function kbWindowResized(p) {
  p.resizeCanvas(p.windowWidth, p.windowHeight);
  computeScale();
}

// --- Parse XML and compute hex grid coordinates for each button ---
function parseXML(xmlText) {
  xmlButtons = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const pts = doc.querySelectorAll('PT');

  pts.forEach(pt => {
    const id = parseInt(pt.querySelector('ID').textContent);
    const origX = parseFloat(pt.querySelector('X').textContent);
    const origY = parseFloat(pt.querySelector('Y').textContent);

    // Compute hex grid coordinates from original XML positions
    // [q, r] = M^(-1) × [dx, dy]
    const dx = origX - GRID_REF_X;
    const dy = origY - GRID_REF_Y;
    const q = Math.round((49 * dx + 14 * dy) / GRID_DET);
    const r = Math.round((-13 * dx - 50 * dy) / GRID_DET);

    // Pitch is recomputed from (q,r) for the ACTIVE temperament — the XML's own
    // note53/Reference are 53-TET specific, so we ignore them and reuse only the
    // physical geometry (q,r). hexPitch keeps this identical to the extra buttons.
    const p = hexPitch(q, r);

    xmlButtons.push({
      id, note53: p.note53, reference: p.reference,
      q, r,
      x: 0, y: 0,
      frequency: p.frequency,
      noteName: p.noteName,
      hover: false,
      active: false
    });
  });
}

// --- Position buttons on a mathematically perfect hex grid ---
// Grid note mapping (per active temperament): note = (notePerQ·q + notePerR·r) mod N,
// reference = refOrigin + notePerQ·q + notePerR·r. NOTE_PER_Q/R, REF_ORIGIN are the
// temperament-driven `let`s declared at the top (set by deriveKLTemperament).

function computeScale() {
  if (!kbP || xmlButtons.length === 0) return;
  // Aliased from the p5 instance so the geometry below reads unchanged.
  const width = kbP.width;
  const height = kbP.height;

  const sizeMultiplier = 2.0;
  // Gap scales with viewport: ~2 px on phones, ~10 px on desktop.
  // Linearly interpolated between 400 px and 1200 px of viewport width.
  const HEX_GAP = Math.round(
    Math.max(2, Math.min(10, 2 + (width - 400) * (5 - 1) / (1200 - 400)))
  );
  const margin = 10;
  const availW = width - margin * 2;
  const availH = height - margin * 2;

  // Hex grid basis vectors (unit distance = 1)
  const cosA = Math.cos(HEX_ANGLE);
  const sinA = Math.sin(HEX_ANGLE);
  const cosB = Math.cos(HEX_ANGLE - Math.PI / 3);
  const sinB = Math.sin(HEX_ANGLE - Math.PI / 3);

  // Top clip boundary. The standalone page reserved space for its nav bar, but
  // the unified scene has none (the only <nav> is the floating menu panel), so
  // the grid uses the full canvas height.
  var navH = 0;

  // Compute grid extent in unit coordinates (from XML buttons only — defines the scale)
  let uxMin = Infinity, uxMax = -Infinity;
  let uyMin = Infinity, uyMax = -Infinity;
  for (let btn of xmlButtons) {
    const ux = btn.q * cosA + btn.r * cosB;
    const uy = btn.q * sinA + btn.r * sinB;
    uxMin = Math.min(uxMin, ux);
    uxMax = Math.max(uxMax, ux);
    uyMin = Math.min(uyMin, uy);
    uyMax = Math.max(uyMax, uy);
  }

  const unitW = (uxMax - uxMin) + 2;
  const unitH = (uyMax - uyMin) + 2;

  let d = Math.min(availW / unitW, availH / unitH) * sizeMultiplier;
  // Hex radius fills the spacing minus the gap: center-to-center = d, so radius = (d - gap) / 2 * 2/sqrt(3)
  scaledRadius = (d - HEX_GAP) / Math.sqrt(3);

  // Enforce minimum hex size — scale up d proportionally so spacing is preserved
  if (scaledRadius < MIN_RADIUS) {
    d = d * (MIN_RADIUS / scaledRadius);
    scaledRadius = MIN_RADIUS;
  }
  // Cap maximum hex size
  if (scaledRadius > MAX_RADIUS) {
    d = d * (MAX_RADIUS / scaledRadius);
    scaledRadius = MAX_RADIUS;
  }

  const gridCenterUX = (uxMin + uxMax) / 2;
  const gridCenterUY = (uyMin + uyMax) / 2;
  const centerX = width / 2;
  const centerY = height / 2;

  // Position XML buttons
  for (let btn of xmlButtons) {
    const ux = btn.q * cosA + btn.r * cosB;
    const uy = btn.q * sinA + btn.r * sinB;
    btn.x = centerX + (ux - gridCenterUX) * d;
    btn.y = centerY + (uy - gridCenterUY) * d;
  }

  // --- Generate extra buttons for all visible grid positions ---
  const existing = new Set();
  for (let btn of xmlButtons) {
    existing.add(btn.q + ',' + btn.r);
  }

  // Build noteData lookup by reference (module-level, shared with hexPitch).
  rebuildNoteByRef();

  // Find q,r range covering the screen
  const det = cosA * sinB - cosB * sinA;
  const screenCorners = [[0, 0], [width, 0], [0, height], [width, height]];
  let qMin = Infinity, qMax = -Infinity;
  let rMin = Infinity, rMax = -Infinity;

  for (const [px, py] of screenCorners) {
    const ux = (px - centerX) / d + gridCenterUX;
    const uy = (py - centerY) / d + gridCenterUY;
    const qf = (sinB * ux - cosB * uy) / det;
    const rf = (-sinA * ux + cosA * uy) / det;
    qMin = Math.min(qMin, Math.floor(qf));
    qMax = Math.max(qMax, Math.ceil(qf));
    rMin = Math.min(rMin, Math.floor(rf));
    rMax = Math.max(rMax, Math.ceil(rf));
  }

  qMin -= 2;  qMax += 2;
  rMin -= 2;  rMax += 2;

  const extraButtons = [];
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      if (existing.has(q + ',' + r)) continue;
      const ux = q * cosA + r * cosB;
      const uy = q * sinA + r * sinB;
      const px = centerX + (ux - gridCenterUX) * d;
      const py = centerY + (uy - gridCenterUY) * d;
      if (px - scaledRadius < 0 || px + scaledRadius > width ||
          py - scaledRadius < navH || py + scaledRadius > height) continue;

      const p = hexPitch(q, r);

      extraButtons.push({
        id: -1, note53: p.note53, reference: p.reference,
        q, r,
        x: px, y: py,
        frequency: p.frequency,
        noteName: p.noteName,
        hover: false,
        active: false
      });
    }
  }

  // Filter out any XML buttons clipped by the border
  var visibleXml = xmlButtons.filter(function(btn) {
    return btn.x - scaledRadius >= 0 && btn.x + scaledRadius <= width &&
           btn.y - scaledRadius >= navH && btn.y + scaledRadius <= height;
  });
  gridButtons = visibleXml.concat(extraButtons);
}

// --- Draw ---
function kbDraw(p) {
    p.background(246);

    if (gridButtons.length === 0) {
    return;
  }

  // Find chord root: a held keyboard key takes priority over mouse hover
  // (the grid fills the viewport, so the cursor is almost always over some
  // hex — without this, the chord rainbow would track the mouse instead
  // of the actually-triggered keyboard root).
  let rootBtn = null;
  for (let btn of gridButtons) {
    if (btn.keyPressed) { rootBtn = btn; break; }
  }
  if (!rootBtn) {
    for (let btn of gridButtons) {
      const d = p.dist(p.mouseX, p.mouseY, btn.x, btn.y);
      if (d <= scaledRadius * 0.88) { rootBtn = btn; break; }
    }
  }

  let chordToneMap = null;
  if (rootBtn) {
    chordToneMap = new Map();
    const activeIntervals = getActiveIntervals(rootBtn);
    for (let i = 0; i < activeIntervals.length; i++) {
      chordToneMap.set(rootBtn.reference + activeIntervals[i], i);
    }
  }

  for (let btn of gridButtons) {
    drawHexButton(p, btn, chordToneMap);
  }

  // Update reverb dry/wet from GUI knob
  if (dryGain && wetGain && window.audioParams) {
    var dw = window.audioParams.dryWet;
    dryGain.gain.value = 1 - dw;
    wetGain.gain.value = dw;
  }
}

// --- Draw a single hex button (ported from LumaButton::draw) ---
function drawHexButton(p, btn, chordToneMap) {
  const d = p.dist(p.mouseX, p.mouseY, btn.x, btn.y);
  btn.hover = d <= scaledRadius * 0.88;

  // Size boost: hovered hex and chord tones grow +25%, clicking flattens to normal
  const isChordTone = chordToneMap && chordToneMap.has(btn.reference);
  const isActive = btn.hover || isChordTone || btn.keyPressed;
  const sizeBoost = (isActive && !mouseIsPressed && !btn.keyPressed) ? 1.05 : 1.0;
  const r = scaledRadius * sizeBoost;

  // Determine fill color
  let chordIdx = isChordTone ? chordToneMap.get(btn.reference) : -1;

  let fillRGB; // track the actual fill for text contrast
  const inScale = functionalMode && functionalScaleSet.has(btn.note53);
  if (btn.keyPressed || (btn.hover && btn.active)) {
    fillRGB = [255, 180, 0];
    p.fill(fillRGB[0], fillRGB[1], fillRGB[2]);            // buttonClicked
  } else if (isChordTone) {
    const c = CHORD_COLORS[Math.min(chordIdx, CHORD_COLORS.length - 1)];
    fillRGB = [c[0], c[1], c[2]];
    p.fill(c[0], c[1], c[2], btn.hover ? 255 : 200);
  } else if (btn.hover) {
    fillRGB = [220, 220, 220];
    p.fill(220, 220, 220, 200);    // hoverColor
  } else if (inScale) {
    fillRGB = null;              // keep dark text; tint is subtle
    p.fill(255, 200, 120, 30);     // warm scale-tone wash
  } else {
    fillRGB = null;              // transparent — use default dark text
    p.fill(255, 255, 255, 0);      // notClicked
  }

  p.stroke(200);
  p.strokeWeight(Math.max(0.5, r * 0.02));

  // Draw hexagon with rounded corners
  const cornerRadius = r * 0.15;
  let verts = [];
  let angle = START_ANGLE;
  for (let i = 0; i < NUM_STEPS; i++) {
    verts.push({
      x: btn.x + Math.cos(angle) * r,
      y: btn.y + Math.sin(angle) * r
    });
    angle += STEP;
  }

  p.beginShape();
  for (let i = 0; i < NUM_STEPS; i++) {
    const prev = verts[(i - 1 + NUM_STEPS) % NUM_STEPS];
    const curr = verts[i];
    const next = verts[(i + 1) % NUM_STEPS];

    // Direction vectors from current vertex toward neighbors
    let dx1 = prev.x - curr.x, dy1 = prev.y - curr.y;
    let len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    dx1 /= len1; dy1 /= len1;

    let dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    let len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    dx2 /= len2; dy2 /= len2;

    // Points inset from the corner by cornerRadius
    const p1x = curr.x + dx1 * cornerRadius;
    const p1y = curr.y + dy1 * cornerRadius;
    const p2x = curr.x + dx2 * cornerRadius;
    const p2y = curr.y + dy2 * cornerRadius;

    p.vertex(p1x, p1y);
    p.quadraticVertex(curr.x, curr.y, p2x, p2y);
  }
  p.endShape(p.CLOSE);

  // Text: note name — choose color based on fill luminance for readability
  p.noStroke();
  if (fillRGB) {
    // Relative luminance (ITU-R BT.601)
    const lum = 0.299 * fillRGB[0] + 0.587 * fillRGB[1] + 0.114 * fillRGB[2];
    if (lum < 140) p.fill(255);          // dark background → white text
    else p.fill(30);                     // light background → dark text
  } else {
    p.fill(100);                         // transparent hex → default grey
  }
  p.textAlign(p.CENTER, p.CENTER);
  const nameSize = Math.max(8, r * 0.33);
  p.textSize(nameSize);
  if (functionalMode) {
    // Stack note name above, Roman numeral below.
    p.text(btn.noteName, btn.x, btn.y - nameSize * 0.45);
    const romanSize = Math.max(6, nameSize * 0.6);
    p.textSize(romanSize);
    const roman = ROMAN_NUMERALS[degreeForNote53(btn.note53)] || '';
    p.text(roman, btn.x, btn.y + nameSize * 0.6);
  } else {
    p.text(btn.noteName, btn.x, btn.y);
  }
}

// --- Audio ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    var limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.01;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.25;

    // Reverb: convolver with synthesized impulse response
    convolver = audioCtx.createConvolver();
    convolver.buffer = createReverbIR(audioCtx, 2.0, 0.6);

    // Dry/wet split — both feed into masterGain
    dryGain = audioCtx.createGain();
    wetGain = audioCtx.createGain();
    var dw = (window.audioParams && window.audioParams.dryWet) || 0.25;
    dryGain.gain.value = 1 - dw;
    wetGain.gain.value = dw;

    convolver.connect(wetGain);
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);

    masterGain.connect(limiter);
    limiter.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    audioCtx.resume();
  }
  // Force Safari to actually start the audio engine by playing a silent buffer
  // (must happen every resume, not just when suspended — Safari can silently stall)
  if (audioCtx.state !== 'closed') {
    var silent = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    var src = audioCtx.createBufferSource();
    src.buffer = silent;
    src.connect(audioCtx.destination);
    src.start(0);
  }
}

// Eagerly unlock AudioContext on first user interaction (Safari requirement)
function unlockAudio() {
  initAudio();
  document.removeEventListener('click', unlockAudio, true);
  document.removeEventListener('touchstart', unlockAudio, true);
  document.removeEventListener('keydown', unlockAudio, true);
}
document.addEventListener('click', unlockAudio, true);
document.addEventListener('touchstart', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);

// Safari/WebKit can suspend or "interrupt" the AudioContext when the tab
// loses focus (switching apps, changing space, returning from another
// window). Resuming from a visibility/focus event alone is often not
// enough — WebKit requires the resume to happen inside a user gesture.
// Re-arm the one-shot unlock listeners whenever we come back.
function rearmUnlockIfNeeded() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    // Try a direct resume first (works in Chrome/Firefox)
    audioCtx.resume().catch(function() {});
    // Re-attach one-shot unlockers so the next click/touch/key forces a
    // full restart inside a user gesture (required by Safari).
    document.addEventListener('click', unlockAudio, true);
    document.addEventListener('touchstart', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
  }
}
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) rearmUnlockIfNeeded();
});
window.addEventListener('focus', rearmUnlockIfNeeded);
window.addEventListener('pageshow', rearmUnlockIfNeeded);

// Synthesize a reverb impulse response: exponentially decaying noise
function createReverbIR(ctx, duration, decay) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const ir = ctx.createBuffer(2, length, rate);
  for (var ch = 0; ch < 2; ch++) {
    var data = ir.getChannelData(ch);
    for (var i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay * 3);
    }
  }
  return ir;
}

// Each click = independent fire-and-forget sound event.
// The ADSR defines the note's entire lifespan: attack → peak → decay → sustain → release → silence.
// A FIFO voice pool caps simultaneous notes so dragging across the grid
// cannot saturate the output. When the pool is full, the oldest voice is
// quickly faded out and replaced.
// Additive timbre: each note is 6 harmonics (matches EigenSpace's createNote) so
// chords sound consistent across scenes — see playSingleTone.
const KL_HARMONICS  = [1, 2, 3, 4, 5, 6];
const KL_AMPLITUDES = [1, 0.41, 0.333, 0.27, 0.13, 0.11];
const MAX_VOICES = 24;
const STEAL_FADE = 0.04; // seconds — fast fade applied to stolen voice
let activeVoices = []; // { oscs:[osc...], noteGain, endTime }

function stealOldestVoice() {
  const v = activeVoices.shift();
  if (!v) return;
  try {
    const now = audioCtx.currentTime;
    v.noteGain.gain.cancelScheduledValues(now);
    v.noteGain.gain.setValueAtTime(v.noteGain.gain.value, now);
    v.noteGain.gain.linearRampToValueAtTime(0, now + STEAL_FADE);
    v.oscs.forEach(o => { try { o.stop(now + STEAL_FADE + 0.01); } catch (e) {} });
  } catch (e) {}
}

// KL → MIDI out (e.g. Ableton). A hex press sends its chord to the selected MIDI device
// and is released on key-up / mouse-up so the DAW receives clean note on/off pairs. MIDI is
// sent even when the local audio is muted (installations often mute the browser, sound = DAW).
const klKeyMidi = new Map();   // computer-key code → [midi noteIds]
let klPointerMidi = [];        // mouse/touch held note ids

function klSendMidiChord(freqs) {
  const mc = window.midiController;
  if (!mc || !mc.midiEnabled || !mc.selectedOutput) {
    console.log('[KL→MIDI] NOT sent — output not ready (enabled:', !!(mc && mc.midiEnabled),
      '| output:', (mc && mc.selectedOutput) ? mc.selectedOutput.name : 'none', ')');
    return null;
  }
  if (!Array.isArray(freqs) || freqs.length === 0) return null;
  console.log('[KL→MIDI] sent', freqs.length, 'note(s) →', mc.selectedOutput.name);
  return mc.playChord(freqs, 5);
}
function klStopMidi(ids) {
  if (ids && ids.length && window.midiController && typeof window.midiController.stopSpecificNotes === 'function') {
    window.midiController.stopSpecificNotes(ids);
  }
}

// Build + play the active selection (chord quality + 9/11, or single note) rooted at rootFreq.
// Plays local audio (unless muted) and sends MIDI-out; returns the MIDI noteIds for note-off.
// `btn` is optional — supplied for hex presses (needed for functional-mode degree); omit it for
// the physical MIDI keyboard, which plays the fixed selected shape transposed to the played key.
function klPlayChordAtFreq(rootFreq, btn) {
  const intervals = getActiveIntervals(btn);
  const freqs = [];
  for (const steps of intervals) freqs.push(rootFreq * Math.pow(2, steps / KN));

  // Local audio (skipped when muted) — MIDI is still sent below so the DAW always gets it.
  if (!window.audioMuted) {
    initAudio();
    for (const freq of freqs) playSingleTone(freq);
  }
  // MIDI out → returns noteIds so the caller can release them on key/mouse up.
  return klSendMidiChord(freqs);
}

function playNote(btn) {
  // Chord Memory capture is driven separately by the input handlers via captureKeyboardChord.
  return klPlayChordAtFreq(btn.frequency, btn);
}

// Exposed for the physical MIDI keyboard (midi_piano.js, KL scene): play the currently selected
// chord-menu choice (quality + 9/11, or single note) rooted at the given Hz, returning the MIDI
// noteIds so the caller releases them on note-off. Same logic as a hex press — one chord menu,
// every trigger (hex, computer key, MIDI keyboard) plays the selected chord.
window.klPlayMidiKeyChord = function (rootFreq) {
  if (typeof rootFreq !== 'number' || !(rootFreq > 0)) return null;
  return klPlayChordAtFreq(rootFreq, null);
};

// True when the "Single note" voicing is selected (one interval per key).
function isSingleNoteMode() {
  return !(selectedChord && selectedChord.intervals && selectedChord.intervals.length > 1);
}

// 53-TET step → quality name for the ten thirds and ten sevenths (mirrors the maps
// used to build CHORDS_53TET, so core names match exactly). Module-scope so the
// extension namer below can reuse them.
// THIRDS_53 / SEVENTHS_53 (step → quality symbol) are module-level lets, rebuilt
// per temperament by deriveKLTemperament().

// Try to name a held cluster by matching its pitch-class shape against the known
// chord templates (CHORDS_53TET, temperament-aware). Returns the chord QUALITY (e.g.
// "M triad", "maj7") or null if the shape isn't a known chord. The root note is
// already shown on the CM cell's top line, so we don't repeat it here (keeps it short).
// Octave/voicing-independent: notes are reduced to pitch classes and each candidate
// root is tested (so inversions still match). Plain triads/7ths/sus match here exactly;
// in 53-TET, chords with extra notes fall through to clusterChordNameExtended (the
// extension namer is a 53-TET heuristic; 31 clusters fall back to "cust" for now).
function clusterChordName(rootBtns) {
  const pcs = [...new Set(rootBtns.map(b => (((b.note53 || 0) % KN) + KN) % KN))].sort((a, b) => a - b);
  if (pcs.length < 2) return null; // a single pitch class isn't a chord
  for (const root of pcs) {
    const rel = pcs.map(pc => (((pc - root) % KN) + KN) % KN).sort((a, b) => a - b);
    for (const tmpl of CHORDS_53TET) {
      if (!tmpl.intervals || tmpl.intervals.length !== rel.length) continue;
      const tset = tmpl.intervals.map(x => ((x % KN) + KN) % KN).sort((a, b) => a - b);
      if (tset.every((v, i) => v === rel[i])) {
        // Just the quality label for CM (e.g. "M", "sm") — drop the " triad" suffix.
        return tmpl.name.replace(/\s*triad$/i, '');
      }
    }
  }
  return KN === 53 ? clusterChordNameExtended(rootBtns, pcs) : null;
}

// Name an extended 53-TET chord (a core triad/7th plus 9th/11th/13th tones) using the
// same analytic scheme as the 12-TET MIDI namer: read the core relative to the bass
// (= root), then label whatever steps are left over as extensions. Natural extensions
// stack into the chord number (9/11/13); altered ones (b9 #11 b13) are appended.
// Diatonic 53-TET step positions: b9=5, 9=9, 11=22, #11=26/27, b13=36, 13/6=40.
function clusterChordNameExtended(rootBtns, pcs) {
  const bassPc = (((Math.min(...rootBtns.map(b => b.note53 || 0))) % 53) + 53) % 53;
  const rel = new Set(pcs.map(pc => (((pc - bassPc) % 53) + 53) % 53));
  const has = (i) => rel.has(i);
  const used = new Set([0]);

  // core tones
  let thirdStep = null;
  for (let s = 11; s <= 20; s++) { if (has(s)) { thirdStep = s; used.add(s); break; } }
  const hasFifth = has(31); if (hasFifth) used.add(31);
  let seventhStep = null;
  for (let s = 42; s <= 51; s++) { if (has(s)) { seventhStep = s; used.add(s); break; } }
  const sixth = has(40) && seventhStep === null; if (sixth) used.add(40);

  // need at least a recognizable core (a third with a fifth or seventh, or a sus frame)
  const susStep = thirdStep === null ? (has(22) ? 22 : has(9) ? 9 : null) : null;
  if (thirdStep === null && susStep === null) return null;
  if (!hasFifth && seventhStep === null) return null; // too sparse to call a chord

  // base quality token (matches CHORDS_53TET naming)
  let base;
  if (thirdStep !== null) {
    const n3 = THIRDS_53[thirdStep];
    if (seventhStep !== null) base = `${n3}${SEVENTHS_53[seventhStep]}7`;
    else base = n3; // triad
  } else {
    used.add(susStep);
    const sus = susStep === 22 ? 'sus4' : 'sus2';
    base = seventhStep !== null
      ? (SEVENTHS_53[seventhStep] === 'maj' ? 'maj7' + sus : '7' + sus)
      : sus;
  }

  // extensions
  const alts = [];
  for (const [step, label] of [[5, 'b9'], [26, '#11'], [27, '#11'], [36, 'b13']]) {
    if (has(step) && !used.has(step)) { alts.push([step, label]); used.add(step); }
  }
  const nat9 = has(9) && !used.has(9);
  const nat11 = has(22) && !used.has(22);
  const nat13 = has(40) && !used.has(40) && seventhStep !== null;
  const stack = nat13 ? '13' : nat11 ? '11' : nat9 ? '9' : null;

  // compose
  let name = base;
  if (stack) {
    if (seventhStep !== null) name = base.replace(/7$/, stack); // …maj7 → …maj9
    else if (sixth) name = base + '6/' + stack;
    else name = base + 'add' + stack;
  } else if (sixth) {
    name = base + '6';
  }
  name += alts.sort((a, b) => a[0] - b[0]).map(a => a[1]).join('');
  return name;
}

// Capture what was just played into the app-wide Chord Memory (grid.js) as
// absolute Hz. `rootBtns` is one button (single press) or several (a held
// cluster). In Single-note mode, holding several keys saves the union of those
// notes — named as a known chord if the shape is recognized, otherwise "cust".
// One key, or chord mode, keeps the existing behavior (single note → no name;
// a selected chord → its name).
function captureKeyboardChord(rootBtns, isCluster) {
  if (typeof window.captureChord !== 'function' || !rootBtns || rootBtns.length === 0) return;
  const seen = new Set();
  const freqs = [];
  for (const btn of rootBtns) {
    for (const steps of getActiveIntervals(btn)) {
      const f = btn.frequency * Math.pow(2, steps / KN);
      const k = Math.round(f * 100);
      if (!seen.has(k)) { seen.add(k); freqs.push(f); }
    }
  }
  if (freqs.length === 0) return;
  freqs.sort((a, b) => a - b);

  let chordName;
  if (isCluster) {
    chordName = clusterChordName(rootBtns) || 'cust';     // known chord, else custom cluster
  } else if (selectedChord && selectedChord.intervals && selectedChord.intervals.length > 1) {
    chordName = selectedChord.name;                       // a real chord
  } else {
    chordName = null;                                     // single note → no name
  }

  window.captureChord({
    frequencies: freqs,
    root: freqs[0],
    chordName: chordName,
    cellColor: null,
    sourceScene: (window.ANIMA && window.ANIMA.Scenes) ? window.ANIMA.Scenes.KEYBOARD : 2
  });
}

// Play an arbitrary set of absolute frequencies through the 53-TET synth. Used
// by the app-wide Chord Memory (window.playChordFrequencies in anima.js) to
// audition chords recalled while the Keyboard scene is active.
window.keyboardPlayChord = function (freqs) {
  if (window.audioMuted) return;
  if (!Array.isArray(freqs) || freqs.length === 0) return;
  initAudio();
  for (const freq of freqs) {
    if (typeof freq === 'number' && freq > 0) playSingleTone(freq);
  }
};

// Light up the hex that matches an incoming MIDI key, so a note played on a
// physical MIDI keyboard highlights its place on the 53-TET grid (visual only —
// audio routing is handled by midi_piano.js). The MIDI keyboard is NOT fixed to
// 12-TET here: each key is dynamically remapped to a microtonal pitch by the
// active scale (midi_piano.js midiNoteToFrequency), so the caller passes that
// actual sounding frequency and we light the hex closest to it (in cents) — the
// hex whose pitch the key is really playing. on=false clears the highlight.
// Called by midi_piano.js while the Keyboard scene is active.
const midiHighlightedHexes = new Map(); // midiNote → the hex lit for it
window.keyboardHighlightMidiNote = function (midiNote, on, freq) {
  if (!gridButtons || gridButtons.length === 0) return;
  if (on) {
    if (midiHighlightedHexes.has(midiNote)) return;
    if (!(freq > 0)) return;
    let best = null, bestCents = Infinity;
    for (const btn of gridButtons) {
      if (!btn.frequency) continue;
      const cents = Math.abs(1200 * Math.log2(btn.frequency / freq));
      if (cents < bestCents) { bestCents = cents; best = btn; }
    }
    if (!best) return;
    best.active = true;
    best.keyPressed = true;
    best._keyPressedAt = performance.now();
    midiHighlightedHexes.set(midiNote, best);
  } else {
    const btn = midiHighlightedHexes.get(midiNote);
    midiHighlightedHexes.delete(midiNote);
    if (!btn) return;
    // Don't clear a hex that a held computer key is still sounding.
    if (typeof pressedKeys !== 'undefined' && [...pressedKeys.values()].includes(btn)) return;
    const elapsed = performance.now() - (btn._keyPressedAt || 0);
    const remaining = Math.max(0, KEY_PRESS_MIN_MS - elapsed);
    setTimeout(function () { btn.active = false; btn.keyPressed = false; }, remaining);
  }
};

// Play one note as an additive stack of 6 harmonics with an exponential ADSR —
// the same recipe EigenSpace uses (createNote), so a chord recalled from Chord
// Memory sounds the same here as it does in EigenSpace. Envelope/waveType come
// from window.audioParams (kept in sync with EigenSpace by the shared ADSR GUI).
function playSingleTone(frequency) {
  const params = window.audioParams || {
    attack: 0.2, sustain: 1.0, release: 0.7,
    attackLevel: 0.76, sustainLevel: 0.001,
    waveType: 'sine', dryWet: 0.33
  };

  const now = audioCtx.currentTime;
  const attackTime  = Math.max(params.attack, 0.005);
  const decayTime   = Math.max(params.sustain, 0.005);
  const releaseTime = Math.max(params.release, 0.005);
  const totalTime   = attackTime + decayTime + releaseTime;

  // Per-note mixer for the harmonic stack; feeds the global dry + reverb buses.
  // baseGain tames the summed harmonics before masterGain (0.25) + the limiter.
  const noteGain = audioCtx.createGain();
  // Base gain × reverb makeup (louder as the wet mix rises — see eigenspace.js).
  noteGain.gain.value = 0.7 * (1 + (params.dryWet || 0) * (window.REVERB_MAKEUP || 0));
  // Pan the dry signal by pitch (low→left, high→right); reverb stays centered.
  const dryPan = audioCtx.createStereoPanner();
  dryPan.pan.value = (window.panForFreq ? window.panForFreq(frequency) : 0);
  noteGain.connect(dryPan); dryPan.connect(dryGain); // dry path → pan → masterGain
  noteGain.connect(convolver);                       // wet path → convolver → wetGain → masterGain

  const oscs = [];
  for (let i = 0; i < KL_HARMONICS.length; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = params.waveType;
    osc.frequency.setValueAtTime(frequency * KL_HARMONICS[i], now);

    const g = audioCtx.createGain();
    const peak    = Math.max(KL_AMPLITUDES[i] * params.attackLevel, 0.0001);
    const sustain = Math.max(KL_AMPLITUDES[i] * params.sustainLevel, 0.0001);
    // Exponential envelope (matches EigenSpace) — needs non-zero endpoints.
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + attackTime);
    g.gain.exponentialRampToValueAtTime(sustain, now + attackTime + decayTime);
    g.gain.exponentialRampToValueAtTime(0.0001, now + totalTime);

    osc.connect(g);
    g.connect(noteGain);
    osc.start(now);
    osc.stop(now + totalTime + 0.05);
    oscs.push(osc);
    osc._gain = g;
  }

  // Track this note as ONE voice in the FIFO pool, stealing the oldest when full.
  const voice = { oscs, noteGain, dryPan, endTime: now + totalTime };
  while (activeVoices.length >= MAX_VOICES) stealOldestVoice();
  activeVoices.push(voice);

  // Self-cleanup when the note finishes (last oscillator to end).
  oscs[oscs.length - 1].onended = function () {
    const idx = activeVoices.indexOf(voice);
    if (idx !== -1) activeVoices.splice(idx, 1);
    oscs.forEach(o => {
      try { o.disconnect(); } catch (e) {}
      try { o._gain.disconnect(); } catch (e) {}
    });
    try { noteGain.disconnect(); } catch (e) {}
    try { dryPan.disconnect(); } catch (e) {}
  };
}

// --- Mouse/touch interaction via document-level listeners ---
// p5's built-in events only fire on canvas clicks, but the canvas is behind page content.
// We use document listeners and map clientX/clientY to canvas coords (canvas is fixed at 0,0).

// Closest hex within hit radius (inscribed circles overlap slightly, so pick the nearest).
function hexAt(cx, cy) {
  const rLimit = scaledRadius * 0.88;
  let best = null, bestD = Infinity;
  for (let btn of gridButtons) {
    const dx = cx - btn.x, dy = cy - btn.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= rLimit && d < bestD) { bestD = d; best = btn; }
  }
  return best;
}

// --- Mouse: a SINGLE pointer (klPointerMidi). Touch is independent + multitouch (below). ---
function hitTestAndPlay(cx, cy) {
  const best = hexAt(cx, cy);
  if (best) {
    best.active = true;
    klStopMidi(klPointerMidi);                 // release any previous pointer note
    klPointerMidi = playNote(best) || [];
    captureKeyboardChord([best], false);
    // Playing a hex tucks the chord menu away so it's out of the way.
    const cp = document.getElementById('chord-panel');
    if (cp) cp.classList.remove('visible');
  }
}

function dragTest(cx, cy) {
  const best = hexAt(cx, cy);
  // Deactivate the previous mouse hex (but never a hex a finger is still holding).
  for (let btn of gridButtons) {
    if (btn.active && btn !== best && touchesOnBtn(btn) === 0) btn.active = false;
  }
  if (best && !best.active) {
    best.active = true;
    klStopMidi(klPointerMidi);                 // release the hex we dragged off
    klPointerMidi = playNote(best) || [];
    captureKeyboardChord([best], false);
  }
}

function releaseAll() {
  for (let btn of gridButtons) {
    btn.active = false;
  }
  // Release the mouse pointer's MIDI note so the DAW doesn't drone.
  klStopMidi(klPointerMidi);
  klPointerMidi = [];
  // Cleanup/scene-leave safety: release every held finger too.
  for (const t of klTouches.values()) klStopMidi(t.ids);
  klTouches.clear();
}

// --- True MULTITOUCH: each finger plays its own hex, released when THAT finger lifts. ---
// Keyed by Touch.identifier → { btn, ids } (ids = the hex's MIDI note-ids for note-off).
const klTouches = new Map();

// How many fingers are currently on a hex (so its highlight/note survive until the last lifts).
function touchesOnBtn(btn) {
  let n = 0;
  for (const t of klTouches.values()) if (t.btn === btn) n++;
  return n;
}

function touchStartAt(id, cx, cy) {
  const btn = hexAt(cx, cy);
  if (!btn) return;
  btn.active = true;
  const ids = playNote(btn) || [];
  klTouches.set(id, { btn: btn, ids: ids });
  // Capture the union of held hexes (a multitouch chord) into Chord Memory.
  const held = [...klTouches.values()].map(t => t.btn);
  captureKeyboardChord(held, held.length > 1);
  const cp = document.getElementById('chord-panel');
  if (cp) cp.classList.remove('visible');
}

function touchMoveAt(id, cx, cy) {
  const cur = klTouches.get(id);
  if (!cur) return;
  const btn = hexAt(cx, cy);
  if (!btn || btn === cur.btn) return;         // same hex / off-grid → keep sounding
  klStopMidi(cur.ids);                          // slid onto a new hex: release old, play new
  if (touchesOnBtn(cur.btn) <= 1) cur.btn.active = false;
  cur.btn = btn;
  btn.active = true;
  cur.ids = playNote(btn) || [];
}

function touchEndId(id) {
  const cur = klTouches.get(id);
  if (!cur) return;
  klStopMidi(cur.ids);
  klTouches.delete(id);
  if (touchesOnBtn(cur.btn) === 0) cur.btn.active = false;
}

// Gate all keyboard input to the Keyboard scene being active. (Named isOnHero
// for its origin in the standalone landing page; in the unified app the grid
// fills its own scene rather than a hero section.)
function isOnHero() {
  return !window.ANIMA || window.ANIMA.getCurrentScene() === window.ANIMA.Scenes.KEYBOARD;
}

// Check if a pointer event landed inside a UI panel (chord panel, app-wide Chord
// Memory grid) or the global navigation menu — those clicks must not also trigger
// a hex note underneath. (#grid-container holds the Chord Memory grid's own p5
// canvas, which sits above the keyboard at z-index 9000, so it is the event target.)
function isInsidePanel(ev) {
  if (ev.target && ev.target.closest &&
      ev.target.closest('#chord-panel, #grid-container, #audio-gui, #keyboard-audio-gui, #anima-menu-panel, #anima-menu-toggle, #anima-menu-overlay')) {
    return true;
  }
  var t = ev.target;
  while (t) {
    if (t.id === 'chord-panel' || t.id === 'grid-container' || t.id === 'audio-gui' || t.id === 'keyboard-audio-gui' || t.tagName === 'NAV') return true;
    t = t.parentElement;
  }
  return false;
}

document.addEventListener('mousedown', function(ev) {
  if (!isOnHero()) return;
  if (isInsidePanel(ev)) { activateKeyboard(); return; }
  initAudio();
  scrollLocked = false;
  activateKeyboard();
  hitTestAndPlay(ev.clientX, ev.clientY);
});
document.addEventListener('mouseup', function() {
  releaseAll();
});
document.addEventListener('mousemove', function(ev) {
  if (!isOnHero()) return;
  if (isInsidePanel(ev)) { activateKeyboard(); return; }
  activateKeyboard();
  if (ev.buttons === 1) dragTest(ev.clientX, ev.clientY);
});
document.addEventListener('touchstart', function(ev) {
  if (!isOnHero()) return;
  if (isInsidePanel(ev)) { activateKeyboard(); return; }
  ev.preventDefault();   // suppress the synthetic mouse events (so mouseup→releaseAll can't
                         // kill other held fingers) AND page scroll/zoom while playing
  initAudio();
  scrollLocked = false;
  activateKeyboard();
  for (let t of ev.changedTouches) touchStartAt(t.identifier, t.clientX, t.clientY);
}, { passive: false });
document.addEventListener('touchmove', function(ev) {
  if (isInsidePanel(ev)) return;
  ev.preventDefault();
  for (let t of ev.changedTouches) touchMoveAt(t.identifier, t.clientX, t.clientY);
}, { passive: false });
document.addEventListener('touchend', function(ev) {
  for (let t of ev.changedTouches) touchEndId(t.identifier);   // release only the lifted finger
}, { passive: true });
document.addEventListener('touchcancel', function(ev) {
  for (let t of ev.changedTouches) touchEndId(t.identifier);
}, { passive: true });

// --- Keyboard / hero crossfade based on mouse activity ---
var idleTimer = null;
var keyboardIsActive = false;
var scrollLocked = false;

// In the unified app the SceneManager owns the body.keyboard-active class and
// the scene's visibility, so the landing page's idle-crossfade/scroll behavior
// is neutralized: activate is a no-op, deactivate only releases held notes.
function activateKeyboard() { /* scene-managed; no-op */ }

function deactivateKeyboard() {
  releaseAll();
}

// Scrolling has no meaning inside the full-screen scene — ignore it while the
// Keyboard scene is active (guarding against stray scroll events bubbling up).
window.addEventListener('scroll', function() {
  if (isOnHero()) return;
});

// --- Computer keyboard input ---
// QWERTY rows map to 4 stacked hex grid rows. Uses ev.code so the physical
// key position is honored regardless of the OS keyboard layout.
//
// Physical keys are staggered to the right as you move down rows:
//
//   1 2 3 4 5 6 7 8 9 0       r = +2
//     Q W E R T Y U I O P     r = +1
//       A S D F G H J K L     r =  0
//         Z X C V B N M       r = -1
//
// To match this stagger on the Lumatone, each row shifts q by +1 going down,
// so the column under '1, Q, A, Z' runs diagonally down-right on the hex grid
// (matching the physical column on the keyboard) instead of down-left.
//
// '1' is anchored at grid (KB_HOME_Q, KB_HOME_R+2). Up/Down arrows shift
// playback by ±53 steps (one full octave).
const KEY_TO_HEX = {
  Digit1:{q:0,r:2}, Digit2:{q:1,r:2}, Digit3:{q:2,r:2}, Digit4:{q:3,r:2},
  Digit5:{q:4,r:2}, Digit6:{q:5,r:2}, Digit7:{q:6,r:2}, Digit8:{q:7,r:2},
  Digit9:{q:8,r:2}, Digit0:{q:9,r:2},
  KeyQ:{q:1,r:1}, KeyW:{q:2,r:1}, KeyE:{q:3,r:1}, KeyR:{q:4,r:1},
  KeyT:{q:5,r:1}, KeyY:{q:6,r:1}, KeyU:{q:7,r:1}, KeyI:{q:8,r:1},
  KeyO:{q:9,r:1}, KeyP:{q:10,r:1},
  KeyA:{q:2,r:0}, KeyS:{q:3,r:0}, KeyD:{q:4,r:0}, KeyF:{q:5,r:0},
  KeyG:{q:6,r:0}, KeyH:{q:7,r:0}, KeyJ:{q:8,r:0}, KeyK:{q:9,r:0},
  KeyL:{q:10,r:0},
  KeyZ:{q:3,r:-1}, KeyX:{q:4,r:-1}, KeyC:{q:5,r:-1}, KeyV:{q:6,r:-1},
  KeyB:{q:7,r:-1}, KeyN:{q:8,r:-1}, KeyM:{q:9,r:-1}
};
// Home anchor for 'A'. The XML grid spans q∈[-2,36], r∈[-14,4] with its
// densest band at r=-5; this anchor centers the 4×10 keyboard region inside
// that band so every key lands on a visible hex.
//   '1' row → r = -3       'Q' row → r = -4
//   'A' row → r = -5       'Z' row → r = -6
//   q across each row → KB_HOME_Q .. KB_HOME_Q+9
const KB_HOME_Q = 13;
const KB_HOME_R = -5;

// Octave shift moves the (q, r) anchor itself so a different set of hexes is
// targeted — and visually highlighted. One octave (+53 steps) = 9·dq + 5·dr;
// (dq=+7, dr=-2) stays inside the long axis of the grid (q spans ~38 cells,
// r only ~18), so the anchor remains on the Lumatone across several octaves.
let kbAnchorOffsetQ = 0;
let kbAnchorOffsetR = 0;
const OCTAVE_DQ = 7;
const OCTAVE_DR = -2;
const pressedKeys = new Map(); // ev.code → btn (the hex actually targeted)
const KEY_PRESS_MIN_MS = 120; // minimum on-screen highlight duration for a tap

function findHexByCoord(q, r) {
  for (let btn of gridButtons) {
    if (btn.q === q && btn.r === r) return btn;
  }
  return null;
}

function buttonForKey(off) {
  const q = KB_HOME_Q + kbAnchorOffsetQ + off.q;
  const r = KB_HOME_R + kbAnchorOffsetR + off.r;
  let btn = findHexByCoord(q, r);
  if (btn) return btn;
  // Off-screen position — synthesize a virtual button so playback still works
  const p = hexPitch(q, r);
  return {
    id: -1, q, r, reference: p.reference,
    note53: p.note53,
    frequency: p.frequency,
    noteName: p.noteName,
    x: 0, y: 0, hover: false, active: false
  };
}

// Map a computer-key code → its note (active temperament) at the FIXED default
// octave (ignores the live ↑/↓ anchor used inside KL). Exposed so EigenSpace can
// reuse the exact same keyboard mapping (every key → a root). Returns { frequency,
// noteName } or null. Octave is fixed for now; can be expanded later.
window.klNoteForKeyCode = function (code) {
  const off = KEY_TO_HEX[code];
  if (!off || !noteData || noteData.length === 0) return null;
  // ES anchor: offset from KB_HOME so key '1' (Digit1) = the spectrum's low C.
  // Shift of (-4,-2) lowers the whole layout so the keyboard starts at that low
  // C; the rest follow isomorphically.
  const q = (KB_HOME_Q - 4) + off.q;
  const r = (KB_HOME_R - 2) + off.r;
  const reference = REF_ORIGIN + NOTE_PER_Q * q + NOTE_PER_R * r;
  const info = noteByRef[reference + OCTAVE_SHIFT] || (noteData.find(n => n.reference === reference + OCTAVE_SHIFT));
  if (!info) return null;
  return { frequency: info.frequency, noteName: info.noteName };
};

document.addEventListener('keydown', function(ev) {
  if (ev.repeat) return;
  if (!isOnHero()) return;
  var ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;

  // Shift+M toggles the Chord Memory grid. 'M' is also a hex key and key_map.js
  // bails in this scene, so intercept the shortcut here (before the hex lookup).
  if (ev.shiftKey && ev.code === 'KeyM' && typeof window.toggleChordGrid === 'function') {
    window.toggleChordGrid();
    ev.preventDefault();
    return;
  }

  if (ev.code === 'ArrowUp') {
    kbAnchorOffsetQ += OCTAVE_DQ;
    kbAnchorOffsetR += OCTAVE_DR;
    activateKeyboard();
    ev.preventDefault();
    return;
  }
  if (ev.code === 'ArrowDown') {
    kbAnchorOffsetQ -= OCTAVE_DQ;
    kbAnchorOffsetR -= OCTAVE_DR;
    activateKeyboard();
    ev.preventDefault();
    return;
  }

  const off = KEY_TO_HEX[ev.code];
  if (!off) return;
  if (pressedKeys.has(ev.code)) return;

  initAudio();
  scrollLocked = false;
  activateKeyboard();

  // Mark only the root as keyPressed; chord tones color themselves via
  // chordToneMap + CHORD_COLORS in drawHexButton.
  const rootBtn = buttonForKey(off);
  rootBtn.active = true;
  rootBtn.keyPressed = true;
  rootBtn._keyPressedAt = performance.now();
  pressedKeys.set(ev.code, rootBtn);
  const _klIds = playNote(rootBtn);
  if (_klIds) klKeyMidi.set(ev.code, _klIds);   // remember for note-off on key-up

  // Capture into Chord Memory. In Single-note mode, several keys held at once
  // become one custom cluster ("cust"); otherwise capture this single press.
  const held = [...pressedKeys.values()];
  if (isSingleNoteMode() && held.length > 1) {
    captureKeyboardChord(held, true);
  } else {
    captureKeyboardChord([rootBtn], false);
  }

  ev.preventDefault();
});

document.addEventListener('keyup', function(ev) {
  // Release this key's MIDI note(s) to the DAW (always — even if the visual btn is gone).
  const _klIds = klKeyMidi.get(ev.code);
  if (_klIds) { klStopMidi(_klIds); klKeyMidi.delete(ev.code); }

  const btn = pressedKeys.get(ev.code);
  pressedKeys.delete(ev.code);
  if (!btn) return;
  const elapsed = performance.now() - (btn._keyPressedAt || 0);
  const remaining = Math.max(0, KEY_PRESS_MIN_MS - elapsed);
  setTimeout(function() {
    btn.active = false;
    btn.keyPressed = false;
  }, remaining);
});

// ANIMA logo click: deactivate keyboard, show hero content, hide panels
var logoEl = document.querySelector('.nav-logo');
if (logoEl) {
  logoEl.addEventListener('click', function() {
    clearTimeout(idleTimer);
    deactivateKeyboard();
    releaseAll();
    var cp = document.getElementById('chord-panel');
    var ag = document.getElementById('audio-gui');
    if (cp) cp.classList.remove('visible');
    if (ag) ag.classList.add('hidden');
  });
}

// ============================================================================
// KEYBOARD SCENE — instance-mode p5 wrapper + scene contract
// ----------------------------------------------------------------------------
// keyboard.js renders through its OWN p5 instance (parented to #home) and its
// own document-level mouse/touch/key listeners (gated by isOnHero() === the
// Keyboard scene being active). The shared router only needs to start/stop this
// instance and toggle container visibility — hence the no-op draw/mouse hooks.
// ============================================================================
let keyboardP5 = null;

const keyboardSketch = (p) => {
  kbP = p;
  p.setup = () => kbSetup(p);
  p.draw = () => kbDraw(p);
  p.windowResized = () => kbWindowResized(p);
};

// Show/hide the chord menu. Exposed for the navigation menu's "Chord menu" item.
// Driven purely by the `.visible` class: the panel's base state is translateX(100%)
// (off-screen right), and `.visible` slides it to 0. We deliberately avoid the
// generic `.hidden` class — modal_studio_style.css has a global
// `.hidden { display:none !important }`, which would kill the slide transition.
window.toggleChordPanel = function () {
  const cp = document.getElementById('chord-panel');
  if (cp) cp.classList.toggle('visible');
};

// Show/hide the shared ADSR (adsr.js) inside the Keyboard scene. The 53-TET
// synth reads window.audioParams, which the ADSR edits live. Mirrors the Modal
// Studio audio toggle: reparent the single shared canvas + use the light theme.
window.toggleKeyboardAudio = function () {
  const gui = document.getElementById('keyboard-audio-gui');
  if (!gui) return;
  if (gui.style.display === 'none' || !gui.style.display) {
    gui.style.display = 'block';
    if (window.adsrCanvas) window.adsrCanvas.parent('keyboard-audio-gui');
    if (typeof setDark === 'function') setDark(false);
    window.adsrCurrentScene = 'keyboard';
  } else {
    gui.style.display = 'none';
  }
};

const KeyboardScene = {
  // SceneManager.register() assigns .name; bodyClass drives both #keyboard-app
  // visibility and the canvas opacity (see keyboard_style.css).
  bodyClass: 'keyboard-active',

  enter() {
    // Hide the other scenes' containers. #keyboard-app itself is shown via
    // body.keyboard-active (added by SceneManager) in keyboard_style.css.
    const eigen = document.getElementById('eigenspace-app');
    const modal = document.getElementById('modalstudio-app');
    if (eigen) eigen.style.display = 'none';
    if (modal) modal.style.display = 'none';

    // Stop Plotly/modebar from intercepting clicks behind the keyboard.
    const plot = document.getElementById('plot');
    if (plot) plot.style.pointerEvents = 'none';
    const modebar = document.querySelector('.modebar');
    if (modebar) modebar.style.display = 'none';

    // Dismiss the EigenSpace intro overlay if it auto-opened over us.
    if (window.infoOverlay && window.infoOverlay.isVisible) window.infoOverlay.hide();

    // Resume the keyboard sketch and recompute layout (the window may have
    // resized while the scene was hidden).
    if (keyboardP5) {
      keyboardP5.loop();
      computeScale();
    }
    console.log('[ANIMA] Scene: Keyboard');
  },

  exit() {
    // Pause the sketch and tuck the chord panel away so neither lingers over
    // another scene.
    if (keyboardP5) keyboardP5.noLoop();
    const cp = document.getElementById('chord-panel');
    if (cp) cp.classList.remove('visible');
    // Reset the audio toggle. The shared ADSR canvas is re-homed by whichever
    // scene we enter next (e.g. EigenspaceScene.enter reparents it back).
    const ag = document.getElementById('keyboard-audio-gui');
    if (ag) ag.style.display = 'none';
    releaseAll();
  },

  // Rendering + input are handled by keyboardP5 and the document listeners above.
  draw() { /* keyboardP5 draws itself */ },
  mousePressed() {},
  mouseDragged() {},
  mouseReleased() {},
  resize() { /* keyboardP5 has its own windowResized */ },
  keyPressed() { /* keyboard.js has its own keydown listener */ },
};

// Expose to the router (anima.js registers it) — the only global this file leaks.
window.KeyboardScene = KeyboardScene;

// Create the keyboard p5 instance once #home exists, paused until the scene is
// entered. Skipped on pages without #home (e.g. standalone modal_studio.html).
function initKeyboardScene() {
  if (keyboardP5 || !document.getElementById('home')) return;
  keyboardP5 = new p5(keyboardSketch);
  keyboardP5.noLoop();

  // Wire the chord panel's close (×) button.
  const closeBtn = document.getElementById('chord-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const cp = document.getElementById('chord-panel');
      if (cp) cp.classList.remove('visible');
    });
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKeyboardScene);
} else {
  initKeyboardScene();
}

})();