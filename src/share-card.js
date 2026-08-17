// Share card v2 — 1200×630 receipt of an irreducible run.
// Artifact is the grown field (same renderer as the GIF pipeline), not a
// screenshot of the explorer. Raster to PNG before sharing — share sheets reject SVG.
import { isSafeImage } from './share-capture.js';

function css(varName, fallback) {
  if (typeof document !== 'undefined') {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  }
  return fallback;
}

function xe(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trunc(s, max) {
  const str = String(s ?? '');
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function fmtPct(n, digits = 0) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function embedImage(href, x, y, w, h, clipId) {
  if (!isSafeImage(href)) return '';
  const clip = clipId ? ` clip-path="url(#${clipId})"` : '';
  return `<image href="${href}" xlink:href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${clip}/>`;
}

export function generateShareCardSVG(data) {
  const title = trunc(data.title || 'Untitled run', 28);
  const date = trunc(data.date || '', 12);
  const outcome = data.outcome || 'LIVE';
  const formulaLines = (data.formulaLines || []).slice(0, 4).map((l) => trunc(l, 36));
  const generation = data.generation | 0;
  const gridW = data.gridWidth | 0;
  const gridH = data.gridHeight | 0;
  const ir = data.irreducible || {
    kicker: 'COMPUTED',
    steps: String(generation),
    unit: 'STEPS',
    line: 'No closed form. The only way to know this state is to run these steps.',
    lines: ['No closed form. No skip.', 'This state exists only because those steps ran.'],
  };
  const irLines = (ir.lines && ir.lines.length ? ir.lines : [ir.line]).slice(0, 2).map((l) => trunc(l, 48));

  const c = {
    bg: css('--bg-primary', '#000000'),
    bgAlt: css('--bg-secondary', '#080800'),
    bgCard: css('--bg-card', '#101008'),
    border: css('--border-color', '#1e1e00'),
    accent: css('--accent-orange', '#ff6600'),
    label: css('--accent-amber', '#ffaa00'),
    value: css('--data-highlight', '#e8e000'),
    body: css('--text-primary', '#ccccaa'),
    dim: css('--text-dim', '#445544'),
    select: css('--selection', '#00cccc'),
    ok: css('--success', '#00ff88'),
  };

  const outcomeColor = outcome === 'RESONANT' ? c.ok : outcome === 'QUIET' ? c.dim : c.value;

  const width = 1200;
  const height = 630;
  const headerH = 80;
  const footerH = 70;
  const bodyTop = headerH;
  const bodyBot = height - footerH;
  const dividerX = 668;
  const leftPad = 40;
  const rightPad = dividerX + 32;
  const rightW = width - 40 - rightPad;

  const snapX = leftPad;
  const snapY = bodyTop + 36;
  const snapW = dividerX - leftPad - 24;
  const snapH = 318;
  const tape = (data.growthFrames || []).filter((f) => isSafeImage(f.image)).slice(0, 4);
  const tapeY = snapY + snapH + 18;
  const tapeH = 72;
  const tapeGap = 8;
  const tapeW = tape.length ? Math.floor((snapW - tapeGap * (tape.length - 1)) / tape.length) : 0;

  const densityFrac = clamp01((data.densityPct || 0) / 100);
  const energySpan = (data.energyMax ?? 3) - (data.energyMin ?? -1) || 1;
  const energyFrac = clamp01(((data.energyMean ?? 0) - (data.energyMin ?? -1)) / energySpan);
  const momentumFrac = clamp01((data.momentumPct || 0) / 100);
  const resonanceFrac = clamp01(data.resonance || 0);

  const pressure = Number.isFinite(data.survivalPressure) ? data.survivalPressure.toFixed(2) : '—';
  const bias = Number.isFinite(data.momentumBias) ? data.momentumBias.toFixed(2) : '—';

  const statRows = [
    ['DENSITY', fmtPct(data.densityPct), densityFrac],
    ['ENERGY', Number.isFinite(data.energyMean) ? data.energyMean.toFixed(2) : '—', energyFrac],
    ['MOMENTUM', fmtPct(data.momentumPct), momentumFrac],
    ['RESONANCE', fmtPct(resonanceFrac * 100), resonanceFrac],
  ];

  function bar(x, y, w, frac) {
    const fillW = Math.max(0, Math.round(w * frac));
    return `
  <rect x="${x}" y="${y}" width="${w}" height="8" fill="${c.bg}" stroke="${c.border}" stroke-width="1"/>
  ${fillW > 0 ? `<rect x="${x}" y="${y}" width="${fillW}" height="8" fill="${c.accent}"/>` : ''}`;
  }

  const snapshot = isSafeImage(data.fieldSnapshot)
    ? embedImage(data.fieldSnapshot, snapX, snapY, snapW, snapH, 'fieldClip')
    : `
  <text x="${snapX + snapW / 2}" y="${snapY + snapH / 2 - 8}" style="font-size:12px;fill:${c.dim};text-anchor:middle;letter-spacing:1px;">FIELD NOT CAPTURED</text>
  <text x="${snapX + snapW / 2}" y="${snapY + snapH / 2 + 14}" style="font-size:11px;fill:${c.dim};text-anchor:middle;">run the steps to see it</text>`;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>text { font-family: 'Courier New', Courier, monospace; }</style>
    <clipPath id="fieldClip"><rect x="${snapX}" y="${snapY}" width="${snapW}" height="${snapH}" rx="6"/></clipPath>
  </defs>
  <rect width="${width}" height="${height}" fill="${c.bg}"/>

  <rect width="${width}" height="${headerH}" fill="${c.bgAlt}"/>
  <line x1="0" y1="${headerH}" x2="${width}" y2="${headerH}" stroke="${c.border}" stroke-width="1"/>
  <text x="${leftPad}" y="47" style="font-size:26px;font-weight:bold;fill:${c.accent};letter-spacing:3px;">HEX AUTOMATON</text>
  <text x="${leftPad}" y="68" style="font-size:10px;fill:${c.dim};letter-spacing:2px;">IRREDUCIBLE FIELD</text>
  <text x="${width - 40}" y="34" style="font-size:12px;fill:${c.dim};text-anchor:end;">${xe(date)}</text>
  <text x="${width - 40}" y="56" style="font-size:18px;font-weight:bold;fill:${outcomeColor};text-anchor:end;letter-spacing:2px;">${xe(outcome)}</text>
  <text x="${width - 40}" y="72" style="font-size:13px;fill:${c.select};text-anchor:end;">${xe(title)}</text>

  <line x1="${dividerX}" y1="${bodyTop + 18}" x2="${dividerX}" y2="${bodyBot - 18}" stroke="${c.border}" stroke-width="1" stroke-dasharray="4,4"/>

  <text x="${snapX}" y="${snapY - 10}" style="font-size:9px;fill:${c.dim};letter-spacing:2px;">THIS FIELD · GEN ${generation} · ${gridW}×${gridH}</text>
  <rect x="${snapX}" y="${snapY}" width="${snapW}" height="${snapH}" fill="#05060a" rx="6"/>
  <rect x="${snapX}" y="${snapY}" width="${snapW}" height="${snapH}" fill="none" stroke="${c.border}" stroke-width="1" rx="6"/>
  ${snapshot}

  ${tape.length ? `<text x="${snapX}" y="${tapeY - 6}" style="font-size:9px;fill:${c.dim};letter-spacing:2px;">GROWTH · HAD TO BE RUN</text>` : ''}
  ${tape.map((f, i) => {
    const x = snapX + i * (tapeW + tapeGap);
    return `
  <rect x="${x}" y="${tapeY}" width="${tapeW}" height="${tapeH}" fill="#05060a" rx="4"/>
  <rect x="${x}" y="${tapeY}" width="${tapeW}" height="${tapeH}" fill="none" stroke="${c.border}" stroke-width="1" rx="4"/>
  ${embedImage(f.image, x, tapeY, tapeW, tapeH)}
  <text x="${x + 6}" y="${tapeY + tapeH - 6}" style="font-size:9px;fill:${c.label};">${i === 0 && f.generation === 0 ? 'SEED' : `G${f.generation}`}</text>`;
  }).join('')}

  <text x="${rightPad}" y="${bodyTop + 36}" style="font-size:9px;fill:${c.dim};letter-spacing:2px;">${xe(ir.kicker)}</text>
  <text x="${rightPad}" y="${bodyTop + 78}" style="font-size:42px;font-weight:bold;fill:${c.value};letter-spacing:1px;">${xe(ir.steps)}</text>
  <text x="${rightPad}" y="${bodyTop + 102}" style="font-size:12px;fill:${c.label};letter-spacing:2px;">${xe(ir.unit)}</text>
  ${irLines.map((line, i) => `
  <text x="${rightPad}" y="${bodyTop + 128 + i * 18}" style="font-size:12px;fill:${c.body};">${xe(line)}</text>`).join('')}

  <line x1="${rightPad}" y1="${bodyTop + 164}" x2="${width - 40}" y2="${bodyTop + 164}" stroke="${c.border}" stroke-width="1"/>
  ${statRows.map(([label, val, frac], i) => {
    const y = bodyTop + 188 + i * 42;
    return `
  <text x="${rightPad}" y="${y}" style="font-size:10px;fill:${c.label};letter-spacing:2px;">${label}</text>
  <text x="${width - 40}" y="${y}" style="font-size:16px;font-weight:bold;fill:${c.value};text-anchor:end;">${xe(val)}</text>
  ${bar(rightPad, y + 8, rightW, frac)}`;
  }).join('')}

  <text x="${rightPad}" y="${bodyTop + 368}" style="font-size:10px;fill:${c.dim};letter-spacing:2px;">RULE</text>
  ${formulaLines.slice(0, 2).map((line, i) => `
  <text x="${rightPad}" y="${bodyTop + 388 + i * 18}" style="font-size:11px;fill:${c.body};">${xe(line)}</text>`).join('')}
  <text x="${rightPad}" y="${bodyTop + 432}" style="font-size:11px;fill:${c.label};">P ${xe(pressure)}  ·  B ${xe(bias)}</text>
  <text x="${rightPad}" y="${bodyTop + 452}" style="font-size:11px;fill:${c.dim};">ALIVE ${xe(fmtPct(data.alivePct, 1))}  ·  ${data.aliveCells | 0}/${data.cellCount | 0}</text>

  <line x1="0" y1="${bodyBot}" x2="${width}" y2="${bodyBot}" stroke="${c.border}" stroke-width="1"/>
  <rect y="${bodyBot}" width="${width}" height="${footerH}" fill="${c.bgAlt}"/>
  <text x="${leftPad}" y="${bodyBot + 28}" style="font-size:12px;fill:${c.dim};letter-spacing:1px;">THE ONLY WAY TO KNOW STEP N+1 IS TO RUN IT</text>
  <text x="${leftPad}" y="${bodyBot + 50}" style="font-size:13px;fill:${c.body};">Same rules. You still have to compute the field.</text>
  <text x="${width - 40}" y="${bodyBot + 44}" style="font-size:16px;font-weight:bold;fill:${c.accent};text-anchor:end;letter-spacing:1px;">karx.github.io/hex-automaton-explore</text>
</svg>`.trim();
}

function svgObjectURL(svgString) {
  return URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
}

export async function svgToPNG(svgString) {
  const url = svgObjectURL(svgString);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1200;
      canvas.height = 630;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('SVG image failed to load'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function slugFilename(data) {
  const slug = String(data?.title || 'run').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'run';
  const gen = data?.generation | 0;
  return `hex-automaton-${slug}-gen${gen}.png`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadCard(svgString, filename = 'hex-automaton-card.png') {
  downloadBlob(await svgToPNG(svgString), filename);
}

export async function shareCard(svgString, title = 'Hex Automaton', text = '', filename) {
  const blob = await svgToPNG(svgString);
  const file = new File([blob], filename || 'hex-automaton-card.png', { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
      } else {
        await navigator.share({ title, text, url: 'https://karx.github.io/hex-automaton-explore/' });
      }
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }

  downloadBlob(blob, filename || 'hex-automaton-card.png');
  return 'downloaded';
}

export function previewCard(svgString) {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-share-preview', '1');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:#000000;display:flex;align-items:center;
    justify-content:center;z-index:10000;padding:20px;cursor:pointer;
  `;
  const url = svgObjectURL(svgString);
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Share card preview';
  img.style.cssText = 'max-width:100%;max-height:100%;border:1px solid #ff6600;';
  overlay.appendChild(img);
  const dismiss = () => {
    URL.revokeObjectURL(url);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
  overlay.addEventListener('click', dismiss);
  document.body.appendChild(overlay);
}

export { slugFilename };
