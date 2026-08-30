// The conductor ("Render" stage, audio side): walks a fixed tempo/beat clock
// across the arrangement, at each 16th-note tick asks every active Layer to
// schedule voices (biased by the field's *current* live stats + a seeded
// PRNG), then mixes all currently-sounding voices into stereo PCM. Same
// stats sequence + seed produces byte-identical output — the field steers
// texture, the arrangement and RNG seed make the result reproducible.
import { createRng } from './components/rng.js';
import { sectionAt } from './arrangement.js';
import { chordTones } from './components/theory.js';
import { adsr, envelopeDone, onePoleLowPass } from './components/synth.js';
import * as perc from './layers/perc.js';
import * as bass from './layers/bass.js';
import * as pad from './layers/pad.js';
import * as lead from './layers/lead.js';

const LAYER_MODULES = [perc, bass, pad, lead];
const LAYER_BY_ID = Object.fromEntries(LAYER_MODULES.map((m) => [m.id, m]));
export const SAMPLE_RATE = 44100;
const TICKS_PER_BEAT = 4; // 16th-note decision grid

// Orchestration smoothing: a layer ramps in/out around a section boundary
// instead of hard-cutting on/off. Percussion gets a longer, delayed fade-in
// than the sustained layers: a kick/hat's own attack is a real transient (it
// has to be, to sound like a hit at all), so if it enters at the same instant
// as everything else newly joining, that first hit still reads as a sharp
// pop against the previously-calmer texture. Staggering it in — starting
// later than the tonal layers and taking longer to reach full velocity —
// spreads that transition out instead of hitting it all at once.
const DEFAULT_FADE_SEC = 3;
const LAYER_FADE = {
  perc: { delaySec: 1.5, durationSec: 6 },
  lead: { delaySec: 2.5, durationSec: 4.5 },
};

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function smoothstep(x) { return x * x * (3 - 2 * x); }
function softLimit(x, drive = 0.45) { return Math.tanh(x * drive); }

// A flat probability-per-tick reads as arrhythmic no matter how it's tuned —
// real playing has a pulse. This nudges (not dictates — each layer's own
// pattern already carries most of the shape) everything toward the beat.
function beatAccent(posInBar) {
  if (posInBar === 0) return 1;
  if (posInBar === 8) return 0.9;
  if (posInBar % 4 === 0) return 0.8;
  if (posInBar % 2 === 0) return 0.65;
  return 0.5;
}

// Humanized micro-timing: on-beat notes land a touch late, off-beat notes a
// touch early (a documented property of human playing), plus a small random
// jitter — a few milliseconds, not enough to feel loose, just not robotic.
function humanizeOffsetSec(tickIndex, rng) {
  const posInBar = tickIndex % 16;
  const bias = posInBar % 4 === 0 ? 0.004 : -0.003;
  const jitter = (rng() - 0.5) * 0.012;
  return bias + jitter;
}

// A short Schroeder allpass diffuser: cheap, dependency-free "glue" that
// softens the ensemble into a shared sense of space instead of dry layered
// voices. y[n] = -g*x[n] + x[n-D] + g*y[n-D].
function createAllpass(delaySamples, gain) {
  const buf = new Float32Array(Math.max(1, delaySamples));
  let idx = 0;
  return (x) => {
    const bufOut = buf[idx];
    const y = -gain * x + bufOut;
    buf[idx] = x + gain * y;
    idx = (idx + 1) % buf.length;
    return y;
  };
}

// For every section, whether each layer was active in the previous section
// and will be active in the next — lets scheduleTick fade a layer in/out
// only at the edges where its active state actually changes.
function computeLayerNeighbors(arrangement) {
  const map = new Map();
  arrangement.forEach((section, i) => {
    map.set(section, {
      prevActiveLayers: arrangement[i - 1]?.activeLayers ?? null,
      nextActiveLayers: arrangement[i + 1]?.activeLayers ?? null,
    });
  });
  return map;
}

