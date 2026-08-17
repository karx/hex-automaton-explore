// Layered hex-cell rendering, shared by the browser demo and headless GIF capture.
// Three visual layers map directly onto the three simulation fields (intent doc
// section 4): density -> filled hexes, energy -> additive glow overlay, momentum ->
// vector arrows. A fourth layer (particles.js) visualizes energy leakage in motion.
// See docs/VISUALIZATION_STYLE_GUIDE.md for the full color/shape rationale.
import { axialToPixel } from './engine.js';

function hexPoints(size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([size * Math.cos(angle), size * Math.sin(angle)]);
  }
  return pts;
}

export function computeLayout(width, height, cellSize) {
  const pts = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const [x, y] = axialToPixel(q, r, cellSize);
      pts.push([x, y]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const pad = cellSize * 1.5;
  return {
    positions: pts,
    canvasWidth: Math.ceil(maxX - minX + pad * 2),
    canvasHeight: Math.ceil(maxY - minY + pad * 2),
    offsetX: -minX + pad,
    offsetY: -minY + pad,
  };
}

// Density -> color only (no energy mixing): deep indigo at low density, warm amber
// at high density. Kept as a pure single-field encoding so the density layer alone
// answers "where is there material" without energy or momentum bleeding into it.
function densityColor(d) {
  const hue = 252 - 218 * Math.min(1, d);
  const sat = 55 + 30 * Math.min(1, d);
  const light = 10 + 46 * Math.min(1, d);
  return `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`;
}

const HEX_PTS = hexPoints(1);

export function renderDensityLayer(ctx, engine, layout, cellSize) {
  const { positions, offsetX, offsetY } = layout;
  const { density, n } = engine;
  const r = cellSize * 0.98;

  for (let i = 0; i < n; i++) {
    const d = density[i];
    if (d < 0.04) continue;
    const [px, py] = positions[i];
    const cx = px + offsetX, cy = py + offsetY;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const x = cx + HEX_PTS[k][0] * r;
      const y = cy + HEX_PTS[k][1] * r;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = densityColor(d);
    ctx.fill();
  }
}

// Energy -> additive-blend radial glow, warm for positive energy (production/heat),
// cool violet for negative energy (deficit). Skipped entirely for near-zero energy.
//
// The two gradients are built ONCE per call, in local space (centered at the
// origin), then repositioned per-cell via ctx.translate() rather than passing
// each cell's own (cx, cy) into a fresh createRadialGradient() call. Per-cell
// intensity (`mag`) is applied via globalAlpha instead of being baked into the
// gradient's color stops, which is mathematically equivalent (globalAlpha
// multiplies the fill's alpha channel, same as scaling the stop's alpha) but
// avoids reconstructing a gradient for every energetic cell. This mattered:
// createRadialGradient() per cell was the dominant cost by far — isolating
// this layer alone (density/momentum/particles off) dropped FPS from a solid
// 60 to ~8 on a ~60%-alive preset (~2900 energetic cells on a 70x70 grid),
// while every other layer held 60fps at the same cell count.
export function renderEnergyGlowLayer(ctx, engine, layout, cellSize) {
  const { positions, offsetX, offsetY } = layout;
  const { energy, n } = engine;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  // Radius matters far more than gradient/blend-mode choice for this layer's
  // cost — it's fill-rate/rasterization-bound, not JS-object-allocation-bound
  // (measured via scripts/profile-energy-isolate.html: shrinking radius from
  // 17px to 10px at ~2900 overlapping cells took a synthetic worst-case from
  // ~12fps to ~34fps, while switching blend mode or reusing one shared
  // gradient object made almost no difference on their own). 1.3x still
  // overlaps neighboring hex cells enough to merge into a bloom — hex
  // spacing at this cellSize is ~1.7x cellSize center-to-center — just not
  // as aggressively as the original 2.1x.
  const glowR = cellSize * 1.3;

  const warmGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  warmGrad.addColorStop(0, 'rgba(255, 200, 110, 0.55)');
  warmGrad.addColorStop(1, 'rgba(255, 160, 60, 0)');
  const coolGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  coolGrad.addColorStop(0, 'rgba(130, 140, 255, 0.4)');
  coolGrad.addColorStop(1, 'rgba(90, 90, 220, 0)');

  for (let i = 0; i < n; i++) {
    const e = energy[i];
    if (Math.abs(e) < 0.12) continue;
    const [px, py] = positions[i];
    const cx = px + offsetX, cy = py + offsetY;
    const mag = Math.min(1, Math.abs(e) / 2);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = mag;
    ctx.fillStyle = e > 0 ? warmGrad : coolGrad;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

// Momentum -> short directional arrows, subsampled so they read as a flow field
// instead of clutter. Opacity scales with local density so arrows fade where
// there's no material carrying the momentum.
export function renderMomentumArrowsLayer(ctx, engine, layout, cellSize, { stride } = {}) {
  const { positions, offsetX, offsetY } = layout;
  const { density, momX, momY } = engine;
  const s = stride || Math.max(1, Math.round(3 - cellSize / 6));
  const len = cellSize * 0.95;
  const haloWidth = Math.max(1.4, cellSize * 0.22);
  const lineWidth = Math.max(0.8, cellSize * 0.11);

  for (let r = 0; r < engine.height; r += s) {
    for (let q = 0; q < engine.width; q += s) {
      const i = r * engine.width + q;
      const d = density[i];
      if (d < 0.12) continue;
      const mx = momX[i], my = momY[i];
      const mlen = Math.hypot(mx, my);
      if (mlen < 1e-3) continue;
      const [px, py] = positions[i];
      const cx = px + offsetX, cy = py + offsetY;
      const ux = mx / mlen, uy = my / mlen;
      const alpha = Math.min(1, 0.55 + d * 0.5);
      const tailX = cx - ux * len * 0.4, tailY = cy - uy * len * 0.4;
      const tipX = cx + ux * len * 0.5, tipY = cy + uy * len * 0.5;

      // dark halo first so the bright arrow reads against any background color/glow
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = 'rgba(4, 6, 14, 0.9)';
      ctx.lineWidth = haloWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(210, 245, 255, 0.95)';
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      const perpX = -uy, perpY = ux;
      const headLen = len * 0.32;
      ctx.fillStyle = 'rgba(210, 245, 255, 0.95)';
      ctx.beginPath();
      ctx.moveTo(tipX + ux * headLen * 0.6, tipY + uy * headLen * 0.6);
      ctx.lineTo(tipX - ux * headLen * 0.3 + perpX * headLen * 0.4, tipY - uy * headLen * 0.3 + perpY * headLen * 0.4);
      ctx.lineTo(tipX - ux * headLen * 0.3 - perpX * headLen * 0.4, tipY - uy * headLen * 0.3 - perpY * headLen * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

const DEFAULT_LAYERS = { density: true, energyGlow: true, momentumArrows: true, particleSystem: null };

export function renderFrame(ctx, engine, layout, cellSize, layers = {}) {
  const opts = { ...DEFAULT_LAYERS, ...layers };
  const { canvasWidth, canvasHeight } = layout;
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (opts.density) renderDensityLayer(ctx, engine, layout, cellSize);
  if (opts.energyGlow) renderEnergyGlowLayer(ctx, engine, layout, cellSize);
  if (opts.momentumArrows) renderMomentumArrowsLayer(ctx, engine, layout, cellSize);
  if (opts.particleSystem) opts.particleSystem.render(ctx);
}
