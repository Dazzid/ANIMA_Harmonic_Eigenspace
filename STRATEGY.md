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

### 6.1 Split anima.js (deferred)
Plan: `eigenspace.js` + `modal_studio_app.js` + slim `anima.js` (router only, ~400 lines).

**Acceptance bar:** scene toggle must remain instant and stateful — no re-mount, no re-init, no re-compute. Audio context and OfApp instance preserved across toggles.

**Watch for** when splitting:
- Globals crossing the boundary: `currentScene`, `Scenes`, `window.playNote`, `audioParams`, the `OfApp` instance.
- Script load order in `index.html` / `anima.html`: shared globals first → eigenspace → modal_studio_app → anima.js (router last).
- `index.html`, `anima.html`, and `modal_studio.html` already share the modal_studio_*.js list — splitting is a chance to dedupe.

Do not start this work until explicitly revisited.

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
