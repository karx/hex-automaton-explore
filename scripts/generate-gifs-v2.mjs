// Enhanced GIF capture with the v2 visual layers (density + energy glow + momentum
// arrows + leak particles) for every library item (14 presets + authored favorites).
// Particles are spawned/updated every simulation step (not just sampled ones) so
// their motion reads as continuous once frames are sampled for the GIF.
//
//   node scripts/generate-gifs-v2.mjs              # all library items
//   node scripts/generate-gifs-v2.mjs coral-echo   # one or more ids
import { createCanvas } from '@napi-rs/canvas';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { Engine } from '../src/engine.js';
import { renderFrame, computeLayout } from '../src/render.js';
import { ParticleSystem } from '../src/particles.js';
import { PRESETS, getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';
import { FAVORITES, getFavorite, getFavoriteSeedFn } from '../src/favorites.js';

const GRID = 60;
const CELL_SIZE = 3;
const TOTAL_GENS = 650;
const SAMPLE_EVERY = 8;
const FRAME_DELAY_MS = 75;
const PALETTE_SIZE = 96;

const LIBRARY_IDS = [...PRESETS.map((p) => p.id), ...FAVORITES.map((f) => f.id)];

function resolveTarget(id) {
  try {
    const preset = getPreset(id);
    return { id: preset.id, name: preset.name, params: getPresetParams(preset), seedFn: getPresetSeedFn(preset) };
  } catch { /* favorite or unknown */ }
  try {
    const fav = getFavorite(id);
    return { id: fav.id, name: fav.name, params: { ...fav.params }, seedFn: getFavoriteSeedFn(fav) };
  } catch {
    throw new Error(`Unknown library item: ${id}`);
  }
}

const outDir = 'gifs-v2';
if (!existsSync(outDir)) mkdirSync(outDir);

const onlyIds = process.argv.slice(2);
const targets = (onlyIds.length ? onlyIds : LIBRARY_IDS).map(resolveTarget);

const summary = [];

for (const item of targets) {
  const t0 = Date.now();
  const engine = new Engine(GRID, GRID, item.params, item.seedFn);
  const layout = computeLayout(GRID, GRID, CELL_SIZE);
  const canvas = createCanvas(layout.canvasWidth, layout.canvasHeight);
  const ctx = canvas.getContext('2d');
  const particles = new ParticleSystem({ maxParticles: 140 });

  const gif = GIFEncoder();
  const metricsLog = [];

  for (let g = 0; g < TOTAL_GENS; g++) {
    engine.step();
    particles.spawn(engine, layout);
    particles.update();

    if (g % SAMPLE_EVERY === 0) {
      renderFrame(ctx, engine, layout, CELL_SIZE, {
        density: true, energyGlow: true, momentumArrows: true, particleSystem: particles,
      });
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const palette = quantize(data, PALETTE_SIZE);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, width, height, { palette, delay: FRAME_DELAY_MS });
    }
    if (g % 100 === 0 || g === TOTAL_GENS - 1) {
      const s = engine.lastStats;
      metricsLog.push({ generation: g, aliveCells: s.aliveCells, fracAlive: +(s.aliveCells / engine.n).toFixed(4), resonance: +s.resonance.toFixed(3) });
    }
  }
  gif.finish();
  const bytes = gif.bytes();
  const outPath = `${outDir}/${item.id}.gif`;
  writeFileSync(outPath, Buffer.from(bytes));

  const final = engine.lastStats;
  const record = {
    id: item.id, name: item.name, outPath,
    sizeKB: Math.round(bytes.length / 1024),
    frames: Math.ceil(TOTAL_GENS / SAMPLE_EVERY),
    generationsSimulated: TOTAL_GENS,
    died: final.aliveCells === 0,
    exploded: final.aliveCells / engine.n > 0.9,
    finalFracAlive: +(final.aliveCells / engine.n).toFixed(4),
    finalResonance: +final.resonance.toFixed(3),
    metricsLog,
    tookMs: Date.now() - t0,
  };
  summary.push(record);
  console.log(`${item.name}: ${record.sizeKB}KB, ${record.frames} frames, alive=${(record.finalFracAlive * 100).toFixed(1)}%, resonance=${record.finalResonance}, died=${record.died}, exploded=${record.exploded}, ${record.tookMs}ms`);
}

let existing = [];
try { existing = JSON.parse(readFileSync(`${outDir}/summary.json`, 'utf8')); } catch { /* first run */ }
const byId = new Map(existing.map((r) => [r.id, r]));
for (const r of summary) byId.set(r.id, r);
const merged = [];
for (const id of LIBRARY_IDS) {
  if (byId.has(id)) merged.push(byId.get(id));
}
for (const r of byId.values()) {
  if (!merged.includes(r)) merged.push(r);
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify(merged, null, 2));
console.log(`\nWrote ${outDir}/summary.json (${merged.length} items)`);
