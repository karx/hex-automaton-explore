// Per-run share card: 1200×630 SVG receipt of the rule formula + field reading.
// Raster to PNG before sharing — share sheets reject SVG.

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

export function generateShareCardSVG(data) {
  const title = trunc(data.title || 'Untitled run', 28);
  const date = trunc(data.date || '', 12);
  const outcome = data.outcome || 'LIVE';
  const formulaLines = (data.formulaLines || []).slice(0, 4).map((l) => trunc(l, 44));
  const generation = data.generation | 0;
  const gridW = data.gridWidth | 0;
  const gridH = data.gridHeight | 0;

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
  const dividerX = 640;
  const leftPad = 48;
  const rightPad = dividerX + 40;

  const formulaY = bodyTop + 48;
  const formulaH = 196;
  const formulaW = dividerX - leftPad - 28;

  const densityFrac = clamp01((data.densityPct || 0) / 100);
  const energySpan = (data.energyMax ?? 3) - (data.energyMin ?? -1) || 1;
  const energyFrac = clamp01(((data.energyMean ?? 0) - (data.energyMin ?? -1)) / energySpan);
  const momentumFrac = clamp01((data.momentumPct || 0) / 100);
  const resonanceFrac = clamp01(data.resonance || 0);

  const pressure = Number.isFinite(data.survivalPressure) ? data.survivalPressure.toFixed(2) : '—';
  const bias = Number.isFinite(data.momentumBias) ? data.momentumBias.toFixed(2) : '—';
  const archetype = data.archetype ? trunc(data.archetype, 22) : '';

  const fieldRows = [
    ['DENSITY', fmtPct(data.densityPct), densityFrac],
    ['ENERGY', Number.isFinite(data.energyMean) ? data.energyMean.toFixed(2) : '—', energyFrac],
    ['MOMENTUM', fmtPct(data.momentumPct), momentumFrac],
  ];

  function bar(x, y, w, frac) {
    const fillW = Math.max(0, Math.round(w * frac));
    return `
  <rect x="${x}" y="${y}" width="${w}" height="10" fill="${c.bg}" stroke="${c.border}" stroke-width="1"/>
  ${fillW > 0 ? `<rect x="${x}" y="${y}" width="${fillW}" height="10" fill="${c.accent}"/>` : ''}`;
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs><style>text { font-family: 'Courier New', Courier, monospace; }</style></defs>
  <rect width="${width}" height="${height}" fill="${c.bg}"/>

  <rect width="${width}" height="${headerH}" fill="${c.bgAlt}"/>
  <line x1="0" y1="${headerH}" x2="${width}" y2="${headerH}" stroke="${c.border}" stroke-width="1"/>
  <text x="${leftPad}" y="47" style="font-size:26px;font-weight:bold;fill:${c.accent};letter-spacing:3px;">HEX AUTOMATON</text>
  <text x="${leftPad}" y="68" style="font-size:10px;fill:${c.dim};letter-spacing:2px;">MULTI-FIELD HEX</text>
  <text x="${width - 48}" y="34" style="font-size:12px;fill:${c.dim};text-anchor:end;">${xe(date)}</text>
  <text x="${width - 48}" y="56" style="font-size:18px;font-weight:bold;fill:${outcomeColor};text-anchor:end;letter-spacing:2px;">${xe(outcome)}</text>
  <text x="${width - 48}" y="72" style="font-size:13px;fill:${c.select};text-anchor:end;">${xe(title)}</text>

  <line x1="${dividerX}" y1="${bodyTop + 20}" x2="${dividerX}" y2="${bodyBot - 20}" stroke="${c.border}" stroke-width="1" stroke-dasharray="4,4"/>

  <text x="${leftPad}" y="${formulaY - 14}" style="font-size:9px;fill:${c.dim};letter-spacing:2px;">RULE FORMULA</text>
  <rect x="${leftPad}" y="${formulaY}" width="${formulaW}" height="${formulaH}" fill="${c.bgCard}" rx="6"/>
  <rect x="${leftPad}" y="${formulaY}" width="${formulaW}" height="${formulaH}" fill="none" stroke="${c.border}" stroke-width="1" rx="6"/>
  ${formulaLines.map((line, i) => `
  <text x="${leftPad + 18}" y="${formulaY + 42 + i * 38}" style="font-size:16px;fill:${c.body};letter-spacing:0.4px;">${xe(line)}</text>`).join('')}
  <text x="${leftPad}" y="${formulaY + formulaH + 28}" style="font-size:12px;fill:${c.label};">Survival Pressure ${xe(pressure)}  ·  Momentum Bias ${xe(bias)}</text>
  ${archetype ? `<text x="${leftPad}" y="${formulaY + formulaH + 50}" style="font-size:11px;fill:${c.dim};">archetype ${xe(archetype)}</text>` : ''}
  <text x="${leftPad}" y="${formulaY + formulaH + 74}" style="font-size:12px;fill:${c.body};">GEN ${generation}  ·  ${gridW}×${gridH}</text>

  <text x="${rightPad}" y="${bodyTop + 34}" style="font-size:9px;fill:${c.dim};letter-spacing:2px;">FIELD</text>
  ${fieldRows.map(([label, val, frac], i) => {
    const y = bodyTop + 58 + i * 72;
    return `
  <text x="${rightPad}" y="${y}" style="font-size:11px;fill:${c.label};letter-spacing:2px;">${label}</text>
  <text x="${width - 48}" y="${y}" style="font-size:20px;font-weight:bold;fill:${c.value};text-anchor:end;">${xe(val)}</text>
  ${bar(rightPad, y + 12, width - 48 - rightPad, frac)}`;
  }).join('')}

  <line x1="${rightPad}" y1="${bodyTop + 280}" x2="${width - 48}" y2="${bodyTop + 280}" stroke="${c.border}" stroke-width="1"/>
  <text x="${rightPad}" y="${bodyTop + 312}" style="font-size:9px;fill:${c.dim};letter-spacing:2px;">RESONANCE</text>
  <text x="${rightPad}" y="${bodyTop + 348}" style="font-size:28px;font-weight:bold;fill:${outcome === 'RESONANT' ? c.ok : c.value};">${xe(fmtPct(resonanceFrac * 100))}</text>
  ${bar(rightPad, bodyTop + 360, width - 48 - rightPad, resonanceFrac)}
  <text x="${rightPad}" y="${bodyTop + 408}" style="font-size:12px;fill:${c.body};">ALIVE ${xe(fmtPct(data.alivePct, 1))}  ·  ${data.aliveCells | 0} / ${data.cellCount | 0}</text>

  <line x1="0" y1="${bodyBot}" x2="${width}" y2="${bodyBot}" stroke="${c.border}" stroke-width="1"/>
  <rect y="${bodyBot}" width="${width}" height="${footerH}" fill="${c.bgAlt}"/>
  <text x="${leftPad}" y="${bodyBot + 28}" style="font-size:12px;fill:${c.dim};letter-spacing:1px;">GROW THIS RULE SET</text>
  <text x="${leftPad}" y="${bodyBot + 50}" style="font-size:13px;fill:${c.body};">Same numbers. Fresh seed. Open the explorer.</text>
  <text x="${width - 48}" y="${bodyBot + 44}" style="font-size:16px;font-weight:bold;fill:${c.accent};text-anchor:end;letter-spacing:1px;">karx.github.io/hex-automaton-explore</text>
</svg>`.trim();
}

function svgToDataURL(svgString) {
  return `data:image/svg+xml,${encodeURIComponent(svgString)}`;
}

export async function svgToPNG(svgString) {
  return new Promise((resolve, reject) => {
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
    img.src = svgToDataURL(svgString);
  });
}

function slugFilename(data) {
  const slug = String(data?.title || 'run').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'run';
  const gen = data?.generation | 0;
  return `hex-automaton-${slug}-gen${gen}.png`;
}

export async function downloadCard(svgString, filename = 'hex-automaton-card.png') {
  const blob = await svgToPNG(svgString);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  await downloadCard(svgString, filename);
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
  const img = document.createElement('img');
  img.src = svgToDataURL(svgString);
  img.alt = 'Share card preview';
  img.style.cssText = 'max-width:100%;max-height:100%;border:1px solid #ff6600;';
  overlay.appendChild(img);
  overlay.addEventListener('click', () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  });
  document.body.appendChild(overlay);
}

export { slugFilename };
