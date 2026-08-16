// Regression check: confirm all existing presets still survive 700 generations
// (died=false, exploded=false) after the leakConcentration engine change.
import { Engine } from '../src/engine.js';
import { VARIANTS } from '../src/variants.js';

const GRID = 60, GENS = 700;

for (const v of VARIANTS) {
  const engine = new Engine(GRID, GRID, v.params, v.seed);
  const trail = [];
  let died = false, exploded = false;
  for (let g = 0; g < GENS; g++) {
    engine.step();
    if ((g + 1) % 100 === 0) {
      const frac = engine.lastStats.aliveCells / engine.n;
      trail.push(+(frac * 100).toFixed(1));
      if (engine.lastStats.aliveCells === 0) died = true;
      if (frac > 0.92) exploded = true;
    }
  }
  const s = engine.lastStats;
  console.log(
    `${v.id.padEnd(22)} died=${died} exploded=${exploded} traj%=[${trail.join(', ')}] ` +
    `resonance=${s.resonance.toFixed(2)} coherence=${s.momentumCoherence.toFixed(2)}`
  );
}
