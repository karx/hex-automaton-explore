import { WAVETABLES, readTable, DRUM_SAMPLES, readSample } from '../src/music/components/wavetable.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

for (const [name, table] of Object.entries(WAVETABLES)) {
  check(`wavetable "${name}" is non-empty`, table.length > 0);
  const allFinite = Array.from(table).every((v) => Number.isFinite(v));
  check(`wavetable "${name}" is all finite`, allFinite);
  const peak = Math.max(...Array.from(table).map(Math.abs));
  check(`wavetable "${name}" is normalized (peak ~1)`, peak > 0.95 && peak <= 1.0001);
  // A single-cycle table should be quiet, not click, at the wrap point.
  check(`wavetable "${name}" doesn't discontinuously jump at the wrap`, Math.abs(table[0] - table[table.length - 1]) < 0.5);
}

const pad = WAVETABLES.pad;
check('readTable at an exact index matches the raw sample', readTable(pad, 0) === pad[0]);
check('readTable interpolates at a half-index', Math.abs(readTable(pad, 0.5 / pad.length) - (pad[0] + pad[1]) / 2) < 1e-9);
check('readTable wraps phase >= 1', Math.abs(readTable(pad, 1) - readTable(pad, 0)) < 1e-9);
check('readTable handles negative phase', Number.isFinite(readTable(pad, -0.3)));

for (const [name, sample] of Object.entries(DRUM_SAMPLES)) {
  check(`drum sample "${name}" is non-empty`, sample.length > 0);
  const allFinite = Array.from(sample).every((v) => Number.isFinite(v));
  check(`drum sample "${name}" is all finite`, allFinite);
  const peak = Math.max(...Array.from(sample).map(Math.abs));
  check(`drum sample "${name}" doesn't clip (peak <= 1)`, peak <= 1.0001);
}

const kick = DRUM_SAMPLES.kick;
check('readSample(0) matches the first frame', readSample(kick, 0) === kick[0]);
check('readSample past the buffer end is silence', readSample(kick, (kick.length + 100) / 44100) === 0);
check('readSample before the buffer start is silence', readSample(kick, -1) === 0);

if (failed) {
  console.error(`\nverify-wavetable: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-wavetable: all checks passed');
