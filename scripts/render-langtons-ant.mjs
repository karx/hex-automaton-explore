// Renders snapshots of the hex Langton's Ant at increasing step counts, to
// see the actual shape of the bounded-but-growing pattern found by
// scripts/analyze-langtons-ant.mjs.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import { LangtonsAnt } from '../src/langtonsAnt.js';
import { axialToPixel } from '../src/engine.js';

const CELL_SIZE = 4;
const PAD = 20;
const HEX_PTS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [Math.cos(a), Math.sin(a)];
});

// distinct hue per state; state 0 is never stored (background)
function stateColor(state, states) {
  const hue = (state / states) * 300;
  return `hsl(${hue.toFixed(0)} 75% 55%)`;
}

function render(ant, filename) {
  const cells = [...ant.cells.entries()].map(([k, state]) => {
    const [q, r] = k.split(',').map(Number);
    const [x, y] = axialToPixel(q, r, CELL_SIZE);
    return { x, y, state };
  });
  if (cells.length === 0) { console.log(filename, 'no cells to render'); return; }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  const w = Math.ceil(maxX - minX + PAD * 2);
  const h = Math.ceil(maxY - minY + PAD * 2);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, w, h);

  const r = CELL_SIZE * 0.95;
  for (const c of cells) {
    const cx = c.x - minX + PAD, cy = c.y - minY + PAD;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const x = cx + HEX_PTS[k][0] * r, y = cy + HEX_PTS[k][1] * r;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = stateColor(c.state, ant.states);
    ctx.fill();
  }

  // mark the ant's current position
  const [ax, ay] = axialToPixel(ant.q, ant.r, CELL_SIZE);
  ctx.beginPath();
  ctx.arc(ax - minX + PAD, ay - minY + PAD, r * 1.6, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  writeFileSync(filename, canvas.toBuffer('image/png'));
  console.log(filename, `${w}x${h}px, ${cells.length} visited cells, ${ant.steps} steps`);
}

const checkpoints = [1000, 10000, 100000, 1000000, 5000000];
const ant = new LangtonsAnt('LR');
let done = 0;
for (const cp of checkpoints) {
  ant.stepN(cp - done);
  done = cp;
  render(ant, `scripts/langtons-ant-${cp}.png`);
}
