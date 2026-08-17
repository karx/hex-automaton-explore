// Plain-text twin of the share card. Always includes a deep link.
import { generateShareUrl } from './share-url.js';
import { SITE_URL } from './share-data.js';

function fmtPct(n, digits = 0) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function buildShareText(data) {
  const title = data.title || 'Untitled run';
  const outcome = data.outcome || 'LIVE';
  const gen = data.generation | 0;
  const birth = (data.formulaLines && data.formulaLines[0]) || '';
  const link = data.resultUrl || generateShareUrl(data);

  const lines = [
    `HEX AUTOMATON — ${title}`,
    `GEN ${gen} · ${outcome}`,
    `density ${fmtPct(data.densityPct)} · energy ${Number.isFinite(data.energyMean) ? data.energyMean.toFixed(2) : '—'} · momentum ${fmtPct(data.momentumPct)}`,
    `resonance ${fmtPct((data.resonance || 0) * 100)} · alive ${fmtPct(data.alivePct, 1)}`,
  ];
  if (birth) lines.push(birth);
  lines.push('');
  lines.push(`Grow this rule set → ${link || SITE_URL}`);
  return lines.join('\n');
}
