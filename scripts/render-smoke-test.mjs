import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import { Engine } from '../src/engine.js';
import { renderFrame, computeLayout } from '../src/render.js';
import { ParticleSystem } from '../src/particles.js';
import { PRESETS, getPresetParams, getPresetSeedFn } from '../src/presets.js';

const preset = PRESETS.find((p) => p.id === 'resonant-bloom');
const params = getPresetParams(preset);
const seedFn = getPresetSeedFn(preset);

const GRID = 50, CELL_SIZE = 8;
const engine = new Engine(GRID, GRID, params, seedFn);
const layout = computeLayout(GRID, GRID, CELL_SIZE);
const canvas = createCanvas(layout.canvasWidth, layout.canvasHeight);
const ctx = canvas.getContext('2d');
const particles = new ParticleSystem();

for (let i = 0; i < 250; i++) {
  engine.step();
  particles.spawn(engine, layout);
  particles.update();
}

renderFrame(ctx, engine, layout, CELL_SIZE, { density: true, energyGlow: true, momentumArrows: true, particleSystem: particles });
writeFileSync('scripts/render-smoke-full.png', canvas.toBuffer('image/png'));

renderFrame(ctx, engine, layout, CELL_SIZE, { density: true, energyGlow: false, momentumArrows: false, particleSystem: null });
writeFileSync('scripts/render-smoke-density-only.png', canvas.toBuffer('image/png'));

renderFrame(ctx, engine, layout, CELL_SIZE, { density: false, energyGlow: true, momentumArrows: false, particleSystem: null });
writeFileSync('scripts/render-smoke-energy-only.png', canvas.toBuffer('image/png'));

renderFrame(ctx, engine, layout, CELL_SIZE, { density: true, energyGlow: false, momentumArrows: true, particleSystem: null });
writeFileSync('scripts/render-smoke-momentum-only.png', canvas.toBuffer('image/png'));

console.log('wrote render-smoke-*.png, particles alive:', particles.particles.length, 'lastStats:', engine.lastStats);
