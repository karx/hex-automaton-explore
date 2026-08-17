# Physics Terminology Disclaimer

**This is not a physics simulation.** "Density," "Energy," and "Momentum"
are evocative names chosen for an interactive, tunable cellular automaton —
not implementations of the physical quantities those words denote. This
document exists because those names carry real expectations (conservation,
units, F = ma, energy–momentum relations) that this engine does not meet,
and because nobody with physics training reviewed the design before those
names were chosen. Read this alongside `docs/ATTRIBUTE_GLOSSARY.md` (what
each parameter *does*) — this document is about what the names *don't mean*.

## Why this document exists

Every field and metric in this project (`src/engine.js`, `src/formula.js`,
the UI labels in `explorer.html`/`viewer3d.html`/the workbench) was named for what felt
intuitive and visually evocative while building an interactive toy, by
someone without formal physics training, tuned by empirical trial-and-error
(parameter sweeps scored on visual complexity and stability — see
`docs/VARIANT_REPORT.md`, `docs/VISUALIZATION_STYLE_GUIDE.md`) rather than
derived from physical law. That's a legitimate way to build a cellular
automaton. It is not a legitimate way to arrive at terminology that means
what a physicist, engineer, or student would reasonably assume it means.
This is that correction, field by field.

## Density

**Real physics:** mass or charge per unit volume/area — an intensive
quantity with units (kg/m³, C/m², etc.), and a well-defined relationship to
extensive quantities (mass = density × volume).

**This engine:** a dimensionless scalar per cell, clamped to [0, 1], that
means "how alive/present is this cell." It has no units, isn't integrated
against an area to produce a conserved "mass," and its dynamics (birth
windows, decay multipliers) are closer to a population/occupancy fraction —
conceptually nearer to the "alive" state in Conway's Life, generalized to a
continuous value, than to physical density. **This is the least misleading
of the three names** — "density" as "how much stuff is here" is a fair
colloquial use — but it still implies no conservation law, and none is
enforced: total system density can grow, shrink, or plateau depending on
parameters, with nothing analogous to a continuity equation (∂ρ/∂t + ∇·J = 0)
holding it in check.

## Energy

**Real physics:** a conserved scalar (in an isolated system — Noether's
theorem ties this to time-translation symmetry), with well-defined forms
(kinetic ½mv², potential, thermal, etc.), always meaningful only up to a
reference/gauge choice for potential forms, and central to essentially all
of physics' predictive power specifically *because* it's conserved.

**This engine:** a signed scalar per cell, clamped to [`energyMin`,
`energyMax`] = [-1, 3], with a production term (`densityToEnergy * density *
neighborAvg`) that **creates energy from nothing** — it's not drawn down
from any reservoir — and a decay term (`energyDecay * value`, see
`src/engine.js`) that **removes energy from the system every step with
nowhere for it to go.** This is an explicitly open, non-conservative system.
**Total energy is not conserved, is not tracked as a global invariant
anywhere in the code, and there is no dimensional relationship between this
quantity and either density or momentum** (no analog of E = ½mv² or the
relativistic E² = (pc)² + (mc²)²). What this field actually behaves like is
an **activator species in a reaction-diffusion / activator-inhibitor
system** (the same family as Gray-Scott or FitzHugh-Nagumo models) — that
comparison was never checked against the literature during development, so
treat it as a post-hoc observation, not a validated design lineage.

