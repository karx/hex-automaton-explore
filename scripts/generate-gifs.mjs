// Headless GIF capture: for each variant, run the CA and encode a sampled animated GIF
// showing the most interesting phase of its evolution (seed -> growth -> stabilized form).
import { createCanvas } from '@napi-rs/canvas';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { Engine } from '../src/engine.js';
import { renderFrame, computeLayout } from '../src/render.js';
import { VARIANTS } from '../src/variants.js';

const GRID = 70;
const CELL_SIZE = 3;
const TOTAL_GENS = 720;
const SAMPLE_EVERY = 9; // -> 80 frames
const FRAME_DELAY_MS = 75;
const PALETTE_SIZE = 64;

if (!existsSync('gifs')) mkdirSync('gifs');

const onlyIds = process.argv.slice(2);
const targets = onlyIds.length ? VARIANTS.filter((v) => onlyIds.includes(v.id)) : VARIANTS;

const summary = [];

for (const variant of targets) {
  const t0 = Date.now();
  const engine = new Engine(GRID, GRID, variant.params, variant.seed);
  const layout = computeLayout(GRID, GRID, CELL_SIZE);
  const canvas = createCanvas(layout.canvasWidth, layout.canvasHeight);
  const ctx = canvas.getContext('2d');

  const gif = GIFEncoder();
  const metricsLog = [];

  for (let g = 0; g < TOTAL_GENS; g++) {
    engine.step();
    if (g % SAMPLE_EVERY === 0) {
      renderFrame(ctx, engine, layout, CELL_SIZE);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const palette = quantize(data, PALETTE_SIZE);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, width, height, { palette, delay: FRAME_DELAY_MS });
    }
    if (g % 100 === 0 || g === TOTAL_GENS - 1) {
      const m = engine.metrics();
      metricsLog.push({ generation: g, aliveCells: m.aliveCells, fracAlive: +(m.aliveCells / engine.n).toFixed(4) });
    }
  }
  gif.finish();
  const bytes = gif.bytes();
  const outPath = `gifs/${variant.id}.gif`;
  writeFileSync(outPath, Buffer.from(bytes));

  const finalMetrics = engine.metrics();
  const record = {
    id: variant.id,
    name: variant.name,
    outPath,
    sizeKB: Math.round(bytes.length / 1024),
    frames: Math.ceil(TOTAL_GENS / SAMPLE_EVERY),
    generationsSimulated: TOTAL_GENS,
    died: finalMetrics.aliveCells === 0,
    exploded: finalMetrics.aliveCells / engine.n > 0.9,
    finalFracAlive: +(finalMetrics.aliveCells / engine.n).toFixed(4),
    metricsLog,
    tookMs: Date.now() - t0,
  };
  summary.push(record);
  console.log(`${variant.name}: ${record.sizeKB}KB, ${record.frames} frames, finalAlive=${(record.finalFracAlive * 100).toFixed(1)}%, died=${record.died}, exploded=${record.exploded}, ${record.tookMs}ms`);
}

writeFileSync('gifs/summary.json', JSON.stringify(summary, null, 2));
console.log('\nWrote gifs/summary.json');
