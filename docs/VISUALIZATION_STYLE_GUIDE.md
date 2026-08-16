# Visualization Style Guide (v2)

Companion to `docs/VARIANT_REPORT.md` (v1, the original 8 rule variants). This
document covers the visualization and control-ontology layer added in the
2026-08-10 revision: layered rendering, the two intuitive control sliders, the
preset library, and the cognitive-scaffolding UI (meters, resonance badge,
interaction-flow diagram).

## Why a redesign

The v1 demo rendered a single field-mixed hex color (density drove hue/lightness,
energy nudged saturation and brightness) and exposed all 15+ raw engine
parameters directly as sliders. Two problems followed directly from that:

1. **Patterns looked visually similar.** Mixing density and energy into one
   color channel meant the energy field's actual shape — where it's
   concentrated, how it's flowing — was never separately legible.
2. **The control panel required knowing the engine's internals.** Sliders like
   `energyBirthCoupling` or `momentumSmoothing` don't map to any intuition a
   first-time viewer has; you had to already understand the rule engine to
   predict what turning one would do.

v2 addresses both by separating the three fields into independent visual
layers (so each is legible on its own or in combination) and by replacing raw
parameter exposure with two named sliders that compose onto a preset's
authored values (`src/ontology.js`).

## Layer 1 — Density (filled hexes)

**What it encodes:** how much "material" is in a cell (0–1).
**Rendering:** a filled hex polygon per cell with `density >= 0.04`, colored by
a pure hue/saturation/lightness ramp that depends on density alone — energy and
momentum do not touch this layer's color, unlike v1.

```
hue    = 252 - 218 * min(1, d)   // 252° deep indigo -> 34° warm amber
sat    = 55 + 30 * min(1, d)
light  = 10 + 46 * min(1, d)
```

Low density reads as cool and dark; high density reads as warm and bright.
Cells below the 0.04 cutoff are skipped entirely (transparent) rather than
drawn near-black, both for performance and so the background stays legible.

**Why this ramp:** hue alone is not colorblind-safe (a deuteranopia viewer
loses much of the indigo-to-amber distinction), so lightness and saturation
both climb monotonically with density too — the same information is available
on a luminance-only reading of the image, not just the hue channel.

## Layer 2 — Energy (additive glow)

**What it encodes:** the energy field's sign and magnitude.
**Rendering:** for any cell with `|energy| > 0.12`, a radial gradient is drawn
centered on that cell with `globalCompositeOperation = 'lighter'` (additive
blending), so overlapping glows brighten each other rather than overwrite —
this is what produces the bloom effect around dense, high-energy clusters.

- Positive energy: warm gradient, `rgba(255,200,110,α) -> rgba(255,160,60,0)`.
- Negative energy (energy deficit): cool violet gradient,
  `rgba(130,140,255,α) -> rgba(90,90,220,0)`.
- `α` scales with `min(1, |energy| / 2)`.
- Glow radius is `2.1 x cellSize`, deliberately larger than one hex so
  neighboring energetic cells visually merge into a single glow field instead
  of appearing as separate dots.

**Why additive blending:** it's the cheapest way to get a physically-plausible
"heat" read — regions where many adjacent cells are all energetic light up
disproportionately brighter than an isolated energetic cell, which mirrors how
the energy field's leakage actually behaves (energy pools where production
outpaces leak-away).

## Layer 3 — Momentum (vector arrows)

**What it encodes:** each cell's momentum direction (always unit length by
construction — see engine.js's post-update normalization — so arrow length is
fixed; only presence, direction, and opacity carry information).
**Rendering:** subsampled across the grid (stride derived from cell size, so
arrows read as a flow field rather than clutter) as a short line with a
triangular arrowhead, drawn in two passes:

1. A dark halo stroke (`rgba(4,6,14,0.9)`, wide) underneath.
2. A bright cyan-white line and arrowhead (`rgba(210,245,255,0.95)`) on top.

**Why the halo:** an arrow drawn in one flat bright color disappears against
the energy glow layer's bright yellow core (tested directly — see
`scripts/render-smoke-test.mjs` output before this was added, where arrows
were nearly invisible). The dark halo guarantees contrast against any
background color underneath.

**Note on threshold mismatch:** arrows draw down to `density >= 0.12`, just
below the engine's own 0.15 "alive" threshold, while the density layer's color
ramp is nearly imperceptible (lightness ~15%) at that same density. This means
isolating the Momentum layer alone (toggle off Density and Energy) can reveal
a wider "penumbra" of sub-visible-threshold structure that the density layer
doesn't show on its own — cells too faint to render as a visible hex but still
carrying real momentum. This is intentional, not a bug: it's one of the
clearest uses of the per-layer toggles, showing the field's true extent versus
what's perceptible in the composited view.

## Layer 4 — Particles (energy leakage in motion)

