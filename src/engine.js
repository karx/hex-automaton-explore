// Multi-field hexagonal cellular automaton engine.
// Axial coordinates (q,r), toroidal wrap on both axes (parallelogram hex torus).
// Fields: density (0..1), energy (unbounded-ish, clamped), momentum (vx,vy unit-ish vector).

export const DIRS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

// Cartesian unit vectors for each axial direction (pointy-top hex, size=1),
// used to bias energy leakage toward the neighbor closest to a cell's momentum vector.
const SQRT3 = Math.sqrt(3);
export const DIR_VECS = DIRS.map(([dq, dr]) => {
  const x = SQRT3 * dq + (SQRT3 / 2) * dr;
  const y = 1.5 * dr;
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
});

export function axialToPixel(q, r, size = 1) {
  return [size * (SQRT3 * q + (SQRT3 / 2) * r), size * 1.5 * r];
}

export class Engine {
  constructor(width, height, params, seedFn) {
    this.width = width;
    this.height = height;
    this.n = width * height;
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.generation = 0;

    this.density = new Float32Array(this.n);
    this.energy = new Float32Array(this.n);
    this.momX = new Float32Array(this.n);
    this.momY = new Float32Array(this.n);

    this._density2 = new Float32Array(this.n);
    this._energy2 = new Float32Array(this.n);
    this._momX2 = new Float32Array(this.n);
    this._momY2 = new Float32Array(this.n);
    this._leakIn = new Float32Array(this.n);

    // Rendering/UI-facing: dominant leak direction per source cell, for particle
    // and flow-arrow visualization. Physically the leak spreads across up to 6
    // neighbors (weighted by momentum alignment); this tracks only the single
    // heaviest-weighted neighbor per cell, cheap to recompute each step.
    this.leakPrimaryTarget = new Int32Array(this.n).fill(-1);
    this.leakPrimaryAmount = new Float32Array(this.n);

    // Per-cell interaction magnitudes, rendering/UI-facing (the 3D viewer's
    // cross-field beams read these directly). Recomputed fresh each step;
    // not involved in the simulation's own state transition.
    this.productionField = new Float32Array(this.n);   // density -> energy
    this.reinforcementField = new Float32Array(this.n); // energy -> density
    this.leakOutField = new Float32Array(this.n);        // energy -> neighbor (momentum-biased)

    this.lastStats = {
      totalDensity: 0, aliveCells: 0, totalEnergy: 0,
      totalProduction: 0, totalConsumption: 0, totalDecayLoss: 0, totalLeak: 0,
      momentumCoherence: 0, leakDirectionality: 0, resonance: 0, generation: 0,
    };

    // Precomputed neighbor index table: n*6 entries.
    this.neighbors = new Int32Array(this.n * 6);
    for (let r = 0; r < height; r++) {
      for (let q = 0; q < width; q++) {
        const idx = this.idx(q, r);
        for (let d = 0; d < 6; d++) {
          const [dq, dr] = DIRS[d];
          const nq = ((q + dq) % width + width) % width;
          const nr = ((r + dr) % height + height) % height;
          this.neighbors[idx * 6 + d] = this.idx(nq, nr);
        }
      }
    }

    if (seedFn) seedFn(this);
  }

  idx(q, r) {
    return r * this.width + q;
  }

  setCell(q, r, density, energy = 0, momAngle = Math.random() * Math.PI * 2) {
    const i = this.idx(((q % this.width) + this.width) % this.width, ((r % this.height) + this.height) % this.height);
    this.density[i] = density;
    this.energy[i] = energy;
    this.momX[i] = Math.cos(momAngle);
    this.momY[i] = Math.sin(momAngle);
  }

  // Returns { totalDensity, maxDensity, aliveCells }
  metrics() {
    let totalDensity = 0, maxDensity = 0, aliveCells = 0;
    for (let i = 0; i < this.n; i++) {
      const d = this.density[i];
      totalDensity += d;
      if (d > maxDensity) maxDensity = d;
      if (d > this.params.aliveThreshold) aliveCells++;
    }
    return { totalDensity, maxDensity, aliveCells, generation: this.generation };
  }

