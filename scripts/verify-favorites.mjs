import { Engine } from '../src/engine.js';
import { getPreset, getPresetParams } from '../src/presets.js';
import { FAVORITES, getFavorite, getFavoriteSeedFn, favoriteAsRuleKit } from '../src/favorites.js';
import { parseRuleKit, ruleKitToJSON, buildEngineFromRuleKit } from '../src/ruleKit.js';

const W = 60, H = 60, GENS = 700;
let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

check('at least one favorite', FAVORITES.length >= 1);

const bloom = getPreset('resonant-bloom');
const bloomParams = getPresetParams(bloom);
const full = getFavorite('pulsating-full');

check('pulsating-full is registered', full.id === 'pulsating-full' && full.name === 'Pulsating Full');
check('pulsating-full is not stock Resonant Bloom params', full.params.birthLow !== bloomParams.birthLow);
check('pulsating-full keeps the exported birth window', full.params.birthLow === 0.4 && full.params.birthHigh === 3.35);

const kit = favoriteAsRuleKit(full);
const json = ruleKitToJSON(kit);
const parsed = parseRuleKit(json);
check('favorite kit JSON parses', parsed.meta.favoriteId === 'pulsating-full');
check('favorite kit params survive stringify', parsed.params.birthLow === 0.4);

const rebuilt = buildEngineFromRuleKit(parsed, { fallbackSeedFn: getFavoriteSeedFn(full) });
check('favorite kit rebuilds at generation 0', rebuilt.generation === 0);
check('favorite kit grid is 90×90', parsed.grid.width === 90 && parsed.grid.height === 90);

for (const fav of FAVORITES) {
  const seedFn = getFavoriteSeedFn(fav);
  const engine = new Engine(W, H, fav.params, seedFn);
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
  console.log(`${fav.id.padEnd(20)} [${status.padEnd(8)}] ${trail.join(', ')}`);
  check(`${fav.id} survives 700 gens`, !died && !exploded);
}

if (failed) {
  console.error(`\nverify-favorites: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-favorites: all checks passed');
