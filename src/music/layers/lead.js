// Lead layer: a single monophonic voice playing a real melodic motif
// (components/groove.js) instead of independently coin-flipping every 8th
// note — that read as constant noodling with no phrasing. A motif is picked
// once per 2-bar phrase (busier motifs when the section wants more energy)
// and held for the whole phrase; the field's density/resonance only nudge
// register and add an occasional passing tone, they don't drive note-by-note
// choices on their own.
import { WAVETABLES, readTable } from '../components/wavetable.js';
import { degreeToFreq, CHORDS } from '../components/theory.js';
import { LEAD_MOTIFS } from '../components/groove.js';

export const id = 'lead';
const PHRASE_STEPS = 16; // 2 bars, counted in 8th-note steps

export function isActive(section) {
  return !!section.activeLayers.lead;
}

export function schedule({ tickIndex, chordSymbol, lastStats, rng, tickDurSec, section, layerState }) {
  if (tickIndex % 2 !== 0) return []; // 8th-note grid
  const step = tickIndex / 2;
  const phraseIndex = Math.floor(step / PHRASE_STEPS);
  const stepInPhrase = step % PHRASE_STEPS;

  if (layerState.phraseIndex !== phraseIndex) {
    const wantBusy = (section.targetDynamics ?? 0.5) > 0.65;
    const candidates = LEAD_MOTIFS.filter((m) => (wantBusy ? m.character !== 'calm' : m.character !== 'busy'));
    layerState.motif = candidates[Math.floor(rng() * candidates.length)] || LEAD_MOTIFS[0];
    layerState.phraseIndex = phraseIndex;
  }

  const degreeOffset = layerState.motif.steps[stepInPhrase];
  if (degreeOffset === null || degreeOffset === undefined) return []; // the motif rests here

  const density = Math.max(0, Math.min(1, (lastStats?.totalDensity ?? 0) / 2000));
  const resonance = Math.max(0, Math.min(1, lastStats?.resonance ?? 0));
  const degrees = CHORDS[chordSymbol] ?? CHORDS.i;
  // A low-resonance field occasionally nudges the motif's note off the chord
  // by one scale step — a passing tone, not a different melody.
  const passing = resonance < 0.4 && rng() < 0.3 ? (rng() < 0.5 ? 1 : -1) : 0;
  const degree = degrees[0] + degreeOffset + passing;
  const octave = 1 + Math.round(density);
  const freq = degreeToFreq(degree, octave);

  return [{
    layerId: id, freqs: [freq], startTick: tickIndex,
    durSec: tickDurSec * 1.8,
    velocity: 0.3 + resonance * 0.3,
    pan: (lastStats?.leakDirectionality ?? 0) * ((rng() - 0.5) > 0 ? 1 : -1) * 0.7,
    envelope: { attack: 0.025, decay: 0.08, sustain: 0.5, release: 0.2 },
  }];
}

export function synthesize(voice, t) {
  return readTable(WAVETABLES.lead, t * voice.freqs[0]);
}
