# Multi-Field Hex Automaton

A multi-field cellular automaton on a hexagonal grid: three interacting
fields (density, energy, momentum) with leakage and coupling rules. v1
(2026-08-09) tuned 8 emergent-behavior variants with a flat single-color
renderer and raw-parameter sliders. v2 (2026-08-10) adds a layered 2D
visualization (density / energy glow / momentum arrows / leak particles), an
intuitive two-slider control ontology (Survival Pressure, Momentum Bias) in
place of raw parameters, cognitive-scaffolding UI (field meters, a resonance
indicator, an animated interaction-flow diagram), and a 13-preset library
found via a guided discovery sweep over the ontology axes. v3 (2026-08-13)
adds a 3D viewer: each field as its own physical layer in space, connected by
real geometry showing per-cell interaction strength, orbitable with the mouse.

- `docs/VARIANT_REPORT.md` — v1 rule engine + the original 8 variants
- `docs/VISUALIZATION_STYLE_GUIDE.md` — v2 visual language + control ontology + preset library, and the v3 3D viewer

## Quick start

The demo uses ES modules (and, for the 3D viewer, an import map), so it needs
a static file server — not `file://`:

```bash
npm install
npx serve .          # or: python -m http.server
```

Open the printed URL for **`index.html`** (2D) or **`viewer3d.html`** (3D) —
each links to the other. Both share the same simulation engine, presets, and
ontology sliders; picking a preset or dragging a slider behaves identically
in either view.

**2D (`index.html`):** pick a preset (also moves the Survival Pressure /
Momentum Bias sliders to its authored position); click the grid to drop new
seed clusters. Ontology sliders and the four visual-layer checkboxes update
live, no restart needed. Raw engine parameters are under "Advanced" for
direct tuning.

**3D (`viewer3d.html`):** each field renders as its own stacked layer —
density as extruded hex height, energy as glowing orbs, momentum as oriented
arrows — connected by beams whose color/brightness track real per-cell
production, reinforcement, and leak magnitudes. Drag to orbit, scroll to
zoom, toggle any layer (or the interaction beams) independently. Same preset
list and ontology sliders as the 2D view; no raw-parameter panel here by
design — use 2D for that.

## Regenerating GIFs / re-running the sweeps

```bash
# v1 (raw-parameter sweep, original 8 variants)
node scripts/sweep.mjs                 # headless param sweep -> scripts/sweep-results.json
node scripts/verify.mjs                # 1500-gen stability check on top sweep candidates
node scripts/verify-line.mjs           # line/single-cell seed checks
node scripts/generate-gifs.mjs         # renders all 8 variants -> gifs/*.gif + gifs/summary.json

# v2 (ontology-guided discovery sweep, 13-preset library)
node scripts/regress-presets.mjs       # confirm v1 variants still survive after the engine change
node scripts/discover.mjs              # sweep Survival Pressure x Momentum Bias x archetypes
node scripts/verify-discoveries.mjs    # 1000-gen stability check on discovery-sweep winners
node scripts/verify-presets.mjs        # confirm all 13 presets.js entries survive end-to-end
node scripts/generate-gifs-v2.mjs      # renders showcase presets with full v2 layers -> gifs-v2/

# v3 (3D viewer regression check — needs a static server running on :4175 first)
node scripts/smoke-test-3d.mjs         # headless Chromium + software-GL: preset/slider/layer smoke test
```

## Layout

```
src/engine.js         CA engine: hex grid, fields, rules, leak-direction softmax, per-cell
                       interaction fields (productionField/reinforcementField/leakOutField), lastStats
src/ontology.js        Survival Pressure / Momentum Bias -> raw param transforms
src/presets.js         the 13-preset library (archetype + slider position + description)
src/variants.js        the original 8 v1 variants (raw params) — presets.js archetypes pull from here
src/render.js           layered 2D hex rendering: density, energy glow, momentum arrows
src/particles.js       leak-flow particle system (2D)
src/flowDiagram.js      animated interaction-flow diagram (2D, density/energy/momentum nodes)
src/seeds.js           seed placement helpers (single/cluster/line/ring/asymmetric)
src/three/hexGeometry.js  hex prism / arrow / energy-orb geometry builders + baked top-lit shading
src/three/viewer3d.js     3D scene: stacked InstancedMesh layers + cross-field interaction beams
index.html              interactive 2D browser demo
viewer3d.html            interactive 3D browser demo
scripts/                headless sweep, discovery, verification, and GIF-capture tooling
gifs/                    v1 GIFs (one per original variant) + summary.json
gifs-v2/                 v2 GIFs (layered rendering, showcase presets) + summary.json
docs/VARIANT_REPORT.md               v1 write-up
docs/VISUALIZATION_STYLE_GUIDE.md    v2 + v3 write-up
```
