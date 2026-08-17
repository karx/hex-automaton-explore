// Raster OG image + PNG favicon set. Hex motif matches the explorer palette
// (indigo → amber density ramp on #05060a).
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';

const BG = '#05060a';
const AMBER = '#ffb545';
const INDIGO = '#4a4de0';
const TEXT = '#d8dae2';
const MUTED = '#9ea3ba';
const CYAN = '#7ecbff';

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function densityColor(t) {
  const hue = 252 - 218 * t;
  const sat = 55 + 30 * t;
  const light = 12 + 46 * t;
  return `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`;
}

function drawHexField(ctx, x0, y0, w, h, cell) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  const dx = cell * Math.sqrt(3);
  const dy = cell * 1.5;
  let row = 0;
  for (let y = y0 - cell; y < y0 + h + cell; y += dy, row++) {
    const odd = row % 2;
    for (let x = x0 - cell + (odd ? dx / 2 : 0); x < x0 + w + cell; x += dx) {
      const nx = (x - x0) / w;
      const ny = (y - y0) / h;
      const t = Math.min(1, Math.max(0, 0.15 + 0.85 * (0.55 * nx + 0.35 * (1 - Math.abs(ny - 0.45) * 2) + 0.15 * Math.sin(nx * 9 + ny * 5))));
      if (t < 0.12) continue;
      hexPath(ctx, x, y, cell * 0.92);
      ctx.fillStyle = densityColor(t);
      ctx.fill();
    }
  }
  ctx.restore();
}

function writePng(name, canvas) {
  writeFileSync(name, canvas.toBuffer('image/png'));
  console.log(`${name}  ${canvas.width}x${canvas.height}  ${Math.round(canvas.toBuffer('image/png').length / 1024)}KB`);
}

// --- OG 1200x630 ---
{
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = AMBER;
  ctx.fillRect(0, 0, W, 8);
  ctx.fillRect(0, H - 8, W, 8);

  drawHexField(ctx, 620, 40, 560, 540, 16);

  ctx.fillStyle = AMBER;
  hexPath(ctx, 72, 88, 22);
  ctx.fill();

  ctx.fillStyle = TEXT;
  ctx.font = '700 22px Arial, sans-serif';
  ctx.fillText('MULTI-FIELD HEX AUTOMATON', 108, 96);

  ctx.fillStyle = TEXT;
  ctx.font = '700 52px Arial, sans-serif';
  ctx.fillText('Grow living hex fields.', 48, 200);
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px Arial, sans-serif';
  ctx.fillText('Density, energy, and momentum on a torus.', 48, 244);

  ctx.strokeStyle = '#23263a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, 272);
  ctx.lineTo(420, 272);
  ctx.stroke();

  const pills = ['2D explorer', '3D layers', '14 presets', 'Rule kits', "Langton's Ant"];
  ctx.font = '600 16px Arial, sans-serif';
  let px = 48, py = 310;
  for (const p of pills) {
    const tw = ctx.measureText(p).width;
    ctx.fillStyle = '#191c28';
    ctx.strokeStyle = '#2c2f42';
    ctx.lineWidth = 1;
    const bw = tw + 24, bh = 32;
    ctx.beginPath();
    ctx.rect(px, py, bw, bh);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CYAN;
    ctx.fillText(p, px + 12, py + 21);
    px += bw + 10;
    if (px > 540) { px = 48; py += 42; }
  }

  ctx.fillStyle = MUTED;
  ctx.font = '400 16px Arial, sans-serif';
  ctx.fillText('Two sliders. Export the live rule set. Free and open.', 48, 430);

  ctx.fillStyle = '#10121a';
  ctx.fillRect(0, 560, W, 62);
  ctx.fillStyle = MUTED;
  ctx.font = '400 16px Arial, sans-serif';
  ctx.fillText('Interactive cellular automaton', 48, 598);
  ctx.fillStyle = AMBER;
  ctx.font = '600 16px Arial, sans-serif';
  ctx.fillText('karx.github.io/hex-automaton-explore', W - 48 - ctx.measureText('karx.github.io/hex-automaton-explore').width, 598);

  writePng('og-image.png', canvas);
}

// --- icon set ---
function paintIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  const r = size * 0.36;
  hexPath(ctx, size / 2, size / 2, r);
  ctx.fillStyle = AMBER;
  ctx.fill();
  hexPath(ctx, size / 2, size / 2, r * 0.42);
  ctx.fillStyle = INDIGO;
  ctx.fill();
  return canvas;
}

writePng('favicon-32x32.png', paintIcon(32));
writePng('favicon-192.png', paintIcon(192));
writePng('favicon-512.png', paintIcon(512));
writePng('apple-touch-icon.png', paintIcon(180));
