import { createComposer } from '../src/music/compose.js';
import { buildArrangement } from '../src/music/arrangement.js';
import { normalizeSchema } from '../src/music/schema.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

// Deterministic, non-random synthetic stats stream (oscillating so every
// layer's field-biased branches get exercised at least once).
function statsAt(i) {
  const phase = (i % 40) / 40;
  return {
    totalDensity: 1000 + Math.sin(phase * Math.PI * 2) * 800,
    aliveCells: 1500 + Math.sin(phase * Math.PI * 2 + 1) * 1200,
    totalEnergy: Math.sin(phase * Math.PI * 2 + 2) * 60,
    resonance: 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 3),
    momentumCoherence: 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 4),
    leakDirectionality: 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 5),
  };
}

function runComposer(durationSec, fps, seed, arrangement = buildArrangement(durationSec)) {
  const schema = normalizeSchema({ durationSec, tempo: 96, seed });
  const composer = createComposer({ schema, arrangement });
  const chunks = [];
  const frames = Math.ceil(durationSec * fps);
  for (let f = 0; f < frames; f++) {
    const tSec = Math.min((f + 1) / fps, durationSec);
    chunks.push(composer.advanceTo(tSec, statsAt(f)));
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

const DURATION = 3; // seconds — long enough to cross several 16th-note ticks
const FPS = 24;

// The default arrangement's first section (Intro) only enables the pad
// layer, which never consults the PRNG — deliberately, it's a held chord.
// The seed-sensitivity check below needs an rng-driven layer (perc/lead)
// active from t=0, so it uses this synthetic all-layers-on section instead.
const allLayersOn = [{
  name: 'Test', startSec: 0, endSec: DURATION,
  activeLayers: { perc: true, bass: true, pad: true, lead: true },
  targetDynamics: 0.8, chordSymbol: 'i', cycleIndex: 0,
}];

const runA = runComposer(DURATION, FPS, 42);
const runB = runComposer(DURATION, FPS, 42);
const runC = runComposer(DURATION, FPS, 7);
const runSeedA = runComposer(DURATION, FPS, 42, allLayersOn);
const runSeedC = runComposer(DURATION, FPS, 7, allLayersOn);

check('output is non-empty', runA.length > 0);

let allFinite = true, inRange = true;
for (let i = 0; i < runA.length; i++) {
  if (!Number.isFinite(runA[i])) allFinite = false;
  if (runA[i] < -1 || runA[i] > 1) inRange = false;
}
check('every sample is finite (no NaN/Infinity)', allFinite);
check('every sample is soft-limited within [-1, 1]', inRange);

let anySound = false;
for (let i = 0; i < runA.length; i++) if (Math.abs(runA[i]) > 1e-6) { anySound = true; break; }
check('the arrangement actually produces audible signal', anySound);

check('same seed + same stats sequence -> identical output length', runA.length === runB.length);
let identical = runA.length === runB.length;
if (identical) for (let i = 0; i < runA.length; i++) if (runA[i] !== runB[i]) { identical = false; break; }
check('same seed + same stats sequence -> byte-identical output (determinism)', identical);

let differsWithOtherSeed = runSeedA.length !== runSeedC.length;
if (!differsWithOtherSeed) for (let i = 0; i < runSeedA.length; i++) if (runSeedA[i] !== runSeedC[i]) { differsWithOtherSeed = true; break; }
check('a different seed produces different output (rng-driven layers active)', differsWithOtherSeed);
check('sanity: runC still a valid finite buffer', runC.every((s) => Number.isFinite(s)));

// A run with every audio layer disabled should be silence.
const silentSchema = normalizeSchema({ durationSec: 1, layers: { audio: { perc: false, bass: false, pad: false, lead: false } } });
const silentArrangement = buildArrangement(1);
const silentComposer = createComposer({ schema: silentSchema, arrangement: silentArrangement });
const silentOut = silentComposer.advanceTo(1, statsAt(0));
check('disabling every audio layer produces silence', silentOut.every((s) => s === 0));

if (failed) {
  console.error(`\nverify-composer: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-composer: all checks passed');
