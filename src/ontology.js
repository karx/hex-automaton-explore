// Intuitive control ontology: replaces direct manipulation of raw engine params
// (energyBirthCoupling, surviveDecay, ...) with two continuous meaning-bearing sliders
// that modulate a chosen preset's base parameters. Presets carry "growth style"
// (per the intent doc's three-axis ontology: growth style, survival pressure,
// momentum strength) — these two sliders cover the other two axes.
//
// Both sliders are 0..1. At 0.5 (neutral) the preset's authored values pass through
// unchanged, preserving its character. Away from 0.5 they lerp toward fixed absolute
// extremes, so "Fragile" and "Isotropic" mean the same real thing on every preset,
// not just "a bit less than whatever this preset started with."

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// t01 in [0,1]; 0 -> extremeLow, 0.5 -> base, 1 -> extremeHigh. Piecewise linear
// through the base value so the slider's neutral position always matches the preset.
function lerpThroughBase(base, extremeLow, extremeHigh, t01) {
  const t = clamp(t01, 0, 1);
  if (t <= 0.5) return base + (extremeLow - base) * ((0.5 - t) / 0.5);
  return base + (extremeHigh - base) * ((t - 0.5) / 0.5);
}

// Survival Pressure: 0 = fragile (patterns die easily, thin margins), 1 = robust
// (patterns are hard to kill, wide margins, strong reinforcement).
export function applySurvivalPressure(baseParams, pressure) {
  const p = { ...baseParams };
  const t = clamp(pressure, 0, 1);

  // Extremes are deliberately softer than the theoretical min/max: the birth/survival
  // rule is threshold-based, so pushing too hard collapses the whole low half of the
  // slider to instant death with no visible gradient. These values were tuned by
  // sweeping pressure in 0.05 steps against the Crystal Bloom preset until decline
  // was gradual rather than a cliff (scripts/regress-presets.mjs-style check).
  p.surviveDecay = clamp(lerpThroughBase(baseParams.surviveDecay, 0.94, 0.998, t), 0.85, 0.999);
  p.deathDecay = clamp(lerpThroughBase(baseParams.deathDecay, 0.35, 0.92, t), 0.05, 0.98);
  p.deadDecay = clamp(lerpThroughBase(baseParams.deadDecay, 0.30, 0.80, t), 0.05, 0.95);

  const baseCenter = (baseParams.surviveLow + baseParams.surviveHigh) / 2;
  const baseHalfWidth = Math.max(0.2, (baseParams.surviveHigh - baseParams.surviveLow) / 2);
  const halfWidth = lerpThroughBase(baseHalfWidth, baseHalfWidth * 0.55, baseHalfWidth * 2.0, t);
  p.surviveLow = clamp(baseCenter - halfWidth, 0, 5);
  p.surviveHigh = clamp(baseCenter + halfWidth, 0, 6);

  p.energyToDensity = clamp(lerpThroughBase(baseParams.energyToDensity, baseParams.energyToDensity * 0.5, baseParams.energyToDensity * 2.5, t), 0, 0.3);
  p.birthEnergyMin = clamp(lerpThroughBase(baseParams.birthEnergyMin, baseParams.birthEnergyMin + 0.25, baseParams.birthEnergyMin - 0.25, t), -1, 1);

  return p;
}

// Momentum Bias: 0 = isotropic (energy leak spreads evenly, direction barely matters),
// 1 = strongly directional (leak concentrates on one neighbor, momentum persists longer).
export function applyMomentumBias(baseParams, bias) {
  const p = { ...baseParams };
  const t = clamp(bias, 0, 1);
  const baseLeakConcentration = baseParams.leakConcentration ?? 0.82;

  p.leakConcentration = clamp(lerpThroughBase(baseLeakConcentration, 0, 1, t), 0, 1);
  p.momentumSmoothing = clamp(lerpThroughBase(baseParams.momentumSmoothing, 0, 0.95, t), 0, 0.95);

  return p;
}

// Compose both onto a base preset's params. Order matters little since the two
// sliders touch disjoint param sets, but survival pressure is applied first by convention.
export function applyOntology(baseParams, { survivalPressure = 0.5, momentumBias = 0.5 } = {}) {
  return applyMomentumBias(applySurvivalPressure(baseParams, survivalPressure), momentumBias);
}

export const ONTOLOGY_AXES = {
  survivalPressure: {
    label: 'Survival Pressure',
    lowLabel: 'Fragile',
    highLabel: 'Robust',
    description: 'How hard patterns are to kill. Fragile: thin margins, patches die easily. Robust: wide survival window, strong reinforcement, hard to extinguish.',
  },
  momentumBias: {
    label: 'Momentum Bias',
    lowLabel: 'Isotropic',
    highLabel: 'Directional',
    description: 'How strongly energy leakage follows the momentum field. Isotropic: energy spreads evenly in all directions. Directional: energy concentrates into one flowing stream, producing drift and rotation.',
  },
};
