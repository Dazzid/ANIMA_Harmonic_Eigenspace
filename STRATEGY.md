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

### 6.1 — 31-TET option in Modal Studio (planning)

**Goal:** let MS operate in **31-TET** as an alternative to today's **53-TET**, with the
Scale Editor, Voicing Editor, chord building, and chord *naming* all correct in the chosen
temperament — selectable at runtime. KL and ES stay 53-TET this phase.

#### Why it's bigger than "change a 53 to a 31"

`53` is hardcoded ~120× across ~11 files, carrying **four different meanings** — each needs a
different treatment:

| Kind | What it is | Example sites | Treatment |
|------|-----------|---------------|-----------|
| **A. Tuning math** | `2^(s/53)`, `round(53·log2 r)`, octave `+53`, `% 53` | [key_map.js:37](key_map.js#L37), [modal_studio_KeyMap.js:32](modal_studio_KeyMap.js#L32), [modal_studio_Chord.js:578](modal_studio_Chord.js#L578) | Pure function of N → parameterize |
| **B. Reference data** | per-step frequency + name + MIDI/bend table | `53_reference_notes.json` via [modal_studio_sketch.js:67](modal_studio_sketch.js#L67) | Generate a 31-TET sibling file |
| **C. Interval semantics** | which step = which degree / chord quality | naming maps [modal_studio_Chord.js:304](modal_studio_Chord.js#L304); component ranges [modal_studio_VoicingEditor.js:455](modal_studio_VoicingEditor.js#L455); chromatic ranges [modal_studio_KeyMap.js:85](modal_studio_KeyMap.js#L85); generator `interModel` [modal_studio_main.js:47](modal_studio_main.js#L47) | **Hard part** — re-author per temperament |
| **D. Editor geometry** | wheels draw 53 nodes; spectrum draws 53 ticks | `TOTAL_STEPS`/`STEPS_PER_OCTAVE` [modal_studio_ScaleEditor.js:39](modal_studio_ScaleEditor.js#L39), [modal_studio_VoicingEditor.js:45](modal_studio_VoicingEditor.js#L45) | Read N from active temperament |

A and D are mechanical; B is generation; **C is musicology — most of the real work.**

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

- **Phase 0 — Safety net:** snapshot 53-TET golden outputs (generated chromatic scale,
  chord names, voicing component types) for a fixed scale/root set → regression oracle.
- **Phase 1 — Parameterize math (A+D), still N=53:** stand up `temperament.js` with
  `Temperament53`; replace literal `53` in A/D sites with `activeTemperament.N`. Pure
  refactor — goldens must still pass.
- **Phase 2 — Lift semantics (C) into `Temperament53`, still N=53:** move `interModel`,
  ranges, quality maps, `chordNameTable` out of their files; call sites read from
  `activeTemperament`. Verify goldens.
- **Phase 3 — Author `Temperament31` (content):** generate `31_reference_notes.json` (same
  schema + **same anchor pitch** so a root stays the same Hz across temperaments; recompute
  MIDI+bend); define 31 note-naming; fill generator, ranges, quality maps, and the smaller
  `chordNameTable`. Needs musical review.
- **Phase 4 — Editor + spectrum geometry (D):** wheels/ticks render `activeTemperament.N`.
- **Phase 5 — Toggle + state policy:** 53/31 selector in MS UI; decide reset-vs-convert on
  switch (D1); tag persisted grid state ([session.js](session.js)) with its temperament.
- **Phase 6 — Keyboard-input scope:** MS keyboard is today the KL Lumatone 53-TET map
  ([key_map.js:256](key_map.js#L256)); decide whether 31 gets its own input map (D2).
- **Phase 7 — E2E:** build major/minor/dom7/half-dim/aug/extended in both temperaments;
  verify intervals, voicings, names, spectrum, audio.

#### Decisions to confirm (shape the work)

- **D1 — State on switch:** *reset* scales/voicings/grid (clean, recommended — cross-EDO
  conversion is lossy) vs *convert* by nearest cents (keeps work, re-quantizes, can rename
  chords).
- **D2 — Input scope:** does 31 need its own playable key/Lumatone/MIDI map (Phase 6), or is
  v1 chord/scale/voicing-only with live input staying 53 / gated in 31 mode?
- **D3 — 31 notation glyphs:** standard meantone #/b + half-sharps, or reuse 53's up/down
  arrows for visual consistency?
- **D4 — Scope:** MS only; KL + ES stay 53-TET. They share [key_map.js](key_map.js), so
  Phase 1 must keep their behavior unchanged (KL pins `activeTemperament = 53`).

#### Risks

- **Shared code:** [key_map.js](key_map.js) serves KL *and* MS — parameterizing must not
  change KL. Watch for cross-scene singleton clashes on `activeTemperament`.
- **Naming table drives the schedule:** Phases 1–2/4 are mechanical; Phase 3's
  `chordNameTable` is bespoke musical content.
- **State integers are temperament-relative:** every stored `ft_note`/`reference`/`root_53`
  is meaningless without its N — tag persisted state or risk silent mis-tuning on reload.
- **Regression surface:** without Phase 0 goldens the refactor can silently change 53 chord
  names — build the oracle first.

**First executable step:** Phase 0 + the skeleton of Phase 1 — stand up `temperament.js`
with `Temperament53`, route the kind-A math through it, prove the 53 goldens are unchanged.
Nothing user-visible changes, but "53 is everywhere" becomes "N is one place," which every
later phase depends on.


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
