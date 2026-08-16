// Fast metrics-only param sweep (no rendering) to find stable/growing, non-exploding,
// visually complex candidates before committing to final variants.
import { Engine, DEFAULT_PARAMS } from '../src/engine.js';
import { seedCluster, seedAsymmetric, seedRing, seedScattered } from '../src/seeds.js';

const W = 60, H = 60, GENS = 600;

function complexity(engine) {
  // edge-variance proxy: sum of |density diff| between neighboring cells, normalized.
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

function runOne(params, seedFn, label) {
  const engine = new Engine(W, H, params, seedFn);
  const history = [];
  let died = false, exploded = false, diedAt = -1;
  for (let g = 0; g < GENS; g++) {
    engine.step();
    const m = engine.metrics();
    history.push(m.aliveCells);
    if (m.aliveCells === 0 && !died) { died = true; diedAt = g; }
    if (m.aliveCells / engine.n > 0.9) exploded = true;
  }
  const last100 = history.slice(-100);
  const mean = last100.reduce((a, b) => a + b, 0) / last100.length;
  const variance = last100.reduce((a, b) => a + (b - mean) ** 2, 0) / last100.length;
  const first200mean = history.slice(100, 300).reduce((a, b) => a + b, 0) / 200;
  const growthTrend = mean - first200mean;
  const alive600 = history[history.length - 1];
  const comp = complexity(engine);

  return {
    label, died, diedAt, exploded, alive600,
    fracAlive: alive600 / engine.n,
    meanLast100: mean, varLast100: variance, growthTrend, complexity: comp,
  };
}

const seedFns = {
  cluster: (e) => seedCluster(e, Math.floor(W / 2), Math.floor(H / 2), 3),
  asym: (e) => seedAsymmetric(e, Math.floor(W / 2), Math.floor(H / 2)),
  ring: (e) => seedRing(e, Math.floor(W / 2), Math.floor(H / 2), 5),
  scattered: (e) => seedScattered(e, Math.floor(W / 2), Math.floor(H / 2), 25, 8),
};

function paramSet(overrides) {
  return { ...DEFAULT_PARAMS, ...overrides };
}

const candidates = [];
const birthCenters = [1.8, 2.1, 2.4, 2.7, 3.0];
const birthWidths = [0.3, 0.5, 0.8];
const leakRates = [0.08, 0.16, 0.24, 0.35];
const deathDecays = [0.55, 0.72, 0.85];
const energyCouplings = [0.4, 1.0, 1.8];

let id = 0;
for (const bc of birthCenters) {
  for (const bw of birthWidths) {
    for (const leak of leakRates) {
      for (const dd of deathDecays) {
        for (const ec of energyCouplings) {
          if ((id++) % 3 !== 0) continue; // thin the grid for speed
          candidates.push(paramSet({
            birthLow: bc - bw / 2,
            birthHigh: bc + bw / 2,
            surviveLow: bc - bw,
            surviveHigh: bc + bw * 2,
            energyLeakRate: leak,
            deathDecay: dd,
            deadDecay: dd * 0.65,
            energyBirthCoupling: ec,
            surviveDecay: 0.97 + Math.random() * 0.025,
            densityToEnergy: 0.03 + Math.random() * 0.08,
            energyToDensity: 0.01 + Math.random() * 0.03,
            activityCost: 0.4 + Math.random() * 0.8,
            momentumSmoothing: 0.05 + Math.random() * 0.3,
          }));
        }
      }
    }
  }
}

console.log(`Sweeping ${candidates.length} param sets x ${Object.keys(seedFns).length} seeds...`);

const results = [];
const t0 = Date.now();
for (let ci = 0; ci < candidates.length; ci++) {
  for (const [sname, sfn] of Object.entries(seedFns)) {
    const r = runOne(candidates[ci], sfn, `${ci}:${sname}`);
    results.push({ ...r, paramIdx: ci });
  }
  if (ci % 20 === 0) console.log(`  ${ci}/${candidates.length} (${Date.now() - t0}ms)`);
}
console.log(`Done in ${Date.now() - t0}ms, ${results.length} runs`);

// score: alive, not exploded, decent fraction alive, some complexity, prefer growth or stable oscillation
const scored = results
  .filter((r) => !r.died && !r.exploded && r.fracAlive > 0.03 && r.fracAlive < 0.75)
  .map((r) => ({
    ...r,
    score: r.complexity * 40 + Math.min(1, Math.sqrt(r.varLast100) / 30) * 20 + Math.max(0, r.growthTrend) * 0.3 + Math.min(1, r.fracAlive * 3) * 10,
  }))
  .sort((a, b) => b.score - a.score);

console.log('\nTop 25 candidates:');
for (const r of scored.slice(0, 25)) {
  console.log(
    `paramIdx=${r.paramIdx} seed=${r.label.split(':')[1]} score=${r.score.toFixed(2)} ` +
    `alive%=${(r.fracAlive * 100).toFixed(1)} complexity=${r.complexity.toFixed(3)} ` +
    `varLast100=${r.varLast100.toFixed(1)} growth=${r.growthTrend.toFixed(1)}`
  );
}

// dump full param sets for top candidates so they can be hand-picked into variants.js
import { writeFileSync } from 'fs';
const top = scored.slice(0, 25).map((r) => ({ ...r, params: candidates[r.paramIdx] }));
writeFileSync(new URL('./sweep-results.json', import.meta.url), JSON.stringify(top, null, 2));
console.log('\nWrote scripts/sweep-results.json');
