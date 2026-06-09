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

### 6.1 Save / Load Session (JSON) — ✅ DONE (verified end-to-end)

**Goal.** Persist a working session to a local JSON file and reload it later. Two menu actions in **all** scenes: **Save Session** (downloads a file) and **Load Session** (drop area → validate header → **replace** current state).

**What a session contains**
1. **Chord Memory** — the 8×8 grid via `gridSketch.getGrid().exportData()` / `importData()`. Load = **replace**.
2. **Modal Studio — the Modal Interchange grid (all 64 cells).** The grid is 8×8 (`modal_studio_Grid.js`): row 0 is the placed progression, rows 1–7 start as the auto-calculated modal interchange — **but any cell (any row) can then be voicing-edited via the Voicing Studio** (`updateSelectedChordVoicing` edits the selected cell). So we **save the entire 8×8 grid and restore it directly — NOT re-run the interchange calculation on load** (that would wipe per-cell edits). Restore "gently": place each saved chord back into its cell. **No Scale Editor involvement** — each cell carries its own notes/voicing/color, so the grid renders and plays correctly with no scale to restore and no recalculation.
   - **Per-cell chord descriptor.** A cell's chord is fully defined by the fields `dropChordIntoCell` copies (modal_studio_Grid.js): `notes[]` (`{ft_note,name,interval,localInterval}`), `noteVoicing[]`, `voicingType`, `globalInversion`, `chordFunction`, `quality`, `finalInfo`, `info`, `root_53`, `note_53`, `chordQuality{}`, color. Empty cells → `null`.

**Session JSON schema** (header is the validity gate on load):
```json
{
  "signature": "ANIMA-EIGENSPACE-SESSION",   // ← magic flag; the FIRST gate on load
  "version": 1,
  "savedAt": "2026-06-05T17:40:00.000Z",
  "chordMemory": { "gridSize": 8, "storage": [ /* 8×8; each entry is a chord cell OR null (empty) */ ] },
  "modalStudio": {
    "grid": [ /* 64 entries (8×8, row-major); each is a chord descriptor OR null (empty cell) */ ]
  }
}
```

**Empty cells are normal.** Neither grid is required to be full — empty CM cells and empty MS cells are saved as `null` and restore back to empty. Validation checks *structure*, never *fullness*; an all-empty grid is still valid.

**Save flow** — build the object → `JSON.stringify` → Blob → `a.download = "session_YYYY-MM-DD_HH-MM-SS.json"` → click (reuse the existing download idiom in eigenspace.js). Local-time, filesystem-safe timestamp (no colons).

**Load flow** — menu "Load Session" opens a centered overlay with a dashed **drop zone** that is also **click-to-browse** (hidden `<input type=file accept=".json">`). On drop/select, read the file text and run the **validation gate below — nothing in the app is mutated until all of it passes**. Only then apply (replace): CM `getGrid().importData(chordMemory)` + `refreshLeds()`, and MS `app.applySession({grid})` → `grid.restoreAll(grid)` (in-place, no recalc). If `OfApp`/Grid isn't ready yet, stash and apply on init. Then close the overlay with success feedback.

**Validation gate (3 layers, in order, before any state change).** A signature alone is necessary but not sufficient — pair it with parse + shape so a foreign *or* a signed-but-broken file can't corrupt state:
1. **Parse** — `JSON.parse` in try/catch → rejects non-JSON garbage outright.
2. **Signature** — `obj.signature === "ANIMA-EIGENSPACE-SESSION" && obj.version === 1` → rejects valid JSON that isn't ours (the magic-flag check the user asked for).
3. **Shape (structure only, `null`-tolerant)** — `chordMemory.gridSize === 8` and `storage` is an 8×8 array; `Array.isArray(modalStudio.grid) && grid.length === 64`. "64" = 64 *slots*, entries may be `null`. Never reject for empty/all-empty cells — only for wrong dimensions/missing arrays.

Any failure shows an inline message in the overlay and leaves the app untouched. Apply each part inside try/catch too, so a surprise can't half-load.

