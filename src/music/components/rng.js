// Seeded PRNG (mulberry32) so the composer's own randomness is reproducible
// for a given stats stream + seed, independent of the engine's own use of
// Math.random() for seeding (a separate, pre-existing gap — see
// docs/EXPLORATIONS.md "Still open").

export function createRng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
