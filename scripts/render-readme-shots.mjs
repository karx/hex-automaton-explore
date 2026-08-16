// Developed stills for the README gallery. GIFs start at generation 0 (tiny
// seeds); GitHub shows the first frame, so the README needs late-generation
// PNGs that actually look like the patterns.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { Engine } from '../src/engine.js';
import { renderFrame, computeLayout } from '../src/render.js';
import { ParticleSystem } from '../src/particles.js';
import { PRESETS, getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';

const OUT = 'docs/shots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const GRID = 52;
const CELL_SIZE = 6;
const SHOWCASE = [
  { id: 'stable-crystal', gens: 450 },
  { id: 'resonant-bloom', gens: 520 },
  { id: 'ember-bloom', gens: 520 },
  { id: 'drifting-vortex', gens: 450 },
  { id: 'pulsing-heart', gens: 420 },
  { id: 'charged-current', gens: 450 },
];

function runTo(preset, gens, cellSize = CELL_SIZE, grid = GRID) {
  const params = getPresetParams(preset);
  const seedFn = getPresetSeedFn(preset);
  const engine = new Engine(grid, grid, params, seedFn);
  const layout = computeLayout(grid, grid, cellSize);
  const particles = new ParticleSystem({ maxParticles: 160 });
  for (let g = 0; g < gens; g++) {
    engine.step();
    particles.spawn(engine, layout);
    particles.update();
  }
  return { engine, layout, particles, cellSize };
}

function writePng(name, engine, layout, cellSize, layers) {
  const canvas = createCanvas(layout.canvasWidth, layout.canvasHeight);
  const ctx = canvas.getContext('2d');
  renderFrame(ctx, engine, layout, cellSize, layers);
  const dest = `${OUT}/${name}.png`;
  writeFileSync(dest, canvas.toBuffer('image/png'));
  const s = engine.lastStats;
  console.log(`${dest}  ${layout.canvasWidth}x${layout.canvasHeight}  gen=${s.generation}  alive=${(s.aliveCells / engine.n * 100).toFixed(1)}%  R=${s.resonance.toFixed(2)}`);
}

for (const { id, gens } of SHOWCASE) {
  const preset = getPreset(id);
  const { engine, layout, particles, cellSize } = runTo(preset, gens);
  writePng(`2d-${id}`, engine, layout, cellSize, {
    density: true, energyGlow: true, momentumArrows: true, particleSystem: particles,
  });
}

// Layer breakdown of Resonant Bloom so the README can show density / energy / momentum separately.
{
  const preset = getPreset('resonant-bloom');
  const { engine, layout, cellSize } = runTo(preset, 280, 8, 46);
  const base = { particleSystem: null };
  writePng('layer-density', engine, layout, cellSize, { ...base, density: true, energyGlow: false, momentumArrows: false });
  writePng('layer-energy', engine, layout, cellSize, { ...base, density: false, energyGlow: true, momentumArrows: false });
  writePng('layer-momentum', engine, layout, cellSize, { ...base, density: true, energyGlow: false, momentumArrows: true });
  writePng('layer-all', engine, layout, cellSize, { ...base, density: true, energyGlow: true, momentumArrows: true });
}
