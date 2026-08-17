// Offscreen field snapshots for the share card. Same renderer as the GIF
// pipeline — not a screenshot of the explorer chrome. Never upscales cell
// size: a 70×70 torus at cellSize 14 plus energy glow is a multi-frame hitch
// (energy glow alone drops the live view from 60 to ~8). Render small, crop,
// JPEG-encode.
import { renderFrame, computeLayout } from './render.js';

export function isSafeImage(src) {
  return typeof src === 'string' && /^data:image\/(png|jpeg);base64,/.test(src);
}

function makeCanvas(width, height, canvasFactory) {
  if (typeof canvasFactory === 'function') return canvasFactory(width, height);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  return null;
}

function reuseCanvas(holder, width, height, canvasFactory) {
  if (holder.canvas && holder.canvas.width === width && holder.canvas.height === height) {
    return holder.canvas;
  }
  holder.canvas = makeCanvas(width, height, canvasFactory);
  return holder.canvas;
}

function canvasToDataURL(canvas, mime = 'image/jpeg', quality = 0.82) {
  if (!canvas) return null;
  if (typeof canvas.toDataURL === 'function') {
    try {
      return canvas.toDataURL(mime, quality);
    } catch {
      return canvas.toDataURL('image/png');
    }
  }
  if (typeof canvas.toBuffer === 'function') {
    try {
      const type = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      return `data:${type};base64,${canvas.toBuffer(type).toString('base64')}`;
    } catch {
      return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
    }
  }
  return null;
}

function contentBounds(engine, layout, cellSize) {
  const { density, energy, n } = engine;
  const { positions, offsetX, offsetY, canvasWidth, canvasHeight } = layout;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const glow = cellSize * 2.2;
  for (let i = 0; i < n; i++) {
    if (density[i] < 0.04 && Math.abs(energy[i]) < 0.12) continue;
    const [px, py] = positions[i];
    const cx = px + offsetX;
    const cy = py + offsetY;
    if (cx - glow < minX) minX = cx - glow;
    if (cy - glow < minY) minY = cy - glow;
    if (cx + glow > maxX) maxX = cx + glow;
    if (cy + glow > maxY) maxY = cy + glow;
  }
  if (!Number.isFinite(minX)) return null;
  const pad = cellSize * 3;
  const x = Math.max(0, Math.floor(minX - pad));
  const y = Math.max(0, Math.floor(minY - pad));
  const w = Math.min(canvasWidth - x, Math.ceil(maxX + pad) - x);
  const h = Math.min(canvasHeight - y, Math.ceil(maxY + pad) - y);
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

function cropAndFit(src, bounds, maxW, maxH, canvasFactory) {
  const sx = bounds ? bounds.x : 0;
  const sy = bounds ? bounds.y : 0;
  const sw = bounds ? bounds.w : src.width;
  const sh = bounds ? bounds.h : src.height;
  const scale = Math.min(maxW / sw, maxH / sh, 3);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  if (!bounds && scale >= 0.999) return src;
  const dst = makeCanvas(dw, dh, canvasFactory);
  if (!dst) return src;
  const ctx = dst.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
  return dst;
}

export function snapshotField(engine, {
  cellSize = 3,
  maxWidth = 560,
  maxHeight = 340,
  canvasFactory,
  layout,
  scratch,
  mime = 'image/jpeg',
  quality = 0.82,
  layers = { density: true, energyGlow: true, momentumArrows: false },
} = {}) {
  if (!engine) return null;
  const usedLayout = layout || computeLayout(engine.width, engine.height, cellSize);
  const canvas = scratch
    ? reuseCanvas(scratch, usedLayout.canvasWidth, usedLayout.canvasHeight, canvasFactory)
    : makeCanvas(usedLayout.canvasWidth, usedLayout.canvasHeight, canvasFactory);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  renderFrame(ctx, engine, usedLayout, cellSize, layers);
  const bounds = contentBounds(engine, usedLayout, cellSize);
  const fitted = cropAndFit(canvas, bounds, maxWidth, maxHeight, canvasFactory);
  return canvasToDataURL(fitted, mime, quality);
}

// Log-spaced generation targets from first to last, inclusive.
// gen 0..1000, count 4 → ~0, 10, 99, 1000 — gaps grow; not a recent cluster.
export function logTargets(t0, t1, count) {
  const start = t0 | 0;
  const end = t1 | 0;
  if (count <= 1) return [end];
  const span = Math.max(0, end - start);
  const out = [];
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    out.push(start + Math.expm1(Math.log1p(span) * u));
  }
  out[0] = start;
  out[count - 1] = end;
  return out;
}

