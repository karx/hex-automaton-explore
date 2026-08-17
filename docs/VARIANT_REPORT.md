# Multi-Field Hex Automaton — Variant Report

Built against the Aug 9, 2026 intent doc: a multi-field cellular automaton on a
non-square grid, with three interacting fields (density, energy, momentum),
producing emergent, self-sustaining growth on a hex grid.

- **Live demo:** `explorer.html` (classic 2D) or `/` (landing). Open via a static file server, not `file://` — it uses ES modules.
- **Engine:** `src/engine.js` — grid, fields, rule/leakage/coupling logic
- **Rendering:** `src/render.js` — shared by the browser demo and headless GIF capture
- **Variant definitions:** `src/variants.js`
- **GIFs:** `gifs/*.gif` (one per variant, `gifs/summary.json` has the raw metrics)

## Architecture summary

- **Grid:** axial coordinates `(q, r)` on a hex torus — both axes wrap, so there
  are no edge effects to artificially kill or reflect patterns. Neighbor lookups
  are precomputed once into a flat `Int32Array` (`n * 6` entries) for speed.
- **Fields per cell:** `density` (0–1), `energy` (roughly −1..3, coupling-dependent),
  `momentum` (a 2D unit vector). All four field arrays are `Float32Array`s of
  length `width * height`; a double-buffered step avoids read-after-write hazards.
