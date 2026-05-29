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

**Core**
- `anima.js` (~3531 lines) — hosts both apps + scene router. See section 5.

## 4. Scene routing (current architecture)

```
Scenes = { EIGENSPACE, MODALSTUDIO }
currentScene = Scenes.EIGENSPACE  // default
switchScene(newScene) — flips state, no re-init
```

All p5 lifecycle hooks (`setup`, `draw`, mouse, keyboard) dispatch via `switch (currentScene)`. Toggle button calls `switchScene()` directly. **This is intentional: the toggle must be instant and stateful — no app reload, audio context preserved, scene state retained.**

## 5. anima.js structure

| Lines | Section |
|---|---|
| 1–27 | Header, license, `Scenes` enum, `currentScene` |
| 29–73 | Config flags, key→freq tables |
| 76–164 | Dissonance math (Plomp–Levelt, refinement) |
| 166–461 | Audio synthesis (reverb, playNote, chord, ADSR) |
| 463–833 | TET ratio helpers + chord position tables (12/31/53-TET) |
| 835–1020 | Numeric helpers (linspace, harmonic node finder, percentile, interpolation) |
| 1022–1976 | `createVisualization` + Plotly layer toggling |
| 1977–2244 | Save binary, root/chord update, run-computation pipeline |
| 2247–2261 | Global audio params bridge |
| 2263–3133 | `OfApp` class — Modal Studio app (chord/grid scenes, drag, voicing) |
| 3134–3382 | Scene router, unified mouse/keyboard dispatch, init |
| 3384–end | p5 sketch initialization |

## 6. Pending / future work

### 6.1 Split anima.js — scene-based architecture (IN PROGRESS, revisited 2026-05-29)
Target: `eigenspace.js` + `modal_studio_app.js` + slim `anima.js` (router only, ~400 lines).

**Acceptance bar:** scene toggle must remain instant and stateful — no re-mount, no re-init, no re-compute. Audio context and OfApp instance preserved across toggles.

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
**Phase 0 — Safety net**
- [ ] Branch off `master` (leave uncommitted grid.js / launchpad.js untouched).
- [ ] Baseline checklist: Eigenspace loads → toggle to Modal Studio → toggle back → play a note in each → ADSR show/hide → MIDI button appears.

**Phase 1 — Scene contract IN PLACE (only behavioral change; still one file)**
- [ ] Add `SceneManager`, `EigenspaceScene`, `ModalStudioScene` objects wrapping existing functions (bodies call current code; `enter()` wraps the current `switchScene` case blocks).
- [ ] Rewire single p5 sketch to delegate `draw`/mouse/resize through `SceneManager.active`.
- [ ] `switchScene(name)` becomes a thin wrapper around `SceneManager.switchTo(name)`.
- [ ] Verify against Phase 0 checklist.

**Phase 2 — Physical split (mechanical, zero behavior change)**
- [ ] `eigenspace.js` — dissonance math, audio synth, TET helpers, numeric helpers, `createVisualization` + Plotly toggling, `window load` init, `EigenspaceScene`.
- [ ] `modal_studio_app.js` — `OfApp` class + `ModalStudioScene`.
- [ ] `anima.js` (slim) — `Scenes`, `currentScene`, `SceneManager`, `switchScene`, single p5 sketch, DOM/nav wiring, `window.ANIMA`.
- [ ] Resolve `window.playNote` overwrite: each scene routes its own audio instead of last-write-wins.
- [ ] Update load order in `index.html` + `anima.html`: shared → eigenspace → modal_studio_app → anima.js (last).
- [ ] Verify against checklist after each file move.

**Phase 3 — Dedupe & docs**
- [ ] Dedupe shared `modal_studio_*.js` list across `index.html` / `anima.html` / `modal_studio.html`.
- [ ] Update STRATEGY §5 file map; flip memory note `anima.js split deferred` → done.

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
