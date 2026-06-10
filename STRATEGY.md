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

### 6.3 Voicing Editor — Dynamic Editing — 🚧 IN PROGRESS

**Goal.** Make the Voicing Editor (`modal_studio_VoicingEditor.js`, MS **chord** scene) editable: re-root the whole chord, add 9/11/13, move notes between octave rings, and apply drop voicings — all of it round-tripping back into the chord (name + colour + audio).

#### Architecture you must know (all steps depend on these)
- **`currentVoicing[]`** = notes, each `{ id, scalePosition, absoluteTET, normalizedTET, octave, noteName }`, kept sorted low→high by `absoluteTET`. `id` is a stable identity (survives re-sorts).
- **Root** is tracked by `rootPitchClass` (set from `notes[0]` on load), **not** by array index — so component ID stays right when the bass ≠ root.
- **6 rings**, octaves −1…4. Note radius `r = radius*0.3 + (octave+1)*radius*0.21`; angle from `normalizedTET`. `getOctave(abs) = floor(abs/53)`.
- **Notify path:** `notifyVoicingChanged()` → `onVoicingChanged(absoluteTET[])` (`modal_studio_app.js:279`) → `grid/modes.updateSelectedChordVoicing` → `chord.updateVoicing()` + `chord.setChordQualityFromVoicing()`. The latter measures intervals from `chord.root_53` and now reads 9/11/13 → **the chord label auto-updates from the voicing**.
- **Key subtlety:** `updateVoicing` updates `this.root` (the bass) but **never `root_53`**. So only the **re-root** step (Step 4, which moves pitch classes) must also move `root_53`; the add-extensions / octave-move / drop steps only octave-shift or add tones (pitch classes unchanged) → name stays correct for free.
- **Host:** editor lives in `modal_studio_app.js` (setup `:275`, draw `:569`, `mousePressed` forwarded `:584`, gated to the `chord` sub-scene). `app.keyPressed` is a no-op; MS keydown is owned by `key_map.js`.

#### Decisions (locked)
- **Re-root trigger** = a new **outer-ring wheel** (canvas, drag-to-rotate), **Holdrian-comma** steps, chromatic, no scale snapping.
- **Shift+↑/↓** = the **note octave-move only** (Step 7). Not re-root.
- **Drops** act on the **current arrangement** (no normalize-to-closed); cumulative, Reset is the undo.
- **Buttons** (9/11/13, drops, reset, oct ▲▼) = **HTML overlay**, fixed-docked. The re-root wheel is the canvas exception.
- **Auto-doubling removed**; **6th ring added outward**, existing rings never shrink.

---

#### Step 0 — Foundation refactor — ✅ DONE (2026-06-09)
Decouple root identity from bass position so the later features can move/reorder notes.
- ✅ `rootPitchClass` set on load; `identifyChordComponents` + `calculateExtendedComponents` use it (not `currentVoicing[0]`).
- ✅ Stable `id` per note + `selectedNoteId` field (identity-based selection/drag).
- ✅ `originalVoicing` snapshot on load (for the Reset step, Step 8); selection cleared on chord change.
- ✅ Auto-doubling (`addOctaveBase`) removed — `currentVoicing` holds only real notes.
- ⬜ **Remaining:** make the root note editable (drop the `i===0` skip in `findNearestNote`/drag guards) — defer to Step 1.
- ⏳ Verify: normal chords unchanged; wide-gap chords no longer show the doubled-root node.

#### Step 1 — 6th ring (octave 4, outward) — ✅ DONE (2026-06-09)
- ✅ `drawCircleGrid` loop `octave < 4` → `< 5`; `factorSize` 1.45 → 1.66 so the frame grows outward (new ring at r=1.35·radius keeps the old 0.31·radius margin). Existing rings untouched.
- ⏳ Verify in-app: widget doesn't overflow / overlap the grid below.
- ⬜ Octave clamp (rings −1…4) for moves/transpose — added with Steps 4 & 7.