- **Rule engine, one `step()`:**
  1. **Leakage pass** — every cell with positive energy pushes a fraction of it
     to whichever of its 6 neighbors is closest (by dot product) to its momentum
     vector. This is what makes energy (and therefore growth) drift directionally
     instead of diffusing symmetrically.
  2. **Update pass** — for each cell, sum neighbor density (the classic
     birth/survival signal), compute a density-weighted average of neighbor
     momentum (new cells inherit their parents' direction), then apply:
     - **Birth:** dead cells become alive if neighbor density sits in the
       `[birthLow, birthHigh]` window *and* local energy exceeds `birthEnergyMin`.
     - **Survival:** live cells decay unless neighbor density is in
       `[surviveLow, surviveHigh]`, in which case energy reinforces them.
     - **Coupling:** positive local energy widens/lowers the birth window
       (`energyBirthCoupling`) — this is the field's only nonlinearity beyond
       the density-density interaction itself.
     - **Energy:** produced by dense clusters (`densityToEnergy`), consumed by
       activity/change (`activityCost`), and lost to the leakage pass and a
       flat decay.

Adding a fourth field is a matter of adding another `Float32Array` pair
(current/next) and reading/writing it inside the existing update-pass loop —
the leakage-pass pattern generalizes to any field you want to move along the
momentum vector.

## The 8 variants

All eight were selected from a **180-parameter-set × 4-seed-type headless
sweep** (`scripts/sweep.mjs`, 600 generations each, no rendering — scored on
survival, spatial complexity, and growth trend), then individually verified
to **1000–1500 generations** (`scripts/verify.mjs`, `scripts/verify-line.mjs`)
to rule out slow-motion explosions or late collapses a short window would
miss. The GIFs below are a *second*, independent run (fresh random seed
jitter, 70×70 grid instead of the 60×60 sweep grid) captured at 720
generations — see the note on finite-size sensitivity below for why the
numbers differ slightly from the sweep.

All eight: **`died: false`, `exploded: false`** at generation 720. None were cherry-picked after the fact — these are the actual numbers from `gifs/summary.json`.

| Variant | Seed type | Alive % @ gen 0→100→300→500→720 | Character |
|---|---|---|---|
| [Crystal Bloom](../gifs/crystal-bloom.gif) | cluster | 0.8 → 16.9 → 61.1 → 58.5 → 58.3 | stable plateau |
| [Dense Coral](../gifs/dense-coral.gif) | cluster | 0.8 → 4.8 → 26.1 → 66.9 → 58.5 | overshoot → equilibrium |
| [Vortex Drift](../gifs/vortex-drift.gif) | asymmetric | 0.7 → 5.5 → 33.2 → 53.7 → 57.4 | drifting, momentum-biased |
| [Storm Field](../gifs/storm-field.gif) | cluster | 0.8 → 3.1 → 11.2 → 26.0 → 46.0 | turbulent, still climbing |
| [Pulsar](../gifs/pulsar.gif) | asymmetric | 0.7 → 1.3 → 9.2 → 7.1 → 17.3 | crash-and-regrow pulse |
| [Ember Ring](../gifs/ember-ring.gif) | ring | 0.7 → 2.1 → 9.1 → 15.8 → 20.4 | sparse, slow glow |
| [Spreading Front (Ring)](../gifs/spreading-front-ring.gif) | ring | 0.7 → 2.4 → 6.5 → 12.5 → 18.9 | textbook growing front |
| [Fault Line](../gifs/fault-line.gif) | line | 0.7 → 0.6 → 2.0 → 4.1 → 8.9 | near-death, then recovers |

### Crystal Bloom
**Rules:** tight birth window (1.4–2.2), moderate momentum smoothing (0.29), 24% energy leak.
**Seed:** a radius-3 cluster at grid center.
**Behavior:** the fastest-converging variant — overshoots to 61% alive by generation 300, then relaxes to a tight ~58% plateau it holds without further drama. Visually the calmest and most crystal-lattice-like of the set: sharp, faceted domains with almost no flicker once settled.
**Why interesting:** demonstrates the "stable" end of the spectrum cleanly — useful as a baseline to compare the others against.

### Dense Coral
**Rules:** same birth window as Crystal Bloom but a much slower `surviveDecay` (0.995 vs 0.992) and double the density→energy gain.
**Seed:** radius-3 cluster, same placement.
**Behavior:** grows much more slowly at first (only 26% alive by generation 300, half of Crystal Bloom's pace at the same point), then breaks out into a sharp overshoot to 67% by generation 500 before relaxing back to ~58%. Even after the count stabilizes, individual cells keep dying and rebirthing at the edges — a dynamic equilibrium, not a frozen one.
**Why interesting:** shows that two very similar rule sets (same birth logic) can produce completely different growth *timing* — slow burn vs fast crystallization — purely from the survival/energy knobs.

### Vortex Drift
**Rules:** the highest energy leak rate in the set (0.35) plus high momentum smoothing (0.28).
**Seed:** the asymmetric blob (a cluster with two trailing arms) — deliberately non-radially-symmetric so the momentum field starts with a real direction to work with.
**Behavior:** steady climb to a ~57% plateau with a late wobble (59.6% at generation 600 settling back to 57.4%). Because leaked energy is biased toward each cell's momentum direction, growth visibly pulls in a drifting, rotational way instead of spreading as a uniform ring — the one variant where the momentum field's effect is easiest to see by eye.
**Why interesting:** the clearest demonstration of the momentum field's job description from the spec ("creates directional flow and rotating structures").

### Storm Field
**Rules:** same birth/survive windows as Crystal Bloom, but density→energy reinforcement (`energyToDensity`) cut to less than half — survival stays marginal even in dense regions.
**Seed:** radius-3 cluster.
**Behavior:** stalls flat around 11% alive for 200 generations (patches keep dying almost as fast as they're born), then breaks out into an uneven, still-climbing 46% by generation 720. Never plateaus in the observed window — visibly the noisiest, most flickering variant.
**Why interesting:** the closest the sweep found to "interesting chaos" without tipping into total die-off — a useful example of how thin the margin between "turbulent" and "dead" is (see Tuning Difficulties below).

### Pulsar
**Rules:** the slowest `surviveDecay` (0.987) combined with a low energy leak (0.08) — energy accumulates in place instead of dissipating.
**Seed:** asymmetric blob.
**Behavior:** a genuine crash-and-regrow cycle, not just noise — alive fraction spikes to 9.2% by generation 300, collapses to 4.5% by generation 400 (more than halved in 100 generations), then climbs back to 17%+ by generation 720. This is energy building up until it overshoots the birth/survival balance, dumping, and restarting — a real pulse driven by the field coupling, not a rendering artifact.
**Why interesting:** the only variant with a visible full boom-bust cycle inside the captured window; a longer run would be worth capturing to see if the pulse period is regular.

### Ember Ring
**Rules:** the narrowest, highest birth window in the set (2.3–3.1, vs 1.4–2.2 for most others) — closer to a classic Life-like "exactly a few neighbors" sweet spot.
**Seed:** a radius-5 ring.
**Behavior:** smooth, slow, monotonic growth — no overshoot, no crash — reaching only ~20% alive by generation 720 and still inching up. Visually sparse: small glowing clusters scattered across mostly-dark grid rather than a filled mass.
**Why interesting:** shows the birth-window position matters more than its width for overall density — a narrow-but-high window (2.3–3.1) sustains far less coverage than a narrow-but-low one (1.4–2.2, as in Crystal Bloom), because far fewer neighborhoods ever reach 2.3+ total density.

### Spreading Front (Ring)
**Rules:** birth window 2.0–2.8, slower activity cost than Ember Ring.
**Seed:** radius-5 ring.
**Behavior:** the cleanest textbook "growing pattern lasting 500+ generations" in the set — smooth, steady, still-accelerating growth (0.7% → 18.9% with no sign of leveling off at generation 720) advancing outward from the ring as a genuine wavefront rather than filling in from the center.
**Why interesting:** directly answers the spec's primary success metric (a pattern that's still growing, not just stable, past 500 generations) with the clearest visual read of the eight.

### Fault Line
**Rules:** same family as Spreading Front, seeded differently to test the "line" seed category from the testing protocol.
**Seed:** a straight 12-cell line.
**Behavior:** the line very nearly dies on arrival — alive fraction actually *drops* from 0.69% to 0.59% in the first 100 generations as most of the line decays (a straight line gives each cell too few in-range neighbors to reliably trigger births). The handful of surviving fragments then reignite into an asymmetric growth front, climbing to ~9% by generation 720 and still rising.
**Why interesting:** a real near-failure that recovered — valuable evidence for the seed-shape testing protocol in the spec (single cells and lines are much more fragile starting conditions than clusters or rings; see below).

## Seed-type testing notes (spec section 6)

Beyond the 8 showcase variants, single-cell and straight-line seeds were
tested directly against several rule sets (`scripts/verify-line.mjs`):

- **Single cells always died within ~30 generations**, across every rule set
  tested. A lone cell has zero live neighbors, so neighbor-density sum is 0 —
  below every `surviveLow` threshold in the sweep — and it just decays away
  under `deathDecay`. This is a direct hex-grid analogue of underpopulation
  in Conway's Life, and it means single-cell seeds are not viable starting
  conditions for *any* of these rule families; a minimum seed mass (line,
  cluster, or ring) is required to get past the first ~30 generations.
- **Line seeds are seed-shape-sensitive**: the same line seed died completely
  under one rule set (`paramIdx=97`, the Spreading Front params) while
  surviving and growing under a very similar one (`paramIdx=60`, the Fault
  Line params) — a straight line's neighbor-density geometry sits right at
  the edge of several birth windows, so small parameter differences flip the
  outcome from total death to sustained growth.

## Performance notes

- **Simulation:** ~26M cell-updates/generation-equivalent workload for a
  60×60 grid over 600 generations ran in well under a second in Node; the
  70×70/720-generation runs used for the final GIFs took 1.2–8.7s each
  (`gifs/summary.json`, `tookMs`), dominated by rendering + GIF encoding, not
  the simulation step itself. The 2D explorer holds 60 FPS on a 70×70
  grid with headroom to spare — the bottleneck at interactive scale is
  `renderFrame`'s per-cell hexagon path, not `Engine.step()`.
- **GIF generation was the actual bottleneck the spec's risk section
  predicted.** The first pass (70×70 grid, 6px cells, 256-color palette, 140
  frames) produced GIFs from **1.7 MB to 18.2 MB** — completely impractical
  to ship 8 of. Cutting cell size 6px→3px, frame count 140→80, and palette
  256→64 colors brought the worst case down to 3.2 MB (`gifs/summary.json`
  has the final sizes: 317 KB–3.15 MB). The remaining cost is structural:
  `gifenc` quantizes and LZW-encodes each frame independently with no
  inter-frame delta, so a busy, fast-changing pattern (a filled hex mosaic
  changing most of its pixels every frame) compresses far worse than a
  sparse one — compare Fault Line (317 KB, mostly empty grid) to Crystal
  Bloom (3.15 MB, mostly full grid) at identical frame/palette settings. A
  worthwhile future optimization is dirty-region/delta frame encoding.

## Rule-tuning difficulties encountered

- **The birth/survival margin is thin.** In the 180-set sweep, most parameter
  combinations either died out before generation 200 or saturated past 90%
  alive ("boring stasis") — only ~50 of 720 (param × seed) runs survived
  the sweep's own die/explode filter, and of those, far fewer showed real
  spatial complexity rather than a uniform blob. The final 8 variants sit in
  a genuinely narrow band of the parameter space.
- **Finite grid size measurably changes outcomes.** The same Pulsar
  parameter set, run on a 60×60 torus (sweep/verify phase) settled around
  51–65% alive; run on a 70×70 torus with a fresh random seed (final GIF
  capture) it instead spiked to 9% and crashed to 4.5% before slowly
  recovering to 17%. Both runs are legitimately "alive, not exploded" — but
  the *qualitative* behavior (steady plateau vs. boom-bust pulse) depended on
  grid size and initial random jitter, not just the rule parameters. Any
  serious parameter search for this rule family needs to test each candidate
  on at least two grid sizes before trusting its classification.
- **`Math.random()` in seed placement means every run is a fresh draw** —
  `seedCluster`/`seedAsymmetric` jitter initial density per cell. This is
  good for demonstrating robustness (a variant that only works from one
  exact seed isn't really stable) but it also means the specific numbers in
  this report describe *one* representative run each, not a guaranteed
  trajectory. Re-running `scripts/generate-gifs.mjs` will reproduce similar
  but not identical curves.

## Suggested future fields / extensions

- **Age field:** cells older than N generations become harder to kill (or
  easier — either direction is a one-line addition to the survival branch),
  which would let structures "mature" into different visual states.
- **Memory field:** store the density value from K generations ago per cell;
  couple it into the birth condition so terrain "remembers" where it's been
  alive before — likely to produce trail/scar patterns behind moving fronts.
- **Charge field with repulsion:** a signed field where same-sign neighbors
  suppress each other's birth threshold — would let two growing fronts
  visibly compete for territory instead of just merging.
- **User-defined fields via a small DSL:** the engine already isolates all
  per-field logic inside `Engine.step()`'s single per-cell loop; the natural
  next step is to make that loop data-driven (an array of `{read, write}`
  field-update functions) so new fields don't require editing `engine.js`
  itself.
- **3D projection / interactive gallery:** out of scope for this pass but
  straightforward given `render.js` already separates layout math from
  drawing — a WebGL hex-prism renderer could reuse the same `Engine` output.
