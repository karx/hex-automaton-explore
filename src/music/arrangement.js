// The fixed "planned show" macro-structure: a repeating cycle of named
// sections (Intro -> Build -> Theme -> Bridge -> Climax -> Release) that
// guarantees a satisfying arc regardless of what the field is doing. The
// field's live stats (fed in later, by the composer) only steer texture
// *within* this arc — this module is pure structure and has zero
// dependency on engine state.
import { DEFAULT_PROGRESSION } from './components/theory.js';

// One cycle = 420s (7 min). All durations are integer seconds so summing
// them across many repeated cycles never drifts from floating-point error.
const CYCLE_TEMPLATE = [
  { name: 'Intro', durSec: 45, activeLayers: { pad: true, bass: false, perc: false, lead: false }, targetDynamics: 0.2 },
  { name: 'Build', durSec: 75, activeLayers: { pad: true, bass: true, perc: false, lead: false }, targetDynamics: 0.45 },
  { name: 'Theme', durSec: 120, activeLayers: { pad: true, bass: true, perc: true, lead: true }, targetDynamics: 0.8 },
  { name: 'Bridge', durSec: 60, activeLayers: { pad: true, bass: false, perc: true, lead: true }, targetDynamics: 0.5 },
  { name: 'Climax', durSec: 90, activeLayers: { pad: true, bass: true, perc: true, lead: true }, targetDynamics: 1.0 },
  { name: 'Release', durSec: 30, activeLayers: { pad: true, bass: false, perc: false, lead: false }, targetDynamics: 0.15 },
];

export const CYCLE_DURATION_SEC = CYCLE_TEMPLATE.reduce((s, e) => s + e.durSec, 0);

// Returns sections covering exactly [0, durationSec], no gaps or overlaps.
// The final section is clipped to end exactly at durationSec (works for a
// full hour and for a 5-second smoke test alike — the latter just yields a
// single clipped Intro sliver).
export function buildArrangement(durationSec, { progression = DEFAULT_PROGRESSION } = {}) {
  if (!(durationSec > 0)) throw new Error(`durationSec must be > 0, got ${durationSec}`);
  const sections = [];
  let t = 0;
  let globalIndex = 0;
  outer: while (t < durationSec) {
    for (const entry of CYCLE_TEMPLATE) {
      if (t >= durationSec) break outer;
      const start = t;
      const end = Math.min(t + entry.durSec, durationSec);
      sections.push({
        name: entry.name,
        startSec: start,
        endSec: end,
        activeLayers: entry.activeLayers,
        targetDynamics: entry.targetDynamics,
        chordSymbol: progression[globalIndex % progression.length],
        cycleIndex: Math.floor(globalIndex / CYCLE_TEMPLATE.length),
      });
      t = end;
      globalIndex += 1;
    }
  }
  return sections;
}

export function sectionAt(sections, tSec) {
  // Plain forward scan: at most a few hundred sections per hour, called once
  // per 16th-note tick, so this is nowhere near a hot path.
  for (const s of sections) {
    if (tSec >= s.startSec && tSec < s.endSec) return s;
  }
  return sections[sections.length - 1];
}