**Files to touch**
- **New `session.js`** (loaded before `anima.js`; sync both HTML lists) — `window.AnimaSession.save()` / `.openLoadDialog()`, the overlay DOM/CSS, the 3-layer validation gate (parse + signature + null-tolerant shape), download helper, apply/restore logic. Self-contained.
- **`menu.js`** — a **Session** section (Save / Load) in every scene, wired to `window.AnimaSession`.
- **`grid.js`** — reuse `exportData`/`importData` (verify `importData` fully replaces).
- **`modal_studio_Grid.js`** — add `serializeAll()` (64 chord descriptors / nulls from `cells[0..63]`) + `restoreAll(descriptors)` (rebuild each Chord and assign into its cell, mirroring `dropChordIntoCell`'s field copy + `colorCode`, **without** column-clear or `calculateModalInterchange`). Set `chordProgression` from the restored row 0.
- **`modal_studio_app.js`** — add `getSession()` (`{ grid: grid.serializeAll() }`) / `applySession({grid})` (`grid.restoreAll(grid)`) on `OfApp` — gently, no recalc, no scale. Stash + apply on init if `OfApp`/Grid not ready.

**Locked:** scope = CM + MS Modal Interchange (**entire 8×8 grid, restored directly — no recalc, no Scale Editor**); load = **replace**; load input = **drag + click-to-browse**. **Resolved:** per-cell voicing edits in any row are saved as part of each chord descriptor.

**Verify** — save with chords in CM and a customized MS grid (incl. a voicing-edited cell in rows 1–7 and some empty cells) → reload page → Load Session restores the CM grid and **all 64 MS cells exactly as saved** (no recompute, edits + empties intact); a foreign or signed-but-broken JSON is rejected with a message and leaves state untouched; filename matches `session_<date>_<time>.json`.

### Build checklist

Tick as we go. Don't start a phase before the one above is green.

**Phase 0 — Decisions**
- [x] Scope = Chord Memory + MS Modal Interchange **entire 8×8 grid** (restored directly, no recalc, no Scale Editor)
- [x] Load = **replace**
- [x] Load input = **drag + click-to-browse**
- [x] Per-cell voicings (any row): saved inside each chord descriptor; restore does NOT re-run modal interchange

**Phase 1 — Serialization core (`session.js`)**
- [x] Create `session.js`; load it **before `anima.js`** in `index.html` **and** `anima.html`
- [x] `window.AnimaSession` namespace + signature constants (`signature: "ANIMA-EIGENSPACE-SESSION"`, `version: 1`)
- [x] `buildSession()` → header + `chordMemory` (`getGrid().exportData()`) + `modalStudio` (`app.getSession()`)
- [x] `validateSession(obj)` → 3-layer gate: `JSON.parse` try/catch + signature (`signature==="ANIMA-EIGENSPACE-SESSION" && version===1`) + null-tolerant shape (`chordMemory.gridSize===8`, `modalStudio.grid` array length 64); fail → inline message, no state change
- [x] `downloadJSON(obj, name)` helper (Blob → `a.download`), filename `session_YYYY-MM-DD_HH-MM-SS.json`

**Phase 2 — MS get/apply: entire grid (no scale)**
- [x] `Grid.serializeAll()` → 64 chord descriptors (or null) from `cells[0..63]`
- [x] `Grid.restoreAll(descriptors)` → rebuild each `Chord`, assign into its cell (mirror `dropChordIntoCell` field copy + `colorCode`); **no** column-clear, **no** `calculateModalInterchange`; rebuild `chordProgression` from row 0
- [x] `OfApp.getSession()` → `{ grid:[...64] }`
- [x] `OfApp.applySession(s)` → `grid.restoreAll(s.grid)` (gentle, no recalc, no scale)
- [x] Handle "`OfApp`/Grid not ready yet" → stash session, apply on init

**Phase 3 — Save action**
- [x] `AnimaSession.save()` builds + downloads
- [x] `menu.js`: **Save Session** item (all scenes)

**Phase 4 — Load action + UI**
- [x] Centered overlay: dashed **drop zone** + hidden `<input type=file accept=".json">` (click-to-browse)
- [x] `dragover`/`dragleave`/`drop` + read file text
- [x] `JSON.parse` (try/catch) → `validateSession` → **visible error**, no state mutation on failure
- [x] Apply on success: CM `importData` (replace) + `app.applySession`
- [x] `menu.js`: **Load Session** item (all scenes) → `AnimaSession.openLoadDialog()`
- [x] Close overlay + success feedback

**Phase 5 — Verify**
- [x] Save with CM chords + a custom MS grid (incl. a voicing-edited cell in rows 1–7) → file downloads, name correct
- [x] Reload page → Load → CM replaced; **all 64 MS cells restored exactly** (the rows 1–7 edit survives — no recalc clobber)
- [x] Foreign/invalid JSON rejected with message, state untouched
- [x] Works from ES / MS / KL menus
- [x] `index.html` + `anima.html` script lists in sync

### 6.2 ES 53-TET root selection — ✅ DONE (verified)

**Goal.** In EigenSpace the root is chosen from 12 chromatic keys today. The system is 53-TET–centric, so let the user reach **any 53-TET step** as the root: click intermediate steps on the **Frequency Spectrum**, and nudge the root by **one Holdrian comma** (1/53 octave) with the **Up/Down arrows**. The 12-TET keys stay as labeled reference; the 53-TET grid is what the ticks/arrows move along.

**What's already there**
- Root = `currentBaseFreq` (eigenspace.js); 12 keys via `keyToFreq` (12-TET, C3–C4); `setRootVisualization(freq)` redraws.
- **Frequency Spectrum** = `chord_visualization.js` (the `chordVizP5` instance, scene-gated): a vertical **log**-frequency bar **C3 (130.81 Hz) → C5 (523.25 Hz)** with `freqToY(freq)`, already drawing the 12-TET notes as reference lines + names.
- **`53_reference_notes.json`** (423 rows): each step = `{ reference, frequency, noteName }`. `reference` is the 53-TET step index (**±1 = one Holdrian comma**); `frequency` is exact Hz; `noteName` is the name (e.g. `^A0`). So steps + names are read straight from here — nothing computed.
- Arrow keys are **currently unused in ES** — free to use (just `preventDefault` so the page doesn't scroll).

**Design**
- Load `53_reference_notes.json` once in ES; keep the steps within the spectrum range (C3–C5, ~106 steps over 2 octaves).
- Draw each 53-TET step as a small **clickable tick** at `freqToY(step.frequency)`; the 12-TET lines stay the prominent labeled anchors. Highlight the current root's step.
- **Click** a tick → nearest-step hit-test by y → set `currentBaseFreq = step.frequency`, `setRootVisualization(...)`, show `step.noteName` in the root readout, redraw.
- **Arrows** in `EigenspaceScene.keyPressed`: snap to the nearest 53-TET `reference`, then ±1 → set root to that step (frequency + name). `preventDefault`.
- Display the **53-TET `noteName`** (from the JSON) for off-12-TET roots — every step has one.
- Keep the 12 keyboard keys as the 12-TET reference roots (unchanged).

**Files to touch**
- **`eigenspace.js`** — load + cache the 53-TET steps (fetch `53_reference_notes.json`); a `setRootToFrequency(freq, name)` helper that updates `currentBaseFreq` + readout + `setRootVisualization`; arrow handling in `EigenspaceScene.keyPressed` (nearest-ref → ±1). Reuse the existing root-readout (`#click-output`).
- **`chord_visualization.js`** — draw the 53-TET ticks + current-root highlight; add `mousePressed` on `chordVizP5` (already events-gated via `enable/disableEvents`) that hit-tests the nearest step and sets the root.

**Defaults (unless changed):** ticks are subtle short marks (12-TET lines stay prominent); click snaps to nearest tick; arrows step continuously (no octave clamp).

**Build checklist**

**Phase 0 — Decisions**
- [x] Root selectable across all 53-TET steps; 12-TET keys stay as reference
- [x] Mouse target = the **Frequency Spectrum** (`chord_visualization.js`), add intermediate clickable steps
- [x] Up/Down arrows = ±1 Holdrian comma (1/53 octave), snapping to canonical 53-TET steps
- [x] Names come from `53_reference_notes.json` `noteName`

**Phase 1 — 53-TET data + root helper (`eigenspace.js`)** ✅
- [x] Fetch + cache `53_reference_notes.json` steps within C3–C5 → `window.tet53Steps` (sorted)
- [x] Root setter: extended `window.updateGlobalRoot(freq, name)` (name from 53-TET data) + `window.stepRoot53(dir)`
- [x] `window.tet53NearestIndex(freq)` helper (log-nearest 53-TET step)

**Phase 2 — Arrow stepping** ✅
- [x] `EigenspaceScene.keyPressed`: ArrowUp/Down → `stepRoot53(±1)` (nearest-ref ±1); `preventDefault`
- [x] No conflict with global Shift+digit hotkeys (those gate on `shiftKey`; arrows have no Shift)

**Phase 3 — Spectrum ticks + click (`chord_visualization.js`)** ✅
- [x] `draw53TetTicks(p)` — short ticks per 53-TET step at `freqToY`; current root highlighted (cyan)
- [x] `handleMouseClick` snaps the click to the nearest 53-TET step → `updateGlobalRoot(freq, noteName)` (12-TET hit-test kept as pre-load fallback)
- [x] Events honor the scene gate — `chordVizP5` is in `activateComponents` (events + `noLoop` off-scene)

**Phase 4 — Verify** ✅
- [x] Click intermediate ticks → root snaps to 53-TET step, name (e.g. `^^F4`, `vC#4`) + viz update — verified
- [x] Up/Down arrows move the root by one comma; names track (`A3`→`^A3`→`vA3`); no page scroll
- [x] 12-TET keyboard keys still set their reference roots (unchanged `keyToFreq` path)
- [x] Ticks inert + not drawn when not in ES (scene gate)

### 6.3 Voicing Editor — Dynamic Editing — 🔲 PLANNED

**Goal.** Turn the Voicing Editor (`modal_studio_VoicingEditor.js`, MS **chord** scene) from a single-gesture widget (drag a note around its own ring) into a full voicing workbench.

**Functionalities to add (the concrete list).** Each row is one user-facing control + the behaviour it triggers:

| # | Control (HTML overlay) | What it does |
|---|---|---|
| F1 | **Re-root ▲ / ▼** (and drag-wheel) | Transpose the **whole** voicing ±1 comma (53-TET, chromatic). Moves every note incl. the root pitch class. Wheel = continuous. |
| F2 | **9** / **11** / **13** (toggle) | Add (or remove) that extension to the voicing by activating its ghost node. |
| F3 | **Oct ▲ / ▼** + **Shift+↑ / Shift+↓** | Move the **selected** note up/down one octave ring (keyboard shortcut mirrors the buttons). |
| F4 | **Drop 2** / **Drop 3** / **Drop 2&4** | Apply the jazz drop voicing — drop the numbered note(s) (top→bottom) an octave. |
| F5 | **Reset** | Restore the chord's default closed voicing. |
| — | **Click a note to select it** | New: persistent selection (highlight) that F3 acts on. Today selection only exists mid-drag. |

These sit on a **prerequisite refactor** (see next block): make every note editable and track the root by pitch class, not array index.

**How it works today (the baseline we're extending)**
- `currentVoicing[]` = ordered list of `{ scalePosition, absoluteTET, normalizedTET, octave, noteName }`. **Index 0 is assumed to be the root AND the bass** — `findNearestNote` skips `i===0`, so the root is non-editable.
- **5 octave rings** (octaves −1…3). A note is drawn at `r = radius*innerRadius + (octave+1)*octaveSpacing`, angle from `normalizedTET` (`octaveSpacing = radius*0.21`). `getOctave(abs) = floor(abs/53)`.
- **Dragging = angular only**, within the note's current ring, bounded by its same-ring neighbors (`isWithinDraggingLimits` / `handleNoteDragging`). Octave never changes while dragging.
- **Extension ghosts already exist**: `calculateExtendedComponents()` precomputes inactive 9th (`root+9`), 11th (`root+22`), #11 (`root+27`, majors only) and 13th positions; `determineComponentType()` owns the canonical 53-TET interval bands (9th 3–10, 3rd 11–20, 11th 21–25, #11 26, 5th 27–35, 13th 33–41, 7th 42–52). *(Naming uses the same bands — see §6.x chord-name extensions in `modal_studio_Chord.js`.)*
- **Change propagation**: any edit calls `notifyVoicingChanged()` → `onVoicingChanged(absoluteTET[])` (wired in `modal_studio_app.js:279`) → `grid.updateSelectedChordVoicing` / `modes[].updateSelectedChordVoicing` → `chord.updateVoicing()` + `chord.setChordQualityFromVoicing()`. **Synergy:** because `setChordQualityFromVoicing` now reads 9/11/13 from the voiced intervals, added extensions will *automatically* show up in the chord label.
- **Host hooks**: instantiated `modal_studio_app.js:67`, `setup()` `:275`, drawn `:569`, mouse dispatched `:584` (chord scene only). `app.keyPressed` is a **no-op** today; MS keydown currently lives in `key_map.js` (note playback).

**Foundational refactor (do this first — features 1, 3, 4 all depend on it).** Decouple **root identity** from **bass position**. Drop voicings, re-rooting, and octave moves all break the "index 0 = root = lowest note" invariant (e.g. Drop 2 of a closed Cmaj7 → G–C–E–B, bass is G not C).
- Keep `currentVoicing` **sorted by `absoluteTET`** for ring placement + neighbor bounds.
- Track the harmonic root **by pitch class** (`root_53` / interval 0), not by array index. Recompute components by interval-from-root each edit (already how `identifyChordComponents` works).
- Make **every** note editable (drop the `i===0` skip); the root keeps a distinct color but can be dragged/moved like the rest.

**The four features**

1. **Re-root by rotating the whole chord (wheel).** A vertical wheel / ▲▼ control that transposes the *entire* voicing up or down, preserving its interval shape. **Decided: chromatic 53-TET transpose** — every note (incl. the root pitch class `root_53`/`note_53`) shifts by the same ±N commas; **no scale snapping** (microtonal freedom is the point). Wheel drag = continuous comma steps; ▲▼ = ±1 comma. Notes that cross a ring boundary update `octave` + `absoluteTET` naturally via `getOctave`; clamp the whole chord so no note leaves rings −1…3.

2. **Add 9th / 11th / 13th.** Buttons `9` `11` `13` (and maybe `#11`) **toggle** the corresponding extension. "On" = promote the existing ghost position to an active `currentVoicing` entry (insert at its ring, re-sort, notify). "Off" = remove it. Clicking the ghost node directly should do the same.

3. **Move a note between rings (octave ± 1).** Add a persistent `selectedNoteIndex` (set by a click/"flick" on a note; today selection only exists mid-drag). Then **Shift+ArrowUp / Shift+ArrowDown** moves the selected note to the next/previous ring: `octave ±= 1` (clamp −1…3), recompute `absoluteTET = normalizedTET + octave*53`, re-sort, notify. Needs a new keyboard hook routed through `app.keyPressed` → `voicingEditor` **without** colliding with `key_map.js` note keys or the ES/global Shift shortcuts (gate on MS chord scene + editor having a selection).

4. **Drop voicings (Drop 2 / Drop 3 / Drop 2&4).** Buttons that re-octave the active notes. **Decided: act on the *current* arrangement** (no normalize-to-closed step). Algorithm: take `currentVoicing` sorted **high→top** by `absoluteTET`, number 1..n **top→bottom**, then drop note #2 (Drop 2), #3 (Drop 3), or #2 and #4 (Drop 2&4) by one octave (`octave−=1`, recompute `absoluteTET`); re-sort, notify. Results therefore depend on the current octave layout (preserves prior manual edits, as requested). Guard `n < 4` (Drop 3 / 2&4 need ≥3 / ≥4 notes) and clamp to ring −1.

**UI / buttons — HTML overlay.** **Decided: real HTML buttons over the canvas** (not p5-drawn). Add a small control panel (its own `<div>`, Fira Code, styled like the existing toolbar buttons) holding: `▲`/`▼` re-root, `9` `11` `13`, `Drop2` `Drop3` `Drop2&4`, octave `▲`/`▼` for the selected note, `Reset`. Wire each via `addEventListener('click', …)` to a `voicingEditor` method that mutates `currentVoicing` and calls `notifyVoicingChanged()`. **Visibility/positioning caveats:** (a) show only in the MS **chord** scene **and** when a chord is selected (`isChordClicked`) — toggle the panel's `display` from the same gates that draw the widget; (b) the widget's title bar is **drag-movable**, so either dock the panel in a **fixed** position (simplest — doesn't track the drag) or, if it must hug the widget, update the panel's `left/top` from `voicingEditor.center` each frame. Recommend a fixed docked panel to avoid per-frame DOM updates. Buttons must **not** sit inside the p5 canvas hit-area in a way that double-fires — HTML stops the event, but confirm the canvas `mousePressed` doesn't also run for that pixel.

**Risks & mitigations (pre-mortem — read before coding).**

*The two derailers (decide/handle in the refactor step, before any feature):*
- **R1 — the notify path can't move the root.** `notifyVoicingChanged()` sends only `absoluteTET[]`; `setChordQualityFromVoicing` measures every interval from the chord's stored `root_53`. F1 (re-root) and F4 (drop) move notes but never tell the chord its root moved → after a re-root the name + component colours read N steps off (all wrong). **Fix:** widen the callback to carry the new root (or have `updateVoicing` re-derive `root_53`). Non-negotiable prerequisite for F1.
- **R2 — re-sorting invalidates index-based state.** `draggedNoteIndex` and the planned selection are **array indices**; any transpose/drop/octave-move re-sorts `currentVoicing`, so the index now points at a *different* note (drag jumps, F3 moves the wrong note). **Fix:** track dragged/selected note by **object identity** (stable ref/id), not index; never re-sort mid-drag.

*Structural:*
- **R3 — "root = index 0 = bass" is assumed in ~6 places** (`findNearestNote`, `identifyChordComponents`, `calculateExtendedComponents`, `isWithinDraggingLimits`, `isValidTETPosition`, `handleNoteDragging`). Drop voicings make bass ≠ root, so `currentVoicing[0]` is the wrong interval reference. **Fix:** convert all to root-by-pitch-class in one pass; miss one → silent mislabeling.
- **R4 — F2 extensions are fixed offsets, not scale-derived.** `calculateExtendedComponents` hardcodes 9th=`root+9`, 11th=`root+22`, #11=`root+27` (majors only) → "Add 11" injects a perfect 4th even in Lydian (should be #11), can land off-scale or duplicate a tone. **Fix:** derive 9/11/13 from `currentScalePositions` (the actual stacked degrees).
- **R5 — phantom doubled root corrupts F4 numbering + selection.** `analyzeVoicing`'s `addOctaveBase` silently inserts a duplicate root; Drop's top→bottom count includes it. **Fix:** exclude doubled/phantom notes from drop numbering + selection, or disable auto-doubling in edit mode.

*Behavioural / integration:*
- **R6 — F3 keyboard collisions.** `anima.js`→scene `keyPressed`, `key_map.js` note keys, ES Shift+L/M, and page-scroll on arrows all overlap. **Fix:** gate Shift+↑/↓ on MS-chord-scene + live selection, `preventDefault`, ensure no `key_map` note fires. Plus a **click-vs-drag threshold** (every select currently starts a drag) and stop `mouseReleased` from clearing the selection.
- **R7 — F4 is cumulative, not toggle** ("current arrangement" → repeated Drop 2 keeps sinking notes; Reset is the only undo). Confirmed intended; just flag in UI.
- **R8 — Reset needs the original template preserved** — snapshot the chord's default voicing on first edit, else there's nothing to restore to.
- **R9 — audio spam** — a wheel-drag re-root re-triggers the chord per frame. **Fix:** throttle, or sound only on release.
- **R10 — HTML panel visibility must mirror editor interactivity** — `onVoicingChanged` handles `grid`+`chord` but `mousePressed` is gated to `chord` only; gate the panel to the *real* interactive surface. Fixed-docked panel won't track the drag-movable widget (accept the disconnect).
- **R11 — off-ring clamping** — only 5 rings (−1…3); a whole-chord transpose where a note is already on the top ring can't move up. **Decide:** block the move vs. let the note go off-ring (sounding, undrawn).
- **R12 — band overlaps at 10 / 26 / 36** (3rd↔9th, dim5↔#11, aug5↔13th): dynamic editing parks notes on these boundaries far more than static chords do, surfacing the known naming/colour ambiguity.

**Build checklist (de-risked order).**
- [ ] **Refactor (do all together):** track root **by pitch class** across the ~6 sites (R3); selection/drag **by identity** not index (R2); **carry the root in the notify callback** (R1); snapshot original voicing for Reset (R8); decide auto-doubling in edit mode (R5).
- [ ] Persistent selection: click-to-select + highlight, with click-vs-drag threshold; don't clear on release (R6).
- [ ] HTML control panel: markup + styling; show/hide gated to the real interactive surface + `isChordClicked` (R10); fixed docked.
- [ ] **F2** Add/remove 9 / 11 / 13 — **scale-derived** (R4) → notify; verify the label gains `…9/11/13`.
- [ ] **F1** Re-root ▲▼ / wheel → chromatic transpose of all notes **incl. root_53** (R1) → notify; clamp to rings (R11); throttle audio (R9).
- [ ] **F4** Drop 2 / Drop 3 / Drop 2&4 on current arrangement, top→bottom numbering **excluding phantoms** (R5); guard `n<4`.
- [ ] **F3 (last — riskiest):** `app.keyPressed` hook → Shift+Arrow octave move of the selected note (R6); clamp to rings.
- [ ] **F5** Reset → restore snapshotted default voicing (R8).
- [ ] Round-trip every edit through `setChordQualityFromVoicing`: name + colour update, audio re-plays correctly.
- [ ] Session save/load still round-trips edited voicings (per-cell `noteVoicing`/`voicingType`, §6.1) — re-verify.

**Decisions (resolved with David)**
- Re-root: **chromatic** 53-TET transpose (no scale snapping).
- Drop buttons: act on the **current arrangement** (no normalize-to-closed).
- Buttons: **HTML overlay** panel (fixed docked), not canvas-drawn.

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
