// The v2 preset library (intent doc 2026-08-10): intuitive named starting points,
// each defined as an *archetype* (a raw tuned param set from variants.js) plus a
// position on the two ontology sliders (Survival Pressure, Momentum Bias — see
// src/ontology.js). Selecting a preset also sets the sliders to its authored
// position, so the UI stays honest: there is no hidden state a slider can't reach.
//
// The first 8 are the original variants (docs/VARIANT_REPORT.md) renamed to match
// the intent doc's suggested vocabulary, at neutral sliders (0.5, 0.5) — unchanged
// behavior, new names. The remaining 5 were found by the guided discovery sweep
// (scripts/discover.mjs) exploring the ontology axes rather than raw parameters,
// then individually verified to 1000 generations (scripts/verify-discoveries.mjs).
// All 13 are died=false, exploded=false at generation 1000.
import { seedCluster, seedAsymmetric, seedRing, seedLine } from './seeds.js';
import { applyOntology } from './ontology.js';
import { VARIANTS } from './variants.js';

function center(engine) {
  return [Math.floor(engine.width / 2), Math.floor(engine.height / 2)];
}

function archetypeParams(id) {
  const v = VARIANTS.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown archetype: ${id}`);
  return v.params;
}

const SEED_FNS = {
  cluster: (engine) => { const [cq, cr] = center(engine); seedCluster(engine, cq, cr, 3); },
  asymmetric: (engine) => { const [cq, cr] = center(engine); seedAsymmetric(engine, cq, cr); },
  ring: (engine) => { const [cq, cr] = center(engine); seedRing(engine, cq, cr, 5); },
  line: (engine) => { const [cq, cr] = center(engine); seedLine(engine, cq - 6, cr, 12, 0); },
};

export const PRESETS = [
  {
    id: 'stable-crystal',
    name: 'Stable Crystal',
    archetype: 'crystal-bloom',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'cluster',
    description: 'Overshoots to ~61% alive by generation 300, then locks into a stable ~58% plateau it holds for the rest of the run — the calmest preset in the library. Neutral sliders: this is the archetype unmodified.',
  },
  {
    id: 'coral-reef',
    name: 'Coral Reef',
    archetype: 'dense-coral',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'cluster',
    description: 'Grows slowly for 300 generations, bursts to a 67% overshoot by generation 500, then relaxes to a ~58% dynamic equilibrium — cells keep turning over at the edges even once the total count is flat.',
  },
  {
    id: 'drifting-vortex',
    name: 'Drifting Vortex',
    archetype: 'vortex-drift',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'asymmetric',
    description: 'The highest base energy-leak rate in the library, seeded off-center so momentum has a real direction to work with from the start. Growth visibly pulls and rotates rather than spreading symmetrically.',
  },
  {
    id: 'storm-field',
    name: 'Storm Field',
    archetype: 'storm-field',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'cluster',
    description: 'Marginal survival reinforcement means patches die and reignite constantly. Stalls flat around 11% for 200 generations before breaking into a slow, uneven climb — visibly turbulent, never fully settling.',
  },
  {
    id: 'pulsing-heart',
    name: 'Pulsing Heart',
    archetype: 'pulsar',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'asymmetric',
    description: 'Energy builds up faster than it leaks, then dumps all at once. A genuine crash-and-regrow cycle: spikes toward 9% by generation 300, collapses back near 4-5%, then climbs again — a real heartbeat.',
  },
  {
    id: 'sparse-ember',
    name: 'Sparse Ember',
    archetype: 'ember-ring',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'ring',
    description: 'A narrow, high birth window closer to a classic Life-like sweet spot. Small glowing clusters scattered across mostly-dark grid rather than a filled mass — sustains only a small fraction of the board.',
  },
  {
    id: 'spreading-front',
    name: 'Spreading Front',
    archetype: 'spreading-front-ring',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'ring',
    description: 'The clearest textbook "still growing" preset at neutral sliders: steady, accelerating growth advancing outward from its ring seed as a genuine wavefront, with no plateau in sight by generation 720.',
  },
  {
    id: 'fault-line',
    name: 'Fault Line',
    archetype: 'fault-line',
    survivalPressure: 0.5,
    momentumBias: 0.5,
    seedType: 'line',
    description: 'A straight-line seed that nearly dies on arrival — most of the line decays in the first 100 generations — before surviving fragments reignite into an asymmetric growth front.',
  },

  // --- discovered via scripts/discover.mjs, guided by the ontology axes ---
  {
    id: 'resonant-vortex',
    name: 'Resonant Vortex',
    archetype: 'vortex-drift',
    survivalPressure: 0.6,
    momentumBias: 0.7,
    seedType: 'asymmetric',
    discovered: true,
    description: 'Drifting Vortex pushed toward robust + directional. Climbs to a firm ~58% plateau by generation 500 and holds it, while resonance (production vs. dissipation balance) rises from 0.80 to a sustained 0.90 — a genuinely resonant pattern, not just a stable one.',
  },
  {
    id: 'charged-current',
    name: 'Charged Current',
    archetype: 'storm-field',
    survivalPressure: 0.6,
    momentumBias: 0.9,
    seedType: 'cluster',
    discovered: true,
    description: 'Storm Field tamed by strong directional bias: the same base rules that produced open-ended turbulence at neutral sliders instead concentrate into a directed current and settle into a ~59% plateau with resonance climbing steadily to 0.86-0.87.',
  },
  {
    id: 'resonant-bloom',
    name: 'Resonant Bloom',
    archetype: 'spreading-front-ring',
    survivalPressure: 0.5,
    momentumBias: 0.1,
    seedType: 'ring',
    discovered: true,
    description: 'The strongest resonance-plus-growth combination the discovery sweep found: still expanding at generation 1000 (3% -> 41% and climbing) while sustaining resonance mostly between 0.8 and 1.0 the entire run, briefly touching a perfect 1.00 at generation 400. The flagship "discovered resonant pattern" from the guided sweep.',
  },
  {
    id: 'ember-bloom',
    name: 'Ember Bloom',
    archetype: 'ember-ring',
    survivalPressure: 0.5,
    momentumBias: 0.1,
    seedType: 'ring',
    discovered: true,
    description: 'The starkest transformation in the library: the same Sparse Ember rules, with leak spread isotropically instead of directionally, turn a preset that sustains ~4-7% of the grid into one that grows steadily to a 63% plateau by generation 600 — proof the ontology sliders can flip a preset\'s entire character.',
  },
  {
    id: 'pulse-current',
    name: 'Pulse Current',
    archetype: 'storm-field',
    survivalPressure: 0.5,
    momentumBias: 0.9,
    seedType: 'cluster',
    discovered: true,
    description: 'Storm Field with strong directional bias but neutral survival pressure: climbs unevenly through several surges (27% -> 44% -> 41% -> 62%) with resonance frequently exceeding 0.9 and briefly hitting 0.99 at generation 400 — visibly pulses rather than climbing smoothly.',
  },
  {
    id: 'coral-echo',
    name: 'Coral Echo',
    archetype: 'spreading-front-ring',
    survivalPressure: 0.5,
    momentumBias: 0.1,
    seedType: 'cluster',
    discovered: true,
    description: 'The exact same rules and sliders as Resonant Bloom — only the seed shape changes, from a ring to a small point cluster. That one change produces a completely different early character: a compact, radially-branching, coral-like fractal growing outward from a single origin, with visible internal maze veining. Slow-burning (0.2% alive for 500+ generations before breaking out), so its most striking phase is generations ~100-600, before it grows large enough to self-interfere on the torus and thicken into a filled mass like the project\'s other wavefront presets. An evocation of Langton\'s Arm\'s fractal branching, not its concentric-ring geometry — see docs/LANGTONS_ANT.md for why genuine nested rings did not emerge from any configuration tried.',
  },
];

export function getPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return p;
}

export function getPresetParams(preset, overrides = {}) {
  const base = archetypeParams(preset.archetype);
  const survivalPressure = overrides.survivalPressure ?? preset.survivalPressure;
  const momentumBias = overrides.momentumBias ?? preset.momentumBias;
  return applyOntology(base, { survivalPressure, momentumBias });
}

export function getPresetSeedFn(preset) {
  return SEED_FNS[preset.seedType];
}
