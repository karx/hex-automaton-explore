// Enhanced GIF capture with the v2 visual layers (density + energy glow + momentum
// arrows + leak particles) for a curated subset of presets. Particles are
// spawned/updated every simulation step (not just sampled ones) so their motion
// reads as continuous once frames are sampled for the GIF.
import { createCanvas } from '@napi-rs/canvas';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { Engine } from '../src/engine.js';
import { renderFrame, computeLayout } from '../src/render.js';
import { ParticleSystem } from '../src/particles.js';
import { PRESETS, getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';

const GRID = 60;
const CELL_SIZE = 3;
const TOTAL_GENS = 650;
const SAMPLE_EVERY = 8;
const FRAME_DELAY_MS = 75;
const PALETTE_SIZE = 96; // richer than v1 (64) since glow/particles add more distinct colors

const SHOWCASE_IDS = ['stable-crystal', 'resonant-bloom', 'ember-bloom', 'drifting-vortex', 'pulsing-heart', 'charged-current'];

const outDir = 'gifs-v2';
if (!existsSync(outDir)) mkdirSync(outDir);

const onlyIds = process.argv.slice(2);
const targets = (onlyIds.length ? onlyIds : SHOWCASE_IDS).map((id) => getPreset(id));

const summary = [];

for (const preset of targets) {
  const t0 = Date.now();
  const params = getPresetParams(preset);
  const seedFn = getPresetSeedFn(preset);
  const engine = new Engine(GRID, GRID, params, seedFn);
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
  const outPath = `${outDir}/${preset.id}.gif`;
  writeFileSync(outPath, Buffer.from(bytes));

  const final = engine.lastStats;
  const record = {
    id: preset.id, name: preset.name, outPath,
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
  console.log(`${preset.name}: ${record.sizeKB}KB, ${record.frames} frames, alive=${(record.finalFracAlive * 100).toFixed(1)}%, resonance=${record.finalResonance}, died=${record.died}, exploded=${record.exploded}, ${record.tookMs}ms`);
}

writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(`\nWrote ${outDir}/summary.json`);
