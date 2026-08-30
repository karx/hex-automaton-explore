// Pure music-theory helpers: note/frequency math, a scale table, and chord
// voicings. No engine or DSP dependency — every function here is a plain
// number-in, number-out mapping, independently testable.

const A4_FREQ = 440;

// semitoneFromA4 may be any real number (fractional = microtonal, unused today).
export function noteFreq(semitoneFromA4) {
  return A4_FREQ * Math.pow(2, semitoneFromA4 / 12);
}

// Semitone offsets from the tonic. Natural minor: moody, loops well, matches
// the "planned show" arrangement's default key (A minor).
export const SCALES = {
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
};

// Chord voicings as 0-based scale-degree indices into a SCALES entry.
// i (tonic), VI (relative major), VII, iv — a common minor-key loop.
export const CHORDS = {
  i: [0, 2, 4],
  VI: [5, 0, 2],
  VII: [6, 1, 3],
  iv: [3, 5, 0],
};

export const DEFAULT_PROGRESSION = ['i', 'VI', 'VII', 'iv'];

// degree: 0-based scale degree, any integer (wraps with an implied octave shift).
// octave: integer octave offset from the reference octave (0 = the one containing the tonic).
// tonicSemitoneFromA4: semitone offset of the key's tonic from A4 (0 = A, the default key).
export function degreeToFreq(degree, octave = 0, { scale = SCALES.naturalMinor, tonicSemitoneFromA4 = 0 } = {}) {
  const len = scale.length;
  const wrappedDegree = ((degree % len) + len) % len;
  const extraOctaves = Math.floor(degree / len);
  const semitone = tonicSemitoneFromA4 + scale[wrappedDegree] + (octave + extraOctaves) * 12;
  return noteFreq(semitone);
}

export function chordTones(chordSymbol, octave = 0, opts = {}) {
  const degrees = CHORDS[chordSymbol];
  if (!degrees) throw new Error(`Unknown chord: ${chordSymbol}`);
  return degrees.map((d) => degreeToFreq(d, octave, opts));
}
