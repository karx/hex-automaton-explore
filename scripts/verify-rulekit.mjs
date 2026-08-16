import { Engine } from '../src/engine.js';
import { getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';
import { exportRuleKit, ruleKitToJSON, parseRuleKit, buildEngineFromRuleKit } from '../src/ruleKit.js';

let failed = 0;
function check(label, ok) {
  console.log(`${label}: ${ok}`);
  if (!ok) failed += 1;
}

const preset = getPreset('drifting-vortex');
const params = getPresetParams(preset);
const seedFn = getPresetSeedFn(preset);
const engine = new Engine(40, 40, params, seedFn);
for (let i = 0; i < 150; i++) engine.step();

// --- rules-only export/import ---
const kitNoState = exportRuleKit(engine, {
  name: 'Test — rules only',
  provenance: { presetId: preset.id, presetName: preset.name, archetype: preset.archetype, survivalPressure: preset.survivalPressure, momentumBias: preset.momentumBias },
});
const jsonNoState = ruleKitToJSON(kitNoState);
console.log('rules-only kit size:', jsonNoState.length, 'bytes, state:', kitNoState.state);

const parsedNoState = parseRuleKit(jsonNoState);
const rebuiltNoState = buildEngineFromRuleKit(parsedNoState, { fallbackSeedFn: seedFn });
check('rebuilt (no state) params match', JSON.stringify(rebuiltNoState.params) === JSON.stringify(parsedNoState.params));
check('rebuilt (no state) generation is 0 (fresh seed)', rebuiltNoState.generation === 0);

// --- full state export/import ---
const kitWithState = exportRuleKit(engine, { name: 'Test — with state', includeState: true });
const jsonWithState = ruleKitToJSON(kitWithState);
console.log('\nwith-state kit size:', jsonWithState.length, 'bytes');

const parsedWithState = parseRuleKit(jsonWithState);
const rebuiltWithState = buildEngineFromRuleKit(parsedWithState);
check('rebuilt generation matches original (150)', rebuiltWithState.generation === engine.generation);
check('density arrays match', arraysEqual(rebuiltWithState.density, engine.density));
check('energy arrays match', arraysEqual(rebuiltWithState.energy, engine.energy));
check('momX arrays match', arraysEqual(rebuiltWithState.momX, engine.momX));
check('momY arrays match', arraysEqual(rebuiltWithState.momY, engine.momY));

// stepping the rebuilt engine should produce identical results to stepping the original further
engine.step();
rebuiltWithState.step();
check('post-import step produces identical next state', arraysEqual(rebuiltWithState.density, engine.density));

// --- error handling ---
try {
  parseRuleKit('{"not": "a kit"}');
  check('invalid kit is rejected', false);
} catch (e) {
  check(`correctly rejected invalid kit (${e.message})`, true);
}

try {
  parseRuleKit(JSON.stringify({ ...kitWithState, grid: { width: 5, height: 5 } }));
  check('size-mismatched state is rejected', false);
} catch (e) {
  check(`correctly rejected size-mismatched state (${e.message})`, true);
}

if (failed) {
  console.error(`\nverify-rulekit: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-rulekit: all checks passed');

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  return true;
}