The fact that this quantity can go **negative** is a further tell: physical
energy is bounded below (there's always a ground state) in every
formulation that matters for this kind of system; a negative-capable,
production/decay-driven scalar with no conservation law is a resource or
signal field with an evocative name, not energy.

## Momentum — the most misleading of the three

**Real physics:** momentum = mass × velocity, a vector with **both
direction and magnitude**, conserved in isolated systems (Newton's third law
is exactly a statement about momentum conservation in two-body
interactions), and related to force by **F = dp/dt** — force is defined as
the rate of change of momentum, not an independent thing.

**This engine:** a per-cell 2D vector that is **unconditionally re-normalized
to unit length (or zero) after every single update**
(`src/engine.js`, the `mlen`/normalize block that runs after both the
alive and dead branches). Read that again: **it is mathematically
impossible for this field to ever carry magnitude information.** There is no
mass in this system. There is no velocity, in the sense of "how fast is
this cell's content moving" — the "momentum" field never encodes speed, only
a heading. What this field actually is: a **per-cell orientation/direction
field**, updated by (a) inheriting a density-weighted average of neighbors'
directions at birth, and (b) blending toward that same neighbor average each
step at a rate set by `momentumSmoothing`. That's a **diffusion process on a
circular (angular) domain**, structurally similar to the local-alignment
term in a Vicsek-style flocking model or an XY-model spin field on a
lattice — genuinely interesting families of systems, but neither one is
called "momentum" in the literature that studies them, for exactly the
reason given above: they have no magnitude/inertia component.

**Conservation:** nothing conserves this field's aggregate value. The
`momentumCoherence` metric (`Math.hypot(aggMomX, aggMomY) / aggDensityForMom`,
i.e. the magnitude of the density-weighted average unit vector, normalized
0–1) is structurally similar to a **Kuramoto order parameter** — the
standard measure of phase synchronization in coupled-oscillator physics.
That's a legitimate and, as far as we're aware, previously-unremarked
parallel worth naming — but it was noticed after the fact, not designed
from that literature, and no derivation, citation, or check against the
actual Kuramoto model's dynamics was ever done. Don't read "coherence" here
as a claim of rigor it doesn't have.

## Force — doesn't exist in this system

There is no `force` field, parameter, or variable anywhere in this codebase
(verified: the string "force" does not appear in `src/*.js` in a physics
sense — checked directly before writing this document). There is no F = ma,
no acceleration, no integration of force over time to produce a velocity
change. **If you came looking for how force is modeled here: it isn't.**

What loosely plays a force-*like* role, informally, without being one:

- **`energyBirthCoupling`** shifts the birth/survival *thresholds* based on
  local energy — this changes which density configurations count as
  "in range," which is a modification of the *rule*, not a force acting on
  a *mass*. There's no object being accelerated; there's a decision boundary
  being moved.
- **`leakConcentration`** biases where energy flows based on the momentum
  (direction) field — this is closer to **advection** (transport along a
  velocity/direction field, as in fluid dynamics' advection term u·∇φ) than
  to a force. Advection moves a *quantity*; force changes a *quantity's rate
  of change of momentum*. This system has the former, not the latter.

If a genuinely force-like mechanism were added later — something that
changed the *direction field's rate of change* based on a spatial gradient
of density or energy, the way an actual force would — that would be a real
design addition, not a renaming. It doesn't exist today.

## How density/energy/momentum actually interact here, vs. how they would physically

| Real physics relationship | Exists in this engine? |
|---|---|
| F = dp/dt (force causes momentum change) | No — no force field exists at all |
| p = mv (momentum needs mass and velocity) | No — no mass; momentum has no magnitude |
| E = ½mv² or E² = (pc)² + (mc²)² (energy–momentum relation) | No — energy and momentum are updated by independent, unrelated formulas with no shared dimensional basis |
| Conservation of momentum (isolated system) | No — momentum direction diffuses/blends; nothing sums to a conserved total, and unit-length renormalization actively destroys any magnitude-based conservation even in principle |
| Conservation of energy (isolated system) | No — explicit production (from density) and explicit decay (to nowhere) both exist; the system is open by construction |
| Continuity equation for density (∂ρ/∂t + ∇·J = 0) | No — density changes by birth/survival threshold rules, not by a flux-divergence relationship |

What *does* genuinely connect the three fields is a set of **hand-tuned
coupling coefficients** (`energyBirthCoupling`, `energyToDensity`,
`densityToEnergy`, `leakConcentration`, `momentumSmoothing` —
see `docs/ATTRIBUTE_GLOSSARY.md` for what each one does mechanically). These
are real, meaningful, well-tested-for-*stability* relationships within this
system's own rules. They are not derived from, checked against, or
dimensionally consistent with any physical law. Treat the coupling as "this
knob affects that behavior, empirically, in this specific rule set" — not
as "this is how energy and momentum interact in nature."

## The metrics: `resonance`, `momentumCoherence`, `leakDirectionality`

All three are custom heuristics invented for this project's UI, computed
directly in `src/engine.js`. None of them is a standard, citable physics or
dynamical-systems quantity, despite names chosen to evoke one:

- **`resonance`** = `1 - |production − dissipation| / (production + dissipation)`,
  i.e. how balanced energy production is against consumption+decay this
  step. Real physical resonance is a specific phenomenon: a driven
  oscillator's response amplitude spiking when a driving frequency matches a
  system's natural frequency. **This system has no oscillator equation, no
  natural frequency, and no driving frequency** — there is nothing here for
  resonance, in the physics sense, to happen *to*. What's actually measured
  is closer to a **supply/demand balance** or **steady-state condition**
  than resonance. The name was chosen because "things are humming along in
  balance" felt resonance-adjacent, not because the underlying math matches.
- **`momentumCoherence`** — see the Kuramoto-order-parameter note above.
  Structurally plausible parallel, never formally verified against it.
- **`leakDirectionality`** — a leak-magnitude-weighted average of how
  concentrated each cell's outgoing energy is onto its single best-aligned
  neighbor. This one has no physics namesake at all; it's a bookkeeping
  statistic specific to this engine's own leak mechanism, and is the most
  "honest" of the three metrics in that its name doesn't borrow authority
  from an external field.

## Missing expertise and information gaps — stated plainly

- **No physicist, applied mathematician, or domain expert in reaction-diffusion
  systems, statistical mechanics, or dynamical systems reviewed this design
  at any point.** Everything above was reasoned out after the fact, by
  re-reading the actual code against remembered undergraduate-level physics,
  not verified by anyone with relevant formal training.
- **No dimensional analysis was ever performed.** None of the coupling
  coefficients (`energyBirthCoupling = 0.4`–`1.2` across presets,
  `densityToEnergy`, etc.) have units or a principled derivation for their
  specific values — they were found by parameter sweeps scored on emergent
  visual complexity and survival (`scripts/discover.mjs`,
  `scripts/discover-shell.mjs`), i.e. by what looked good and didn't die or
  explode, not by any first-principles argument.
- **No formal stability, bifurcation, or chaos analysis was done**, despite
  the system visibly exhibiting complex, sensitive-to-initial-conditions
  behavior (see the "rule-tuning difficulties" section of
  `docs/VARIANT_REPORT.md` — most of the parameter sweep's candidates died
  or saturated, and the survivors sit in a narrow band). A dynamical-systems
  approach might characterize that band rigorously (fixed points, Lyapunov
  exponents, basins of attraction); none of that exists here — only
  empirical "this specific set of numbers survived N generations in
  practice."
- **No literature comparison was done** against the actual established
  families this system structurally resembles: reaction-diffusion models
  (Gray-Scott, FitzHugh-Nagumo), coupled-oscillator synchronization
  (Kuramoto), flocking/alignment models (Vicsek), or other multi-field
  cellular automata (Lenia, SmoothLife). Any of these could have informed
  more principled coupling terms, better-understood stability regions, or
  at minimum, more accurate naming. None were consulted.
- **The "hex Langton's Ant" work (`docs/LANGTONS_ANT.md`) is held to a
  different, higher standard than the field engine** — it's deterministic,
  its claims are pinned as regression tests (`scripts/verify-langtons-ant.mjs`),
  and its central finding (no highway on this grid) was verified by direct
  measurement, not assumed. **The field engine has no equivalent rigor.**
  Its presets are validated only for "doesn't die, doesn't explode, looks
  interesting" (`scripts/verify-presets.mjs` — and see
  `docs/TESTING_AND_QA.md` for the additional caveat that this check isn't
  even CI-enforced). Nothing about the field engine's *dynamics* being
  correct, stable in a formal sense, or physically meaningful has ever been
  checked, because there is no physical meaning being claimed to check
  against — but that also means there's no external standard at all
  constraining whether a given tuning choice is "right" beyond "did it
  survive and look good."

## How to talk about this project accurately

- Do: "a multi-field cellular automaton with density, energy, and momentum
  *inspired* fields" / "three coupled fields, loosely named after physical
  quantities for intuition, with their own rules."
- Don't: "a physics simulation," "physically accurate," "models real
  energy/momentum dynamics," or cite F = ma, conservation laws, or
  energy-momentum relations as if they apply here.
- If asked "is the momentum field really momentum?" — no. It's a direction
  field with no magnitude, updated by local averaging. Call it that if
  precision matters.
- If asked "is energy conserved?" — no, by construction (production and
  decay terms both exist with no reservoir/sink relationship between them).
- If someone wants an actually physically-grounded version of this system,
  that's a legitimate and interesting follow-up project, but it would mean
  redesigning the update rules from a real dispersion relation or
  Hamiltonian outward — not renaming what exists today.
