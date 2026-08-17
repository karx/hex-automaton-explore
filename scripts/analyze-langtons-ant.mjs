// Empirical long-run analysis of the hex-generalized Langton's Ant, rule LR.
// The square-grid version is famous for ~10,000 steps of chaotic growth
// before locking into a diagonal "highway." The hex geometry (6 headings,
// 60-degree turns) is a genuinely different automaton — don't assume it also
// builds a highway, measure it.
import { LangtonsAnt } from '../src/langtonsAnt.js';

function analyze(ruleString, totalSteps, sampleEvery) {
  const ant = new LangtonsAnt(ruleString);
  const samples = [];
  let lastDisp = 0;
  for (let s = 0; s < totalSteps; s++) {
    ant.step();
    if ((s + 1) % sampleEvery === 0) {
      const disp = ant.displacement();
      samples.push({
        step: s + 1,
        displacement: +disp.toFixed(1),
        dispRate: +((disp - lastDisp) / sampleEvery).toFixed(4), // cells of net displacement per step, this window
        visited: ant.visitedCount(),
        bbox: `${ant.maxQ - ant.minQ}x${ant.maxR - ant.minR}`,
      });
      lastDisp = disp;
    }
  }
  return { ruleString, finalSteps: ant.steps, samples, finalDir: ant.dir };
}

console.log('=== Rule LR ===');
const lr = analyze('LR', 2_000_000, 50_000);
for (const s of lr.samples) {
  console.log(`step ${String(s.step).padStart(8)}  disp=${String(s.displacement).padStart(9)}  rate=${String(s.dispRate).padStart(7)} cells/step  visited=${String(s.visited).padStart(7)}  bbox=${s.bbox}`);
}

// A rate that converges to a nonzero constant = highway (linear drift).
// A rate that stays near 0 (with displacement plateauing or oscillating) =
// bounded / non-escaping pattern.
const lastFew = lr.samples.slice(-5).map((s) => s.dispRate);
const avgLastRate = lastFew.reduce((a, b) => a + b, 0) / lastFew.length;
console.log(`\nAvg displacement rate over final ${lastFew.length} samples: ${avgLastRate.toFixed(4)} cells/step`);
console.log(avgLastRate > 0.05
  ? '=> Converged to sustained directional drift (a "highway").'
  : '=> No sustained directional drift detected in this run — displacement is bounded/oscillating.');

// Quick comparison against a couple of other short rules for context.
for (const rule of ['RL', 'LLRR', 'LR RL'.replace(' ', '')]) {
  console.log(`\n=== Rule ${rule} (200k steps, for comparison) ===`);
  const r = analyze(rule, 200_000, 50_000);
  for (const s of r.samples) {
    console.log(`step ${String(s.step).padStart(8)}  disp=${String(s.displacement).padStart(9)}  rate=${String(s.dispRate).padStart(7)}  visited=${String(s.visited).padStart(7)}  bbox=${s.bbox}`);
  }
}