export function createComposer({ schema, arrangement, sampleRate = SAMPLE_RATE }) {
  const rng = createRng(schema.seed ?? 1);
  const tickDurSec = 60 / schema.tempo / TICKS_PER_BEAT;
  const enabledLayerIds = new Set(
    Object.entries(schema.layers.audio).filter(([, on]) => on).map(([layerId]) => layerId)
  );
  const lastSectionEnd = arrangement[arrangement.length - 1].endSec;
  const layerNeighbors = computeLayerNeighbors(arrangement);

  let producedSec = 0;
  let nextTickIndex = 0;
  let nextTickTimeSec = 0;
  const voices = [];
  // Per-layer scratch state a layer's schedule() can read/write across ticks
  // (e.g. the lead holding its current motif for a whole phrase) — one slot
  // per layer, scoped to this composer instance only.
  const layerState = Object.fromEntries(LAYER_MODULES.map((m) => [m.id, {}]));

  // Master bus: a gentle warmth (low-pass) filter, then stereo diffusion, then
  // a soft limiter — glues the four separately-synthesized layers into one
  // sound instead of dry layered voices, and rounds off anything peaky.
  const warmthL = { y: 0 }, warmthR = { y: 0 };
  const diffuseL1 = createAllpass(Math.round(0.011 * sampleRate), 0.5);
  const diffuseL2 = createAllpass(Math.round(0.017 * sampleRate), 0.5);
  const diffuseR1 = createAllpass(Math.round(0.013 * sampleRate), 0.5);
  const diffuseR2 = createAllpass(Math.round(0.019 * sampleRate), 0.5);

  // 0..1: 1 in the steady middle of a section, ramping down near a boundary
  // where the layer's active state is about to (or just did) change. A layer
  // joining fresh (see LAYER_FADE) waits `delaySec` before it even starts
  // ramping in, so several layers newly active at the same boundary don't
  // all arrive in the same instant.
  function layerPresence(layerId, section, tSec) {
    const { prevActiveLayers, nextActiveLayers } = layerNeighbors.get(section);
    const fade = LAYER_FADE[layerId] || { delaySec: 0, durationSec: DEFAULT_FADE_SEC };
    let presence = 1;
    if (!(prevActiveLayers && prevActiveLayers[layerId])) {
      const sinceStart = tSec - section.startSec - fade.delaySec;
      presence = Math.min(presence, smoothstep(clamp01(sinceStart / fade.durationSec)));
    }
    if (!(nextActiveLayers && nextActiveLayers[layerId])) {
      const untilEnd = section.endSec - tSec;
      presence = Math.min(presence, smoothstep(clamp01(untilEnd / fade.durationSec)));
    }
    return presence;
  }

  function scheduleTick(tickIndex, lastStats) {
    const tSec = Math.min(tickIndex * tickDurSec, lastSectionEnd - 1e-9);
    const section = sectionAt(arrangement, tSec);
    const tones = chordTones(section.chordSymbol, 0);
    const accent = 0.75 + 0.25 * beatAccent(tickIndex % 16);
    const timingOffset = humanizeOffsetSec(tickIndex, rng);
    for (const mod of LAYER_MODULES) {
      if (!enabledLayerIds.has(mod.id) || !mod.isActive(section)) continue;
      const newVoices = mod.schedule({
        tickIndex, section, chordTones: tones, chordSymbol: section.chordSymbol,
        lastStats, rng, tickDurSec, layerState: layerState[mod.id],
      }) || [];
      const presence = layerPresence(mod.id, section, tSec);
      for (const v of newVoices) {
        v.startSec = tickIndex * tickDurSec + timingOffset;
        v.velocity = clamp01(v.velocity) * clamp01(section.targetDynamics ?? 1) * presence * accent;
        voices.push(v);
      }
    }
  }

  // Advance production up to absolute time `tSec`, using `lastStats` (the
  // field's current lastStats snapshot) for any scheduling decisions made
  // along the way. Returns interleaved stereo Float32Array PCM for the slice.
  function advanceTo(tSec, lastStats) {
    const targetSample = Math.round(tSec * sampleRate);
    const startSample = Math.round(producedSec * sampleRate);
    const numSamples = Math.max(0, targetSample - startSample);
    if (numSamples === 0) return new Float32Array(0);

    const out = new Float32Array(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      const sampleTimeSec = (startSample + i) / sampleRate;
      while (sampleTimeSec >= nextTickTimeSec) {
        scheduleTick(nextTickIndex, lastStats);
        nextTickIndex += 1;
        nextTickTimeSec = nextTickIndex * tickDurSec;
      }
      let left = 0, right = 0;
      for (let vi = voices.length - 1; vi >= 0; vi--) {
        const v = voices[vi];
        const tSinceStart = sampleTimeSec - v.startSec;
        if (tSinceStart < 0) continue;
        if (envelopeDone(tSinceStart, v.durSec, v.envelope)) { voices.splice(vi, 1); continue; }
        const raw = LAYER_BY_ID[v.layerId].synthesize(v, tSinceStart);
        const env = adsr(tSinceStart, v.durSec, v.envelope);
        const s = raw * env * v.velocity;
        const pan = Math.max(-1, Math.min(1, v.pan ?? 0));
        left += s * (1 - Math.max(0, pan));
        right += s * (1 + Math.min(0, pan));
      }
      left = onePoleLowPass(left, warmthL, 0.5);
      right = onePoleLowPass(right, warmthR, 0.5);
      left = diffuseL2(diffuseL1(left));
      right = diffuseR2(diffuseR1(right));
      out[i * 2] = softLimit(left);
      out[i * 2 + 1] = softLimit(right);
    }
    producedSec = targetSample / sampleRate;
    return out;
  }

  return { advanceTo, get activeVoiceCount() { return voices.length; } };
}
