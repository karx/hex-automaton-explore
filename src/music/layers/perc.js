// Percussion layer: plays real 16-step kick/hat patterns (components/groove.js)
// instead of an independent per-tick coin flip — a section's dynamics pick
// which pattern fits, and the field's live activity/energy bias velocity and
// which hat pattern (sparse vs busy) plays, not whether a tick fires at all.
import { DRUM_SAMPLES, readSample } from '../components/wavetable.js';
import { KICK_PATTERNS, HAT_PATTERNS } from '../components/groove.js';

export const id = 'perc';

const TICKS_PER_BAR = 16; // 16th-note grid, 4/4
// Both voices play a pre-baked one-shot sample with its own envelope already
// applied (see components/wavetable.js) — the generic ADSR below is left
// effectively flat (sustain=1, no attack/decay) so it doesn't double-shape
// the hit; `durSec` just needs to cover the sample so it isn't cut short.
const PASSTHROUGH_ENVELOPE = { attack: 0, decay: 0, sustain: 1, release: 0.01 };

export function isActive(section) {
  return !!section.activeLayers.perc;
}

function kickPatternFor(dynamics) {
  if (dynamics < 0.35) return KICK_PATTERNS.sparse;
  if (dynamics < 0.75) return KICK_PATTERNS.fourFloor;
  return KICK_PATTERNS.driving;
}

function hatPatternFor(dynamics, activity) {
  if (dynamics < 0.3) return HAT_PATTERNS.sparse;
  if (activity > 0.55) return HAT_PATTERNS.sixteenths;
  return HAT_PATTERNS.eighths;
}

// One decision per 16th-note tick: read the current pattern at this step;
// a human drummer doesn't hit a machine-identical pattern every single bar,
// so a weak (low-accent) step has a small chance of being skipped or ghosted.
export function schedule({ tickIndex, lastStats, rng, section }) {
  const voices = [];
  const posInBar = tickIndex % TICKS_PER_BAR;
  const activity = Math.max(0, Math.min(1, (lastStats?.aliveCells ?? 0) / 4000));
  const energy = Math.max(0, Math.min(1, (lastStats?.totalEnergy ?? 0) / 200));
  const dynamics = section.targetDynamics ?? 0.5;

  const kickAccent = kickPatternFor(dynamics)[posInBar];
  if (kickAccent > 0 && rng() < 0.9 + kickAccent * 0.1) {
    voices.push({
      layerId: id, kind: 'kick', freqs: [null], startTick: tickIndex,
      durSec: DRUM_SAMPLES.kick.length / 44100,
      velocity: kickAccent * (0.62 + energy * 0.2), pan: 0,
      envelope: PASSTHROUGH_ENVELOPE,
    });
  }
  const hatAccent = hatPatternFor(dynamics, activity)[posInBar];
  if (hatAccent > 0 && rng() < 0.92) {
    voices.push({
      layerId: id, kind: 'hat', freqs: [null], startTick: tickIndex,
      durSec: DRUM_SAMPLES.hat.length / 44100,
      velocity: hatAccent * (0.16 + energy * 0.14), pan: (rng() - 0.5) * 0.5,
      envelope: PASSTHROUGH_ENVELOPE,
    });
  }
  return voices;
}

export function synthesize(voice, t) {
  return readSample(DRUM_SAMPLES[voice.kind], t);
}
