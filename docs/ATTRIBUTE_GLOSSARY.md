# Attribute Glossary — The Mental Model

Added 2026-08-16, alongside rule-kit export/import and the Rule Set Formula
view. This is the answer to "what am I actually controlling, and what does
turning it do?" — every raw engine parameter, plus the two ontology sliders,
explained in plain language with a mental model attached, not just a symbol
and a range.

**Source of truth:** `src/paramMeta.js` holds the same descriptions in code
(feeds the Advanced-panel tooltips and the Rule Set Formula view). This
document is the expanded, narrative companion — if the two ever disagree,
`paramMeta.js` is authoritative for what the engine actually does; open an
issue against this doc.

## The three fields, in one sentence each

- **Density** (0–1 per cell): how much "material" is here. This is the only
  field you can see directly as filled hexes in the 2D view or column height
  in 3D — the other two fields exist to push density around.
- **Energy** (roughly −1 to 3 per cell): a local resource, produced by dense
  clusters and spent on change. High energy makes birth and survival easier;
  it's the engine's only real feedback loop.
- **Momentum** (a unit vector per cell, always length 1 or 0): a direction,
  not a magnitude. It doesn't push density around directly — it biases which
  neighbor energy leaks toward, which is how directional flow emerges from a
  field that otherwise has no concept of "left" or "right."

If you only remember one relationship: **density is the thing you watch,
energy is what makes it grow faster than the base rules alone would, and
momentum is what makes that growth lean in a direction.**

## How a cell decides what happens to it, each step

Every parameter below plugs into one of these four decisions. Read this
section once and the individual glossary entries will make more sense in
context — this is also exactly what the Rule Set Formula view (`index.html`
→ "Rule set formula") prints with your current numbers substituted in.

1. **Is this cell dead or alive?** (`density > aliveThreshold`)
2. **If dead:** sum this cell's 6 neighbors' density. Is that sum inside a
   window? If yes (and local energy clears a floor), the cell is born.
3. **If alive:** sum the neighbors again. Inside a (different, wider) window
   means the cell is reinforced; outside means it decays.
4. **Energy and momentum update alongside density**, using the density value
   from *before* this step's changes — production/consumption/leak all
   happen off the same snapshot, so nothing double-counts a change that
   hasn't happened yet.

The birth window and the survival window are **two separate windows** with
independent low/high bounds — this is why a preset can have (for example) a
narrow birth window but a wide survival window: easy to keep going, hard to
start.

---

## Birth (dead → alive)

| Param | Mental model |
|---|---|
| `birthLow` / `birthHigh` | The "just right" range of neighbor crowding a dead cell needs to spark to life — too few neighbors and there's nothing to grow from, too many and the classic overcrowding-prevents-birth rule (same spirit as Conway's Life) kicks in. **Narrower window = more particular about exactly how crowded a spot needs to be** → sparser, more deliberate growth (Sparse Ember: `[2.3, 3.1]`, a narrow high window). **Wider window = easier to satisfy** → denser, faster-filling growth (Stable Crystal: `[1.4, 2.2]`, still narrow but centered lower — most presets in this library use a similar low-centered window; it's the *position*, not just the width, that decides how much of the grid can eventually fill in). |
| `birthDensity` | How "born" a newly-alive cell starts out. Not just a flat number — it's scaled 0.6–1.0 by how close the neighbor count was to the window's center, so a marginal birth starts fainter than a perfectly-centered one. |
| `birthEnergyMin` | A gate, not a dial: if local energy is below this, no birth happens even if the density window is satisfied. Set very negative (default `-0.2`, i.e. allows some energy debt) and it barely matters; push it toward 0 or positive and growth becomes a genuine energy-limited process, not just a density one. |
| `deadDecay` | What happens to a cell that *didn't* get born — if it has any residual density left over from recently dying, this controls how long that afterglow lingers before hitting true zero. Close to 1 → visible trailing "ghosts" behind a moving front. Close to 0 → crisp, immediate death. |
| `energyBirthCoupling` | **The single most important nonlinear knob in the whole engine.** A cell's own positive energy widens its birth window on the fly: `effectiveBirthLow = birthLow − energy×coupling`, `effectiveBirthHigh = birthHigh + energy×coupling×0.6`. At 0, energy has no say over birth at all — growth is pure density geometry. Turned up, an energy-rich patch becomes dramatically easier to grow into, which is the mechanism behind every "hotspot" or "runaway" behavior in this library (compare it across presets: most sit around `0.4`, low by design, because the sweep that found this rule set discovered that higher values tend toward chaotic die-off more often than not — see `docs/VARIANT_REPORT.md`'s "rule-tuning difficulties" section). |

## Survival (already-alive cell)

