import { KICK_PATTERNS, HAT_PATTERNS, BASS_PATTERNS, LEAD_MOTIFS } from '../src/music/components/groove.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

for (const [group, patterns] of Object.entries({ KICK_PATTERNS, HAT_PATTERNS, BASS_PATTERNS })) {
  for (const [name, pattern] of Object.entries(patterns)) {
    check(`${group}.${name} has 16 steps`, pattern.length === 16);
    check(`${group}.${name} values are in [0,1]`, pattern.every((v) => v >= 0 && v <= 1));
    check(`${group}.${name} has at least one hit`, pattern.some((v) => v > 0));
  }
}

check('at least 2 lead motifs exist', LEAD_MOTIFS.length >= 2);
check('both calm and busy motifs exist', LEAD_MOTIFS.some((m) => m.character === 'calm') && LEAD_MOTIFS.some((m) => m.character === 'busy'));
for (const motif of LEAD_MOTIFS) {
  check(`motif "${motif.name}" has 16 steps`, motif.steps.length === 16);
  check(`motif "${motif.name}" has at least one rest`, motif.steps.some((s) => s === null));
  check(`motif "${motif.name}" has at least one note`, motif.steps.some((s) => s !== null));
  const notes = motif.steps.filter((s) => s !== null);
  check(`motif "${motif.name}" degree offsets are small integers`, notes.every((n) => Number.isInteger(n) && Math.abs(n) <= 6));
}

if (failed) {
  console.error(`\nverify-groove: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-groove: all checks passed');
