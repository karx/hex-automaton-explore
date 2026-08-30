import { generateLyrics, toLrc, parseLrc, toTranscript } from '../src/lyrics.js';
import { buildArrangement } from '../src/music/arrangement.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

const duration = 900; // 15 min, spans several sections
const arrangement = buildArrangement(duration);
const presetMeta = { name: 'Pulsing Heart', description: 'A genuine crash-and-regrow cycle.' };

const N = 200;
const statSamples = Array.from({ length: N }, (_, i) => {
  const t = (i / (N - 1)) * duration;
  const phase = t / duration;
  return {
    timeSec: t,
    n: 3600,
    lastStats: {
      resonance: Math.min(0.99, phase * 1.2),
      aliveCells: Math.round(3600 * Math.min(0.95, phase * 1.5)),
    },
  };
});

const cues = generateLyrics(arrangement, presetMeta, statSamples);

check('produces at least one cue', cues.length > 0);
check('every cue has non-empty text', cues.every((c) => typeof c.text === 'string' && c.text.length > 0));
check('every cue is within [0, duration]', cues.every((c) => c.timeSec >= 0 && c.timeSec <= duration));

let sorted = true;
for (let i = 1; i < cues.length; i++) if (cues[i].timeSec < cues[i - 1].timeSec) sorted = false;
check('cues are sorted by time', sorted);

check('one cue per named section start', cues.filter((c) => c.timeSec === 0 || arrangement.some((s) => s.startSec === c.timeSec)).length >= arrangement.length);
check('a resonance milestone cue fires', cues.some((c) => c.text.includes('resonance holds')));
check('an alive milestone cue fires', cues.some((c) => c.text.includes('alive crosses')));

const lrc = toLrc(cues);
check('.lrc output has one line per cue', lrc.split('\n').length === cues.length);

const roundTripped = parseLrc(lrc);
let roundTripOk = roundTripped.length === cues.length;
if (roundTripOk) {
  for (let i = 0; i < cues.length; i++) {
    if (Math.abs(roundTripped[i].timeSec - cues[i].timeSec) > 0.005 || roundTripped[i].text !== cues[i].text) {
      roundTripOk = false;
      break;
    }
  }
}
check('.lrc round-trips back to the same timestamps and text', roundTripOk);

const transcript = toTranscript(cues);
check('transcript has one line per cue', transcript.split('\n').length === cues.length);

const emptyCues = generateLyrics(buildArrangement(5), presetMeta, []);
check('handles an empty statSamples list without throwing', Array.isArray(emptyCues) && emptyCues.length > 0);

if (failed) {
  console.error(`\nverify-lyrics: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-lyrics: all checks passed');