| Param | Mental model |
|---|---|
| `surviveLow` / `surviveHigh` | The neighbor-crowding range that counts as "sustainable." Below `surviveLow`: too isolated, the cell is starving for neighbors. Above `surviveHigh`: too crowded, the cell is being suffocated. Both ends matter — a preset with a very high `surviveHigh` (Resonant Bloom: `4.0`) tolerates dense interiors; a low one lets dense cores die out from the middle, sometimes carving hollow shapes. |
| `surviveDecay` | The default fate of an in-range alive cell: multiply density by this every step. It's expressed as a number just under 1 (typically `0.985`–`0.995`) because that's what "barely decaying" looks like multiplicatively — `0.99` per step sounds tiny but compounds to roughly halving in ~70 steps if nothing reinforces it. This is *not* the same as being reinforced (see `energyToDensity` below) — a cell can be "successfully surviving" and still be slowly fading unless energy actively pushes back. |
| `deathDecay` | The fate of an *out-of-range* alive cell — no reinforcement applies here, just straight decay. Usually set much lower than `surviveDecay` (0.72 vs 0.99 in most presets here) so that falling out of the survival window has a real, visible consequence rather than fading at the same imperceptible rate as everything else. |
| `energyToDensity` | How directly a cell's own positive energy translates into *more* density, on top of the decay/no-decay split above. This is the engine's other major feedback path (alongside `energyBirthCoupling`): energy doesn't just keep a cell alive, it can actively push density all the way to 1.0 and hold it there. Presets with a high value here (Ember Bloom: `0.036`, comparatively large relative to its sparse base) turn "surviving" into "thriving." |
| `aliveThreshold` | Not exposed as a slider (it's structural, not really a tuning knob) — the density cutoff between "dead, possibly decaying toward zero" and "alive, subject to the survival rules." Fixed at `0.15` across every preset in this library. |

## Energy field

| Param | Mental model |
|---|---|
| `densityToEnergy` | The field's only source: dense, well-supported cells generate energy proportional to their own density times their neighbors' average density. No density, no energy — there is no other way for energy to enter the system except this term (plus whatever a cell starts with at seed time). |
| `activityCost` | Change costs energy. A cell whose density just shifted a lot (growing, dying, being reinforced) burns energy proportional to how much it changed. A perfectly static cell is "free" regardless of this value. Turned up, this tends to calm turbulent patterns down over time (fast change literally starves itself of the energy that was driving it) — it's the closest thing this engine has to a stabilizing negative feedback term. |
| `energyLeakRate` | The fraction of a cell's positive energy sent to neighbors each step. Important: **this redistributes energy, it does not destroy it** — what leaves one cell's account arrives in a neighbor's (see `leakConcentration` for *which* neighbor). A high leak rate spreads hotspots out fast; a low one lets them concentrate and build (this is most of the mechanism behind Pulsing Heart's boom-bust cycle — low leak, energy pools until something gives). |
| `energyDecay` | The field's only true sink — a flat fraction of a cell's current energy (whatever its sign) that simply leaves the system every step. This is what actually limits how much energy can accumulate anywhere, long-term; `energyLeakRate` just moves it around, `energyDecay` is the drain. |
| `energyMin` / `energyMax` | Hard clamps, not tuning knobs in the usual sense (not exposed as sliders) — `[-1, 3]` in every preset here. They exist so a runaway feedback loop (see `energyBirthCoupling`) can't diverge to infinity; without them, a hot enough patch could in principle spiral without bound. |

## Momentum field

| Param | Mental model |
|---|---|
| `momentumSmoothing` | How "sticky" a cell's direction is. Each step, an alive cell's momentum vector blends toward its neighbors' density-weighted average by this fraction. Near 0: a cell keeps pointing roughly where it was born pointing, for a long time — direction is a durable trait. Near 1: direction is constantly renegotiated to match whatever's happening locally right now — momentum becomes a description of the current local flow rather than any individual cell's "memory." |
| `leakConcentration` | How sharply energy leakage picks a single favored neighbor (the one best-aligned with momentum) versus spreading across all 6 roughly evenly. This is the raw parameter the **Momentum Bias** ontology slider drives directly — see below. At 0, momentum is nearly irrelevant to where energy goes (isotropic spread); at 1, energy rides the momentum vector almost like a narrow stream. |

*(New cells don't get a fresh random direction unless there's truly nothing nearby to inherit from — at birth, a cell's momentum starts as the density-weighted average of its neighbors' momentum. This is why a seed's initial shape matters for how directional a pattern becomes: an asymmetric seed hands early cells a real, non-cancelling average direction to inherit; a perfectly symmetric ring's neighbor-momentum tends to average toward zero.)*

---

## The two ontology sliders

The raw parameters above are the actual mechanism, but tuning 20 of them by
hand to get a specific *feel* is not a mental model, it's guesswork. The two
sliders in the main UI (`src/ontology.js`) are a deliberate compression of
that space down to two axes that map onto how the pattern *feels* to watch,
not what the code does internally.

### Survival Pressure — Fragile ↔ Robust

