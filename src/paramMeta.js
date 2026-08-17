// Single source of truth for what each raw engine parameter means. Consumed by:
//   - src/formula.js (the human-readable rule-set formula view)
//   - explorer.html / workbench Advanced panel (slider tooltips)
//   - docs/ATTRIBUTE_GLOSSARY.md (hand-authored companion; keep both in sync
//     when a param's behavior changes — this file is the runtime source,
//     the doc is the expanded prose explanation)
//
// Every key in engine.js's DEFAULT_PARAMS has an entry here. `slider` marks
// whether it's exposed directly in the UI (a few are fixed/rarely-tuned and
// only surface via the formula view and glossary).

export const PARAM_GROUPS = {
  birth: 'Birth (dead → alive)',
  survival: 'Survival (alive cell)',
  energy: 'Energy field',
  momentum: 'Momentum field',
};

export const PARAM_META = {
  aliveThreshold: {
    label: 'Alive threshold',
    group: 'survival',
    slider: false,
    unit: 'density',
    meaning: 'The density value above which a cell counts as "alive" for birth/survival/metrics purposes. Below this, a cell is dead regardless of how much residual density remains as it decays.',
    higher: 'Fewer cells count as alive; faint decaying cells disappear from metrics sooner.',
    lower: 'More residual/faint density counts as "alive"; alive% reads higher for the same underlying field.',
  },
  birthLow: {
    label: 'Birth window — low',
    group: 'birth',
    slider: true,
    unit: 'neighbor density sum (0–6)',
    meaning: 'The minimum summed density of a dead cell’s 6 neighbors required for it to be born.',
    higher: 'Harder to trigger births — needs denser neighborhoods. Growth is slower/sparser.',
    lower: 'Easier to trigger births from thin neighborhoods. Growth spreads faster and fills in more readily.',
  },
  birthHigh: {
    label: 'Birth window — high',
    group: 'birth',
    slider: true,
    unit: 'neighbor density sum (0–6)',
    meaning: 'The maximum summed neighbor density still allowed to trigger a birth — the birth window is [birthLow, birthHigh].',
    higher: 'Widens the birth window upward; births still happen in denser neighborhoods (less "overcrowding death" for new cells).',
    lower: 'Narrows the window; dense neighborhoods stop producing new births, capping how solid a region can get before growth stalls.',
  },
  birthDensity: {
    label: 'Birth density',
    group: 'birth',
    slider: true,
    unit: '0–1',
    meaning: 'The starting density a newly-born cell gets (scaled 0.6–1.0 by how close the neighbor sum was to the window’s center).',
    higher: 'New cells start denser/brighter — patterns look more "solid" immediately after growth.',
    lower: 'New cells start faint and take longer (via reinforcement) to reach full density, if they survive that long.',
  },
  birthEnergyMin: {
    label: 'Birth energy minimum',
    group: 'birth',
    slider: true,
    unit: 'energy',
    meaning: 'A birth only happens if the cell’s own local energy is above this floor — a starved region (very negative energy) can’t spawn new material even inside the density window.',
    higher: 'Births become gated on energy availability — growth stalls in energy-poor regions even if density conditions are right.',
    lower: 'Births happen regardless of local energy — density conditions alone decide growth.',
  },
  surviveLow: {
    label: 'Survive window — low',
    group: 'survival',
    slider: true,
    unit: 'neighbor density sum (0–6)',
    meaning: 'The minimum summed neighbor density an already-alive cell needs to stay reinforced rather than decay as "out of range."',
    higher: 'Sparse neighborhoods can no longer sustain a cell — isolated/edge cells die off faster.',
    lower: 'Even very sparse neighborhoods sustain a cell — patterns hold together with less support.',
  },
  surviveHigh: {
    label: 'Survive window — high',
    group: 'survival',
    slider: true,
    unit: 'neighbor density sum (0–6)',
    meaning: 'The maximum summed neighbor density still counted as "in range" for survival — above this, a cell is being overcrowded and decays via deathDecay instead of surviveDecay.',
    higher: 'Dense cores stay reinforced instead of dying from overcrowding — solid blobs can get denser.',
    lower: 'Dense cores start dying off — caps how solid the interior of a pattern can get, can carve out hollow centers.',
  },
  surviveDecay: {
    label: 'Survive decay',
    group: 'survival',
    slider: true,
    unit: 'multiplier/step, ~0.9–0.999',
    meaning: 'Each step, an in-range alive cell’s density is multiplied by this (then reinforcement is added). Closer to 1 = barely decays on its own.',
    higher: '(closer to 1) Patterns hold their density almost indefinitely once established — very stable, low flicker.',
    lower: 'Even "successfully surviving" cells fade unless reinforcement (energy × energyToDensity) actively offsets it — more dependent on the energy field.',
  },
  deathDecay: {
    label: 'Death decay',
    group: 'survival',
    slider: true,
    unit: 'multiplier/step, 0–1',
    meaning: 'Each step, an alive cell whose neighbor sum falls outside the survive window has its density multiplied by this (no reinforcement applied).',
    higher: '(closer to 1) Cells that fall out of range fade slowly — more forgiving, structures erode gradually.',
    lower: 'Cells that fall out of range collapse almost immediately — sharp, sudden death at pattern edges.',
  },
  deadDecay: {
    label: 'Dead decay',
    group: 'birth',
    slider: true,
    unit: 'multiplier/step, 0–1',
    meaning: 'Each step, a dead cell that didn’t just get born has its residual density (if any) multiplied by this — controls how long "afterglow" lingers.',
    higher: '(closer to 1) Faint residue lingers a long time after a cell dies — visible trails/ghosting behind moving fronts.',
    lower: 'Dead cells snap to zero density almost immediately — crisp, trail-free edges.',
  },
  energyBirthCoupling: {
    label: 'Energy→birth coupling',
    group: 'birth',
    slider: true,
    unit: 'coefficient',
    meaning: 'How much a cell’s own positive energy widens its birth/survive windows: birthLow shrinks and birthHigh/surviveHigh grow proportionally to local energy × this value. This is the engine’s main nonlinear feedback loop.',
    higher: 'Energy-rich regions become dramatically easier to grow into — energy hotspots can trigger runaway local growth.',
    lower: 'Birth/survival depend almost entirely on density geometry, energy has little say — more predictable, less explosive growth.',
  },
  energyToDensity: {
    label: 'Energy→density reinforcement',
    group: 'survival',
    slider: true,
    unit: 'coefficient',
    meaning: 'How much of a cell’s positive energy gets added directly to its density each step (on top of surviveDecay), when in the survive window.',
    higher: 'Energy-rich alive cells actively strengthen rather than just persist — can push density all the way to 1.0 and hold it there.',
    lower: 'Energy mostly just keeps a cell from decaying rather than actively building it up.',
  },
  densityToEnergy: {
    label: 'Density→energy production',
    group: 'energy',
    slider: true,
    unit: 'coefficient',
    meaning: 'How much energy a cell generates each step, proportional to its own density times its neighbors’ average density. Dense clusters are the engine’s only energy source.',
    higher: 'Dense regions generate energy fast — hotspots form quickly, feeding the birth-coupling feedback loop.',
    lower: 'Energy is scarce — growth relies more on the base density rules with little energy-driven acceleration.',
  },
  activityCost: {
    label: 'Activity cost',
    group: 'energy',
    slider: true,
    unit: 'coefficient',
    meaning: 'How much energy a cell burns in proportion to how much its own density changed that step (|new − old|). Change itself costs energy — static cells are "free."',
    higher: 'Fast-changing regions (growing fronts, dying patches) drain energy quickly — tends to stabilize patterns by starving turbulence.',
    lower: 'Change is cheap — energy stays high even in chaotic, fast-changing regions, which can sustain turbulence longer.',
  },
  energyLeakRate: {
    label: 'Energy leak rate',
    group: 'energy',
    slider: true,
    unit: 'fraction/step, 0–0.6',
    meaning: 'The fraction of a cell’s positive energy sent to neighbors each step (distributed per leakConcentration). This is a redistribution, not a loss — what leaves one cell arrives at another.',
    higher: 'Energy moves through the field fast — hotspots spread out / smear quickly rather than staying local.',
    lower: 'Energy stays put — hotspots stay concentrated and can build up (relevant to the Pulsing Heart-style boom/bust cycles).',
  },
  energyDecay: {
    label: 'Energy decay',
    group: 'energy',
    slider: true,
    unit: 'fraction/step, 0–0.1',
    meaning: 'The fraction of a cell’s current energy (positive or negative) that is simply removed from the system each step — the field’s only true energy loss (leak is redistribution, not loss).',
    higher: 'Energy dissipates fast — harder to sustain the high-energy feedback loop, patterns lean calmer.',
    lower: 'Energy persists — easier to build up large reserves, more dramatic energy-driven behavior.',
  },
  energyMin: {
    label: 'Energy floor',
    group: 'energy',
    slider: false,
    unit: 'energy',
    meaning: 'Hard clamp on how negative a cell’s energy can go.',
    higher: '(less negative) Energy deficits are capped smaller — starved regions recover faster.',
    lower: '(more negative) Energy debt can run deeper — starved regions take longer to recover, birthEnergyMin gating matters more.',
  },
  energyMax: {
    label: 'Energy ceiling',
    group: 'energy',
    slider: false,
    unit: 'energy',
    meaning: 'Hard clamp on how much energy a single cell can hold.',
    higher: 'Hotspots can accumulate more energy before capping out — bigger potential bursts (relevant to Pulsing Heart-style dynamics).',
    lower: 'Energy caps out sooner — dampens how extreme a single-cell hotspot can get.',
  },
  momentumSmoothing: {
    label: 'Momentum smoothing',
    group: 'momentum',
    slider: true,
    unit: 'fraction/step, 0–0.95',
    meaning: 'How much an already-alive cell’s momentum vector blends toward its neighbors’ density-weighted average each step, versus keeping its own current direction.',
    higher: 'Momentum reorients quickly to match the local flow — more fluid, harder for a cell to keep an independent direction.',
    lower: 'Momentum is sticky — a cell keeps pointing roughly where it was born pointing, for a long time.',
  },
  leakConcentration: {
    label: 'Leak concentration',
    group: 'momentum',
    slider: true,
    unit: '0 (isotropic) – 1 (directional)',
    meaning: 'How sharply energy leakage concentrates onto the single neighbor best-aligned with a cell’s momentum, versus spreading across all 6 neighbors roughly evenly. This is the raw parameter the Momentum Bias ontology slider drives.',
    higher: 'Energy flows as a narrow directional stream — visible drift/rotation, the effect Drifting Vortex is built around.',
    lower: 'Energy spreads outward evenly regardless of momentum — growth looks more like uniform diffusion than directed flow.',
  },
};

export function getParamMeta(key) {
  return PARAM_META[key] || null;
}

export function paramsByGroup() {
  const out = {};
  for (const groupKey of Object.keys(PARAM_GROUPS)) out[groupKey] = [];
  for (const [key, meta] of Object.entries(PARAM_META)) out[meta.group].push(key);
  return out;
}
