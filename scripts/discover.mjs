// Guided discovery sweep (intent doc section 7): explores the ontology axes
// (Survival Pressure x Momentum Bias) against a handful of base archetypes,
// rather than sweeping raw engine parameters directly. Scores candidates on
// visual richness (spatial complexity), resonance (production/dissipation
// balance), and growth-trend clarity, to surface a few new presets.
import { writeFileSync } from 'fs';
import { Engine } from '../src/engine.js';
import { applyOntology } from '../src/ontology.js';
import { VARIANTS } from '../src/variants.js';
import { seedCluster, seedAsymmetric, seedRing, seedLine } from '../src/seeds.js';

const W = 60, H = 60, GENS = 600;

// A small set of base archetypes to explore around — distinct enough rule families
// that the ontology sliders explore genuinely different neighborhoods of the space.
const ARCHETYPES = [
  { id: 'crystal-bloom', seed: (e) => { const c = Math.floor(W / 2); seedCluster(e, c, c, 3); } },
  { id: 'storm-field', seed: (e) => { const c = Math.floor(W / 2); seedCluster(e, c, c, 3); } },
  { id: 'ember-ring', seed: (e) => { const c = Math.floor(W / 2); seedRing(e, c, c, 5); } },
  { id: 'vortex-drift', seed: (e) => { const c = Math.floor(W / 2); seedAsymmetric(e, c, c); } },
  { id: 'spreading-front-ring', seed: (e) => { const c = Math.floor(W / 2); seedRing(e, c, c, 5); } },
];

function complexity(engine) {
  let edgeSum = 0, edgeCount = 0;
  for (let i = 0; i < engine.n; i++) {
    const d0 = engine.density[i];
    if (d0 < 0.05) continue;
    for (let k = 0; k < 6; k++) {
      const j = engine.neighbors[i * 6 + k];
      edgeSum += Math.abs(d0 - engine.density[j]);
      edgeCount++;
    }
  }
  return edgeCount ? edgeSum / edgeCount : 0;
}

function runOne(baseParams, seedFn, survivalPressure, momentumBias) {
  const params = applyOntology(baseParams, { survivalPressure, momentumBias });
  const engine = new Engine(W, H, params, seedFn);
  const aliveHistory = [];
  const resonanceHistory = [];
  let died = false, exploded = false;
  for (let g = 0; g < GENS; g++) {
    engine.step();
    if (g % 10 === 0) {
      aliveHistory.push(engine.lastStats.aliveCells);
      resonanceHistory.push(engine.lastStats.resonance);
      if (engine.lastStats.aliveCells === 0) died = true;
      if (engine.lastStats.aliveCells / engine.n > 0.9) exploded = true;
    }
  }
  const last10 = aliveHistory.slice(-10);
  const meanAliveLast = last10.reduce((a, b) => a + b, 0) / last10.length;
  const varAliveLast = last10.reduce((a, b) => a + (b - meanAliveLast) ** 2, 0) / last10.length;
  const first20mean = aliveHistory.slice(10, 30).reduce((a, b) => a + b, 0) / 20;
  const growthTrend = meanAliveLast - first20mean;
  const meanResonanceLast = resonanceHistory.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const fracAlive = meanAliveLast / engine.n;
  const comp = complexity(engine);

  return {
    died, exploded, fracAlive, varAliveLast, growthTrend,
    meanResonanceLast, complexity: comp, params,
  };
}

const results = [];
const pressures = [0.3, 0.5, 0.6, 0.75, 0.9];
const biases = [0.1, 0.3, 0.5, 0.7, 0.9];

console.log(`Sweeping ${ARCHETYPES.length} archetypes x ${pressures.length} pressures x ${biases.length} biases...`);
const t0 = Date.now();
let count = 0;
for (const arch of ARCHETYPES) {
  const base = VARIANTS.find((v) => v.id === arch.id).params;
  for (const pressure of pressures) {
    for (const bias of biases) {
      if (pressure === 0.5 && bias === 0.5) continue; // that's just the original preset
      const r = runOne(base, arch.seed, pressure, bias);
      results.push({ archetype: arch.id, pressure, bias, ...r });
      count++;
    }
  }
  console.log(`  ${arch.id} done (${count} total, ${Date.now() - t0}ms)`);
}

const scored = results
  .filter((r) => !r.died && !r.exploded && r.fracAlive > 0.03 && r.fracAlive < 0.85)
  .map((r) => ({
    ...r,
    score: r.complexity * 40 + r.meanResonanceLast * 30 + Math.min(1, Math.sqrt(r.varAliveLast) / 25) * 15 + Math.min(1, Math.max(0, r.growthTrend) / 400) * 15,
  }))
  .sort((a, b) => b.score - a.score);

console.log(`\nDone in ${Date.now() - t0}ms. ${scored.length}/${results.length} candidates survived the filter.\n`);
console.log('Top 20:');
for (const r of scored.slice(0, 20)) {
  console.log(
    `${r.archetype.padEnd(22)} pressure=${r.pressure} bias=${r.bias} score=${r.score.toFixed(2)} ` +
    `alive%=${(r.fracAlive * 100).toFixed(1)} complexity=${r.complexity.toFixed(3)} resonance=${r.meanResonanceLast.toFixed(2)} growth=${r.growthTrend.toFixed(0)}`
  );
}

writeFileSync(new URL('./discover-results.json', import.meta.url), JSON.stringify(scored.slice(0, 30), null, 2));
console.log('\nWrote scripts/discover-results.json');
