// A small self-contained "sample set" for the instrument layers: band-limited
// single-cycle wavetables (built once from additive harmonic sums, so tone
// playback is a table lookup + interpolation instead of live sin()/saw()
// math) and pre-baked one-shot drum samples (kick/hat, rendered once with
// their own envelope and noise shaping baked in). No external audio assets —
// everything here is generated from pure math — but it's played back the way
// a sampler plays back real recordings, and it's the fix for two problems at
// once: raw sawWave()/triangleWave() alias and sound buzzy (infinite harmonic
// content, discontinuous edges), and live per-sample noise for percussion is
// jittery/harsh. A fixed table, faded in/out and read with interpolation, is
// warmer and cheaper.
import { createRng } from './rng.js';

const TABLE_SIZE = 2048;
const SAMPLE_RATE = 44100;

// Harmonic amplitude stacks (index 0 = fundamental). Each is tapered by an
// extra exp() falloff on top of its own numbers so truncating the series
// doesn't leave a harsh edge (Gibbs ringing) — the taper is what makes these
// sound "soft" rather than a naive band-limited saw.
const HARMONIC_SETS = {
  // Pad: mostly fundamental, a whisper of odd overtones — warm, breathy.
  pad: [1, 0, 0.22, 0, 0.09, 0, 0.04],
  // Lead: brighter, closer to a soft reed/string — more harmonics than the
  // pad but still smoothly tapered, never a harsh full saw.
  lead: [1, 0.55, 0.32, 0.2, 0.13, 0.08, 0.05, 0.03],
  // Bass: fundamental-heavy with a little growl from the 2nd/3rd harmonic.
  bass: [1, 0.42, 0.16, 0.07],
};

function buildHarmonicTable(amplitudes, { taper = 0.12 } = {}) {
  const table = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) {
    const phase = i / TABLE_SIZE;
    let sum = 0;
    for (let n = 1; n <= amplitudes.length; n++) {
      const amp = amplitudes[n - 1];
      if (!amp) continue;
      sum += amp * Math.exp(-taper * (n - 1)) * Math.sin(2 * Math.PI * n * phase);
    }
    table[i] = sum;
  }
  let peak = 0;
  for (let i = 0; i < TABLE_SIZE; i++) peak = Math.max(peak, Math.abs(table[i]));
  if (peak > 1e-9) for (let i = 0; i < TABLE_SIZE; i++) table[i] /= peak;
  return table;
}

export const WAVETABLES = {
  pad: buildHarmonicTable(HARMONIC_SETS.pad, { taper: 0.05 }),
  lead: buildHarmonicTable(HARMONIC_SETS.lead, { taper: 0.15 }),
  bass: buildHarmonicTable(HARMONIC_SETS.bass, { taper: 0.1 }),
};

// Linear-interpolated table read; `phase` is in cycles (any real number).
export function readTable(table, phase) {
  const p = (phase - Math.floor(phase)) * table.length;
  const i0 = Math.floor(p);
  const i1 = (i0 + 1) % table.length;
  const frac = p - i0;
  return table[i0] * (1 - frac) + table[i1] * frac;
}

// One-shot drum samples, baked with their own envelope/shaping — playback is
// just an indexed read (see readSample), not live synthesis per sample.
function raisedCosine(t, dur) {
  return t >= dur ? 0 : 0.5 - 0.5 * Math.cos(Math.PI * (1 - t / dur)); // fades 1 -> 0 over [0,dur]
}

// A jump straight to full amplitude at sample 0 is a real digital click, no
// matter how the rest of the sample is shaped — this ramps 0 -> 1 over a few
// milliseconds so the onset reads as a soft, punchy hit instead of a pop.
function attackRamp(t, attackSec) {
  return attackSec > 0 ? Math.min(1, t / attackSec) : 1;
}

function buildKickSample() {
  const dur = 0.16;
  const n = Math.round(dur * SAMPLE_RATE);
  const buf = new Float32Array(n);
  const rng = createRng(0xBEEF); // fixed internal seed: a "sample" is a fixed asset, not run-seeded
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const pitch = 150 * Math.pow(0.3, t / 0.09) + 42; // fast drop, settles on a low fundamental
    const env = raisedCosine(t, dur) * attackRamp(t, 0.004);
    // a very short soft transient click, well below the fundamental's level,
    // gives it a sense of attack without a harsh digital pop.
    const click = t < 0.004 ? (1 - t / 0.004) * 0.15 : 0;
    buf[i] = (Math.sin(2 * Math.PI * pitch * t) * env) + click * (rng() * 2 - 1) * attackRamp(t, 0.002);
  }
  return normalizePeak(buf);
}

// Keeps a baked sample from ever exceeding [-1, 1] without changing its shape.
function normalizePeak(buf) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak > 1) for (let i = 0; i < buf.length; i++) buf[i] /= peak;
  return buf;
}

function buildHatSample() {
  const dur = 0.06;
  const n = Math.round(dur * SAMPLE_RATE);
  const buf = new Float32Array(n);
  const rng = createRng(0xC0FFEE); // fixed internal seed: a "sample" is a fixed asset, not run-seeded
  let lp = 0, hp = 0, prevIn = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const noise = rng() * 2 - 1;
    lp += 0.35 * (noise - lp);           // soften the top end
    const shaped = lp - prevIn * 0.6;     // mild high-pass-ish shimmer, gentler than raw noise
    prevIn = lp;
    hp = shaped;
    const env = (raisedCosine(t, dur) ** 1.5) * attackRamp(t, 0.0015);
    buf[i] = hp * env * 0.9;
  }
  return buf;
}

export const DRUM_SAMPLES = {
  kick: buildKickSample(),
  hat: buildHatSample(),
};

// Reads a one-shot sample buffer at elapsed seconds `t` (linear interpolation,
// silence past the end) — this *is* the envelope for drum voices, unlike the
// generic ADSR the tonal layers use.
export function readSample(buffer, t) {
  const pos = t * SAMPLE_RATE;
  const i0 = Math.floor(pos);
  if (i0 < 0 || i0 >= buffer.length - 1) return 0;
  const frac = pos - i0;
  return buffer[i0] * (1 - frac) + buffer[i0 + 1] * frac;
}
