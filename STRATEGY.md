# ANIMA Harmonic Eigenspace — Strategy

Working notes to keep direction and decisions in one place. Update as the project evolves.

---

## 1. Project at a glance

Two interactive web apps share a single page and toggle between scenes without re-initializing:

- **Eigenspace** — 4D psychoacoustic dissonance visualization (Plomp–Levelt), Plotly-based 3D viz, audio synthesis, MIDI input, ADSR.
- **Modal Studio** — port of C++ ofApp.cpp; grid + chord scenes, dragging chords, voicing/scale editors.

Both run on top of p5.js. Audio uses Web Audio + p5.sound. Plotly drives the Eigenspace 3D viz.

## 2. Entry points

- `index.html` — **main entry** (the one GitHub Pages serves). Loads p5, Plotly, all component scripts, then the scene files + `anima.js` last.
- `anima.html` — alternate entry. **Identical local script list to index.html — keep the two in sync** when adding/removing scripts.
- `modal_studio.html` — standalone Modal Studio entry (uses `modal_studio_main.js` + `modal_studio_sketch.js` instead of `anima.js`). Independent of the unified app.

### Run locally

```bash
# from the repo root
python3 -m http.server 8000
```

Then open:
- http://localhost:8000/ — main entry (`index.html`)
- http://localhost:8000/anima.html — alternate entry

Port already in use? Check `lsof -i :8000 -sTCP:LISTEN`, stop with `kill <PID>`, or pick another port (`python3 -m http.server 8080`). A static server is required — opening the HTML via `file://` breaks the `fetch()` dataset loads. See §8 for deploy.

## 3. File map

**Shared / common**
- `midi_mpe.js`, `midi_piano.js` — MIDI input
- `binary-loader.js` — dataset loader
- `adsr.js`, `colorbar-slider.js` — UI components
- `chord_visualization.js`, `info_overlay.js`, `key_map.js`, `grid.js` — Eigenspace UI

**Modal Studio modules** (`modal_studio_*.js`)
- `KeyMap`, `audio`, `Note`, `Chord`, `Mode`, `ScaleEditor`, `VoicingEditor`, `Grid`, `DraggingChords`, `shaders`, `info_overlay`, `adsr`, `main`, `sketch`
- In the **unified app**, the Modal Studio scene is `modal_studio_app.js` (the `OfApp` class), which composes the `modal_studio_*.js` modules above. `main`/`sketch`/`adsr` are used only by the **standalone** `modal_studio.html`.

**Core (unified app — split from the old monolithic anima.js, 2026-05-29)**
- `eigenspace.js` (~2400 lines) — EigenSpace scene: dissonance math, audio synth, TET helpers, numeric helpers, `createVisualization` + Plotly, load-time init, `EigenspaceScene`.
- `modal_studio_app.js` (~950 lines) — `OfApp` class + `ModalStudioScene`.
- `anima.js` (~360 lines) — **router only**: `Scenes`/`currentScene`, `SceneManager`, `switchScene`, single p5 sketch, DOM/nav wiring, `window.playNote` entry, `window.ANIMA`. Loads last.

## 4. Scene routing (current architecture, post-split)

```
Scenes = { EIGENSPACE: 0, MODALSTUDIO: 1 }
currentScene = Scenes.EIGENSPACE  // default; kept in sync by SceneManager

// Each scene is an object implementing the contract:
//   enter / exit / draw / mousePressed / mouseDragged / mouseReleased / keyPressed / resize
SceneManager = { scenes, active, register(name,scene), switchTo(name) }
//   switchTo: active.exit() → swap → set body class (mutually exclusive) → active.enter()
switchScene(name)  // thin wrapper over SceneManager.switchTo(name)
```

The single p5 sketch and the global key/mouse listeners delegate to `SceneManager.active` **only** — an inactive scene is never drawn or sent events (kills the old behind-the-scenes 60fps render). `EigenspaceScene.draw` is a no-op (Plotly self-renders); `ModalStudioScene.draw` runs `OfApp.draw`.

`EigenspaceScene` also owns its **interactive p5 sub-components** — `colorbarP5` (colorbar-slider.js), `gridSketch` (grid.js, Chord Memory), `chordVizP5` (chord_visualization.js) — via `activateComponents(active)`, which toggles both their mouse events (`enable/disableEvents`) and draw loop (`loop/noLoop`) on `enter()`/`exit()`. Without this they stay clickable/redrawing behind the active scene.

`window.playNote` (external triggers: key_map.js, midi_piano.js) is defined **once** in anima.js, routing to Modal Studio's engine via `window.app`. EigenSpace's own point-clicks use its local `playChord()`.

**The toggle stays instant and stateful** — no app reload, audio context + `OfApp` instance preserved, scene state retained.

## 5. Adding a new scene (recipe)

The architecture is built so a new scene is a localized, low-risk addition — no new `switch` arms across lifecycle hooks.

1. **Give it a file.** New scene logic → its own `*.js` (e.g. `my_scene.js`), loaded **before** `anima.js`. Reuse existing component modules where useful.
2. **Add the enum value** in `anima.js`: `Scenes = { EIGENSPACE:0, MODALSTUDIO:1, MYSCENE:2 }`.
3. **Write the scene object** implementing the contract — `enter / exit / draw / mousePressed / mouseDragged / mouseReleased / keyPressed / resize` (+ optional `bodyClass: 'scene-myscene'`):
   - `enter()` — show your DOM container; activate your interactive components.
   - `exit()` — hide/deactivate; **stop any p5 sub-component events + draw loops** (copy the `EigenspaceScene.activateComponents` pattern).
   - `draw(p)` — per-frame render; make it a **no-op if you self-render** (like Plotly).
   - ⚠️ Do **not** reference `Scenes` inside the object literal (it loads before `anima.js`) — `SceneManager.register` assigns `.name` for you.