export function selectAsymptoticFrames(frames, count = 4) {
  if (!Array.isArray(frames) || frames.length === 0) return [];
  const sorted = [...frames].sort((a, b) => (a.generation | 0) - (b.generation | 0));
  const uniq = [];
  for (const f of sorted) {
    if (!uniq.length || uniq[uniq.length - 1].generation !== f.generation) uniq.push(f);
  }
  if (uniq.length <= count) return uniq;
  const targets = logTargets(uniq[0].generation, uniq[uniq.length - 1].generation, count);
  const used = new Set();
  const picked = [];
  for (const target of targets) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < uniq.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs((uniq[i].generation | 0) - target);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0) {
      used.add(best);
      picked.push(uniq[best]);
    }
  }
  return picked.sort((a, b) => (a.generation | 0) - (b.generation | 0));
}

function isLogMilestone(gen) {
  const g = gen | 0;
  if (g <= 1) return true;
  return (g & (g - 1)) === 0;
}

function dropLeastLogUseful(frames) {
  if (frames.length < 3) {
    frames.shift();
    return;
  }
  let drop = 1;
  let minRedundancy = Infinity;
  for (let i = 1; i < frames.length - 1; i++) {
    const prev = Math.log1p(frames[i - 1].generation);
    const cur = Math.log1p(frames[i].generation);
    const next = Math.log1p(frames[i + 1].generation);
    const redundancy = Math.min(cur - prev, next - cur);
    if (redundancy < minRedundancy) {
      minRedundancy = redundancy;
      drop = i;
    }
  }
  frames.splice(drop, 1);
}

// Records stills during the run. Stores many frames; the card picks a
// log-spaced subset so the strip is seed → early → late → now, not four
// recent twins. Density-only + cached layout so the live loop does not hitch.
export class GrowthTape {
  constructor({
    maxFrames = 32,
    maxStore,
    every = 24,
    cellSize = 2,
    canvasFactory,
    layers = { density: true, energyGlow: false, momentumArrows: false },
  } = {}) {
    this.maxStore = maxStore || maxFrames || 32;
    this.every = every;
    this.cellSize = cellSize;
    this.canvasFactory = canvasFactory;
    this.layers = layers;
    this.frames = [];
    this._layout = null;
    this._layoutKey = '';
    this._scratch = {};
  }

  reset() {
    this.frames = [];
    this._layout = null;
    this._layoutKey = '';
  }

  _layoutFor(engine) {
    const key = `${engine.width}x${engine.height}@${this.cellSize}`;
    if (this._layoutKey !== key) {
      this._layout = computeLayout(engine.width, engine.height, this.cellSize);
      this._layoutKey = key;
    }
    return this._layout;
  }

  capture(engine) {
    if (!engine) return;
    const image = snapshotField(engine, {
      cellSize: this.cellSize,
      maxWidth: 160,
      maxHeight: 100,
      canvasFactory: this.canvasFactory,
      layout: this._layoutFor(engine),
      scratch: this._scratch,
      layers: this.layers,
      mime: 'image/jpeg',
      quality: 0.72,
    });
    if (!image) return;
    const frame = { generation: engine.generation | 0, image };
    const last = this.frames[this.frames.length - 1];
    if (last && last.generation === frame.generation) {
      last.image = image;
      return;
    }
    this.frames.push(frame);
    while (this.frames.length > this.maxStore) dropLeastLogUseful(this.frames);
  }

  maybeCapture(engine) {
    if (!engine) return;
    if (this.frames.length === 0) {
      this.capture(engine);
      return;
    }
    const g = engine.generation | 0;
    const last = this.frames[this.frames.length - 1];
    const dueLinear = g - last.generation >= this.every;
    const dueLog = isLogMilestone(g) && last.generation !== g;
    if (dueLinear || dueLog) this.capture(engine);
  }
}
