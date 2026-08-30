import { normalizeSchema, DEFAULT_SCHEMA } from '../src/music/schema.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

const defaults = normalizeSchema();
check('defaults fill in presetId', defaults.presetId === DEFAULT_SCHEMA.presetId);
check('defaults sink is file', defaults.sink.type === 'file' && !!defaults.sink.path);
check('defaults duration is 3600', defaults.durationSec === 3600);

const overridden = normalizeSchema({ durationSec: 5, fps: 100, grid: 999, tempo: 10 });
check('durationSec override applies', overridden.durationSec === 5);
check('fps clamps to max 60', overridden.fps === 60);
check('grid clamps to max 200', overridden.grid === 200);
check('tempo clamps to min 40', overridden.tempo === 40);

const layerOverride = normalizeSchema({ layers: { audio: { lead: false } } });
check('layer override merges, not replaces', layerOverride.layers.audio.bass === DEFAULT_SCHEMA.layers.audio.bass && layerOverride.layers.audio.lead === false);
check('video layers untouched by audio override', layerOverride.layers.video.density === true);

const rtmp = normalizeSchema({ sink: { type: 'rtmp', url: 'rtmp://example/live/x' } });
check('rtmp sink accepted with url', rtmp.sink.type === 'rtmp' && rtmp.sink.url === 'rtmp://example/live/x');

let threwBadType = false;
try { normalizeSchema({ sink: { type: 'ftp' } }); } catch { threwBadType = true; }
check('rejects unknown sink type', threwBadType);

let threwNoUrl = false;
try { normalizeSchema({ sink: { type: 'rtmp', url: '' } }); } catch { threwNoUrl = true; }
check('rejects rtmp sink with an explicitly empty url', threwNoUrl);

const rtmpFallsBackToDefaultUrl = normalizeSchema({ sink: { type: 'rtmp' } });
check('rtmp sink with no url override falls back to the default url', !!rtmpFallsBackToDefaultUrl.sink.url);

let threwUndefinedPresetIdDoesNotClobberDefault = false;
try {
  const s = normalizeSchema({ presetId: undefined, fps: undefined });
  threwUndefinedPresetIdDoesNotClobberDefault = s.presetId === DEFAULT_SCHEMA.presetId && s.fps === DEFAULT_SCHEMA.fps;
} catch { /* leave false */ }
check('explicit undefined overrides (as a CLI wrapper would pass) fall back to defaults, not undefined', threwUndefinedPresetIdDoesNotClobberDefault);

if (failed) {
  console.error(`\nverify-schema: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-schema: all checks passed');
