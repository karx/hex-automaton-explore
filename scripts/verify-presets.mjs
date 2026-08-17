import { Engine } from '../src/engine.js';
import { PRESETS, getPresetParams, getPresetSeedFn } from '../src/presets.js';

const W = 60, H = 60, GENS = 700;
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

for (const preset of PRESETS) {
  const params = getPresetParams(preset);
  const seedFn = getPresetSeedFn(preset);
  const engine = new Engine(W, H, params, seedFn);
  let died = false, exploded = false;
  const trail = [];
  for (let g = 0; g < GENS; g++) {
    engine.step();
    if ((g + 1) % 200 === 0) {
      const frac = engine.lastStats.aliveCells / engine.n;
      trail.push(`${(frac * 100).toFixed(1)}%/res${engine.lastStats.resonance.toFixed(2)}`);
      if (engine.lastStats.aliveCells === 0) died = true;
      if (frac > 0.92) exploded = true;
    }
  }
  const status = died ? 'DIED' : exploded ? 'EXPLODED' : 'ok';
  console.log(`${preset.id.padEnd(20)} [${status.padEnd(8)}] ${trail.join(', ')}`);
  check(`${preset.id} survives 700 gens`, !died && !exploded);
}

if (failed) {
  console.error(`\nverify-presets: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-presets: all checks passed');