**What it encodes:** the actual per-step energy leak events (`src/particles.js`),
sourced from `engine.leakPrimaryTarget` / `engine.leakPrimaryAmount` — the
single most-favored neighbor each leaking cell sends energy toward.
**Rendering:** a small glowing dot (radial gradient, same warm palette as the
energy layer) that travels from source-cell position to target-cell position
over several animation frames, fading in on spawn and out on arrival
(`alpha ∝ sin(progress * π)`).

**Why decoupled from the simulation step:** `ParticleSystem.spawn()` /
`.update()` are driven once per *rendered* frame, not once per *simulated*
generation. This keeps particle motion visually smooth regardless of how the
caller paces simulation steps — the browser demo steps once per animation
frame (spawn/update every frame), while GIF capture steps the simulation every
frame internally but only samples every 8th frame for encoding
(`scripts/generate-gifs-v2.mjs`), and particles still read as continuous
motion because they were spawned/updated on every one of those internal
steps, not just the sampled ones.

## The control ontology (`src/ontology.js`)

*(For the plain-language "what does this actually do" explanation of every
raw parameter and both sliders, see `docs/ATTRIBUTE_GLOSSARY.md` — this
section stays focused on the implementation.)*

Two sliders replace direct manipulation of raw parameters, each 0–1, neutral
(preset's authored values, unchanged) at 0.5:

**Survival Pressure** (Fragile ↔ Robust) — modulates `surviveDecay`,
`deathDecay`, `deadDecay`, the width of the survive window
(`surviveLow`/`surviveHigh`), `energyToDensity` reinforcement, and
`birthEnergyMin`. Verified against Crystal Bloom, Storm Field, and Ember Ring:
the neutral-to-robust half (0.5–1.0) produces a smooth, real gradient (e.g.
Crystal Bloom climbs from 59% to 68% alive as pressure goes 0.5→1.0). The
fragile half (0.0–0.5) has a much sharper transition — most presets collapse
to total death somewhere around pressure 0.4–0.45 rather than degrading
gradually. **This is not a mapping bug**: the underlying birth/survival rule
is threshold-based (a cell is either in its survive window or it isn't), so
"barely fragile" and "very fragile" produce similar outcomes (death) much
more often than they produce visibly different degrees of decline — the same
kind of phase transition Conway's Life shows at its own birth/survival
boundaries. The extremes were still deliberately softened during tuning (see
the comment in `ontology.js`) to push that cliff as far down the slider as
practical, but it could not be eliminated without changing the core rule
mechanics.

**Momentum Bias** (Isotropic ↔ Directional) — modulates `leakConcentration`
(the softmax sharpness controlling how concentrated energy leakage is onto a
single best-aligned neighbor vs. spread across all six) and
`momentumSmoothing` (how quickly a cell's momentum updates toward its
neighbors' average). Verified with a dedicated engine stat,
`leakDirectionality` (leak-magnitude-weighted average concentration, distinct
from the whole-field `momentumCoherence` stat — the two respond to different
things and are not interchangeable; see the comment in `engine.js`), which
rises from ~0.4 to ~0.88 across the slider's range on Crystal Bloom.

Both sliders lerp **through the preset's own authored value at the 0.5
midpoint** to a fixed absolute extreme at each end (`lerpThroughBase` in
`ontology.js`), rather than nudging relative to the preset's value by a fixed
delta. This means "Isotropic" and "Fragile" mean the same real thing on every
preset — a design choice made after an earlier relative-delta version proved
non-monotonic and preset-dependent in its practical range (see conversation
history / `ontology.js` comments for the before/after sweep numbers).

## Cognitive scaffolding UI

**Field Balance meters** (three bars: Density, Energy, Momentum): read
directly from `engine.lastStats` each frame.
- Density: `totalDensity / n`, 0–1.
- Energy: `(totalEnergy/n - energyMin) / (energyMax - energyMin)`, 0–1 (the
  raw signed average is also shown as text since the bar alone can't convey
  sign).
- Momentum: `momentumCoherence`, 0–1 — the magnitude of the density-weighted
  average momentum vector. This is deliberately a *coherence* measure, not a
  raw magnitude (every cell's momentum vector is unit length by construction,
  so summing raw magnitudes would always just track alive-cell count and
  carry no new information). A chaotic, canceling momentum field reads near 0;
  an organized, aligned field reads near 1.

**Resonance indicator**: `engine.lastStats.resonance = 1 - |production -
dissipation| / (production + dissipation)`, where dissipation is
`consumption + decayLoss` (leakage between cells is excluded — it's a
redistribution within the system, not a loss from it). The badge gets a
pulsing amber glow (CSS `@keyframes pulse`) above 0.75. This is the literal
implementation of the intent doc's "resonance detectors will highlight when
production and dissipation are balanced."

**Interaction flow diagram** (`src/flowDiagram.js`, ~300×140px canvas): three
labeled nodes (Density, Energy, Momentum) connected by four animated dashed
arrows, each mapped to a real per-step quantity:
- Density → Energy (production): width/opacity ∝ `totalProduction`.
- Energy → Density (reinforcement): width ∝ `totalDecayLoss` (used as an
  activity proxy; there's no isolated "reinforcement" stat tracked
  separately from the engine's other energy terms).
- Energy → Momentum (leak): width ∝ `totalLeak`; **hue shifts from blue
  (isotropic) to orange (directional)** and dash-animation speed increases,
  both driven by `leakDirectionality` — this is the one arrow that visibly
  responds to the Momentum Bias slider in real time.
- Momentum → Density (birth inheritance): thin, mostly static — there's no
  single scalar in `lastStats` that isolates this effect from the general
  birth process, so it's shown as present but not dynamically scaled.

All dash animation is driven by a monotonically increasing frame counter
(`flowAnimT`), not wall-clock time, so it pauses correctly when the
simulation is paused.

## Preset library (`src/presets.js`)

13 presets: 8 are the original v1 variants renamed to match the intent doc's
suggested vocabulary (Stable Crystal, Pulsing Heart, Drifting Vortex, Sparse
Ember, plus Coral Reef, Storm Field, Spreading Front, Fault Line), each at
neutral sliders (0.5, 0.5) — same behavior as v1, new names only. The other 5
were found by `scripts/discover.mjs`, a guided sweep over the two ontology
axes (not raw parameters) crossed with 5 base archetypes, scored on spatial
complexity + resonance + growth trend, then individually verified to 1000
generations (`scripts/verify-discoveries.mjs`). All 13 are confirmed
`died: false, exploded: false` at generation 700+ via
`scripts/verify-presets.mjs`, which also re-derives each preset's params
through the exact same `getPresetParams()` path the UI uses — catching any
drift between a preset's written description and what it would actually do if
selected.

Each preset stores an *archetype* (a raw param set) plus a slider position,
not a fully-resolved param object — selecting a preset in the UI also moves
the two sliders to its authored position, so there's no hidden state a slider
can't reach, and users can immediately see (and change) where a preset sits on
both axes.

## Known limitations / honest gaps

- The interaction-flow diagram's "reinforcement" and "birth inheritance"
  arrows are illustrative (structurally present, visually distinct) rather
  than driven by dedicated per-step statistics the way production/leak are —
  a genuine simplification, noted here rather than overclaimed.
- Survival Pressure's fragile half remains a sharp transition rather than a
  smooth gradient (see above) — documented as an emergent property of the
  underlying threshold-based CA rule, not something the ontology layer can
  fully smooth away without changing the rule itself.
- GIF capture (`scripts/generate-gifs-v2.mjs`) samples every 8th simulated
  frame at a 96-color palette; file sizes range 700KB–3MB per preset. Denser,
  fast-changing patterns (Stable Crystal) compress far worse than sparse ones
  (Resonant Bloom) for the same reason noted in the v1 report: `gifenc`
  quantizes/encodes each frame independently with no inter-frame delta.

---

## v3 — 3D viewer (`viewer3d.html`, `src/three/`)

Added 2026-08-13. The 2D view mixes all three fields into one flat hex mosaic
plus small overlay affordances (arrows, glow, a 2-node-per-edge flow diagram).
It's legible, but there's no view where you can look at *only* the momentum
field, or watch energy visibly flow from one layer into another in 3D space.
`viewer3d.html` addresses that directly: each field gets its own physical
layer stacked in 3D, and the connections between layers are real geometry you
can orbit around, not an abstracted 2D diagram.

**Reuses, unchanged:** `src/engine.js`, `src/ontology.js`, `src/presets.js` —
the 3D viewer is a second renderer over the same simulation, not a fork of it.
Switching a preset or dragging Survival Pressure / Momentum Bias behaves
identically to the 2D view because it's the literal same `Engine` and the same
`getPresetParams()` call path.

### Layer stacking

Three `THREE.Group`s stacked along world Y, all sharing the same XZ hex
layout (`computeLayout` from `src/render.js`, reused so 3D cell positions are
pixel-identical to the 2D view's, just centered at the origin instead of
canvas-offset):

- **y = 0 — Density.** Each cell is a hex prism (`createHexPrismGeometry`)
  whose *height* is driven by density (`Math.max(0.02, d) * 2.6`) and whose
  color is the same density hue ramp as the 2D layer. Extrusion height is the
  one piece of information the 2D view cannot show at all — in 3D, "how much
  material is here" is literally how tall the column is, not just how bright
  its color is.
- **y = 2.2 — Energy.** Each cell is a small icosahedron whose *radius* is
  driven by `|energy|` and color/warmth by its sign (same amber/violet split
  as the 2D glow layer). Near-zero energy collapses to true zero scale (not
  just a small floor) rather than always rendering a faint sphere.
- **y = 4.4 — Momentum.** Each cell is an arrow (shaft + cone,
  `createArrowGeometry`) rotated about Y by `atan2(-momY, momX)` — momentum is
  a 2D field living in the hex XZ-plane, so its arrows lie flat, not pointing
  "up" into the momentum layer.

Each layer has its own visibility checkbox in the panel, so "see each layer
in action separately" is literal: toggle off Density and Energy and only the
momentum arrow field remains on screen.

### Cross-field interaction beams

This is the direct answer to "observe/tune the cross field interactions."
Two `LineSegments` sets connect corresponding cells between adjacent layers,
built from **per-cell** interaction magnitudes — new engine state added
specifically for this (`engine.productionField`, `.reinforcementField`,
`.leakOutField`, populated every step alongside the existing aggregate
`lastStats`, not derived after the fact):

- **Density ↔ Energy beam:** one line per cell, from the top of that cell's
  density prism to its energy orb. Color leans amber when production
  dominates that cell, rose when reinforcement dominates; brightness scales
  with total activity. A cell that's actively feeding energy from its density
  (or being reinforced back) lights up its own vertical connector — you can
  watch specific cells "breathe" as a pattern evolves, not just see an
  aggregate number change in a meter.
- **Energy ↔ Momentum beam:** one line per cell, from energy orb to momentum
  arrow, hue-shifted by that cell's own `leakDirectionality` (isotropic blue
  → directional orange) and brightened by how much energy it's leaking. This
  is the one beam type that visibly responds to the Momentum Bias slider in
  real time and per-cell, rather than as a single aggregate readout.

Both beam sets are individually visible/hideable via the "Interaction beams"
checkbox (both toggle together; the 2D flow diagram's version splits these
out as a separate module if per-beam-type toggling is ever wanted).

### Why unlit materials, not real-time lighting

The first implementation used `MeshStandardMaterial` (real-time PBR lighting,
two directional lights + ambient) for the density and momentum layers.
Profiling in headless Chromium under software rendering (swiftshader, used
because headless Chromium has no real GPU) found this was the dominant cost:
hiding just those two layers took the scene from ~4fps to ~48fps, while the
CPU-side per-cell update loop (matrix composition, color assignment, beam
buffer writes for up to ~2500 cells) profiled independently at ~9ms/frame —
cheap. The bottleneck was GPU-side per-pixel lighting computation, not the JS
update loop.

Both materials were switched to `MeshBasicMaterial` (unlit) — colors are
already fully baked per-instance via `instanceColor`, so no lighting was
adding real information. To keep some sense of 3D form without paying for
live lighting, `hexGeometry.js`'s `bakeTopLitShading()` writes a static
per-vertex brightness attribute at geometry-creation time (top face ~1.0,
side walls ~0.6, derived from each vertex's normal.y) — three.js multiplies
this against `instanceColor` automatically in its built-in vertex color chunk
(`vColor *= color; vColor.rgb *= instanceColor.rgb`), so it's a one-time cost
baked into the geometry, not a per-frame lighting calculation. The energy
layer's icosahedron detail was also reduced (80 → 20 triangles/instance) and
its near-zero-energy floor changed from "always render a small orb" to "true
zero scale," since additive-blended overlapping fragments are the most
expensive thing to rasterize under software rendering and most cells sit at
exactly zero energy for large stretches of a run.

**Honest performance caveat:** even after these fixes, headless/software
rendering in this project's test environment tops out around 10-40fps
depending on scene busyness (energetic-cell count), not the display's actual
achievable rate. This is very likely a ceiling specific to swiftshader's CPU
rasterization (a known-slow software fallback used only because headless
Chromium has no GPU) rather than real hardware — a few thousand
`InstancedMesh` instances of simple unlit geometry is a textbook case modern
GPUs handle at 60fps+ without difficulty, and it could not be fully verified
against real GPU-accelerated hardware from this environment. If a real
browser session shows sustained low framerate, the Grid Size slider (defaults
to 50, capped at 90) is the direct lever — cell count scales with its square.

### What's deliberately not in v3

- **Click-to-seed** (present in the 2D view) isn't implemented in 3D — it
  needs a ray cast onto the density layer's XZ plane through the orbiting
  camera, which is a reasonable follow-up but was out of scope here. The
  panel's "Add Seed Cluster" button seeds at a randomized position near
  center instead.
- **Raw parameter access** (the 2D view's collapsed "Advanced" panel) isn't
  duplicated in 3D — the two ontology sliders plus preset selection are
  considered sufficient for a viewer whose purpose is spatial observation,
  not fine-grained tuning; use the 2D view for raw-parameter work.
