// Generates a clean, portable, human-readable "formula sheet" for a resolved
// params object — the actual rule set an Engine is running, spelled out as
// grouped equations with real numbers substituted in, not just a raw JSON
// dump of parameter names. This is what gets shown in the UI's Formula panel
// and embedded as a comment block at the top of exported rule-kit files.
import { PARAM_META } from './paramMeta.js';
import { DEFAULT_PARAMS } from './engine.js';

function fmt(n, decimals = 3) {
  if (!Number.isFinite(n)) return String(n);
  const s = n.toFixed(decimals);
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function pct(n, decimals = 0) {
  return `${(n * 100).toFixed(decimals)}%`;
}

// name(param=value) tag used at the end of formula lines, e.g. "(birthLow=1.98)"
function tag(...pairs) {
  return `(${pairs.map(([k, v]) => `${k}=${fmt(v)}`).join(', ')})`;
}

export function generateFormula(params, { ontology, title, provenance } = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const lines = [];

  lines.push(`FIELD RULE SET${title ? ` — "${title}"` : ''}`);
  if (provenance?.presetName) {
    lines.push(`Derived from preset: ${provenance.presetName}${provenance.archetype ? ` (archetype: ${provenance.archetype})` : ''}`);
  }
  if (ontology) {
    lines.push(
      `Ontology: Survival Pressure ${fmt(ontology.survivalPressure, 2)} · Momentum Bias ${fmt(ontology.momentumBias, 2)}`
    );
  }
  lines.push('');

  lines.push('BIRTH  (dead cell, density ≤ alive threshold)');
  lines.push(`  becomes alive if neighbor density sum ∈ [${fmt(p.birthLow)}, ${fmt(p.birthHigh)}]  ${tag(['birthLow', p.birthLow], ['birthHigh', p.birthHigh])}`);
  lines.push(`    window widens by up to (+${fmt(p.energyBirthCoupling * 0.6)} / −${fmt(p.energyBirthCoupling)}) per unit of local positive energy  ${tag(['energyBirthCoupling', p.energyBirthCoupling])}`);
  lines.push(`  AND local energy > ${fmt(p.birthEnergyMin)}  ${tag(['birthEnergyMin', p.birthEnergyMin])}`);
  lines.push(`  → new density = ${fmt(p.birthDensity)} × (0.6 to 1.0 by closeness to window center)  ${tag(['birthDensity', p.birthDensity])}`);
  lines.push(`  otherwise (no birth): density × ${fmt(p.deadDecay)} per step  ${tag(['deadDecay', p.deadDecay])}`);
  lines.push('');

  lines.push('SURVIVAL  (alive cell, density > alive threshold)');
  lines.push(`  reinforced if neighbor density sum ∈ [${fmt(p.surviveLow)}, ${fmt(p.surviveHigh)}]  ${tag(['surviveLow', p.surviveLow], ['surviveHigh', p.surviveHigh])}`);
  lines.push(`    (upper bound also widens with local energy, same coupling as birth)`);
  lines.push(`    in range: density = min(1, density × ${fmt(p.surviveDecay, 4)} + energy × ${fmt(p.energyToDensity)})  ${tag(['surviveDecay', p.surviveDecay], ['energyToDensity', p.energyToDensity])}`);
  lines.push(`    out of range: density × ${fmt(p.deathDecay)} per step  ${tag(['deathDecay', p.deathDecay])}`);
  lines.push(`  alive threshold: ${fmt(p.aliveThreshold)}  ${tag(['aliveThreshold', p.aliveThreshold])}`);
  lines.push('');

  lines.push('ENERGY');
  lines.push(`  produced:  +${fmt(p.densityToEnergy)} × density × (neighbor density sum / 6)  ${tag(['densityToEnergy', p.densityToEnergy])}`);
  lines.push(`  consumed:  −${fmt(p.activityCost)} × |Δdensity|  ${tag(['activityCost', p.activityCost])}`);
  lines.push(`  decays:    −${pct(p.energyDecay)} of current energy per step  ${tag(['energyDecay', p.energyDecay])}`);
  lines.push(`  leaks out: ${pct(p.energyLeakRate)} of positive energy per step, redistributed to neighbors  ${tag(['energyLeakRate', p.energyLeakRate])}`);
  lines.push(`    direction: ${pct(p.leakConcentration)} concentrated toward momentum, rest spread evenly  ${tag(['leakConcentration', p.leakConcentration])}`);
  lines.push(`  clamped to [${fmt(p.energyMin)}, ${fmt(p.energyMax)}]  ${tag(['energyMin', p.energyMin], ['energyMax', p.energyMax])}`);
  lines.push('');

  lines.push('MOMENTUM  (unit vector per cell)');
  lines.push(`  new cells inherit the density-weighted average momentum of their neighbors at birth`);
  lines.push(`  alive cells reorient ${pct(p.momentumSmoothing)} toward that same neighbor average each step  ${tag(['momentumSmoothing', p.momentumSmoothing])}`);
  lines.push(`  energy leak direction is biased by this vector (see leakConcentration above)`);

  return lines.join('\n');
}

// A compact one-line-per-param dump, grouped, for contexts that want every
// value visible (e.g. a diff between two rule kits) rather than the narrative
// formula above.
export function generateParamTable(params) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const lines = [];
  for (const [key, meta] of Object.entries(PARAM_META)) {
    lines.push(`${key.padEnd(22)} ${fmt(p[key], 4).padStart(9)}   ${meta.label}`);
  }
  return lines.join('\n');
}
