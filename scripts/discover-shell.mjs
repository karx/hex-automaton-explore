// Guided sweep for "shell/lace" visual character in the field engine — an
// evocation of Langton's Arm's fractal shell pattern (docs/LANGTONS_ARM.md)
// using this engine's completely different, continuous mechanics. Scores
// candidates on: concentric-ring structure (radial density profile peaks),
// lacy texture (edge complexity), and thinness (low mean density among alive
// cells — a filled blob isn't "lace"). Grown from a small point-like cluster
// so ring formation is genuinely emergent, not just a leftover ring seed.
import { writeFileSync } from 'fs';
import { Engine } from '../src/engine.js';
import { applyOntology } from '../src/ontology.js';
import { VARIANTS } from '../src/variants.js';
import { seedCluster } from '../src/seeds.js';

const W = 70, H = 70, GENS = 700;
const CENTER = Math.floor(W / 2);

function hexDistance(dq, dr) {
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function radialProfile(engine) {
  const cq = CENTER, cr = CENTER;
  const maxRadius = Math.floor(Math.min(engine.width, engine.height) / 2) - 1;
  const sums = new Float64Array(maxRadius + 1);
  const counts = new Int32Array(maxRadius + 1);
  for (let r = 0; r < engine.height; r++) {
    for (let q = 0; q < engine.width; q++) {
      const d = engine.density[r * engine.width + q];
      let dq = q - cq, dr = r - cr;
      if (dq > engine.width / 2) dq -= engine.width; else if (dq < -engine.width / 2) dq += engine.width;
      if (dr > engine.height / 2) dr -= engine.height; else if (dr < -engine.height / 2) dr += engine.height;
      const dist = Math.round(hexDistance(dq, dr));
      if (dist > maxRadius) continue;
      sums[dist] += d;
      counts[dist]++;
    }
  }
  const profile = new Float64Array(maxRadius + 1);
  for (let i = 0; i <= maxRadius; i++) profile[i] = counts[i] > 0 ? sums[i] / counts[i] : 0;
  return profile;
}

function countRingPeaks(profile) {
  let peaks = 0;
  for (let i = 2; i < profile.length - 2; i++) {
    if (profile[i] > 0.06 && profile[i] > profile[i - 1] && profile[i] > profile[i + 1] && profile[i] >= profile[i - 2] && profile[i] >= profile[i + 2]) {
      peaks++;
    }
  }
  return peaks;
}

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

function runOne(baseParams, survivalPressure, momentumBias) {
  const params = applyOntology(baseParams, { survivalPressure, momentumBias });
  const engine = new Engine(W, H, params, (e) => seedCluster(e, CENTER, CENTER, 2));
  let died = false, exploded = false;
  for (let g = 0; g < GENS; g++) {
    engine.step();
    if (engine.lastStats.aliveCells === 0) died = true;
    if (engine.lastStats.aliveCells / engine.n > 0.9) exploded = true;
  }
  if (died || exploded) return { died, exploded, params };

  const profile = radialProfile(engine);
  const peaks = countRingPeaks(profile);
  const comp = complexity(engine);
  let sumAlive = 0, countAlive = 0;
  for (let i = 0; i < engine.n; i++) {
    if (engine.density[i] > 0.15) { sumAlive += engine.density[i]; countAlive++; }
  }
  const meanAliveDensity = countAlive > 0 ? sumAlive / countAlive : 1;
  const fracAlive = countAlive / engine.n;

  return {
    died, exploded, params, peaks, complexity: comp, meanAliveDensity, fracAlive,
    profile: Array.from(profile).map((v) => +v.toFixed(3)),
  };
}

const ARCHETYPES = ['ember-ring', 'spreading-front-ring', 'storm-field', 'crystal-bloom', 'fault-line'];
const pressures = [0.4, 0.5, 0.6];
const biases = [0.1, 0.3, 0.5, 0.7];

console.log(`Sweeping ${ARCHETYPES.length} archetypes x ${pressures.length} pressures x ${biases.length} biases (point-cluster seed)...`);
const results = [];
const t0 = Date.now();
for (const archId of ARCHETYPES) {
  const base = VARIANTS.find((v) => v.id === archId).params;
  for (const pressure of pressures) {
    for (const bias of biases) {
      const r = runOne(base, pressure, bias);
      results.push({ archetype: archId, pressure, bias, ...r });
    }
  }
  console.log(`  ${archId} done (${Date.now() - t0}ms)`);
}

const scored = results
  .filter((r) => !r.died && !r.exploded && r.fracAlive > 0.03 && r.fracAlive < 0.7)
  .map((r) => ({
    ...r,
    score: r.peaks * 25 + r.complexity * 45 + (1 - r.meanAliveDensity) * 20 + Math.min(1, r.fracAlive * 3) * 10,
  }))
  .sort((a, b) => b.score - a.score);

console.log(`\n${scored.length}/${results.length} candidates survived the filter.\n`);
console.log('Top 15 by shell/lace score:');
for (const r of scored.slice(0, 15)) {
  console.log(
    `${r.archetype.padEnd(22)} p=${r.pressure} b=${r.bias}  score=${r.score.toFixed(2)}  peaks=${r.peaks}  ` +
    `complexity=${r.complexity.toFixed(3)}  meanAliveDensity=${r.meanAliveDensity.toFixed(3)}  alive%=${(r.fracAlive * 100).toFixed(1)}`
  );
}

writeFileSync(new URL('./discover-shell-results.json', import.meta.url), JSON.stringify(scored.slice(0, 15), null, 2));
console.log('\nWrote scripts/discover-shell-results.json');
