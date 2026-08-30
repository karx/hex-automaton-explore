// Transcript generator for the music-video pipeline: a timed lyrics/caption
// track derived from the arrangement's section names, the running preset's
// own name/description (src/presets.js), and the field's live stats crossing
// notable thresholds. Text only for now — on-canvas caption burn-in and
// sung/spoken vocals are later integration points (see docs/MUSIC_VIDEO.md),
// not built here.

const SECTION_LINES = {
  Intro: (name) => `${name} stirs from silence.`,
  Build: (name) => `${name} gathers.`,
  Theme: (name) => `${name} — in full bloom.`,
  Bridge: () => 'a turn in the field.',
  Climax: (name) => `${name} resonates at its peak.`,
  Release: (name) => `${name} settles.`,
};

const RESONANCE_MILESTONE = 0.9;
const ALIVE_MILESTONE = 0.5;

// arrangement: from src/music/arrangement.js. presetMeta: a src/presets.js
// entry ({ name, description }). statSamples: [{ timeSec, lastStats, n }],
// sampled periodically by the caller while the engine runs (not every tick —
// the caller controls resolution).
export function generateLyrics(arrangement, presetMeta, statSamples = []) {
  const cues = [];
  const presetName = presetMeta?.name || 'The field';

  for (const section of arrangement) {
    const lineFn = SECTION_LINES[section.name];
    if (lineFn) cues.push({ timeSec: section.startSec, text: lineFn(presetName) });
  }

  let sawResonance = false;
  let sawAlive = false;
  for (const sample of statSamples) {
    const stats = sample.lastStats;
    if (!stats || !sample.n) continue;
    if (!sawResonance && stats.resonance >= RESONANCE_MILESTONE) {
      sawResonance = true;
      cues.push({ timeSec: sample.timeSec, text: `resonance holds at ${(stats.resonance * 100).toFixed(0)}%.` });
    }
    const fracAlive = stats.aliveCells / sample.n;
    if (!sawAlive && fracAlive >= ALIVE_MILESTONE) {
      sawAlive = true;
      cues.push({ timeSec: sample.timeSec, text: `alive crosses ${(fracAlive * 100).toFixed(0)}%.` });
    }
  }

  cues.sort((a, b) => a.timeSec - b.timeSec);
  return cues;
}

function formatLrcTimestamp(timeSec) {
  const mm = Math.floor(timeSec / 60);
  const ss = timeSec - mm * 60;
  return `${String(mm).padStart(2, '0')}:${ss.toFixed(2).padStart(5, '0')}`;
}

export function toLrc(cues) {
  return cues.map((c) => `[${formatLrcTimestamp(c.timeSec)}]${c.text}`).join('\n');
}

// Parses toLrc()'s own output back into { timeSec, text } cues — used to
// round-trip-test the format, not a general-purpose .lrc parser.
export function parseLrc(text) {
  const lines = text.split('\n').filter(Boolean);
  return lines.map((line) => {
    const m = /^\[(\d{2}):(\d{2}\.\d{2})\](.*)$/.exec(line);
    if (!m) throw new Error(`Malformed .lrc line: ${line}`);
    const timeSec = Number(m[1]) * 60 + Number(m[2]);
    return { timeSec, text: m[3] };
  });
}

export function toTranscript(cues) {
  return cues.map((c) => `[${formatLrcTimestamp(c.timeSec)}] ${c.text}`).join('\n');
}
