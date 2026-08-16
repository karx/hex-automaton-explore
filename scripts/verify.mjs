// Longer-horizon check (1500 gens) on top sweep candidates to rule out slow-motion explosions
// or late collapses that a 600-gen window wouldn't catch.
import { readFileSync, writeFileSync } from 'fs';
import { Engine } from '../src/engine.js';
import { seedCluster, seedAsymmetric, seedRing, seedScattered } from '../src/seeds.js';

const W = 60, H = 60, GENS = 1500;
const seedFns = {
  cluster: (e) => seedCluster(e, 30, 30, 3),
  asym: (e) => seedAsymmetric(e, 30, 30),
  ring: (e) => seedRing(e, 30, 30, 5),
  scattered: (e) => seedScattered(e, 30, 30, 25, 8),
};

const top = JSON.parse(readFileSync(new URL('./sweep-results.json', import.meta.url)));
// dedupe by paramIdx, keep highest-scored seed choice, then keep top 12 distinct paramIdx
const seen = new Map();
for (const r of top) {
  if (!seen.has(r.paramIdx) || seen.get(r.paramIdx).score < r.score) seen.set(r.paramIdx, r);
}
const distinct = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 14);

const report = [];
for (const cand of distinct) {
  const seedName = cand.label.split(':')[1];
  const engine = new Engine(W, H, cand.params, seedFns[seedName]);
  const snapshots = [];
  let died = false, exploded = false;
  for (let g = 0; g < GENS; g++) {
    engine.step();
    if ((g + 1) % 100 === 0) {
      const m = engine.metrics();
      snapshots.push(Math.round((m.aliveCells / engine.n) * 1000) / 10);
      if (m.aliveCells === 0) died = true;
      if (m.aliveCells / engine.n > 0.92) exploded = true;
    }
  }
  report.push({ paramIdx: cand.paramIdx, seed: seedName, died, exploded, trajectory: snapshots });
  console.log(`paramIdx=${cand.paramIdx} seed=${seedName} died=${died} exploded=${exploded} traj%=[${snapshots.join(', ')}]`);
}

writeFileSync(new URL('./verify-results.json', import.meta.url), JSON.stringify(report, null, 2));
