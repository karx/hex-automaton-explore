// The generator's config object — one place describing an entire run, in the
// same spirit as src/ontology.js (meaningful knobs + defaults + a validated
// merge, not raw params scattered across a script). Swapping this object is
// what makes the pipeline a *generator* rather than one fixed show.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Drops undefined-valued keys so a spread merge can't clobber a default with
// "not provided" — callers (notably the CLI, which always builds an object
// literal even for flags the user didn't pass) routinely produce these.
function definedOnly(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

export const DEFAULT_SCHEMA = {
  presetId: 'pulsing-heart',
  durationSec: 3600,
  // 30fps + a 1876x1098 canvas (grid x cellSize) reads sharp instead of the
  // small/blurry 469x275 the old cellSize=3 default produced, and profiling
  // showed it stays close to real-time even at ~60% alive once energyGlow is
  // off (~0.84x-1.2x realtime measured, vs. far slower with glow enabled).
  fps: 30,
  grid: 60,
  cellSize: 12,
  // Generations per second of *video*, independent of fps — this is the
  // field's visible "turn rate". 15 keeps the picture visibly evolving most
  // frames instead of holding the same generation for several in a row.
  gensPerSecond: 15,
  tempo: 96,
  key: 'Am',
  seed: 1,
  layers: {
    // energyGlow defaults off: its per-cell radial gradients are by far the
    // most expensive part of a frame once the field densifies (profiled: the
    // dominant cost of a long render), and the video reads cleanly without it.
    // Pass --layers.video.energyGlow=true (or the equivalent schema override)
    // to bring it back for a shorter/lower-grid run.
    video: { density: true, energyGlow: false, momentumArrows: true, particles: true },
    // perc defaults off: kick/hat percussion cut against the chill/ambient
    // vibe this is going for, even after softening its attack and staggering
    // its entrance (docs/MUSIC_VIDEO.md, decision log). Pad/bass/lead alone
    // carry the arrangement. Pass --layers.audio.perc=true to bring it back.
    audio: { perc: false, bass: true, pad: true, lead: true },
  },
  // sink.type 'file' writes a local .mp4; 'rtmp' pushes a live stream.
  // RTMP is the lower-priority path for now — 'file' is what's exercised first.
  sink: { type: 'file', path: 'music-video.mp4', url: 'rtmp://localhost:1935/live/fieldca' },
};

function mergeLayers(base, overrides = {}) {
  return {
    video: { ...base.video, ...(overrides.video ?? {}) },
    audio: { ...base.audio, ...(overrides.audio ?? {}) },
  };
}

export function normalizeSchema(rawOverrides = {}) {
  const overrides = definedOnly(rawOverrides);
  const s = { ...DEFAULT_SCHEMA, ...overrides };
  s.durationSec = clamp(Number(s.durationSec) || DEFAULT_SCHEMA.durationSec, 1, 24 * 3600);
  s.fps = clamp(Math.round(Number(s.fps) || DEFAULT_SCHEMA.fps), 1, 60);
  s.grid = clamp(Math.round(Number(s.grid) || DEFAULT_SCHEMA.grid), 10, 200);
  s.cellSize = clamp(Number(s.cellSize) || DEFAULT_SCHEMA.cellSize, 1, 20);
  s.gensPerSecond = clamp(Number(s.gensPerSecond) || DEFAULT_SCHEMA.gensPerSecond, 0.5, 60);
  s.tempo = clamp(Number(s.tempo) || DEFAULT_SCHEMA.tempo, 40, 220);
  s.seed = Number.isFinite(Number(s.seed)) ? Number(s.seed) : DEFAULT_SCHEMA.seed;
  s.layers = mergeLayers(DEFAULT_SCHEMA.layers, overrides.layers);

  const sink = { ...DEFAULT_SCHEMA.sink, ...definedOnly(overrides.sink) };
  if (sink.type !== 'file' && sink.type !== 'rtmp') {
    throw new Error(`sink.type must be "file" or "rtmp", got "${sink.type}"`);
  }
  if (sink.type === 'rtmp' && !sink.url) {
    throw new Error('sink.type "rtmp" requires sink.url');
  }
  if (sink.type === 'file' && !sink.path) {
    throw new Error('sink.type "file" requires sink.path');
  }
  s.sink = sink;

  return s;
}
