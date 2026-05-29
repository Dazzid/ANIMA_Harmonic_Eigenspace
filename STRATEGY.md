# ANIMA Harmonic Eigenspace — Strategy

Working notes to keep direction and decisions in one place. Update as the project evolves.

---

## 1. Project at a glance

Two interactive web apps share a single page and toggle between scenes without re-initializing:

- **Eigenspace** — 4D psychoacoustic dissonance visualization (Plomp–Levelt), Plotly-based 3D viz, audio synthesis, MIDI input, ADSR.
- **Modal Studio** — port of C++ ofApp.cpp; grid + chord scenes, dragging chords, voicing/scale editors.

Both run on top of p5.js. Audio uses Web Audio + p5.sound. Plotly drives the Eigenspace 3D viz.

## 2. Entry points

- `index.html` — main entry. Loads p5, Plotly, all component scripts, then `anima.js` last.
- `anima.html` — alternate entry, near-duplicate of index.html.
- `modal_studio.html` — standalone Modal Studio entry (uses `modal_studio_main.js` + `modal_studio_sketch.js` instead of `anima.js`).

Local dev server: `python3 -m http.server 8000` → http://localhost:8000/

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

## 5. (removed) — `anima.js` is no longer monolithic; see §3 Core and §4 above.

## 6. Pending / future work

### 6.1 Split anima.js — scene-based architecture (IN PROGRESS, revisited 2026-05-29)
Target: `eigenspace.js` + `modal_studio_app.js` + slim `anima.js` (router only, ~400 lines).

**Acceptance bar:** scene toggle must remain instant and stateful — no re-mount, no re-init, no re-compute. Audio context and OfApp instance preserved across toggles.

**Current status (2026-05-29):** on branch `refactor/scene-architecture`. Phases 0–2 done & committed (split verified faithful: `anima.js` 3611→342 lines; `eigenspace.js` + `modal_studio_app.js` carry the rest). Scene-independence + frame-saving for EigenSpace sub-components implemented, pending verify/commit. Remaining: Phase 2b (`playNote` routing) + Phase 3 (HTML dedupe + docs).

#### Goals (why we're doing this)
1. Eigenspace loads once — never rebuilt on toggle. *(Already true: 3D viz is Plotly, built once on `load`.)*
2. Modal Studio state preserved when switching to Eigenspace and back. *(Already true: single `OfApp` instance in `window.app`, only `display` toggled.)*
3. Independent code per scene + one central handler, so adding scenes is cheap.
4. Central handler renders/updates **only the active scene** — no parallel compute. *(NOT true today — see below.)*

#### Key finding driving the work
There is **no loop guard** (`noLoop`/`frameRate`/scene check) anywhere. `p.draw = () => { if (app) app.draw(p); }` runs every frame, so the **entire Modal Studio scene renders at 60fps behind a `display:none` div while Eigenspace is showing**. Mouse events are already guarded inside `OfApp.mousePressed` (`if (currentScene !== Scenes.MODALSTUDIO) return`), but rendering is not.

#### Design decisions (agreed)
- **Loop control:** single p5 instance always looping; `draw()` delegates to the active scene only. Inactive scene's `draw` is simply never called. (No per-scene p5 instances — that risks Modal Studio re-init.)
- **Init timing:** eager — both scenes init at startup, exactly like today (preserves the "loads once" guarantee).
- **No bundler / ES modules** — stays script-tag globals (Conventions §7).

#### Architecture: Scene contract + SceneManager
Every scene is an object implementing: `init / enter / exit / draw / mousePressed / mouseDragged / mouseReleased / keyPressed / resize`.
```
SceneManager = { scenes, active, switchTo(name) }   // switchTo: active.exit() → swap → active.enter()
p.draw         = () => SceneManager.active?.draw(p)  // ← goal 4: inactive scene never renders
p.mousePressed = () => SceneManager.active?.mousePressed(p.mouseX, p.mouseY)  // etc.
```
`EigenspaceScene.draw` is a no-op (Plotly self-renders), so toggling to Eigenspace stops the Modal Studio render loop entirely.

#### Process (check off as we go)
**Phase 0 — Safety net** ✅ done
- [x] Branch off `master` → `refactor/scene-architecture`.
- [x] Baseline: Eigenspace + Modal Studio load and toggle correctly.

**Phase 1 — Scene contract IN PLACE (only behavioral change; still one file)** ✅ done & verified
- [x] Add `SceneManager`, `EigenspaceScene`, `ModalStudioScene` objects wrapping existing behavior.
- [x] Rewire single p5 sketch + keydown to delegate through `SceneManager.active`.
- [x] `switchScene(name)` becomes a thin wrapper around `SceneManager.switchTo(name)`.
- [x] Verified. **Bug found & fixed:** per-scene `enter()` added its body class but never cleared the other's → both classes lingered → `body.scene-modalstudio #eigenspace-app * { pointer-events:none }` froze EigenSpace on return. Fix: `switchTo()` clears all scenes' `bodyClass`, sets only the active one (mutual exclusion, generalized for future scenes).

