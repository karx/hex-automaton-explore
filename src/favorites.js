// Authored favorites are exact rule kits — fully resolved params, not an
// archetype + ontology slider pair. Selecting one loads those params as the
// new base (sliders sit at 0.5 / 0.5 so they stay honest). Source slider
// values below are provenance from the export that produced the kit.
import { getPresetSeedFn } from './presets.js';

export const FAVORITES = [
  {
    id: 'pulsating-full',
    name: 'Pulsating Full',
    sourcePresetId: 'resonant-bloom',
    archetype: 'spreading-front-ring',
    seedType: 'ring',
    survivalPressure: 0.5,
    momentumBias: 0.1,
    grid: { width: 90, height: 90 },
    description: 'Hand-tuned from Resonant Bloom: a wide, easy birth window that fills the torus by generation 100, then holds a ~56% living mass that breathes a few percent instead of locking. Weaker survival reinforcement than the stock bloom, so the field stays full without going crystalline.',
    params: {
      aliveThreshold: 0.15,
      birthLow: 0.4,
      birthHigh: 3.35,
      birthDensity: 1,
      birthEnergyMin: -0.76,
      surviveLow: 0.7,
      surviveHigh: 4,
      surviveDecay: 0.952,
      deathDecay: 0.43,
      deadDecay: 0.468,
      energyBirthCoupling: 0.4,
      energyToDensity: 0.03578961791529673,
      densityToEnergy: 0.09182158742202598,
      activityCost: 0.729927867775797,
      energyLeakRate: 0.08,
      energyDecay: 0.01,
      energyMin: -1,
      energyMax: 3,
      momentumSmoothing: 0.06885719518974937,
      leakConcentration: 0.16399999999999992,
    },
  },
];

export function getFavorite(id) {
  const f = FAVORITES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown favorite: ${id}`);
  return f;
}

export function getFavoriteSeedFn(favorite) {
  return getPresetSeedFn({ seedType: favorite.seedType });
}

export function favoriteAsRuleKit(favorite) {
  return {
    formatVersion: 1,
    kind: 'fieldCA-ruleKit',
    meta: {
      name: favorite.name,
      description: favorite.description || '',
      favoriteId: favorite.id,
      presetId: favorite.id,
      presetName: favorite.name,
      sourcePresetId: favorite.sourcePresetId,
      archetype: favorite.archetype,
      survivalPressure: favorite.survivalPressure,
      momentumBias: favorite.momentumBias,
    },
    grid: { ...favorite.grid },
    params: { ...favorite.params },
    state: null,
  };
}
