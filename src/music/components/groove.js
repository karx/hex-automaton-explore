// Pre-composed rhythmic/melodic vocabulary. The fix for "sounds robotic, not
// like a human played it": don't independently coin-flip every tick (that
// reads as arrhythmic noodling no matter how the probabilities are tuned) —
// instead pick from a small set of real patterns/motifs, and let the field's
// live stats bias *which* one fits and how hard it hits, not whether an
// arbitrary tick fires at all. This mirrors how actual groove-based
// production works (drum-machine step patterns, groove-quantize templates)
// rather than sampling noise per note.

// 16 steps = one bar of 16th notes. 0 = rest, otherwise a relative accent
// (0-1] — real drum patterns aren't flat-velocity, so the pattern itself
// already carries a human-feeling loud/soft shape.
export const KICK_PATTERNS = {
  sparse: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  fourFloor: [1, 0, 0, 0, 0.85, 0, 0, 0, 1, 0, 0, 0, 0.85, 0, 0, 0],
  driving: [1, 0, 0, 0.4, 0.8, 0, 0.3, 0, 1, 0, 0, 0.4, 0.85, 0, 0.5, 0],
};

export const HAT_PATTERNS = {
  sparse: [0, 0, 0.45, 0, 0, 0, 0.45, 0, 0, 0, 0.45, 0, 0, 0, 0.45, 0],
  eighths: [0.6, 0, 0.45, 0, 0.6, 0, 0.45, 0, 0.6, 0, 0.45, 0, 0.6, 0, 0.45, 0],
  sixteenths: [0.65, 0.3, 0.5, 0.3, 0.65, 0.3, 0.5, 0.3, 0.65, 0.3, 0.5, 0.3, 0.65, 0.3, 0.5, 0.4],
};

export const BASS_PATTERNS = {
  root: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  rootAndFive: [1, 0, 0, 0, 0, 0, 0.7, 0, 1, 0, 0, 0, 0, 0.6, 0, 0],
  syncopated: [1, 0, 0, 0.55, 0, 0, 0.9, 0, 0, 0.55, 0, 0, 1, 0, 0, 0.65],
};

// Relative scale-degree offsets from the current chord's root degree, one
// per 8th-note step across a 2-bar (16-step) phrase; null = the motif rests
// there — silence is part of the phrase, not a gap to fill. `character`
// steers which motifs a section reaches for (see lead.js).
export const LEAD_MOTIFS = [
  { name: 'arch', character: 'calm', steps: [0, null, 2, null, 4, null, 2, null, 0, null, null, 1, null, null, null, null] },
  { name: 'call-response', character: 'busy', steps: [0, 2, null, 4, null, 2, 0, null, null, 3, 4, null, 2, 0, null, null] },
  { name: 'rise', character: 'busy', steps: [null, 0, null, 1, null, 2, null, 3, null, 4, null, 3, null, 2, null, 0] },
  { name: 'sparse-drop', character: 'calm', steps: [4, null, null, null, 2, null, null, null, 0, null, null, null, null, null, null, null] },
];
