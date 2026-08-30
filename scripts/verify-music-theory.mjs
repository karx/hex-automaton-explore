import { noteFreq, degreeToFreq, chordTones, SCALES, CHORDS, DEFAULT_PROGRESSION } from '../src/music/components/theory.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

check('noteFreq(0) is A4 = 440', Math.abs(noteFreq(0) - 440) < 1e-9);
check('noteFreq(12) is one octave up (880)', Math.abs(noteFreq(12) - 880) < 1e-9);
check('noteFreq(-12) is one octave down (220)', Math.abs(noteFreq(-12) - 220) < 1e-9);

check('naturalMinor scale has 7 degrees', SCALES.naturalMinor.length === 7);
check('naturalMinor starts on the tonic (0)', SCALES.naturalMinor[0] === 0);

for (const [symbol, degrees] of Object.entries(CHORDS)) {
  check(`chord ${symbol} has 3 tones`, degrees.length === 3);
}

for (const symbol of DEFAULT_PROGRESSION) {
  check(`progression chord "${symbol}" is a known chord`, !!CHORDS[symbol]);
}

let allFinite = true;
for (let degree = -14; degree <= 21; degree++) {
  for (let octave = -2; octave <= 3; octave++) {
    const f = degreeToFreq(degree, octave);
    if (!Number.isFinite(f) || f <= 0) allFinite = false;
  }
}
check('degreeToFreq stays finite/positive across a wide degree/octave range', allFinite);

check('degreeToFreq wraps octave correctly (degree 7 == degree 0, octave+1)', Math.abs(degreeToFreq(7, 0) - degreeToFreq(0, 1)) < 1e-9);
check('degreeToFreq(0,0) is the tonic (A4 by default)', Math.abs(degreeToFreq(0, 0) - 440) < 1e-9);

const tones = chordTones('i', 1);
check('chordTones returns 3 frequencies for chord i', tones.length === 3);
check('chordTones frequencies are all audible (20Hz-20kHz)', tones.every((f) => f >= 20 && f <= 20000));

let threwUnknownChord = false;
try { chordTones('bogus'); } catch { threwUnknownChord = true; }
check('chordTones rejects an unknown chord symbol', threwUnknownChord);

if (failed) {
  console.error(`\nverify-music-theory: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-music-theory: all checks passed');
