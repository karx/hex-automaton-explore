import { buildArrangement, sectionAt, CYCLE_DURATION_SEC } from '../src/music/arrangement.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

check('one cycle is 6-8 minutes', CYCLE_DURATION_SEC >= 360 && CYCLE_DURATION_SEC <= 480);

for (const duration of [5, 30, 900, 3600]) {
  const sections = buildArrangement(duration);
  check(`[${duration}s] at least one section`, sections.length >= 1);
  check(`[${duration}s] first section starts at 0`, sections[0].startSec === 0);
  check(`[${duration}s] last section ends exactly at duration`, sections[sections.length - 1].endSec === duration);

  let gapless = true;
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].startSec !== sections[i - 1].endSec) gapless = false;
  }
  check(`[${duration}s] sections are contiguous (no gaps/overlaps)`, gapless);

  const everySectionHasLayer = sections.every((s) => Object.values(s.activeLayers).some(Boolean));
  check(`[${duration}s] every section has >=1 active layer`, everySectionHasLayer);

  const everyHasChord = sections.every((s) => typeof s.chordSymbol === 'string' && s.chordSymbol.length > 0);
  check(`[${duration}s] every section has a chord symbol`, everyHasChord);
}

const hourSections = buildArrangement(3600);
check('an hour repeats the cycle more than once', hourSections.some((s) => s.cycleIndex > 0));

const mid = sectionAt(hourSections, hourSections[3].startSec + 1);
check('sectionAt finds the section containing a given time', mid === hourSections[3]);
check('sectionAt falls back to the last section past the end', sectionAt(hourSections, 999999) === hourSections[hourSections.length - 1]);

let threwOnZeroDuration = false;
try { buildArrangement(0); } catch { threwOnZeroDuration = true; }
check('rejects a non-positive duration', threwOnZeroDuration);

if (failed) {
  console.error(`\nverify-arrangement: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-arrangement: all checks passed');
