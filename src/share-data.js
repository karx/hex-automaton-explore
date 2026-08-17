// Single assembler for the share card, share text, and #s= deep link.
// Preview / share / copy all call this. Reads engine fields — never the DOM.
import { generateCompactFormula } from './formula.js';

export const SITE_URL = 'https://karx.github.io/hex-automaton-explore/';

export function classifyOutcome({ aliveCells, alivePct, resonance }) {
  if (!aliveCells || alivePct < 0.05) return 'QUIET';
  if (resonance > 0.75) return 'RESONANT';
  return 'LIVE';
}

function todayISO(date) {
  if (date) return date;
  return new Date().toLocaleDateString('en-CA');
}

export function buildCardData({ engine, name, provenance = {}, date } = {}) {
  if (!engine) throw new Error('buildCardData requires an engine');

  const n = engine.n || (engine.width * engine.height) || 1;
  const threshold = engine.params?.aliveThreshold ?? 0.15;
  let totalDensity = 0;
  let totalEnergy = 0;
  let aliveCells = 0;
  for (let i = 0; i < n; i++) {
    totalDensity += engine.density[i];
    totalEnergy += engine.energy[i];
    if (engine.density[i] > threshold) aliveCells++;
  }

  const stats = engine.lastStats || {};
  const densityPct = (totalDensity / n) * 100;
  const energyMean = totalEnergy / n;
  const alivePct = (aliveCells / n) * 100;
  const resonance = Number.isFinite(stats.resonance) ? stats.resonance : 0;
  const momentumPct = Number.isFinite(stats.momentumCoherence) ? stats.momentumCoherence * 100 : 0;

  const title = name || provenance.presetName || 'Untitled run';
  const energyMin = engine.params?.energyMin ?? -1;
  const energyMax = engine.params?.energyMax ?? 3;

  return {
    title,
    date: todayISO(date),
    generation: engine.generation || 0,
    outcome: classifyOutcome({ aliveCells, alivePct, resonance }),
    formulaLines: generateCompactFormula(engine.params),
    densityPct,
    energyMean,
    energyMin,
    energyMax,
    momentumPct,
    resonance,
    alivePct,
    aliveCells,
    cellCount: n,
    survivalPressure: provenance.survivalPressure,
    momentumBias: provenance.momentumBias,
    presetName: provenance.presetName || title,
    presetId: provenance.presetId,
    archetype: provenance.archetype,
    gridWidth: engine.width,
    gridHeight: engine.height,
    params: { ...engine.params },
    siteUrl: SITE_URL,
  };
}
