# ANIMA Harmonic Eigenspace — Strategy

Living reference for how the app works now and where it's heading. Written for future models and for us — architecture + logic, not a changelog. Keep it current; delete what stops being true.

---

## 1. What it is

A single-page web app with **three scenes** that toggle instantly without re-initializing (audio context + each scene's state stay alive):

- **Eigenspace (ES)** — 4D psychoacoustic dissonance visualization (Plomp–Levelt), Plotly 3D viz, additive audio synth, MIDI in, ADSR.
- **Modal Studio (MS)** — port of C++ `ofApp`; grid + Modal Interchange scenes, dragging chords, scale/voicing editors.
- **Keyboard Layout (KL)** — 53-TET hex keyboard; plays chords by interval, additive synth matched to ES.

Stack: **p5.js** (rendering — one sketch per scene/component), **Web Audio** (synthesis), **Plotly** (ES 3D). Scripts are plain `<script>` tags — no bundler; globals are intentional.

## 2. Entry points & running

- `index.html` — **main entry** (served by GitHub Pages). Loads libs → component scripts → scene files → `anima.js` last.
- `anima.html` — alternate entry; **keep its local script list identical to `index.html`**.
- `modal_studio.html` — standalone MS (uses `modal_studio_main.js`/`sketch.js`, not `anima.js`).

### Run locally

```bash
# from the repo root
python3 -m http.server 8000
```

Then open:
- http://localhost:8000/ — main entry (`index.html`)
- http://localhost:8000/anima.html — alternate entry

A static server is required — opening via `file://` breaks the `fetch()` dataset loads.

## 3. File map

- **Router:** `anima.js` — `Scenes`/`currentScene`, `SceneManager`, the single p5 sketch, DOM/nav wiring, and app-wide entries (`window.playNote`, `window.captureChord`, `window.playChordFrequencies`). Loads last.
- **Scenes:** `eigenspace.js` (ES), `modal_studio_app.js` (`OfApp` + `ModalStudioScene`), `keyboard.js` (KL).
- **MS modules** (`modal_studio_*.js`): `KeyMap`, `audio`, `Note`, `Chord`, `Mode`, `ScaleEditor`, `VoicingEditor`, `Grid`, `DraggingChords`, `shaders`, `info_overlay`. (`main`/`sketch`/`adsr` only serve standalone MS.)
- **Shared / UI:** `adsr.js`, `colorbar-slider.js`, `grid.js` (Chord Memory), `chord_visualization.js`, `info_overlay.js`, `key_map.js`, `menu.js`, `midi_mpe.js`, `midi_piano.js`, `binary-loader.js`, `launchpad.js`.

## 4. Scene architecture

```
Scenes = { EIGENSPACE: 0, MODALSTUDIO: 1, KEYBOARD: 2 }
SceneManager = { scenes, active, register(name, scene), switchTo(name) }
//   switchTo: active.exit() → swap → set body class (mutually exclusive) → active.enter()
```

Each scene implements the contract: `enter / exit / draw / mousePressed / mouseDragged / mouseReleased / keyPressed / resize`. The single p5 sketch and the global key/mouse listeners delegate to `SceneManager.active` **only** — an inactive scene is never drawn or sent events.

**Durable rules (they bite future scene work):**
- **Body classes are mutually exclusive** — the manager clears every scene's class then sets the active one. Don't toggle them yourself in `enter()`.
- **Extra p5 instances leak** — any p5 instance's `mousePressed` fires on *any* window press. Gate it (events + `loop`/`noLoop`) by when it's actually visible/active. ES gates `colorbarP5`/`chordVizP5` via `activateComponents`; the Chord Memory grid gates itself by panel visibility; `anima.js` also skips scene delegation when the pointer is over the CM panel.
- **Load-time vs runtime** — `Scenes`/`currentScene` live in `anima.js` (loads last). Reference cross-script globals only at runtime (inside methods), never at a script's load time. Scene objects must not reference `Scenes` in their object literal (`.name` is assigned by `register`).

**Add a scene:** new `*.js` (loaded before `anima.js`) implementing the contract → add the enum value → `SceneManager.register(...)` → wire a nav button → keep both HTML script lists in sync.

## 5. Cross-cutting systems

**Chord Memory (CM)** — `grid.js`, an app-wide 8×8 compositional memory (its own p5 instance, scene-independent). Chords auto-capture from every scene via `window.captureChord({frequencies, root, chordName, cellColor, sourceScene})` and store as **absolute Hz**. Recall plays through the active scene's synth (`window.playChordFrequencies` routes ES/MS/KL); full ES visual reconstruction happens only when in ES. Serializes via `getGrid().exportData()/importData()`. Surfaced in the menu (all scenes) + `Shift+M`; the panel is draggable and clamped to the viewport.

**Audio** — three engines, intentionally **not** merged: ES `playChord`/`createNote` (6-harmonic additive), MS `AudioEngine.playChord(freqs)`, KL `playSingleTone` (additive, matched to ES so recalled chords sound consistent). `window.playNote` (external triggers from key_map / MIDI piano) routes to MS's engine. Envelope/waveform come from the shared ADSR (`adsr.js`), kept in sync across `audioParams` (ES local) and `window.audioParams` (MS/KL).
- Caveat: ES `×2` octave-doubling is applied at play time but CM stores the *un-doubled* base Hz, so a doubled ES chord recalled in KL/MS plays the base octave.

**Cross-file interface:**
| Symbol | Owner | Used by |
|---|---|---|
| `Scenes`, `currentScene`, `window.app`, `window.playNote` | anima.js | all |
| `window.captureChord`, `window.playChordFrequencies` | anima.js | all (CM) |
| `gridSketch` + `getGrid().export/importData` | grid.js | CM, session |
| ES audio: `audioCtx`, `audioParams`, `playChord`, `eigenspacePlayFrequencies` | eigenspace.js | ES |
| `window.keyboardPlayChord` | keyboard.js | CM recall in KL |
| MS grid session API: `OfApp.getSession/applySession`, `Grid.serializeAll/restoreAll` | modal_studio_app.js, modal_studio_Grid.js | session |

## 6. Roadmap

### 6.2 — Fifth-gradation chord families (planned, next after 6.1)

Extend the 53-TET chord vocabulary by applying the ten-fold quality gradation to the FIFTH as
well (today the fifth takes one of three fixed values: 31 main grid / 26 half-diminished / 35
augmented). Third x seventh x fifth gradation completes the combinatorial family (up to 10x10x10)
and populates the Eigenspace regions between the current families. Wanted by David 2026-07-13;
also cited as planned future work in the paper (§7.3) and in the R2 response (the reviewer's
"why not 1000?" arithmetic is exactly this family). Scope: chord catalogue + naming + Eigenspace
node placement; interacts with the Temperament module from 6.1.

### 6.1 — 31-TET option in Modal Studio + Keyboard (in progress)

> **Progress (2026-06-16):** Phase 0 ✓ · Phase 1 (MS) ✓ · Phase 2 ✓ · **Phase 3 ✓ (MS + KL)** ·
> **Phase 4 ✓** · **Phase 6 ✓ (code)** · **Phase 5 toggle + persistence ✓**. MS plays 31-TET fully
> (reference re-anchored to C, quality maps + chordNameTable + noteName, every dynamic-naming path),
> and **KL (hex keyboard) now plays 31-TET too**: the physical Lumatone grid is reused with 31-TET
> generators (q:+5 M2, r:+2 A1), pitch/reference/frequency recomputed per tuning, the chord menu
> collapsed to the 5-quality vocabulary (33 vs 113), functional mode + computer-key input
> temperament-aware, and the toggle (now in **both** the MS and KL menus, D5 shared) rebuilds MS+KL
> together. Sessions are temperament-tagged + auto-flip on load; voicing-type presets + editor
> note-name rings fixed in 31. 53 frozen byte-identical, golden_31 green. **Remaining:** browser pass
> of KL 31 (live pitches/MIDI-in) · Phase 7 E2E. (Phase 5a per-temperament session swap ✓.) Kept **live** — see the log.

**Goal:** let **MS and KL** operate in **31-TET** as an alternative to today's **53-TET**,
with scales, voicings, chord building, chord *naming*, and the KL hex keyboard all correct in
the chosen temperament — selectable at runtime. **ES is out of scope** (it is already
multi-TET and stays untouched).

**Scope note — KL is a second front.** KL ([keyboard.js](keyboard.js)) is not just "another
53 to swap." It has its **own** chord-naming system (`THIRD_STEPS`/`SEVENTH_STEPS`/
`NINTH_STEPS` + `CHORDS_53TET`, separate from MS's tables) **and** an **isomorphic hex
layout** `note53 = (9·q + 5·r) mod 53` — tuning-specific *geometry* MS doesn't have. So the
"hard" content (naming) roughly doubles, and the hex layout is genuinely new work.

#### Why it's bigger than "change a 53 to a 31"

`53` is hardcoded ~120× across ~11 files, carrying **four different meanings** — each needs a
different treatment:

| Kind | What it is | Example sites | Treatment |
|------|-----------|---------------|-----------|
| **A. Tuning math** | `2^(s/53)`, `round(53·log2 r)`, octave `+53`, `% 53` | [key_map.js:37](key_map.js#L37), [modal_studio_KeyMap.js:32](modal_studio_KeyMap.js#L32), [modal_studio_Chord.js:578](modal_studio_Chord.js#L578) | Pure function of N → parameterize |
| **B. Reference data** | per-step frequency + name + MIDI/bend table | `53_reference_notes.json` via [modal_studio_sketch.js:67](modal_studio_sketch.js#L67) | Generate a 31-TET sibling file |
| **C. Interval semantics** | which step = which degree / chord quality | **MS:** naming maps [modal_studio_Chord.js:304](modal_studio_Chord.js#L304); component ranges [modal_studio_VoicingEditor.js:455](modal_studio_VoicingEditor.js#L455); chromatic ranges [modal_studio_KeyMap.js:85](modal_studio_KeyMap.js#L85); generator `interModel` [modal_studio_main.js:47](modal_studio_main.js#L47). **KL:** `THIRD/SEVENTH/NINTH_STEPS` + `CHORDS_53TET` [keyboard.js:62](keyboard.js#L62),[130](keyboard.js#L130) | **Hard part** — re-author per temperament (×2: MS + KL) |
| **D. Geometry** | MS wheels draw 53 nodes / spectrum 53 ticks; **KL isomorphic hex layout** | `TOTAL_STEPS` [modal_studio_ScaleEditor.js:39](modal_studio_ScaleEditor.js#L39), [modal_studio_VoicingEditor.js:45](modal_studio_VoicingEditor.js#L45); **KL** `note53=(9q+5r)%53` [keyboard.js:498](keyboard.js#L498),[617](keyboard.js#L617) | MS: read N (mechanical). **KL hex: new tuning-specific geometry** |

A is mechanical; B is generation; **C is musicology (×2 with KL) — most of the real work**;
D is mechanical for MS but the **KL hex layout is genuinely new geometry** (the isomorphic
generators 9/5 change for 31-TET).

#### Core principle — one source of truth

There is no temperament abstraction today; `53` is a literal everywhere. Introduce a
**Temperament module** (`temperament.js`) holding a registry + active selection:

```
TEMPERAMENTS = { 53: Temperament53, 31: Temperament31 }
activeTemperament = TEMPERAMENTS[53]   // default = today's behavior
```

Each `Temperament` is the single source of truth: `N`, `stepToRatio/ratioToStep`,
`referenceNotes` (its JSON), `interModel` (53→`[9,9,4,9,9,9,4]`, 31→`[5,5,3,5,5,5,3]`),
`chromaticRanges`, `componentRanges`, the third/fifth/seventh `qualityMaps`,
`chordNameTable`, `landmarks` (P4/P5/M3/#11/M6/octave), `noteName(step)`. Every other file
reads N and these tables from `activeTemperament` instead of writing `53`.

#### 53 → 31 spec (the musicology)

31-EDO is **meantone** (step ≈ 38.71¢ vs 53's ≈ 22.64¢) — coarser, so 53-TET's comma
vocabulary collapses.

| Interval | 53 | 31 | | Interval | 53 | 31 |
|---|:--:|:--:|---|---|:--:|:--:|
| m2 | ~4 | 3 | | tritone/#11 | 26–27 | 15–16 |
| M2 | 9 | 5 | | P5 | 31 | 18 |
| m3 | 14 | 8 | | m6 | 35 | 21 |
| M3 | 17 | 10 | | M6 | 40 | 23 |
| P4 | 22 | 13 | | m7 / M7 | 44 / 49 | 25 / 28 |
| | | | | octave | 53 | 31 |

- **Generator:** `interModel` → `[5,5,3,5,5,5,3]` (whole=5, diatonic semitone=3).
- **Quality vocabulary shrinks:** 53 resolves ~11 thirds (subminor…supermajor); 31 ~5
  (subminor 7, minor 8, neutral 9, major 10, supermajor 11). The combinatorial
  `chordNameTable` must be **re-authored for the smaller 31 set** — biggest content task,
  needs musical sign-off.
- **Naming:** 31-EDO standard meantone notation (distinct #/b, 1-step diesis, half-sharps),
  generated from a chain-of-fifths scheme (vs 53's up/down arrows).

#### Phased plan (53-TET must never break)

- [x] **Phase 0 — Safety net:** snapshot 53-TET golden outputs (generated chromatic scale,
  chord names, voicing component types) for a fixed scale/root set → regression oracle.
  *Status 2026-06-15:* **done.** Math oracle ✓ ([tools/temperament_check.js](tools/temperament_check.js) —
  pins step↔ratio / mod / octave for 53 & 31). Semantic golden ✓
  ([tools/golden_semantics.js](tools/golden_semantics.js) — pins the chromatic-position and
  chord-component classifiers vs the *verbatim* legacy if/else, all intervals 0..52). Both
  plain Node, no framework.
- [x] **Phase 1 — Parameterize math (A+D), still N=53:** stand up `temperament.js` with
  `Temperament53`; replace literal `53` in A/D sites with `activeTemperament.N`. Pure
  refactor — goldens must still pass.
  *Status 2026-06-15:* **done for the MS path & browser-verified.** [temperament.js](temperament.js)
  (Temperament53 + Temperament31 stub) created and loaded before every consumer in all 3 HTML
  entries; all MS-path kind-A routed through `window.Temperament.active`
  (key_map, modal_studio_KeyMap, modal_studio_Chord, ScaleEditor, VoicingEditor). Grid needed
  none. **KL's mechanical 53s are deferred to Phase 4** (tangled with its hex layout; KL stays
  pinned to 53 until then).
- [x] **Phase 2 — Lift semantics (C) into `Temperament53`, still N=53:** move `interModel`,
  ranges, quality maps, `chordNameTable` out of their files; call sites read from
  `activeTemperament`. Verify goldens.
  *Status 2026-06-15:* **DONE.** Everything lifted into Temperament53 AND wired: classifiers
  (`chromaticPosition`/`componentType`), the three quality maps, the 159-entry `chordNameTable`,
  `interModel`, plus `landmarks` (9/22/27/40) and `extensionRanges` (qualityWithExtensions).
  modal_studio_Chord.js / VoicingEditor / KeyMap now read `window.Temperament.active.*`; both
  duplicate literal tables removed. Audit: no bare 53 kind-A/C constants remain in the MS path
  (only the now-misnamed `get53tetRatio`/`setRoot53` identifiers, which delegate to Temperament).
  3 goldens green; behavior unchanged (active = 53).
- [x] **Phase 3 — Author `Temperament31` (content):** generate `31_reference_notes.json` (same
  schema + **same anchor pitch** so a root stays the same Hz across temperaments; recompute
  MIDI+bend); define 31 note-naming; fill generator, ranges, quality maps, and the smaller
  `chordNameTable`. **Includes the KL naming system** (`THIRD/SEVENTH/NINTH_STEPS` +
  `CHORDS_53TET` → 31-TET equivalents) — two naming systems, both need musical review.
  *Status 2026-06-16:* **DONE (MS + KL).** MS-side: full 31-EDO interval-class layer, quality maps,
  chordNameTable, `noteName(step)`, C-anchored JSON. **3d (KL) DONE:** `klChords` (5-quality →
  33-chord menu vs 53's 113) + `klNaturals` added to the temperament; keyboard.js derives its
  `THIRD/SEVENTH/NINTH/ELEVENTH_STEPS`, `CHORDS_53TET`, sus, fundamental anchors from
  `Temperament.active`. 53 frozen byte-identical (naturals/menu/center pitch all match), golden_31 green.
- [x] **Phase 4 — Geometry (D):** MS wheels/ticks render `activeTemperament.N`; **KL: 31-TET
  isomorphic hex layout DONE.** Reuses the physical `Edo53_settings_new.xml` grid but swaps the
  generators per `temperament.kl` (53: q+9/r+5, refOrigin 62, shift −52; 31: q+5/r+2, refOrigin 36,
  shift −30). A single `hexPitch(q,r)` recomputes note/reference/frequency for the active tuning
  (parseXML, the screen-fill extras, and the virtual key buttons all route through it); `%53`→`%KN`,
  the `NATURAL_NOTE53` anchors and `functionalDegreeMap` sizing now follow N. The 31 reference JSON
  was widened (−40..200) so the keyboard's full ~5-octave span fits; verified all hexes resolve and
  cover 31/31 pitch classes. **Browser pass still owed** (live pitches/register).
- [x] **Phase 5 — Toggle button + state policy:** **toggle DONE (2026-06-16)** — labelled by the
  *target* tuning, now in **both** the MS and KL menus (D5 shared), driving `setMSTemperament` → a
  full rebuild (reference reload, editors/grid re-init, modes + palette regenerated) **and** a KL
  rebuild via `kbRebuildForTemperament` so MS+KL flip together. **(b) temperament-tagged persistence
  DONE:** [session.js](session.js) stamps + auto-flips on load; untagged legacy files load as 53;
  unknown tunings rejected at the gate. **(a) per-temperament session swap DONE** (replaces the
  earlier "confirm-before-reset" idea — no dialog): each tuning keeps its own modal grid in
  **`localStorage`** (`anima_ms_grid_53`/`_31`); `switchTemperamentWithSwap` ([anima.js](anima.js))
  parks the current grid → flips → queues the target's, applied when the rebuilt grid re-inits (hook
  in [modal_studio_app.js](modal_studio_app.js)). Chord Memory is absolute Hz and stays shared. No
  server file — a browser can't write one; cache survives reload. **Dual-file save/load DONE:**
  [session.js](session.js) `buildSession` writes `tetSessions:{53,31}` (active grid live, the other
  from the swap cache); `applySession` seeds both back into the cache + applies the active tuning;
  v1 single-tuning files still load. **Phase 5 complete.**
- [x] **Phase 6 — 31-TET input map (per D2):** **DONE (code).** Computer-key input
  (`klNoteForKeyCode` for ES + `buttonForKey` inside KL) routes through `hexPitch`, so every key maps
  to the active tuning; `KEY_TO_HEX` is pure geometry (unchanged). **MIDI-in still owed a browser
  pass** in 31.
- [ ] **Phase 7 — E2E:** build major/minor/dom7/half-dim/aug/extended in both temperaments;
  verify intervals, voicings, names, spectrum, audio.

#### Decisions

- **D1 — State on switch: RESET ✓** (2026-06-15). Switching temperament resets
  scales/voicings/grid — 53 and 31 are two distinct setups; cross-EDO conversion is lossy.
- **D2 — 31-TET is a first-class resolution ✓** (2026-06-15). 31-TET and 53-TET are peer
  *resolutions* of the app, so 31-TET gets its **own playable keyboard/MIDI input map**
  (Phase 6 is a build task, not a gate). All input follows `activeTemperament`.
- **D3 — 31 notation glyphs: MEANTONE #/b + HALF-SHARPS ✓** (2026-06-15). Distinct sharps/flats
  (C#≠Db, one diesis apart) + half-sharp/half-flat for the in-between steps. Also confirmed: the
  31-EDO third vocabulary is the **five** qualities subminor(7)/minor(8)/neutral(9)/major(10)/supermajor(11).
- **D4 — Scope: MS + KL get 31-TET; ES untouched ✓** (2026-06-15). ES is already multi-TET
  and is not modified. MS and KL both gain the 31/53 option.
- **D5 — Shared switch ✓** (2026-06-16). Resolved as **SHARED**: one `Temperament.active` drives
  MS and KL together. The toggle appears in both menus and calls `setMSTemperament`, which rebuilds
  MS and then KL (`kbRebuildForTemperament`). ES stays out (D4).

#### Risk assessment (tiered)

Complexity is real but **concentrated, not evenly spread**:

- **Low (mechanical) — kind A + MS-side D.** Route ~120 literal `53`s through
  `activeTemperament.N`; each change is local and Phase 0 goldens catch slips.
- **Medium (boundaries + KL hex) — persistence, shared code, KL geometry.** Stored step
  indices are meaningless without their N (a 53-authored grid reloaded in 31 mode silently
  mis-tunes); [key_map.js](key_map.js) is shared by MS *and* KL. The **KL isomorphic hex
  layout** must be re-derived for 31-TET (new q/r generators) — not a literal swap.
- **High (content, not engineering) — kind C, naming, ×2.** 53's ~11 micro-thirds collapse
  to ~5 in 31-EDO; **both** the MS `chordNameTable` **and** the KL `THIRD/SEVENTH/NINTH`
  tables must be re-authored with musical judgment. This is the schedule driver and the part
  most likely to "look done but be wrong."

#### What's structurally safe — Modal Interchange

Modal Interchange is **degree/mode-based, not tuning-based**, so it is one of the *safer*
parts of this work:

- Mode generation is pure rotation of the generator
  ([modal_studio_app.js:227](modal_studio_app.js#L227) `generateMode`) + a cumulative sum
  ([accumulateIntervals:236](modal_studio_app.js#L236)) — **no literal `53`**. Swap
  `interModel`→`[5,5,3,5,5,5,3]` and the seven modes regenerate correctly *by construction*.
- Grid substitution / voicing propagation
  ([modal_studio_Grid.js:759](modal_studio_Grid.js#L759)) works off `stackIndex` + relative
  `interval = ft − pRoot` + a step `offset` — relative arithmetic with no hardcoded
  landmarks; it transfers directly.
- **Caveat:** the chords interchange produces still flow through the tuning-dependent
  *naming* and a few hardcoded extension fallbacks (#11=27, P4=22 in
  [modal_studio_VoicingEditor.js:512](modal_studio_VoicingEditor.js#L512)). So interchange is
  **structurally correct before its names are correct** — the labels lag until Phase 3.

#### Other risks

- **Duplicated generator.** `interModel` + the mode-generation block live in **both**
  [modal_studio_app.js:46](modal_studio_app.js#L46) (integrated) and
  [modal_studio_main.js:47](modal_studio_main.js#L47) (standalone MS). Both must read from
  `temperament.js`, or integrated and standalone MS will silently diverge.
- **State integers are temperament-relative** — tag persisted state
  ([session.js](session.js)) or risk silent mis-tuning on reload.
- **Regression surface** — without Phase 0 goldens the refactor can silently change 53 chord
  names; build the oracle first.
- **Shared code** — parameterizing [key_map.js](key_map.js) must not change KL/ES; watch for
  cross-scene singleton clashes on `activeTemperament`.

**First executable step:** Phase 0 + the skeleton of Phase 1 — stand up `temperament.js`
with `Temperament53`, route the kind-A math through it, prove the 53 goldens are unchanged.
Nothing user-visible changes, but "53 is everywhere" becomes "N is one place," which every
later phase depends on. *(Done — see log below.)*

#### Implementation log

Kept current as work lands (newest first). Each entry = what changed + how it was verified.

- **2026-06-16 — FIX: per-temperament swap restored nothing (chords erased on switch).** Real
  ordering bug, not a stale build: the restore hook runs *synchronously inside* `setMSTemperament`
  (it calls `generateAllModes()`, which re-inits the grid and fires the hook), but
  `switchTemperamentWithSwap` set `window.__tetPendingGrid` *after* `await setMSTemperament` — so the
  grid always rebuilt with nothing queued and came back empty. Fix: queue the pending grid BEFORE the
  await (setActive runs early in setMSTemperament, so the hook's id check matches), plus a
  post-rebuild safety-net apply ([anima.js](anima.js)). [session.js](session.js) load path now clears
  the pending grid BEFORE its own `setMSTemperament` for the same reason. `node --check` clean; flow
  retraced: queue → setMSTemperament→generateAllModes→grid re-init→hook restores → safety net no-ops.
- **2026-06-16 — Phase 5a complete: per-temperament sessions (switch-swap + dual-file save/load).**
  Switching 53⇄31 no longer loses either tuning's modal grid: `switchTemperamentWithSwap`
  ([anima.js](anima.js)) parks the active grid to `localStorage` (`anima_ms_grid_<id>`), flips, and
  queues the target's grid, applied when the rebuilt grid re-initializes (hook in
  [modal_studio_app.js](modal_studio_app.js)); the menu toggles call it (both MS + KL). Save Session
  ([session.js](session.js)) now writes `tetSessions:{53,31}` — active grid live, the other read from
  that same cache — so one file holds BOTH sessions; load seeds both back into the cache and applies
  the active tuning, with the inactive one restored on the next switch. Chord Memory (absolute Hz)
  stays shared. Storage is the browser cache (localStorage), not a server file — a static page can't
  write one, and cache survives reloads. Back-compat: old single-tuning (v1) files still load.
  Verified: `node --check` clean; a mock sim confirms save captures both grids (53 live + 31 cached),
  load seeds both + applies the active + restores the other on switch, and v1 files apply as before.
- **2026-06-16 — KL hex keyboard plays 31-TET (Phases 3d + 4 + 6, D5 shared).** keyboard.js was
  53-first; made it temperament-driven. Added `kl` (generators/anchors), `klChords` (5-quality
  menu), `klNaturals` to [temperament.js](temperament.js). `deriveKLTemperament()` rebuilds every
  table from `Temperament.active`; a single `hexPitch(q,r)` recomputes note/reference/frequency for
  the active tuning and is the one source for parseXML (reuses only the XML's q,r geometry — the
  53 grid is shared), the screen-fill extras, and the virtual key buttons. Replaced `%53`/`/53`/`62`
  with `KN`/`REF_ORIGIN`; landmarks (M2/P4/P5, fifth) + naturals + `functionalDegreeMap` now follow
  N. Fetch moved to `dataset/<active.referenceFile>` (53 copy proven identical to root). Widened the
  31 reference JSON to −40..200 so the keyboard's full span fits. The toggle is now in the KL menu
  too and `setMSTemperament` calls `kbRebuildForTemperament` (MS+KL flip together). The extended
  cluster-namer stays 53-only (31 clusters → "cust" until authored). Verified: `node --check` on all
  touched files; golden_31 + golden_semantics + golden_naming green (**53 byte-identical** — naturals
  C=3, 113-chord menu, center pitch all match the old consts); sim confirms 31 = 33-chord menu,
  fifth=18, all 280 hexes resolve in-JSON with 31/31 pitch-class coverage. **Owed:** live browser
  pass (pitches/register/MIDI-in).
- **2026-06-16 — 31-TET editor note-name rings fixed (C back at top, 12 complete labels).** The
  Voicing (and latently the Scale) editor labelled the inner ring with three 53-hardcoded constants:
  the 12-note chromatic `STEP_PATTERN` `[0,5,4,…]`, the `+13` C-at-top angle offset, and the `step − 40`
  reference offset. In 31 these selected the wrong steps, rotated C off the top, and indexed references
  outside the 31 table → broken/incomplete labels (note_name_error.png). Lifted the chromatic pattern
  into the temperament as `chromaticStepPattern` (53 = the old `[0,5,4,5,4,4,5,4,5,4,4,5]`; 31 =
  `[0,2,3,3,2,3,2,3,2,3,3,2]` → C C# D Eb E F F# G G# A Bb B), and in `VoicingEditor.drawCircleGrid`
  replaced `+13` with C's pitch class `((startingNote%N)+N)%N` (13 in 53, 8 in 31) and `step−40` with
  `step + startingNote`. Both editors now read the pattern from `Temperament.active`. Verified: sim of
  the label loop shows C at the top with 12 complete labels in both tunings, 53 byte-identical; goldens
  + `node --check` green.
- **2026-06-16 — Three 31-TET fixes: voicing-type presets, trapped dropdown, tagged sessions.**
  (1) **Voicing-type presets did nothing in 31.** `VoicingEditor.buildLeadingVoicing` detected the
  3rd/5th/7th tones with hardcoded **53** windows (3rd 11-20, 5th 26-35, 7th 42-52) → in 31 every
  tone fell outside, so only the root got placed. Added `leadVoicingRanges` to the temperament
  (53 = those exact windows; 31 = 3rd 7-11, 5th 16-20, 7th 24-29) and route through
  `Temperament.active`. (2) **"Voicing types" dropdown got trapped across scenes.** The menu is a
  `document.body`-level DOM node owned by the VoicingEditor instance; `setMSTemperament` recreates
  the editor, orphaning the old menu (left visible in ES/KL). Added `VoicingEditor.disposeMenuDom()`
  and call it in [anima.js](anima.js) before the swap. (3) **Cross-temperament session load broke.**
  [session.js](session.js) now stamps the active temperament on save and, on load, auto-flips to it
  (awaiting the rebuild) before restoring; untagged legacy files = 53; unknown tunings rejected at
  the gate; the load overlay reports the tuning / "Switched to N-TET". Verified: `node --check` on all
  four files clean; golden_31 + golden_semantics + golden_naming all green (53 byte-identical); node
  spot-check confirms 31 dom7 tones land in their windows and 53 windows == the old hardcoded values.
- **2026-06-16 — Temperament toggle moved into the menu (Phase 5, partial).** Removed the
  dev floating `#ms-temperament-toggle` from [anima.js](anima.js) and added a menu item under
  **OPTIONS** ([menu.js](menu.js), Modal Studio scene only). Label names the *target* tuning —
  "Switch to 31-TET" in 53, "Switch to 53-TET" in 31 — so it always reads as an action and can
  never say "Switch to 53-TET" while in 53. `open()` re-`render()`s each open, so the label stays
  correct after a switch; click calls `setMSTemperament(next)`. Guarded on `window.Temperament`
  being ready. `node --check` clean. **Still open in Phase 5:** confirm-before-reset + persistence.
- **2026-06-16 — 31 frequencies re-anchored to C (was ~16¢ sharp).** Frequencies were exact 31-EDO
  but anchored on the wrong note: I'd pinned **A1 = 55.18** (matching the 53 file's A), yet the app
  builds from `starting_note` = **C** and the 53 grid anchors **C**. So 31's root C sat at 33.0 Hz vs
  53/standard 32.70 — the whole tuning ~16¢ sharp ("bad approximation"). **Fix:** generator now anchors
  31's C (ref -23) to the same Hz as 53's C (ref -40 ≈ 32.7032) → root identical across temperaments,
  still exact 31-EDO (M3 = 387.1¢ vs just 386.3¢). Octave labels switched to A-anchored to match the 53
  file (`C0`). Regenerated `dataset/31_reference_notes.json`; 53 untouched.
- **2026-06-16 — #11 reserved to maj7 (isMajorChord temperament-aware).** `isMajorChord()` (decides
  default 11th = #11 vs natural) had hardcoded 53 windows (3rd 17-20, b7 42-46) → always false in 31,
  so a maj7 never got its #11. Added `majorThird`/`flatSeventh` to `voicingRanges` (53 = 17-20/42-46
  verbatim; 31 = 10-11/24-26) and routed it through. Now #11 is reserved to maj7 (major 3rd, no flat
  7th); dominants/minor get natural 11. 53 frozen.
- **2026-06-16 — Column-breaks-on-edit fixed (missed 53 windows in setChordQualityFromVoicing).**
  Editing the row-0 chord / adding a 9 / Over-Column re-names via `setChordQualityFromVoicing`, which
  still had **hardcoded 53-TET classification windows** (3rd 10-20, 5th 26-36, 7th 33-36/42-51, P5
  30-32) that I missed in the Phase-1/2 routing. In 31 the intervals (3rd 8, 5th 18, 7th 26) fall
  outside → every quality defaulted → names collapsed to `C`/`CM`. **Fix:** temperament-specific
  `voicingRanges` (53 = its exact windows, verbatim; 31 = 3rd 7-11 / 5th 16-20 / 7th 24-29 / P5 17-19);
  loop routed through them. Headless repro extended (Cm7/Cø7/Cmaj7/Cmaj9 from voicing) — all pass,
  53 frozen.
- **2026-06-16 — 31 dynamic-naming (extensions) fixed.** Reproduced headlessly
  ([tools/debug_naming.js](tools/debug_naming.js), now a hard test): `SM7`→`SM11` (3rd=12 hit by
  `nat11 12-14`) and `o7`→`o13` (dim7=24 hit by `nat13 22-24`). Cause = the earlier **map-widening**
  (added for the "C" bug, which was really the palette) pushed chord-tone qualities into the extension
  bands. **Fix:** reverted the 31 quality maps to natural steps (3rd 7-11, 5th 16-20, 7th 24-29) and
  made `extensionRanges` disjoint (nat9 2-6, nat11 13-14, nat13 21-23) — extensions live in the gaps.
  All 7 cases pass (SM7, o7 clean; maj9/11/13 register); 53 frozen. Shared `qualityWithExtensions`
  covers all three dynamic paths (setChordQuality, setChordQualityFromVoicing, Over-Column).
- **2026-06-16 — Real naming bug found (stale palette) + voicing corrected.** Proved the 31
  naming LOGIC is correct via a headless repro ([tools/debug_naming.js](tools/debug_naming.js) —
  builds real Chord objects on 31 scale stacks: Ionian→Cmaj7, Dorian→Cm7, Locrian→Cø7 ✓). So the
  column-"C" bug was upstream: the **draggable-chords palette (`DraggingChords`) is built once at
  startup from the 53 modes and the switch never rebuilt it** → dragged chords carried 53-TET refs
  (3rd ≈ 17 steps, unclassified in 31 → "unknown" → bare "C"; the tonic-interchange rows reuse those
  `droppedNotes`). **Fix:** `app.draggingChordsInitialized = false` in setMSTemperament. Voicing:
  reverted the over-tight templates (31 → null → 53 templates = C2 E3 G3 B3 C4 base) and **capped
  9/11/13 to one octave above the top chord tone** (was flung to the outermost ring). Pending re-test.
- **2026-06-16 — Smart 31 voicing + naming completeness.** Diagnostic showed Cmaj7 voiced
  `C2,E3,G3,B3,C4` — bass isolated in oct 2, chord tones jumped to oct 3 (template index 17 = E3,
  not E2). Made **voicings per-temperament**: 53 keeps its open templates; 31 gets tight ones
  (`[8,10,12,14]` close, drop-2/3, etc.) so chord tones sit next to the bass. Routed Chord ctor
  through `Temperament.active.voicings`. Also: chordNameTable completed to all 25 third×seventh
  combos (was 14 → garbled fallbacks), and the 31 quality maps **widened to ranges** so dragged/
  interchange chords classify instead of "unknown"→bare "C". 53 frozen; goldens green. Pending re-test.
- **2026-06-15 — Chord-pitch root cause + fix.** Chords landed wrong because the app builds
  everything from `starting_note = -40`, which is **C1 in the 53 table but `F+0` in the 31 table**
  (both anchor A at ref 0, so C lands at a different index: 53→-40, 31→-23). Worse, `getOctave(-40)`
  was octave −2 in 31 vs −1 in 53, mis-aligning the voicing rings (→ the "broken voicing", which is
  downstream). **Fix:** added temperament-specific `startingNote` (53:-40, 31:-23, both ≈ C @ 32.8 Hz)
  and routed every `-40` through it (app + main constructors, ScaleEditor startingStep ×4, VoicingEditor
  WHEEL_MIN/MAX, setMSTemperament refresh). 53 goldens green. Pending re-test.
- **2026-06-15 — Scale Editor fixed; voicing breakage diagnosed.** Scale Editor reads `5 5 3 5 5 5 3`
  now (interModel fix worked). Voicing reported broken too — but the VoicingEditor's octave/range math
  (`WHEEL_MAX_TET = -40 + 5*TOTAL_STEPS`, `getOctave = floor(abs/TOTAL_STEPS)`, all `*TOTAL_STEPS`) is
  already temperament-correct. So the broken voicing is **downstream of the broken chord pitch** (the
  editor faithfully shows a wrong chord) — one deferred pitch fix resolves both. Not two bugs.
- **2026-06-15 — Scale Editor 31 (3rd finding: inversion wheel / 7th node / connector lines).**
  All three broke together. Read every draw path (`drawInversionWheel`, node lines+numbers 828-849,
  `calculateCumulativeSteps`, `distributeSteps`/`updateNodePositions`) — **all already use
  `TOTAL_STEPS` (31), no 53 hardcode**. Root cause is the **dev switch recreating the editor objects**,
  which re-reads N but **drops the app→editor wiring that pushes the modal scale + chromatic overlay**,
  so the editor falls back to an even 7-way division + stale chromatic ring. **Fix = proper Phase 5
  switch:** re-read N *in place* (`editor.setTemperament(N)` → update TOTAL_STEPS/STEPS_PER_OCTAVE +
  re-init markers + redistribute) and re-apply the scale. **UPDATE — real cause found by tracing the
  data flow:** `app.interModel` was never refreshed on switch (stayed at 53's [9,9,4,9,9,9,4], sum 53);
  the 31 editor laid that out in a 31-step octave via `setIntervals`. Fixed with one line
  (`app.interModel = [...t.interModel]` in `setMSTemperament`). Pending re-test.
- **2026-06-15 — Scale Editor 31 markers (2nd finding).** After the rebuild fix the wheel showed
  31 nodes but used the **hardcoded 53-step `intervalMarkers`** (names + colors), so every node got a
  53-TET label/colour — "very broken". Made `initializeIntervalMarkers()` temperament-aware:
  `_markers53()` (unchanged 53 table) vs new `_markers31()` (31 entries). **Quality-colour scheme**
  (= the `getChordColor` palette): subminor **cyan**, minor **blue**, neutral **grey**, major
  **orange**, supermajor **red-orange** — applied to the 3rd (steps 7–11) and 7th (25–29); perfect
  intervals white, 2nds/6ths minor=blue / major=orange, rest grey. Added `RED_ORANGE` const. Pending
  re-test. (Open: extend the 5-colour palette to 2nds/6ths if David wants it beyond 3rd/7th.)
- **2026-06-15 — 31 smoke test (first findings) + switch rebuild.** Toggle loads cleanly after
  fixing the reference path (the file must live in `dataset/`, where `loadJSONData` fetches). Two
  findings, both = incomplete rebuild, **not** musical: (a) Scale Editor stayed at 53 nodes — the
  editors read `N` in their **constructor** (once, at startup), so re-init didn't re-read it; (b)
  chords land very high — stale 53 step-indices reinterpreted under a 31-step octave. Hardened
  `setMSTemperament` to **recreate** scaleEditor/voicingEditor/grid (re-reads N + drops stale state)
  then regenerate modes. Pending re-test. Fine voicing-octave tuning deferred to a later musical pass.
- **2026-06-15 — MS-31 made testable (Phase 5 enabler).** Added `referenceFile` to each
  temperament; routed the two load sites (anima.js, modal_studio_sketch.js) through
  `window.Temperament.active.referenceFile`. Added a dev console hook
  **`setMSTemperament(id)`** (reloads the reference table, forces editors/grid to re-init,
  regenerates modes from the active generator). Startup unchanged (active=53 loads the 53 file).
  **First runnable 31-TET path** — pending a browser smoke test. Polished editor toggle + full
  reset/persistence is Phase 5 proper.
- **2026-06-15 — Phase 3c: 31 note names + reference table.** `Temperament31.noteName(step)`
  (A-anchored, meantone #/b with `+`/`-` half-sharp/flat glyphs). New
  [tools/gen_31_reference.js](tools/gen_31_reference.js) wrote **31_reference_notes.json** (187 notes)
  at the **same anchor as the 53 file**: ref 0 = A1 = 55.180 Hz, ref −31 = A0 = 27.590 Hz (bend
  matches too), with letter-aware (enharmonic-safe) octave numbering — Cb2/B#1 land right. golden_31
  extended (noteName checks) — pass; 53 frozen. Next: KL naming (3d) + the blank-major triad item.
- **2026-06-15 — Phase 3b2: 31 chordNameTable.** 14 seventh-chord entries on Temperament31
  (confirmed mirror-of-53 symbols: maj7 / 7 / m7 / mM7 / N7 / Nmaj7 / sm7 / SM7 / ø7 / o7 / +5).
  Added `neutral: 'N'` to the shared `Chord.THIRD_SYMBOL` — **additive**: 53 never emits a bare
  "neutral" token (it splits into neutralmajor/neutralminor), so 53 output is unchanged and the 53
  goldens still pass. **Open (small):** blank-major triad (confirmed for 31) needs a per-temperament
  triad-symbol map to honor without touching 53's shared `qualityCore`. Next: noteName + reference JSON.
- **2026-06-15 — Phase 3b: 31 quality maps + A4/d5 fix.** `thirdQualityMap` (7–11 →
  subminor/minor/neutral/major/supermajor), `fifthQualityMap` (16–20), `seventhQualityMap` (24–29)
  on Temperament31. Caught a derivation error: 31 is meantone (flat 5th), so **A4/#11 = 15 sits
  BELOW d5 = 16** (opposite of 53's sharp fifth) — corrected `sharpEleventh` 16→15 + componentRanges.
  golden_31 extended — pass; 53 goldens untouched. Next: `chordNameTable` (symbols pending review)
  + `noteName` + `31_reference_notes.json`.
- **2026-06-15 — Phase 3 started: 31-EDO interval-class layer.** Temperament31 now has
  chromaticRanges, componentRanges, landmarks (ninth=5, eleventh=13, sharpEleventh=16, thirteenth=23)
  + extensionRanges, derived from the meantone landmarks. New [tools/golden_31.js](tools/golden_31.js)
  pins them vs JI targets + 12-slot coverage — pass; 53 goldens unaffected. Decisions locked: D3 =
  meantone #/b + half-sharps; 31 third vocabulary = subminor/minor/neutral/major/supermajor.
  Next: quality maps + chordNameTable, noteName, 31_reference_notes.json.
- **2026-06-15 — Phase 2 COMPLETE.** Tail lifted: `landmarks` (ninth=9, eleventh=22,
  sharpEleventh=27, thirteenth=40) + `extensionRanges` (nat9/nat11/nat13/p5) added to
  Temperament53; `qualityWithExtensions` (Chord.js) + `calculateExtendedComponents` (VoicingEditor)
  now read them. golden_semantics extended to pin them — pass. All MS-path 53-TET semantics now
  live in Temperament53; audit confirms none left hardcoded. Next: Phase 3 (author Temperament31).
- **2026-06-15 — Phase 2 wired.** Call sites now read from Temperament: Chord.js references
  the quality maps + `chordNameTable` (both duplicate literal copies removed via whitespace-proof
  `perl`); `determineComponentType` → `componentType()`; KeyMap chromatic if/else → `chromaticPosition()`;
  `interModel` init (app + main) → `Temperament.active.interModel`. golden_naming repointed to a frozen
  snapshot (`tools/golden_naming_53.json`) since the source literals are gone. All 6 files parse; 3
  goldens green. Behavior-preserving (active = 53). Remaining: extension-range/landmark constants.
- **2026-06-15 — Phase 2: all naming data lifted.** Quality maps + the full 159-entry
  `chordNameTable` moved into Temperament53. [tools/golden_naming.js](tools/golden_naming.js)
  **deep-equals** each against the originals extracted live from modal_studio_Chord.js — pass
  (the golden caught a missing property-exposure mid-move). Additive (Chord.js still uses its
  locals until the wiring batch).
- **2026-06-15 — Phase 2 started: classifiers lifted.** `chromaticRanges`/`componentRanges`
  added to Temperament53 as ordered data + `chromaticPosition()`/`componentType()` methods. New
  [tools/golden_semantics.js](tools/golden_semantics.js) asserts they reproduce the verbatim
  legacy if/else for all intervals 0..52 — pass. Additive; call sites not yet wired.
- **2026-06-15 — Phase 1 closed for MS (batch 2 browser-verified).** Scale/Voicing editors,
  extension naming, inversions, and the octave key all unchanged in-app.
- **2026-06-15 — Phase 1 MS-path kind-A routed.** Editor dimensions (`TOTAL_STEPS`/
  `STEPS_PER_OCTAVE`), octave/scale-builder constants (KeyMap + key_map), `modal_studio_Chord.js`
  octave-reduction mods, and the ScaleEditor octave-normalization now read
  `window.Temperament.active`. Audit confirms **no kind-A `53` left in the MS path**; all files
  parse; user browser-verified Scale/Voicing editors, extension naming, inversions, octave key.
- **2026-06-15 — Phase 1 skeleton + first routing.** Created [temperament.js](temperament.js)
  (Temperament53 + Temperament31 stub: `N`, `stepToRatio`, `ratioToStep`, `mod`, `octave`,
  `interModel`); wired into index/anima/modal_studio HTML before all consumers; routed the
  ratio/step helpers in [key_map.js](key_map.js) + [modal_studio_KeyMap.js](modal_studio_KeyMap.js).
  User browser-verified MS + KL unchanged.
- **2026-06-15 — Phase 0 math oracle.** [tools/temperament_check.js](tools/temperament_check.js)
  (plain `node`, no framework) pins step↔ratio / mod / octave parity vs the legacy formulas for
  both 53 & 31 — all pass. *(Semantic chord-name golden still pending before Phase 2.)*
- **2026-06-15 — Decisions locked:** D1 reset, D2 31-as-first-class, D4 MS+KL scope (ES out).
  Open: D3 (31 notation glyphs → Phase 3), D5 (shared vs independent toggle → Phase 5).


---

## 7. Conventions

- Plain script tags, **not** ES modules — globals are intentional; don't add a bundler casually.
- Code placement: ES → `eigenspace.js`; MS → `modal_studio_app.js` / `modal_studio_*.js`; KL → `keyboard.js`; router/plumbing → `anima.js`; a new scene → its own file.
- Reference `Scenes`/`currentScene` only at **runtime**.
- Keep `index.html` and `anima.html` script lists **identical**.
- Menu/UI redesign target: Tailwind.

## 8. Deployment

- **`master` is live** — GitHub Pages serves the repo root → https://dazzid.github.io/ANIMA_Harmonic_Eigenspace/ (`index.html`).
- Work directly on `master`; **push only when ready** — every push rebuilds the public site (~1 min).
- Before pushing: preview locally (§2) and sanity-check the scene toggle + audio. Rollback with `git revert <sha>`.
