import { readFileSync } from 'fs';
import { Engine } from '../src/engine.js';
import { seedLine, seedSingle } from '../src/seeds.js';

const W = 60, H = 60, GENS = 1000;
const top = JSON.parse(readFileSync(new URL('./sweep-results.json', import.meta.url)));
const byIdx = new Map();
for (const r of top) if (!byIdx.has(r.paramIdx)) byIdx.set(r.paramIdx, r.params);

function run(params, seedFn, label) {
  const engine = new Engine(W, H, params, seedFn);
  const snaps = [];
  for (let g = 0; g < GENS; g++) {
    engine.step();
    if ((g + 1) % 100 === 0) snaps.push(Math.round((engine.metrics().aliveCells / engine.n) * 1000) / 10);
  }
  console.log(`${label}: traj%=[${snaps.join(', ')}]`);
}

for (const idx of [97, 60, 34]) {
  run(byIdx.get(idx), (e) => seedLine(e, 20, 30, 12, 0), `paramIdx=${idx} line`);
}
for (const idx of [143, 24]) {
  run(byIdx.get(idx), (e) => seedSingle(e, 30, 30, 0.9, 0.6), `paramIdx=${idx} single`);
}
