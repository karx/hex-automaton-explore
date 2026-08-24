// Compact #s= token for a run. Reconstructs the rule set (and the card facts)
// without a backend. Canvas state is not encoded — use a rule-kit JSON for that.
import { DEFAULT_PARAMS } from './engine.js';
import { SITE_URL } from './share-data.js';

function toBase64Url(str) {
  const bytes = typeof Buffer !== 'undefined'
    ? Buffer.from(str, 'utf8')
    : new TextEncoder().encode(str);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token) {
  const b64 = String(token).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64 + pad, 'base64').toString('utf8');
  }
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}

function compactParams(params) {
  const out = {};
  const src = { ...DEFAULT_PARAMS, ...params };
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = round4(v);
  }
  return out;
}

export function encodeSharePayload(data) {
  const payload = {
    v: 1,
    n: String(data.title || 'Untitled run').slice(0, 48),
    p: data.presetId || undefined,
    a: data.archetype || undefined,
    sp: Number.isFinite(data.survivalPressure) ? round4(data.survivalPressure) : undefined,
    mb: Number.isFinite(data.momentumBias) ? round4(data.momentumBias) : undefined,
    g: data.generation | 0,
    w: data.gridWidth | 0,
    h: data.gridHeight | 0,
    d: round4(data.densityPct),
    e: round4(data.energyMean),
    m: round4(data.momentumPct),
    r: round4(data.resonance),
    al: round4(data.alivePct),
    dt: data.date,
    params: compactParams(data.params),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharePayload(token) {
  try {
    const raw = JSON.parse(fromBase64Url(token));
    if (!raw || raw.v !== 1 || typeof raw !== 'object') return null;
    const params = raw.params && typeof raw.params === 'object'
      ? { ...DEFAULT_PARAMS, ...raw.params }
      : null;
    return {
      version: 1,
      title: typeof raw.n === 'string' ? raw.n : 'Untitled run',
      presetId: typeof raw.p === 'string' ? raw.p : undefined,
      archetype: typeof raw.a === 'string' ? raw.a : undefined,
      survivalPressure: Number.isFinite(raw.sp) ? raw.sp : undefined,
      momentumBias: Number.isFinite(raw.mb) ? raw.mb : undefined,
      generation: Number.isFinite(raw.g) ? raw.g : 0,
      gridWidth: Number.isFinite(raw.w) && raw.w > 0 ? raw.w : undefined,
      gridHeight: Number.isFinite(raw.h) && raw.h > 0 ? raw.h : undefined,
      densityPct: Number.isFinite(raw.d) ? raw.d : 0,
      energyMean: Number.isFinite(raw.e) ? raw.e : 0,
      momentumPct: Number.isFinite(raw.m) ? raw.m : 0,
      resonance: Number.isFinite(raw.r) ? raw.r : 0,
      alivePct: Number.isFinite(raw.al) ? raw.al : 0,
      date: typeof raw.dt === 'string' ? raw.dt : undefined,
      params,
    };
  } catch {
    return null;
  }
}

export function parseShareToken(token) {
  if (!token) return null;
  try {
    return decodeSharePayload(String(token));
  } catch {
    return null;
  }
}

export function parseShareHash(hash) {
  const m = String(hash || '').match(/^#s=([^&]+)/);
  if (!m) return null;
  try {
    return parseShareToken(decodeURIComponent(m[1]));
  } catch {
    return parseShareToken(m[1]);
  }
}

export function parseShareLocation(loc = typeof location !== 'undefined' ? location : { search: '', hash: '' }) {
  const fromQuery = new URLSearchParams(loc.search || '').get('s');
  if (fromQuery) return parseShareToken(fromQuery);
  return parseShareHash(loc.hash || '');
}

export function generateShareUrl(data) {
  const token = encodeSharePayload(data);
  return `${SITE_URL}explorations/workbench.html?s=${encodeURIComponent(token)}`;
}