**Phase 2 — Physical split (mechanical, zero behavior change)** ✅ done & verified
- [x] `eigenspace.js` — dissonance math, audio synth, TET helpers, numeric helpers, `createVisualization` + Plotly toggling, `window load` init, `EigenspaceScene`.
- [x] `modal_studio_app.js` — `OfApp` class + `ModalStudioScene`.
- [x] `anima.js` (slim, 342 lines) — `Scenes`, `currentScene`, `SceneManager`, `switchScene`, single p5 sketch, DOM/nav wiring, `window.ANIMA`.
- [x] Faithfulness proven by code-line diff: only intended diffs are the removed `name: Scenes.X` literals + `register()` now assigning `scene.name` (avoids load-time `Scenes` ref since `Scenes` lives in last-loaded `anima.js`).
- [x] Load order updated in `index.html` + `anima.html`: shared → eigenspace → modal_studio_app → anima.js (last).
- [x] **Phase 2b — `window.playNote` explicit cleanup (no audible change):** there are two synth engines (EigenSpace's `playNote`/`playChord`; Modal Studio's `AudioEngine`). Routing today is *mixed*: EigenSpace 3D point-clicks → EigenSpace engine (via local `playChord`); keymap + MIDI piano → `window.playNote` → Modal Studio engine. `window.playNote` was set by eigenspace.js then overwritten in p5 setup (last-writer-wins by load order). **Decision (user):** keep current sound, just remove the race. Now defined **once** in the router (anima.js), call-time guarded on `window.app`; eigenspace.js no longer assigns it. *(Pending verify/commit. Considered & rejected: scene-aware routing — would split engines, opposite of the desired unified feel.)*

**Phase 2.5 — Scene independence (sub-component gating)** 🔧 implemented, pending verify/commit
- *Problem:* EigenSpace has **three** independent p5 instances besides the main router sketch — `colorbarP5` (colorbar-slider.js), `gridSketch` (grid.js, the Chord Memory grid), `chordVizP5` (chord_visualization.js). Each one's `mousePressed` fires on **any** window press, so their cells stayed clickable behind Modal Studio (saved chords triggerable; hidden but live).
- [x] grid.js + chord_visualization.js: add `eventsEnabled` gate + `enableEvents()/disableEvents()` (mirrors colorbar). `chordVizP5` given a module handle.
- [x] `EigenspaceScene.activateComponents(active)`: toggles all three as a group — both **events** (enable/disable) and **draw loop** (`loop()/noLoop()`), so inactive components also stop repainting hidden canvases (saves frames). `enter()`→active, `exit()`→inactive.
- [x] `ModalStudioScene.enter()` no longer reaches into colorbar — deactivation owned by `EigenspaceScene.exit()` (run by SceneManager before the new scene's `enter()`).
- [ ] Verify: saved chord not triggerable from Modal Studio; EigenSpace components live again on return; console clean.

**Phase 3 — Dedupe & docs** ✅ done
- [x] Reconciled `index.html` ↔ `anima.html` (now identical local script lists; added missing `modal_studio_info_overlay.js` to anima.html — the Modal Studio Info button was dead there). True cross-file dedup isn't possible without a build/include step (plain script tags); `modal_studio.html` stays separate (standalone). *Note: modal_studio.html references `modal_studio_Audio.js` (capital A) — works on macOS's case-insensitive FS, would break on Linux; pre-existing, out of scope.*
- [x] Updated STRATEGY §3/§4/§5 to the post-split architecture.
- [ ] Flip memory note `anima.js split deferred` → done (doing now).

#### Explicit cross-file interface (the scope hazard — resolve lexically today, must be `window.*` after the cut)
| Symbol | Owner | Consumed by |
|---|---|---|
| `Scenes`, `currentScene` | anima.js | both scenes |
| `window.playNote` | **ambiguous today** — fix in Phase 2 | both |
| `audioParams`, `audioMuted`, `audioCtx` | eigenspace.js (audio core) | modal studio audio |
| `setDark`, `adsrCanvas`, `adsrCurrentScene` | adsr.js (shared) | both |
| `colorbarP5`, `setRootVisualization`, `clearChordVisualization` | eigenspace UI | EigenspaceScene |

Note: `OfApp.this.currentScene` ('chord'/'grid') is distinct from global `currentScene` (EIGENSPACE/MODALSTUDIO) — no collision.

#### Out of scope
- No bundler/modules. No touching OfApp internals, dissonance math, or Plotly trace building. No re-init on toggle (OfApp instance + audio context stay alive). Don't touch uncommitted grid.js / launchpad.js.

#### Adding scene #3 afterward
Write one object implementing the contract + `SceneManager.scenes[...] = NewScene`. No new `switch` arms across lifecycle hooks.

## Lunch the web-app locally
python3 -m http.server 8000 
Open:
http://localhost:8000/anima.html 
Check: lsof -i :8000 -sTCP:LISTEN
kill PID

### 6.2 Other open threads
*(add here as they arise)*

## 7. Conventions

- Globals are intentional — these are script-tag scripts, not ES modules. Don't introduce a bundler casually.
- Keep `Scenes` enum + `currentScene` declared before any consumer loads.
- Modal Studio code lives in `modal_studio_*.js` — match that naming for any new Modal Studio module.
- Eigenspace code currently lives inside `anima.js`; new Eigenspace logic goes there until the split happens.
- We will implement Menu design using https://tailwindcss.com/showcase

## 8. References

- Project: ANIMA MSCA Postdoctoral Fellowship (Project ID 101203318), Horizon Europe.
- Citation: Dalmazzo, D. (2025). *ANIMA Harmonic Eigenspace: 4D Psychoacoustic Dissonance Visualization for Microtonal Harmony.* MSCA Project 101203318.
