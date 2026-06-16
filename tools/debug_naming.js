// Reproduce the 31-TET chord naming with the REAL Chord class, headless.
//   node tools/debug_naming.js
const fs = require('fs');
const path = require('path');
global.window = global;
require('../temperament.js');
window.Temperament.setActive(31);

// Load the Note + Chord classes into global scope via eval (they're plain <script> classes).
function load(file, names) {
  let code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  code += '\n' + names.map(n => `try{global.${n}=${n}}catch(e){}`).join(';');
  (0, eval)(code);
}
try { load('modal_studio_Note.js', ['Note']); } catch (e) { console.error('Note load:', e.message); }
try { load('modal_studio_Chord.js', ['Chord']); } catch (e) { console.error('Chord load:', e.message); }

const T = window.Temperament.active;
console.log('active:', T.name, 'startingNote:', T.startingNote);

// Build a 31-TET scale stack the way Mode.setChords does, for a given mode pattern from C(-23).
function stack(pattern, root = -23, octs = 3) {
  const refs = [root]; let cur = root;
  for (let o = 0; o < octs; o++) for (const s of pattern) { cur += s; refs.push(cur); }
  return refs.map((ft, i) => { const n = new Note(); n.ft_note = ft; n.name = 'C' + i; n.localInterval = 1; n.interval = i + 1; return n; });
}

function nameChord(label, pattern) {
  const ch = new Chord();
  ch.setNotes(stack(pattern));
  ch.setChordQuality();
  const t3 = ch.notes[2].ft_note - ch.root_53.ft_note;
  const t5 = ch.notes[4].ft_note - ch.root_53.ft_note;
  const t7 = ch.notes[6].ft_note - ch.root_53.ft_note;
  console.log(`${label}: quality="${ch.quality}"  (3rd=${t3}→${T.thirdQualityMap[t3]}, 5th=${t5}→${T.fifthQualityMap[t5]}, 7th=${t7}→${T.seventhQualityMap[t7]})`);
}

nameChord('Ionian  I  (expect Cmaj7)', [5,5,3,5,5,5,3]);
nameChord('Dorian  i  (expect Cm7)  ', [5,3,5,5,5,3,5]);
nameChord('Phrygian i (expect Cm7)  ', [3,5,5,5,3,5,5]);
nameChord('Locrian  i (expect Cø7)  ', [3,5,5,3,5,5,5]);

console.log('\n--- extension naming (qualityWithExtensions), 31-TET chord tones: 3rd 7-12, 5th 16-20, 7th 25-30 ---');
const ch = new Chord();
ch.setNotes(stack([5,5,3,5,5,5,3]));
ch.setChordQuality();
let FAILS = 0;
const ext = (label, core, ivs, expect) => {
  const got = ch.qualityWithExtensions(core, ivs);
  const ok = got === expect;
  if (!ok) FAILS++;
  console.log(`  ${ok ? 'OK ' : 'XX '}${label}: "${got}"  (expect "${expect}")`);
};
// chord tones only (NO extension should be added)
ext('maj7  R3+5+7=0,10,18,28', 'maj7', [0,10,18,28], 'maj7');
ext('m7    R3+5+7=0,8,18,26',  'm7',   [0,8,18,26],  'm7');
ext('SM7   3rd=12 (widened)',  'SM7',  [0,12,18,28], 'SM7');   // nat11 12-14 collides with 3rd=12?
ext('o7    7th=24 (dim7)',     'o7',   [0,8,16,24],  'o7');    // nat13 22-24 collides with dim7=24?
// real extensions (should be added)
ext('maj9  +9th(5)',           'maj7', [0,10,18,28,5],  'maj9');
ext('maj11 +11th(13)',         'maj7', [0,10,18,28,13], 'maj11');
ext('maj13 +13th(23)',         'maj7', [0,10,18,28,23], 'maj13');

console.log('\n--- setChordQualityFromVoicing (voicing-edit / column propagation path) ---');
const fromVoicing = (label, pattern, ivs, expect) => {
  const c = new Chord();
  c.setNotes(stack(pattern));
  c.setChordQuality();
  const root = c.root_53.ft_note;
  c.setChordQualityFromVoicing(ivs.map(iv => root + iv));
  const display = c.chordQuality.name;   // root + displayQuality (carries 9/11/13)
  const ok = display === expect;
  c.quality = display;   // for the print below
  if (!ok) FAILS++;
  console.log(`  ${ok ? 'OK ' : 'XX '}${label}: "${c.quality}"  (expect "${expect}")`);
};
fromVoicing('Cmaj7 from voicing', [5,5,3,5,5,5,3], [0,10,18,28], 'Cmaj7');
fromVoicing('Cm7   from voicing', [5,3,5,5,5,3,5], [0,8,18,26],  'Cm7');
fromVoicing('Cø7   from voicing', [3,5,5,3,5,5,5], [0,8,16,26],  'Cø7');
fromVoicing('Cmaj9 from voicing', [5,5,3,5,5,5,3], [0,10,18,28,5], 'Cmaj9');

console.log(FAILS === 0 ? '\nALL CASES OK.' : `\n${FAILS} FAILURE(S).`);
process.exit(FAILS ? 1 : 0);