Touches, all at once: `surviveDecay`, `deathDecay`, `deadDecay`, the width of
the survive window, `energyToDensity`, and `birthEnergyMin`. In one sentence:
**how hard is this pattern to kill.** At the fragile end, thin margins mean
patches die easily and a slightly-wrong seed can fail outright. At the robust
end, the survive window is wide and reinforcement is strong — established
patterns become very hard to extinguish, and even normally-fragile presets
(Sparse Ember pushed toward robust) start filling in solidly.

**Known caveat, not a bug:** below the neutral midpoint (0.5), the transition
from "fine" to "totally dead" is a *cliff*, not a gradient — most of a preset's
trajectories collapse to 0% alive somewhere around pressure 0.4–0.45,
regardless of exactly how low you go beneath that. This mirrors the
underlying rule's own nature: birth/survival is a threshold test, not a
continuous function, so "barely fragile" and "very fragile" often produce the
*same* outcome (death) rather than visibly different degrees of struggle —
the same way Conway's Life has no in-between "half-alive" state. The slider's
extremes were deliberately softened during tuning to push that cliff as far
down as practical, but it can't be fully smoothed away without changing the
underlying rule.

### Momentum Bias — Isotropic ↔ Directional

Touches: `leakConcentration` and `momentumSmoothing` together. In one
sentence: **does energy move as a diffuse cloud or a directed stream.** At
the isotropic end, energy spreads outward roughly evenly regardless of any
cell's momentum — growth looks like uniform diffusion. At the directional
end, energy rides each cell's momentum vector almost like a current, and
momentum itself persists longer once established — this is what produces the
visible drift/rotation in presets like Drifting Vortex and Resonant Vortex.

Unlike Survival Pressure, this axis is smooth and monotonic across its full
range — no cliff. The live "leak directionality" metric in both the 2D and 3D
views is a direct, real-time readout of where the slider currently has this
value pointed (as distinct from "momentum coherence," a different metric
measuring whether the *whole field's* directions happen to be aligned, which
responds to more than just this slider — see
`docs/VISUALIZATION_STYLE_GUIDE.md` for the distinction).

**Both sliders are neutral at 0.5** — at that position, a preset behaves
exactly as authored, with zero modification. Values move outward from there
toward a fixed absolute extreme (not a delta relative to the preset), so
"Fragile" and "Isotropic" mean the same real thing no matter which preset is
currently selected.

---

## Reading the Rule Set Formula view

`index.html`'s "Rule set formula" panel (`src/formula.js`) prints the exact
four rules above with your current numbers substituted in — it's generated
from the same live `engine.params` object the simulation is actually
running on, not from the preset's original authored values, so if you've
nudged a raw slider in Advanced, the formula reflects that immediately. Each
line ends with a `(paramName=value)` tag so you can trace every number in the
formula back to the slider that controls it.

## Reading an exported rule kit

`src/ruleKit.js` exports a JSON file with four top-level parts:

- `meta` — name, description, export timestamp, and (if available)
  provenance: which preset/archetype it was derived from and what the
  ontology sliders were set to. This is context, not authoritative — the
  simulation doesn't re-derive anything from it on import.
- `grid` — width/height.
- `params` — the **complete, resolved** parameter set (all 20 values from
  the tables above). This is the actual ground truth; import applies these
  numbers directly, regardless of whether presets.js still has a matching
  archetype in some future version.
- `state` — `null`, or the exact per-cell density/energy/momentum arrays
  plus generation count. Continuing a simulation from imported state
  produces bit-identical results to continuing the original — verified in
  `scripts/verify-rulekit.mjs`.

A rules-only export (no state) is a few KB and is really a portable preset:
sharing it hands someone the exact formula above, but they pick their own
seed. Including state makes the file scale with grid size (roughly 4 numbers
per cell) and lets the recipient resume the precise pattern, mid-growth,
exactly where you left it.

## Quick reference

| Param | Group | Slider range |
|---|---|---|
| `birthLow` | birth | 0–5 |
| `birthHigh` | birth | 0–6 |
| `birthDensity` | birth | 0–1 |
| `birthEnergyMin` | birth | −1–1 |
| `deadDecay` | birth | 0–1 |
| `energyBirthCoupling` | birth | 0–3 |
| `surviveLow` | survival | 0–5 |
| `surviveHigh` | survival | 0–6 |
| `surviveDecay` | survival | 0.9–1 |
| `deathDecay` | survival | 0–1 |
| `energyToDensity` | survival | 0–0.2 |
| `aliveThreshold` | survival | fixed, 0.15 |
| `densityToEnergy` | energy | 0–0.3 |
| `activityCost` | energy | 0–2 |
| `energyLeakRate` | energy | 0–0.6 |
| `energyDecay` | energy | 0–0.1 |
| `energyMin` / `energyMax` | energy | fixed, −1 / 3 |
| `momentumSmoothing` | momentum | 0–1 |
| `leakConcentration` | momentum | 0–1 |

Full detail for each (meaning, higher/lower effect) lives in
`src/paramMeta.js` and surfaces as a hover tooltip on every Advanced slider
in `index.html`.
