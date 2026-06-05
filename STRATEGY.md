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

## 6. Current direction: Save / Load Session (JSON)

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
