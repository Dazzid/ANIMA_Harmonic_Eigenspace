# Harmonic Eigenspace Explorer

Interactive 3D visualization of consonance/dissonance landscape for tetrachords using Plomp-Levelt psychoacoustic model.

**Features:**
- 3D harmonic eigenspace (α, β, γ frequency ratios)
- 77 local minima detection with stochastic refinement
- Real-time audio synthesis with click-to-play
- Multi-view modes: layered isosurfaces and full 3D volume
- Comparative analysis: 12-TET, 31-TET, 53-TET chord systems
- WebGL rendering with Plotly.js

**Tech:**
- Pure JavaScript + Web Audio API
- 400³ dissonance grid computation
- Local minima finding with adaptive refinement
- Tetrahedron constraint (α ≤ β ≤ γ)

Exploring microtonal harmony through computational psychoacoustics.