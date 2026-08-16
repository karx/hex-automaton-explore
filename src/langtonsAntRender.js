// Rendering for the hex Langton's Ant (src/langtonsAnt.js). Unlike
// src/render.js (a fixed-size grid rendered 1:1), the ant's grid is sparse
// and logically infinite, so every frame auto-fits the current visited
// bounding box into the canvas — the pattern grows, the view zooms out to
// keep it framed.
import { axialToPixel, DIR_VECS } from './engine.js';

const HEX_PTS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [Math.cos(a), Math.sin(a)];
});

// Distinct hue per nonzero state; state 0 is background (never drawn — cells
// in that state simply aren't in the map). For the classic 2-state "LR" rule
// this means everything drawn is a single color.
function stateColor(state, states) {
  if (states <= 2) return '#5ce8a6';
  const hue = ((state - 1) / Math.max(1, states - 1)) * 300;
  return `hsl(${hue.toFixed(0)} 75% 58%)`;
}

export function renderLangtonsAnt(ctx, ant, canvasWidth, canvasHeight, { padding = 24, baseCellSize = 7 } = {}) {
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const cells = ant.cells;
  if (cells.size === 0) {
    drawAnt(ctx, ant, canvasWidth / 2, canvasHeight / 2, baseCellSize);
    return { scale: 1, cellCount: 0 };
  }

  // bounding box in unit-hex pixel space (cellSize=1), covering both visited
  // cells and the ant's own current position (so the marker is never clipped)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const positions = new Array(cells.size);
  let i = 0;
  for (const k of cells.keys()) {
    const [q, r] = k.split(',');
    const [x, y] = axialToPixel(+q, +r, 1);
    positions[i++] = [x, y, cells.get(k)];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const [antX, antY] = axialToPixel(ant.q, ant.r, 1);
  minX = Math.min(minX, antX); maxX = Math.max(maxX, antX);
  minY = Math.min(minY, antY); maxY = Math.max(maxY, antY);

  const bboxW = Math.max(1e-6, maxX - minX);
  const bboxH = Math.max(1e-6, maxY - minY);
  const availW = canvasWidth - padding * 2;
  const availH = canvasHeight - padding * 2;
  const fitScale = Math.min(availW / bboxW, availH / bboxH);
  const scale = Math.min(baseCellSize, fitScale); // never zoom in past 1 cell = baseCellSize px
  const cx0 = canvasWidth / 2 - ((minX + maxX) / 2) * scale;
  const cy0 = canvasHeight / 2 - ((minY + maxY) / 2) * scale;

  const r = Math.max(0.6, scale * 0.95);
  for (const [x, y, state] of positions) {
    const cx = x * scale + cx0, cy = y * scale + cy0;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const px = cx + HEX_PTS[k][0] * r, py = cy + HEX_PTS[k][1] * r;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = stateColor(state, ant.states);
    ctx.fill();
  }

  drawAnt(ctx, ant, antX * scale + cx0, antY * scale + cy0, Math.max(2, scale));
  return { scale, cellCount: cells.size };
}

function drawAnt(ctx, ant, cx, cy, size) {
  const [dx, dy] = DIR_VECS[ant.dir];
  ctx.beginPath();
  ctx.arc(cx, cy, size * 1.4, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, size * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + dx * size * 2.4, cy + dy * size * 2.4);
  ctx.lineTo(cx - dy * size * 0.8, cy + dx * size * 0.8);
  ctx.lineTo(cx + dy * size * 0.8, cy - dx * size * 0.8);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}
