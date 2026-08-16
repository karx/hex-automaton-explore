import { Engine } from '../src/engine.js';
import { applyOntology } from '../src/ontology.js';
import { VARIANTS } from '../src/variants.js';
import { seedCluster, seedAsymmetric, seedRing } from '../src/seeds.js';

const W = 60, H = 60, GENS = 1000;
const center = () => Math.floor(W / 2);

const CANDIDATES = [
  { archetype: 'vortex-drift', pressure: 0.6, bias: 0.7, seed: (e) => seedAsymmetric(e, center(), center()) },
  { archetype: 'storm-field', pressure: 0.6, bias: 0.9, seed: (e) => seedCluster(e, center(), center(), 3) },
  { archetype: 'spreading-front-ring', pressure: 0.5, bias: 0.1, seed: (e) => seedRing(e, center(), center(), 5) },
  { archetype: 'ember-ring', pressure: 0.5, bias: 0.1, seed: (e) => seedRing(e, center(), center(), 5) },
  { archetype: 'storm-field', pressure: 0.5, bias: 0.9, seed: (e) => seedCluster(e, center(), center(), 3) },
];

for (const c of CANDIDATES) {
  const base = VARIANTS.find((v) => v.id === c.archetype).params;
  const params = applyOntology(base, { survivalPressure: c.pressure, momentumBias: c.bias });
  const engine = new Engine(W, H, params, c.seed);
  const trail = [];
  let died = false, exploded = false;
  for (let g = 0; g < GENS; g++) {
    engine.step();
    if ((g + 1) % 100 === 0) {
      const frac = engine.lastStats.aliveCells / engine.n;
      trail.push(`${(frac * 100).toFixed(1)}/${engine.lastStats.resonance.toFixed(2)}`);
      if (engine.lastStats.aliveCells === 0) died = true;
      if (frac > 0.92) exploded = true;
    }
  }
  console.log(`${c.archetype} p=${c.pressure} b=${c.bias}: died=${died} exploded=${exploded}`);
  console.log(`  alive%/resonance @100..1000: [${trail.join(', ')}]`);
}