  step() {
    const p = this.params;
    const {
      width, height, n, density, energy, momX, momY, neighbors,
      _density2: nd, _energy2: ne, _momX2: nmx, _momY2: nmy, _leakIn: leakIn,
      leakPrimaryTarget, leakPrimaryAmount,
    } = this;

    leakIn.fill(0);
    leakPrimaryTarget.fill(-1);
    leakPrimaryAmount.fill(0);

    // sharpness of the leak-direction softmax: 0 (leakConcentration=0) spreads leak
    // ~uniformly across all 6 neighbors regardless of momentum; high values concentrate
    // it onto the single best-aligned neighbor (the old hard-argmax behavior).
    const sharpness = 0.4 + p.leakConcentration * 13;
    const dirWeights = this._dirWeights || (this._dirWeights = new Float32Array(6));

    // Pass 1: energy leakage, biased by momentum direction, from current state.
    for (let i = 0; i < n; i++) {
      const e = energy[i];
      if (e <= 0) continue;
      const leak = e * p.energyLeakRate;
      const mx = momX[i], my = momY[i];
      const mlen = Math.hypot(mx, my);

      let weightSum = 0;
      let bestW = -1, bestD = 0;
      if (mlen < 1e-6) {
        for (let d = 0; d < 6; d++) { dirWeights[d] = 1; weightSum += 1; bestD = 0; bestW = 1; }
      } else {
        const ux = mx / mlen, uy = my / mlen;
        for (let d = 0; d < 6; d++) {
          const dot = Math.max(0, ux * DIR_VECS[d][0] + uy * DIR_VECS[d][1]);
          const w = Math.pow(dot, sharpness);
          dirWeights[d] = w;
          weightSum += w;
          if (w > bestW) { bestW = w; bestD = d; }
        }
        if (weightSum < 1e-9) {
          for (let d = 0; d < 6; d++) { dirWeights[d] = 1; weightSum += 1; }
          bestD = 0;
        }
      }
      for (let d = 0; d < 6; d++) {
        const share = dirWeights[d] / weightSum;
        if (share <= 0) continue;
        leakIn[neighbors[i * 6 + d]] += leak * share;
      }
      const primaryTarget = neighbors[i * 6 + bestD];
      leakPrimaryTarget[i] = primaryTarget;
      leakPrimaryAmount[i] = leak * (dirWeights[bestD] / weightSum);
    }

    let sumProduction = 0, sumConsumption = 0, sumDecayLoss = 0, sumLeak = 0;
    let aggMomX = 0, aggMomY = 0, aggDensityForMom = 0;
    // leakDirectionality: leak-magnitude-weighted average share of each cell's outgoing
    // leak that went to its single best-aligned neighbor. ~1/6 when leak is spread evenly
    // (isotropic), approaching 1 when it's concentrated on one neighbor (directional).
    // Unlike momentumCoherence (whole-field vector alignment, also driven by birth
    // inheritance), this responds directly and only to leakConcentration.
    let sumDirectionality = 0, sumLeakForDirectionality = 0;
    for (let i = 0; i < n; i++) {
      const amt = leakPrimaryAmount[i];
      const totalOut = Math.max(0, energy[i]) * p.energyLeakRate;
      if (amt <= 0 || totalOut <= 1e-9) continue;
      sumDirectionality += amt;
      sumLeakForDirectionality += totalOut;
    }

    // Pass 2: full update per cell using only "current" snapshot values.
    for (let i = 0; i < n; i++) {
      const d0 = density[i];
      const e0 = energy[i];

      let neighborDensitySum = 0;
      let sumMomX = 0, sumMomY = 0, momWeight = 0;
      for (let k = 0; k < 6; k++) {
        const j = neighbors[i * 6 + k];
        const dj = density[j];
        neighborDensitySum += dj;
        sumMomX += momX[j] * dj;
        sumMomY += momY[j] * dj;
        momWeight += dj;
      }

      // --- Coupling: positive energy widens/lowers the birth window ---
      const energyBoost = Math.max(0, e0) * p.energyBirthCoupling;
      const birthLow = p.birthLow - energyBoost;
      const birthHigh = p.birthHigh + energyBoost * 0.6;
      const inBirthRange = neighborDensitySum >= birthLow && neighborDensitySum <= birthHigh;
      const inSurviveRange = neighborDensitySum >= p.surviveLow && neighborDensitySum <= p.surviveHigh + energyBoost * 0.4;

      let newDensity, newMomX, newMomY;
      let reinforcement = 0;
      const alive = d0 > p.aliveThreshold;

      if (!alive) {
        if (inBirthRange && e0 > p.birthEnergyMin) {
          const center = (birthLow + birthHigh) / 2;
          const spread = Math.max(1e-3, (birthHigh - birthLow) / 2);
          const closeness = 1 - Math.min(1, Math.abs(neighborDensitySum - center) / spread);
          newDensity = p.birthDensity * (0.6 + 0.4 * closeness);
          if (momWeight > 1e-6) {
            newMomX = sumMomX / momWeight;
            newMomY = sumMomY / momWeight;
          } else {
            const a = Math.random() * Math.PI * 2;
            newMomX = Math.cos(a);
            newMomY = Math.sin(a);
          }
        } else {
          newDensity = d0 * p.deadDecay;
          newMomX = momX[i] * 0.9;
          newMomY = momY[i] * 0.9;
        }
      } else {
        reinforcement = Math.max(0, e0) * p.energyToDensity;
        if (inSurviveRange) {
          newDensity = Math.min(1, d0 * p.surviveDecay + reinforcement);
        } else {
          newDensity = d0 * p.deathDecay;
        }
        if (momWeight > 1e-6) {
          const avgX = sumMomX / momWeight, avgY = sumMomY / momWeight;
          newMomX = momX[i] * (1 - p.momentumSmoothing) + avgX * p.momentumSmoothing;
          newMomY = momY[i] * (1 - p.momentumSmoothing) + avgY * p.momentumSmoothing;
        } else {
          newMomX = momX[i];
          newMomY = momY[i];
        }
      }

      // normalize momentum to unit length (direction-only carrier)
      const mlen = Math.hypot(newMomX, newMomY);
      if (mlen > 1e-6) { newMomX /= mlen; newMomY /= mlen; }

      // --- Energy field: produced by dense clusters, consumed by activity/change, leaks away ---
      const production = p.densityToEnergy * d0 * (neighborDensitySum / 6);
      const activity = Math.abs(newDensity - d0);
      const consumption = p.activityCost * activity;
      const leakOut = Math.max(0, e0) * p.energyLeakRate;
      const decayLoss = p.energyDecay * e0;
      let newEnergy = e0 + production - consumption - leakOut + leakIn[i] - decayLoss;
      newEnergy = Math.max(p.energyMin, Math.min(p.energyMax, newEnergy));

      sumProduction += production;
      sumConsumption += consumption;
      sumDecayLoss += Math.abs(decayLoss);
      sumLeak += leakOut;
      aggMomX += newMomX * newDensity;
      aggMomY += newMomY * newDensity;
      aggDensityForMom += newDensity;

      this.productionField[i] = production;
      this.reinforcementField[i] = reinforcement;
      this.leakOutField[i] = leakOut;

      nd[i] = Math.max(0, Math.min(1, newDensity));
      ne[i] = newEnergy;
      nmx[i] = newMomX;
      nmy[i] = newMomY;
    }

    this.density.set(nd);
    this.energy.set(ne);
    this.momX.set(nmx);
    this.momY.set(nmy);
    this.generation++;

    let totalDensity = 0, totalEnergy = 0, aliveCells = 0;
    for (let i = 0; i < n; i++) {
      totalDensity += this.density[i];
      totalEnergy += this.energy[i];
      if (this.density[i] > p.aliveThreshold) aliveCells++;
    }

    const dissipation = sumConsumption + sumDecayLoss;
    const resonance = 1 - Math.abs(sumProduction - dissipation) / (sumProduction + dissipation + 1e-6);
    const momentumCoherence = aggDensityForMom > 1e-6
      ? Math.hypot(aggMomX, aggMomY) / aggDensityForMom
      : 0;
    const leakDirectionality = sumLeakForDirectionality > 1e-9
      ? sumDirectionality / sumLeakForDirectionality
      : 0;

    this.lastStats = {
      totalDensity, aliveCells, totalEnergy,
      totalProduction: sumProduction, totalConsumption: sumConsumption,
      totalDecayLoss: sumDecayLoss, totalLeak: sumLeak,
      momentumCoherence: Math.max(0, Math.min(1, momentumCoherence)),
      leakDirectionality: Math.max(0, Math.min(1, leakDirectionality)),
      resonance: Math.max(0, Math.min(1, resonance)),
      generation: this.generation,
    };
  }
}

export const DEFAULT_PARAMS = {
  aliveThreshold: 0.15,
  birthLow: 1.9,
  birthHigh: 2.6,
  birthDensity: 0.85,
  birthEnergyMin: -0.2,
  surviveLow: 1.3,
  surviveHigh: 3.2,
  surviveDecay: 0.985,
  deathDecay: 0.72,
  deadDecay: 0.5,
  energyBirthCoupling: 1.2,
  energyToDensity: 0.02,
  densityToEnergy: 0.06,
  activityCost: 0.8,
  energyLeakRate: 0.22,
  energyDecay: 0.01,
  energyMin: -1,
  energyMax: 3,
  momentumSmoothing: 0.15,
  // 0 = leak spreads ~uniformly across all 6 neighbors (isotropic); 1 = leak
  // concentrates almost entirely on the single neighbor best-aligned with momentum
  // (directional). 0.82 default approximates the old hard-argmax-only behavior.
  leakConcentration: 0.82,
};
