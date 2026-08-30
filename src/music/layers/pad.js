// Pad layer: the current chord, held as a slow-attack detuned stack — the
// harmonic bed the other layers sit on top of. Stereo width comes from the
// field's momentum: a coherent, directional field spreads the chord tones
// wider across the stereo image.
import { WAVETABLES, readTable } from '../components/wavetable.js';

export const id = 'pad';
const DETUNE = [1, 1.006, 0.994];

export function isActive(section) {
  return !!section.activeLayers.pad;
}

export function schedule({ tickIndex, chordTones, lastStats, section, tickDurSec }) {
  if (tickIndex % 16 !== 0) return [];
  const coherence = Math.max(0, Math.min(1, lastStats?.momentumCoherence ?? 0));
  const width = 0.2 + coherence * 0.6;
  return chordTones.map((freq, i) => {
    const spread = chordTones.length > 1 ? (i / (chordTones.length - 1)) * 2 - 1 : 0;
    return {
      layerId: id, freqs: [freq], startTick: tickIndex,
      durSec: tickDurSec * 15, // ~1 bar, clipped by section end regardless
      velocity: (0.25 + (section.targetDynamics ?? 0.5) * 0.35),
      pan: spread * width,
      envelope: { attack: 1.2, decay: 0.6, sustain: 0.75, release: 1.8 },
    };
  });
}

export function synthesize(voice, t) {
  const f = voice.freqs[0];
  let sum = 0;
  for (const d of DETUNE) sum += readTable(WAVETABLES.pad, t * f * d);
  return sum / DETUNE.length;
}
