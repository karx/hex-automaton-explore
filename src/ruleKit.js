// Export/import of a "rule kit": a portable, versioned JSON snapshot of a
// running simulation. Always includes the fully-resolved params object (the
// ground truth an Engine actually runs on — not just a preset id, so a kit
// stays valid even if presets.js changes later, or if the sender hand-tuned
// raw parameters beyond what the two ontology sliders can reach). Canvas
// state (every cell's density/energy/momentum + generation count) is
// optional — include it to let someone resume the exact simulation, or omit
// it to share just the rule set as a fresh starting point.
import { Engine, DEFAULT_PARAMS } from './engine.js';

export const RULE_KIT_FORMAT_VERSION = 1;
export const RULE_KIT_KIND = 'fieldCA-ruleKit';

export function exportRuleKit(engine, { name, description, includeState = false, provenance = {} } = {}) {
  const kit = {
    formatVersion: RULE_KIT_FORMAT_VERSION,
    kind: RULE_KIT_KIND,
    meta: {
      name: name || 'Untitled rule kit',
      description: description || '',
      exportedAt: new Date().toISOString(),
      generationAtExport: engine.generation,
      ...provenance, // presetId, presetName, archetype, survivalPressure, momentumBias — all optional
    },
    grid: { width: engine.width, height: engine.height },
    params: { ...DEFAULT_PARAMS, ...engine.params },
    state: null,
  };

  if (includeState) {
    kit.state = {
      generation: engine.generation,
      density: Array.from(engine.density),
      energy: Array.from(engine.energy),
      momX: Array.from(engine.momX),
      momY: Array.from(engine.momY),
    };
  }

  return kit;
}

// Pretty-printed, but the four state arrays are kept as single compact lines
// rather than one-number-per-line (plain `JSON.stringify(kit, null, 2)` would
// turn a 70x70 grid's state into ~20,000 lines — technically valid JSON, but
// unreadable and slow for anything that processes the text as a whole, e.g.
// pasting it into a browser text field). Still 100% standard JSON underneath;
// parseRuleKit just calls JSON.parse regardless of how it was formatted.
export function ruleKitToJSON(kit, { pretty = true } = {}) {
  if (!pretty) return JSON.stringify(kit);

  const indentBody = (json) => json.split('\n').map((line, i) => (i === 0 ? line : `  ${line}`)).join('\n');

  const parts = [
    `  "formatVersion": ${JSON.stringify(kit.formatVersion)}`,
    `  "kind": ${JSON.stringify(kit.kind)}`,
    `  "meta": ${indentBody(JSON.stringify(kit.meta, null, 2))}`,
    `  "grid": ${JSON.stringify(kit.grid)}`,
    `  "params": ${indentBody(JSON.stringify(kit.params, null, 2))}`,
    `  "state": ${kit.state ? indentBody(stateToCompactJSON(kit.state)) : 'null'}`,
  ];

  return `{\n${parts.join(',\n')}\n}`;
}

function stateToCompactJSON(state) {
  return [
    '{',
    `  "generation": ${state.generation},`,
    `  "density": ${JSON.stringify(state.density)},`,
    `  "energy": ${JSON.stringify(state.energy)},`,
    `  "momX": ${JSON.stringify(state.momX)},`,
    `  "momY": ${JSON.stringify(state.momY)}`,
    '}',
  ].join('\n');
}

export function parseRuleKit(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON: ${e.message}`);
  }
  if (!obj || typeof obj !== 'object') throw new Error('Rule kit must be a JSON object');
  if (obj.kind !== RULE_KIT_KIND) throw new Error(`Not a field CA rule kit (expected kind="${RULE_KIT_KIND}", got ${JSON.stringify(obj.kind)})`);
  if (obj.formatVersion !== RULE_KIT_FORMAT_VERSION) {
    throw new Error(`Unsupported rule kit format version ${obj.formatVersion} (this build supports ${RULE_KIT_FORMAT_VERSION})`);
  }
  if (!obj.grid || !Number.isFinite(obj.grid.width) || !Number.isFinite(obj.grid.height)) {
    throw new Error('Rule kit missing a valid grid { width, height }');
  }
  if (!obj.params || typeof obj.params !== 'object') {
    throw new Error('Rule kit missing params');
  }
  if (obj.state) {
    const n = obj.grid.width * obj.grid.height;
    for (const field of ['density', 'energy', 'momX', 'momY']) {
      const arr = obj.state[field];
      if (!Array.isArray(arr) || arr.length !== n) {
        throw new Error(`Rule kit state.${field} must be an array of length ${n} (grid is ${obj.grid.width}x${obj.grid.height}), got ${Array.isArray(arr) ? arr.length : typeof arr}`);
      }
    }
  }
  return obj;
}

// Builds a fresh Engine from a parsed/validated rule kit. If the kit has no
// saved state, `fallbackSeedFn` seeds it (same shape as presets.js seed
// functions) — pass none to get an empty grid.
export function buildEngineFromRuleKit(kit, { fallbackSeedFn } = {}) {
  const { width, height } = kit.grid;
  const engine = new Engine(width, height, kit.params, kit.state ? undefined : fallbackSeedFn);

  if (kit.state) {
    engine.density.set(kit.state.density);
    engine.energy.set(kit.state.energy);
    engine.momX.set(kit.state.momX);
    engine.momY.set(kit.state.momY);
    engine.generation = kit.state.generation || 0;
  }

  return engine;
}

// --- Browser-only helpers (no-op/throw if called outside a browser) ---

export function downloadRuleKit(kit, filename) {
  const json = ruleKitToJSON(kit);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${(kit.meta?.name || 'rule-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