#### Step 2 — Persistent selection (prerequisite for the octave-move, Step 7) — ✅ DONE (2026-06-09)
- ✅ Click a note (incl. the root) → `selectedNoteId` set; bold blue ring highlight in `drawCurrentVoicing`. Click it again to deselect.
- ✅ **Click-vs-drag threshold** (`CLICK_DRAG_THRESHOLD` 4px): a press only becomes an angular drag past 4px, so a select-click never nudges the note.
- ✅ Selection persists across redraws/drags; cleared only on chord change. Root is selectable (`findNearestNote(includeRoot)`) but still not angular-draggable.
- ⏳ Verify in-app: clicking selects/highlights; tiny clicks don't move notes; drag still works.
- Note: drag still uses `draggedNoteIndex` (fine — no re-sort happens during angular drag); migrate to `id` only when a re-sorting op (Step 3/5/7) needs it.

#### Step 3 — Add / remove 9 / 11 / 13 — ✅ DONE (2026-06-09)
- ✅ `calculateExtendedComponents` now **scale-derived**: 9/11/13 = the 2nd/4th/6th scale degrees above the root (from `currentScalePositions`), raised an octave; falls back to fixed offsets with no scale. #11 dropped. Stores `absoluteTET` + scale-derived `octave`; `getRootAbsolute()` added.
- ✅ `toggleExtension(type)`: voiced in that band → remove; else add the ghost pitch one octave above the root, re-sort, re-ID, `notifyVoicingChanged`. Round-trip confirmed (no loop back into `updateCurrentVoicing`) → chord label gains `…9/11/13` via `setChordQualityFromVoicing`.
- ✅ Interaction = **visible `9` / `11` / `13` buttons** drawn at the **lower-left of the widget frame** (`drawExtensionButtons`, hit-tested in `mousePressed`). Button highlights when that extension is voiced; click toggles add/remove. (The faint ghost markers were invisible in practice, so explicit buttons are the primary affordance; ghost-click kept as a bonus.)
- ✅ **Detection is by IDENTITY tag, not position (2026-06-10, final):** each button-added note carries `extType` (9/11/13). `isExtension` = `v.extType === type` — pure identity. So a note added by the 11 button **stays "the 11" wherever you drag it** (even to the bass), and pressing 11 removes **that exact note**. The tag survives angular/octave drags in-place, and survives `updateCurrentVoicing` rebuilds via `prevTags` (absoluteTET→extType, same-chord only). #11 placed at step **27** (augmented 4th); name distinguishes 27 (#11) from 26 (b5). One note per button, guaranteed (toggle is 0↔1).
- ✅ **Major-chord 11 defaults to #11 (2026-06-10):** `isMajorChord()` (major 3rd at 17–20) → the 11 ghost/label becomes **#11** (Lydian) since natural 11 clashes with the major 3rd. Non-major chords keep natural 11.
- ↪️ **UI deviation:** these buttons are **canvas-drawn** (not the HTML overlay from the Step 6 plan) — auto show/hide + auto-position with the widget, no DOM-sync. If we still want HTML styling later, Step 6 can replace them; otherwise the canvas buttons may just absorb Step 6.
- ✅ Placement = **just above the highest note** (David's choice), **hard-clamped to the rings** (octave ≤ 4) — a missing clamp had let spread voicings fling a note ~17 rings off the widget (non-sensical.png). Toggle-off is now **reliable via an `extType` tag** on added notes (band-classification was failing for some scales → kept re-adding instead of removing).
- ⏳ Verify in-app: click `9`/`11`/`13` (lower-left) → note appears on an **on-screen** upper ring (never off-widget) **and** the label updates (e.g. `Cmaj9`); click again clears it. *(Known: with the spread default voicings "above highest" can land on the outer ring — that's the chosen rule; switch to "one octave above root" is a 1-liner if it feels too high.)*

#### Step 4 — Re-root wheel — ✅ DONE (2026-06-09)
- ✅ **Wheel band** drawn in the outer frame margin (1.44–1.56·radius, tick marks; tints orange while dragging). `drawWheel` + `wheelRadii`.
- ✅ **Drag-to-rotate** → continuous accumulated rotation → Holdrian-comma steps; `applyWheelTranspose(N)` shifts every note's `absoluteTET` by N (chromatic, no snap), recomputes octave/ring, **blocked at ring edges** (−1…4).
- ✅ **Root threaded (R1):** shifts `rootPitchClass`; `onTranspose(N)` (wired in `modal_studio_app.js`) shifts the selected chord's `notes[]` + `root_53` (dedup by object identity) **before** notify, so intervals are unchanged → the name transposes correctly (C…→C#…), quality preserved.
- ✅ **De-shared mutation (2026-06-09):** grid cells deep-copy `notes[]` but **share `root_53` by reference** with the original dragged chord (`dropChordIntoCell`), so an in-place transpose leaked to other cells/the palette. `onTranspose` now builds FRESH note objects and reassigns `ch.notes/root_53/root` → transpose affects ONLY the selected chord.
- ⏳ Verify in-app: drag the outer band → whole voicing rotates up/down by commas; chord name's root letter tracks; **only this chord changes**; stops at the rings.
- ⬜ Deferred: **audio on release** (transpose is currently silent until the chord is re-clicked); direction (CW=up) — flip if it feels backwards.

#### Step 5 — Voicing drop-down (4 leading-voice voicings, David's table) — ✅ DONE (2026-06-10, FINAL)
- ✅ **HARDCODED exactly from David's table** (`buildLeadingVoicing(lead)` in the editor) — the saved `voicing_1…7` templates double the *wrong* tone, so they were dropped. Each note is `[tone, octaveOffset]`; tone interval read from the actual chord (any quality), octave/order literal:
  - **Root** C2 C3 E3 G3 B3 C4 · **3rd** C2 C3 G3 B3 C4 E4 · **5th** C2 C3 B3 C4 E3 G4 · **7th** C3 B3 C4 E4 G4 B4
- ✅ **Drop-down** (top-right, canvas-drawn): `Root on top / 3rd on top / 5th on top / 7th on top`. **No "Default"** (all four ARE musical defaults). Clamped to rings −1…4.
- ✂️ Removed: my from-scratch drop math AND the `ch.voicing(n)` saved-template approach — both gave non-matching/collapsed voicings. Root stays in the bass → no inversion/slash.

#### Step 6 — HTML control panel — ❌ DROPPED (buttons went canvas-drawn)
All buttons are canvas-drawn on the widget: **top row** `Drop2 / Drop3 / Drop2&4 / Reset` (under the title bar), **bottom-left** `9 / #11 / 13`, **bottom-right** octave `↑/↓` stepper, plus the re-root **wheel** (outer ring). No HTML panel needed. (The space crunch this creates is what motivates §6.4 tabs.)

#### Step 7 — Move selected note ±1 octave — 🚧 buttons DONE (2026-06-09), keyboard pending
- ✅ **Octave ↑/↓ buttons** (lower-right of the widget) → `moveSelectedNoteOctave(±1)` on the selected note: clamp to rings −1…4, recompute `absoluteTET`, re-sort, notify; note keeps its `id` so the highlight follows. Dimmed when nothing is selected. (Unblocks "notes trapped on their ring".)
- ⬜ **Shift+↑/↓** keyboard shortcut via a new `app.keyPressed` hook — require MS chord scene + a live `selectedNoteId`; `preventDefault`; **no collisions** with `key_map.js` notes or ES Shift+L/M. (Deferred — riskier.)

#### Step 8 — Reset — ✅ DONE (2026-06-10)
`resetVoicing()`: restore `originalVoicing` (load snapshot) + `_notes` → rebuild `currentVoicing` with no extension tags → notify. Wipes every edit (extensions, drags, drops, transpose) back to the chord's default. Top-row `Reset` button.

#### Step 9 — Round-trip & session verify
- Every edit reaches `setChordQualityFromVoicing`: name + colour update, audio re-plays.
- Session save/load still round-trips edited voicings (per-cell `noteVoicing`/`voicingType`, §6.1).

#### Watch-list (gotchas to not forget)
- **Band overlaps** at intervals 10 / 26 / 36 (3rd↔9th, dim5↔#11, aug5↔13th) — dynamic editing parks notes there often; can mislabel/miscolour.
- **Down-room for drops** is just the single octave −1 ring below the root; if cramped, re-center the rings (separate change).
- **No `#11` button — drag the 11th instead.** Buttons are just `9 / 11 / 13`; the 11th note is then **dragged to any 53-TET quality** (natural 11, #11, etc.) and the NAME follows. Naming intelligence (kept): `setChordQualityFromVoicing` prefers the perfect 5th (so a 26/27 note ≠ `b5` when a P5 is present), and `qualityWithExtensions` appends `#11` only when a perfect 5th coexists. So dragging the 11 up to the augmented-4th next to a P5 → `Cmaj7#11`; a flattened 5th with no P5 still → `b5`. (A magic fixed `#11` button contradicted the microtonal drag model — removed.)
- Auto-doubling (R5): **removed**. 6th ring (R11): **added outward**, existing rings unchanged.

### 6.4 Unify Scale + Voicing editors into one tabbed slot — ✅ DONE (2026-06-11)

**Goal.** Scale Editor and Voicing Editor are the same-size widget (`factorSize 1.6`, radius `160`) but used to stack **vertically** top-right, eating ~2 frame-heights (overflowed small/laptop screens). They're mutually exclusive in practice (Scale = global scale; Voicing = the *selected chord's* voicing), so they now share **one slot** with a `[ Scale | Voicing ]` tab toggle — reclaiming a whole frame-height.

**Locked decisions (David):** (a) **switching = auto + manual** — clicking a chord (Modes button or Grid cell) auto-flips to the Voicing tab via `setActiveEditorTab('voicing')`; both tabs stay clickable for manual switching (Scale is home); (b) **tabs = DOM/CSS**, a real **two-button segmented control** (one click, NOT a dropdown), matching the Voicing dropdown theme; (c) **empty Voicing** → frame + centered "Click a chord to edit its voicing".

**Implementation.**
- `modal_studio_app.js`: `this.activeEditorTab` ('scale' home / 'voicing'); Voicing editor pinned to the **same center** as Scale (`updatePositions` + init), so they fully overlap. `drawActiveEditor(p)` draws ONLY the active editor in both scenes; `mousePressed`/`mouseReleased` routed to the active editor only (critical now that both are co-located); `mouseDragged` already gated by `isInteracting`.
- DOM tab strip: `ensureEditorTabs` / `updateEditorTabs` / `hideEditorTabs` / `setActiveEditorTab` — modeled on the editor's `ensureMenuDom`/`updateMenuDom`/`hideMenuDom` (same `getBoundingClientRect` + `center − outerRadius` tracking). Left-aligned on the active editor's title bar (right of the bar stays grabbable for dragging, and clear of the top-right global hamburger menu). `setActiveEditorTab` syncs co-location (incoming adopts the dragged position) and hides the Voicing dropdown when leaving the Voicing tab.
- `modal_studio_VoicingEditor.js`: `drawEmptyPlaceholder()` in the no-chord `draw` branch.
- `modal_studio_style.css`: `.editor-tabs` / `.editor-tab` / `.editor-tab.active` (segmented pill, `#2b2b2b` + amber `#ffc800`, Fira Code).
- Scene `exit()` hides the tab strip; `updateEditorTabs` no-ops when not in MODALSTUDIO.

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
