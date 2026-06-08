# The Harmonic Eigenspace — Concept

The "why" behind this project, so we stay aligned across iterations. This is a **research instrument**, not just a web app. Read this before coding: most decisions exist to faithfully present the idea below. For *how* the app is built, see `STRATEGY.md`.

---

## 1. The core idea

A tetrad rooted at frequency `f` is the vector

```
v = f · (1, α, β, γ)        with  α ≤ β ≤ γ ∈ [1, 2]   (upper-voice ratios to the root)
```

Transposition (changing the root) is the **uniform scaling operator** `Tλ = λ·I`: it multiplies every frequency by `λ`. So:

- **Every chord vector is an eigenvector of `Tλ`.**
- The **eigen‑direction `(α, β, γ)` is the chord *quality*** — the thing intrinsic to the chord, independent of key.
- The **eigenvalue `λ` is the root / transposition ratio** — just *where* the quality is voiced.
- Dissonance is a **class function constant along each eigen‑ray**, so **every root produces the same 3D dissonance landscape.** Cmaj7 and F♯maj7 are the *same point* in `(α,β,γ)`.

That invariance is why it's an *Eigen*space: chord identity is the invariant direction; the root is the scalar.

## 2. The dissonance field

The scalar over `(α,β,γ)` is **psychoacoustic dissonance** (Plomp–Levelt roughness, extended to complex tones by Sethares): sum of pairwise roughness across all partials of the four notes' harmonic spectra (`dataset_eigenspace.ipynb`).

- **Local minima ≈ just‑intonation tetrads** — perceptually stable chords; the gradient field partitions the volume into basins around them.
- **12‑, 31‑, 53‑TET appear as discrete lattices** sampling the same continuous volume → all tuning systems compared on one perceptual basis. 53‑TET is the working vocabulary (ten interval gradations).
- **Timbre determines the minima.** Change the spectrum and the consonant ratios move — consonance is a relationship between *tuning and timbre*, not a fixed property of ratios. (This is why audio timbre in the app is not cosmetic.)

## 3. The key subtlety (settled — don't re‑litigate)

Sethares's critical‑band scaling `s = x* / (s₁·f + s₂)` reads **absolute** frequency through the `s₂ ≈ 19 Hz` baseline. **This is not a flaw to remove — it *is* the human ear** (cochlear critical bandwidth grows with frequency).

- It only rescales dissonance **magnitude** slightly at low pitch.
- The minima **locations / eigen‑directions are pure ratio conditions** (partials coinciding) → they don't move with the root. The eigen‑structure is exactly invariant.
- Making it scale‑free (`s₂→0` / log‑frequency) would give *exact value*-invariance but lands in **the same spot** structurally and is **less perceptual**. So we don't.

**Synthesis:** eigen‑structure = the math (exact, root‑invariant); critical band = the perceptual anchor (the ear); audible band = the canvas. The goal is **to show humans a perceptually‑grounded map that explains why chords sound the way they do** — within ~20 Hz–20 kHz (a ~220 Hz root + 6 harmonics ≈ 220 Hz–5 kHz, fully audible). We do **not** need to certify the model across all physics or chase where invariance drifts outside hearing.

## 4. What this means for implementation

Decisions serve the demonstration of the idea, not just look/feel:

- **Position jitter** on the point cloud → so a regular‑lattice rendering artifact (moiré) doesn't *misrepresent* the dissonance field.
- **53‑TET names + root‑invariant playback/selection** → faithfulness to the model (the quality is the invariant; the root is just the eigenvalue).
- **Additive timbre + critical‑band‑consistent audio** → because timbre determines the minima (Sethares); the sound must match the spectrum the map is built from.
- **Node resolution (e.g. 400→500)** → resolve the real structure honestly, not for show.
- **Chord Memory / Modal Studio** → compositional navigation of the expanded 53‑TET vocabulary the space reveals.

## 5. Pointers

- Paper: Under revision
- Dataset generator: `dataset_eigenspace.ipynb` (builds `D(α,β,γ)` + the local‑minima nodes).
- Architecture / how‑it's‑built: `STRATEGY.md`.
- Live: https://dazzid.github.io/ANIMA_Harmonic_Eigenspace/
