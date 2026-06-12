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
This space is reserved for implementation plans. 


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