4. **Register it** in `anima.js`: `SceneManager.register(Scenes.MYSCENE, MyScene)`.
5. **Wire a nav button** in the DOM → `switchScene(Scenes.MYSCENE)`.
6. **Load order** in `index.html` *and* `anima.html`: shared components → scene files → `anima.js` last. Keep the two HTML entries identical.

**Gotchas (learned in the split — see §6.1):**
- Body scene classes are mutually exclusive; the manager clears all then sets the active one. Don't toggle them yourself in `enter()`.
- Any extra p5 instance you create fires `mousePressed` on **any** window press → gate it by scene in `enter/exit`, or its UI stays live behind other scenes.
- Top-level `let`/`const` globals are visible everywhere **at runtime**, but not before their script runs — reference them only inside methods/handlers, never at load time.

## 6. Pending / future work

### 6.1 Scene-based split of anima.js — ✅ DONE (shipped to `master`, 2026-05-29)
The monolithic `anima.js` (~3611 lines) was split into `eigenspace.js` + `modal_studio_app.js` + slim router `anima.js` (~360), with a Scene contract + `SceneManager` (see §3/§4). Live on `master` / GitHub Pages.

**What it achieved:** independent per-scene code + one central handler; **inactive scenes are never drawn or sent events** (removed the old behind-the-scenes 60fps render); the fluid stateful toggle was preserved (no re-mount/re-init/re-compute — `OfApp` instance + audio context stay alive).

**Durable lessons / watch-outs (apply to any future scene work):**
- **Mutually-exclusive body classes:** `SceneManager.switchTo` clears every scene's `bodyClass` then sets only the active one. Both present once froze EigenSpace via `body.scene-modalstudio #eigenspace-app * { pointer-events:none }`.
- **Extra p5 instances leak:** EigenSpace has three besides the router sketch (`colorbarP5`, `gridSketch`, `chordVizP5`); each one's `mousePressed` fires on *any* window press. `EigenspaceScene.activateComponents()` gates their events **and** draw loop (`loop`/`noLoop`) per scene. A new scene with its own p5 instance must do the same.
- **Load-time vs runtime refs:** `Scenes` lives in last-loaded `anima.js`; scene objects must not reference it in their literal (`.name` is set by `register`). Cross-script `let`/`const` globals resolve at runtime via the shared global lexical scope, not at load time.
- **Audio:** two engines exist (EigenSpace `playChord`; Modal Studio `AudioEngine`). `window.playNote` is defined **once** in anima.js and routes external triggers (keymap, MIDI piano) to Modal Studio's engine. Kept unified per user preference (a scene-aware split was considered and rejected).

**Cross-file interface (current reality):**
| Symbol | Owner | Consumed by |
|---|---|---|
| `Scenes`, `currentScene`, `window.playNote`, `window.app` | anima.js (router) | both scenes |
| audio core: `audioCtx`, `audioParams`, `audioMuted`, `playNote`/`playChord` | eigenspace.js | EigenSpace |
| `setDark`, `window.adsrCanvas`, `window.adsrCurrentScene` | adsr.js (shared) | both |
| `colorbarP5`, `gridSketch`, `chordVizP5`, `setRootVisualization`, `clearChordVisualization` | EigenSpace components | EigenspaceScene |

Note: `OfApp.this.currentScene` ('chord'/'grid', Modal Studio's *internal* sub-scene) is distinct from the global `currentScene` (EIGENSPACE/MODALSTUDIO) — no collision.

### 6.2 Other open threads
- Menu/UI redesign using Tailwind (see §7).
- *(add here as they arise)*

## 7. Conventions

- **Globals are intentional** — these are script-tag scripts, not ES modules. Don't introduce a bundler casually.
- **Where code goes:** EigenSpace logic → `eigenspace.js`; Modal Studio → `modal_studio_app.js` / `modal_studio_*.js` modules; router-only code (scene plumbing, p5 sketch, DOM wiring) → `anima.js`. A new scene → its own file (see §5).
- `Scenes`/`currentScene` live in `anima.js` (loads last). Reference them only at **runtime** (inside methods/handlers), never at a script's load time — see §6.1 lessons.
- Keep `index.html` and `anima.html` script lists **identical** when adding/removing scripts.
- Menu/UI redesign will use Tailwind — https://tailwindcss.com/showcase

## 8. Deployment & branch workflow

- **`master` is the live branch.** GitHub Pages serves the repo root of `master` → `https://dazzid.github.io/ANIMA_Harmonic_Eigenspace/` (default page `index.html`).
- **Single-branch development.** Work directly on `master`; no long-lived feature branches. Use `checkpoint:` commit messages as named revert points.
- **Every `git push origin master` updates the public site** (rebuilds in ~1 min). Commit freely; **push only when ready to go live.**
- **Rollback:** `git revert <sha>`, or reset to a known-good `checkpoint:` commit, then push. Pre-split rollback point: `29e25ad` (*checkpoint: launchpad added*).
- **Before pushing:** preview locally (§2) and sanity-check the scene toggle + audio.

## 9. References

- Project: ANIMA MSCA Postdoctoral Fellowship (Project ID 101203318), Horizon Europe.
- Citation: Dalmazzo, D. (2025). *ANIMA Harmonic Eigenspace: 4D Psychoacoustic Dissonance Visualization for Microtonal Harmony.* MSCA Project 101203318.
