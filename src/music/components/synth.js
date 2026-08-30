// Dependency-free DSP primitives shared by every instrument layer: an ADSR
// envelope and a one-pole low-pass filter. Raw oscillator waveforms
// (sine/saw/triangle) and live noise generation used to live here too, but
// every layer now reads a pre-rendered, band-limited wavetable or a baked
// drum sample instead (see components/wavetable.js) — smoother and cheaper
// than computing a waveform fresh every sample.

// Envelope value in 0..1 at elapsed seconds `t` since note-on, given the note's
// held duration `dur` (seconds) before release begins.
export function adsr(t, dur, { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.15 } = {}) {
  if (t < 0) return 0;
  if (t < attack) return attack > 0 ? t / attack : 1;
  const afterAttack = t - attack;
  if (afterAttack < decay) return 1 - (1 - sustain) * (decay > 0 ? afterAttack / decay : 1);
  if (t < dur) return sustain;
  const rt = t - dur;
  if (rt < release) return sustain * (1 - (release > 0 ? rt / release : 1));
  return 0;
}

// True once a voice's envelope has fully released and can be dropped.
export function envelopeDone(t, dur, envelope) {
  return t >= dur + (envelope?.release ?? 0.15);
}

// One-pole low-pass filter, stateful across calls — caller owns `state` ({ y }).
export function onePoleLowPass(x, state, cutoff01) {
  const a = Math.max(0.001, Math.min(1, cutoff01));
  state.y = state.y + a * (x - state.y);
  return state.y;
}
