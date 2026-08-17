// Single assembler for the share card, share text, and #s= deep link.
// Preview / share / copy all call this. Reads engine fields — never the DOM.
import { generateCompactFormula } from './formula.js';
import { snapshotField, selectAsymptoticFrames } from './share-capture.js';

export const SITE_URL = 'https://karx.github.io/hex-automaton-explore/';

export function classifyOutcome({ aliveCells, alivePct, resonance }) {
  if (!aliveCells || alivePct < 0.05) return 'QUIET';
  if (resonance > 0.75) return 'RESONANT';
  return 'LIVE';
}

export function formatSteps(n) {
  const v = n | 0;
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function irreducibleCaption(generation) {
  const n = generation | 0;
  return {
    kicker: 'COMPUTED',
    steps: formatSteps(n),
    unit: n === 1 ? 'STEP' : 'STEPS',
    line: n === 0
      ? 'Seed only. The next state has no closed form.'
      : 'No closed form. The only way to know this state is to run these steps.',
    lines: n === 0
      ? ['Seed only. The next state has no closed form.', 'You still have to run the steps.']
      : ['No closed form. No skip.', 'This field exists because those steps ran.'],
  };
}

function todayISO(date) {
  if (date) return date;
  return new Date().toLocaleDateString('en-CA');
}

export function buildCardData({
  engine,
  name,
  provenance = {},
  date,
  growthFrames = [],
  fieldSnapshot,
  canvasFactory,
} = {}) {
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
  const generation = engine.generation || 0;
  const snapshot = fieldSnapshot === undefined
    ? snapshotField(engine, {
      cellSize: 3,
      maxWidth: 560,
      maxHeight: 340,
      canvasFactory,
      layers: { density: true, energyGlow: true, momentumArrows: false },
    })
    : fieldSnapshot;

  return {
    title,
    date: todayISO(date),
    generation,
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
    fieldSnapshot: snapshot || null,
    growthFrames: selectAsymptoticFrames(Array.isArray(growthFrames) ? growthFrames : [], 4),
    irreducible: irreducibleCaption(generation),
  };
}
