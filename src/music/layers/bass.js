// Bass layer: follows a real 16-step pattern (components/groove.js) synced
// to the same bar grid as percussion, instead of a fixed "every 8 ticks"
// pedal tone. A section's dynamics pick which pattern fits; the field's
// energy brightens the tone; a lighter (lower-accent) hit occasionally
// reaches for the fifth instead of the root, for a little harmonic motion.
import { onePoleLowPass } from '../components/synth.js';
import { WAVETABLES, readTable } from '../components/wavetable.js';
import { BASS_PATTERNS } from '../components/groove.js';

export const id = 'bass';

export function isActive(section) {
  return !!section.activeLayers.bass;
}

function patternFor(dynamics) {
  if (dynamics < 0.4) return BASS_PATTERNS.root;
  if (dynamics < 0.75) return BASS_PATTERNS.rootAndFive;
  return BASS_PATTERNS.syncopated;
}

export function schedule({ tickIndex, chordTones, lastStats, rng, tickDurSec, section }) {
  const posInBar = tickIndex % 16;
  const accent = patternFor(section.targetDynamics ?? 0.5)[posInBar];
  if (!accent) return [];

  const energy = Math.max(0, Math.min(1, ((lastStats?.totalEnergy ?? 0) + 50) / 150));
  const useFifth = accent < 1 && chordTones.length > 2 && rng() < 0.5;
  const freq = (useFifth ? chordTones[2] : chordTones[0]) / 2;

  return [{
    layerId: id, freqs: [freq], startTick: tickIndex,
    durSec: tickDurSec * 6,
    velocity: accent * (0.5 + energy * 0.3),
    pan: 0,
    brightness: 0.12 + energy * 0.4,
    envelope: { attack: 0.03, decay: 0.16, sustain: 0.6, release: 0.25 },
  }];
}

export function synthesize(voice, t) {
  voice._filterState = voice._filterState || { y: 0 };
  const raw = readTable(WAVETABLES.bass, t * voice.freqs[0]);
  return onePoleLowPass(raw, voice._filterState, voice.brightness ?? 0.3);
}
