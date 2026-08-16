// Eight hand-picked variants, selected from a 180-param x 4-seed headless sweep (600 gens)
// then verified individually out to 1000-1500 generations for stability (scripts/sweep.mjs,
// scripts/verify.mjs, scripts/verify-line.mjs). All entries below survive 500+ generations
// without dying (aliveCells -> 0) or exploding (aliveCells/n > 0.9).
import { seedCluster, seedAsymmetric, seedRing, seedLine } from './seeds.js';

function center(engine) {
  return [Math.floor(engine.width / 2), Math.floor(engine.height / 2)];
}

export const VARIANTS = [
  {
    id: 'crystal-bloom',
    name: 'Crystal Bloom',
    description: 'Tight birth window + low momentum smoothing. Overshoots to ~61% alive by generation 300, then relaxes and locks into a stable ~58% plateau it holds for the rest of the run — the calmest variant in the set.',
    character: 'stable',
    seedType: 'cluster',
    params: {
      birthLow: 1.4, birthHigh: 2.2, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1, surviveHigh: 3.4, surviveDecay: 0.9919627984782488,
      deathDecay: 0.72, deadDecay: 0.468, energyBirthCoupling: 0.4,
      energyToDensity: 0.028914972420170146, densityToEnergy: 0.10011338991045558,
      activityCost: 0.4765259121684768, energyLeakRate: 0.24, energyDecay: 0.01,
      momentumSmoothing: 0.29267784813471753,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedCluster(engine, cq, cr, 3); },
  },
  {
    id: 'dense-coral',
    name: 'Dense Coral',
    description: 'Wider survive range and stronger density->energy feedback than Crystal Bloom. Grows slowly for 300 generations (26% alive), then bursts to a 67% overshoot by generation 500 before relaxing back to a ~58% dynamic equilibrium — cells keep turning over even though the total count is flat.',
    character: 'stable-dynamic',
    seedType: 'cluster',
    params: {
      birthLow: 1.4, birthHigh: 2.2, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1, surviveHigh: 3.4, surviveDecay: 0.9948351702070414,
      deathDecay: 0.85, deadDecay: 0.5525, energyBirthCoupling: 0.4,
      energyToDensity: 0.03939679421133144, densityToEnergy: 0.06348935369707691,
      activityCost: 0.8805691749676869, energyLeakRate: 0.16, energyDecay: 0.01,
      momentumSmoothing: 0.06251759814157301,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedCluster(engine, cq, cr, 3); },
  },
  {
    id: 'vortex-drift',
    name: 'Vortex Drift',
    description: 'Highest energy leak rate (0.35) of the set, paired with an asymmetric seed that gives the momentum field an initial bias. Energy leakage riding the momentum vector produces visible rotational/drifting flow as it climbs steadily to a ~57% plateau with a late wobble (60% at gen 600, settling to 57%) instead of symmetric growth.',
    character: 'oscillating',
    seedType: 'asymmetric',
    params: {
      birthLow: 1.4, birthHigh: 2.2, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1, surviveHigh: 3.4, surviveDecay: 0.9922780253746146,
      deathDecay: 0.72, deadDecay: 0.468, energyBirthCoupling: 0.4,
      energyToDensity: 0.03544526208899073, densityToEnergy: 0.091722534830772,
      activityCost: 1.138608640798724, energyLeakRate: 0.35, energyDecay: 0.01,
      momentumSmoothing: 0.2794757829972386,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedAsymmetric(engine, cq, cr); },
  },
  {
    id: 'storm-field',
    name: 'Storm Field',
    description: 'Low energy->density reinforcement makes survival marginal, so patches die and reignite constantly. Growth stalls flat at ~11% for 100 generations before breaking out into a slow, uneven climb past 46% — still visibly turbulent and un-plateaued at generation 720.',
    character: 'turbulent',
    seedType: 'cluster',
    params: {
      birthLow: 1.4, birthHigh: 2.2, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1, surviveHigh: 3.4, surviveDecay: 0.9890201074894599,
      deathDecay: 0.72, deadDecay: 0.468, energyBirthCoupling: 0.4,
      energyToDensity: 0.018724271555800205, densityToEnergy: 0.08350720980472182,
      activityCost: 0.7207768946610872, energyLeakRate: 0.16, energyDecay: 0.01,
      momentumSmoothing: 0.2989569534517104,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedCluster(engine, cq, cr, 3); },
  },
  {
    id: 'pulsar',
    name: 'Pulsar',
    description: 'Slow survive-decay (0.987) plus a low energy leak lets energy build up in clusters then dump all at once. Produces a genuine crash-and-regrow pulse: alive fraction spikes to 9% by generation 300, collapses back to 4.5% at generation 400, then climbs again to 17%+ — a real heartbeat, not just noise.',
    character: 'oscillating',
    seedType: 'asymmetric',
    params: {
      birthLow: 1.4, birthHigh: 2.2, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1, surviveHigh: 3.4, surviveDecay: 0.9871915472206304,
      deathDecay: 0.85, deadDecay: 0.5525, energyBirthCoupling: 0.4,
      energyToDensity: 0.02966186756887003, densityToEnergy: 0.08527168240899669,
      activityCost: 0.8590622447211219, energyLeakRate: 0.08, energyDecay: 0.01,
      momentumSmoothing: 0.32093425348067933,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedAsymmetric(engine, cq, cr); },
  },
  {
    id: 'ember-ring',
    name: 'Ember Ring',
    description: 'Narrower, higher birth window (2.3-3.1) than the other variants — closer to a classic Life-like sweet spot. Climbs smoothly and slowly, reaching just ~20% alive by generation 720 and still inching upward: small glowing embers rather than a filled mass.',
    character: 'sparse-stable',
    seedType: 'ring',
    params: {
      birthLow: 2.3, birthHigh: 3.1, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1.9, surviveHigh: 4.3, surviveDecay: 0.9924118685671811,
      deathDecay: 0.85, deadDecay: 0.5525, energyBirthCoupling: 0.4,
      energyToDensity: 0.03286858753127621, densityToEnergy: 0.08419897790805335,
      activityCost: 0.6441716314879229, energyLeakRate: 0.35, energyDecay: 0.01,
      momentumSmoothing: 0.2306878003045254,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedRing(engine, cq, cr, 5); },
  },
  {
    id: 'spreading-front-ring',
    name: 'Spreading Front (Ring)',
    description: 'Still expanding at generation 720 (0.7% -> 19% of the grid and climbing steadily, no plateau in sight) — the clearest textbook "growing" variant in the set. Seeded from a ring so growth advances as an outward wavefront rather than a filled blob.',
    character: 'growing',
    seedType: 'ring',
    params: {
      birthLow: 2, birthHigh: 2.8, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1.6, surviveHigh: 4, surviveDecay: 0.9902587241129286,
      deathDecay: 0.72, deadDecay: 0.468, energyBirthCoupling: 0.4,
      energyToDensity: 0.03578961791529673, densityToEnergy: 0.09182158742202598,
      activityCost: 0.729927867775797, energyLeakRate: 0.08, energyDecay: 0.01,
      momentumSmoothing: 0.34428597594874694,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedRing(engine, cq, cr, 5); },
  },
  {
    id: 'fault-line',
    name: 'Fault Line',
    description: 'Same family as Spreading Front but seeded from a straight 12-cell line instead of a ring. The line nearly dies immediately (0.69% -> 0.59% alive in the first 100 generations, most of it decaying away) before the surviving fragments reignite into an asymmetric growth front, reaching ~9% by generation 720 and still climbing.',
    character: 'growing',
    seedType: 'line',
    params: {
      birthLow: 1.7, birthHigh: 2.5, birthDensity: 0.85, birthEnergyMin: -0.2,
      surviveLow: 1.3, surviveHigh: 3.7, surviveDecay: 0.9933091536117302,
      deathDecay: 0.55, deadDecay: 0.3575, energyBirthCoupling: 0.4,
      energyToDensity: 0.019796965621566586, densityToEnergy: 0.07954212968734978,
      activityCost: 0.680653055335792, energyLeakRate: 0.08, energyDecay: 0.01,
      momentumSmoothing: 0.07302859191867492,
    },
    seed: (engine) => { const [cq, cr] = center(engine); seedLine(engine, cq - 6, cr, 12, 0); },
  },
];

export function getVariant(id) {
  const v = VARIANTS.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown variant: ${id}`);
  return v;
}
