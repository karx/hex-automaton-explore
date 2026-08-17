// Headless checks for the hex Langton's Ant and the Coral Echo preset.
// Must exit 1 on failure — this is what CI / `npm test` gates on.
import { LangtonsAnt, parseRule } from '../src/langtonsAnt.js';
import { DIRS } from '../src/engine.js';
import { getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';
import { Engine } from '../src/engine.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

// --- parseRule ---
check('parseRule("LR") is [L, R]', parseRule('LR').join('') === 'LR');
check('parseRule trims and uppercases', parseRule('  lr  ').join('') === 'LR');
try {
  parseRule('LRX');
  check('parseRule rejects non-L/R', false);
} catch (e) {
  check(`parseRule rejects non-L/R (${e.message})`, /L\/R/.test(e.message));
}
try {
  parseRule('   ');
  check('parseRule rejects empty', false);
} catch (e) {
  check('parseRule rejects empty', true);
}

// --- DIRS is a 6-cycle so L/R are well-defined ---
check('engine DIRS has 6 headings', DIRS.length === 6);

// --- determinism ---
const a = new LangtonsAnt('LR');
const b = new LangtonsAnt('LR');
a.stepN(10_000);
b.stepN(10_000);
check('two LR ants stay in lockstep for 10k steps', a.q === b.q && a.r === b.r && a.dir === b.dir && a.visitedCount() === b.visitedCount());

// --- hex LR does not form a square-grid-style highway ---
// A highway is linear drift: displacement grows ~c*steps. On this hex
// geometry, LR stays a bounded fractal shell (disp stays O(10) at 100k).
const lr = new LangtonsAnt('LR');
lr.stepN(50_000);
check(`LR @ 50k displacement is bounded (got ${lr.displacement().toFixed(1)}, want < 40)`, lr.displacement() < 40);
check('LR @ 50k has visited a non-trivial shell', lr.visitedCount() > 500);
check('LR @ 50k is still inside a compact bbox', (lr.maxQ - lr.minQ) < 80 && (lr.maxR - lr.minR) < 80);

// --- Coral Echo is Resonant Bloom's rules, point-seeded ---
const bloom = getPreset('resonant-bloom');
const echo = getPreset('coral-echo');
check('coral-echo exists', !!echo);
check('coral-echo shares Resonant Bloom archetype + sliders',
  echo.archetype === bloom.archetype
  && echo.survivalPressure === bloom.survivalPressure
  && echo.momentumBias === bloom.momentumBias);
check('coral-echo is a cluster seed (bloom is a ring)', echo.seedType === 'cluster' && bloom.seedType === 'ring');
check('resolved params are identical', JSON.stringify(getPresetParams(echo)) === JSON.stringify(getPresetParams(bloom)));

const engine = new Engine(40, 40, getPresetParams(echo), getPresetSeedFn(echo));
let died = false;
let exploded = false;
for (let g = 0; g < 400; g++) {
  engine.step();
  const frac = engine.lastStats.aliveCells / engine.n;
  if (engine.lastStats.aliveCells === 0) died = true;
  if (frac > 0.92) exploded = true;
}
check('coral-echo survives 400 gens on a 40x40 grid', !died && !exploded && engine.lastStats.aliveCells > 0);

if (failed) {
  console.error(`\nverify-langtons-ant: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-langtons-ant: all checks passed');
