// Seed placement helpers: single cell, cluster, line, ring, asymmetric blob.

export function seedSingle(engine, q, r, density = 0.9, energy = 0.5) {
  engine.setCell(q, r, density, energy);
}

export function seedCluster(engine, cq, cr, radius, density = 0.9, energy = 0.6) {
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = -radius; dr <= radius; dr++) {
      if (Math.abs(dq + dr) > radius) continue;
      if (Math.hypot(dq, dr) > radius + 0.5) continue;
      engine.setCell(cq + dq, cr + dr, density * (0.7 + 0.3 * Math.random()), energy);
    }
  }
}

export function seedLine(engine, q0, r0, length, dir = 0, density = 0.9, energy = 0.6) {
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const [dq, dr] = dirs[dir % 6];
  for (let i = 0; i < length; i++) {
    engine.setCell(q0 + dq * i, r0 + dr * i, density, energy, (dir / 6) * Math.PI * 2);
  }
}

export function seedRing(engine, cq, cr, radius, density = 0.9, energy = 0.6) {
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  let q = cq + dirs[4][0] * radius, r = cr + dirs[4][1] * radius;
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      const angle = (side / 6) * Math.PI * 2;
      engine.setCell(q, r, density, energy, angle);
      q += dirs[side][0];
      r += dirs[side][1];
    }
  }
}

export function seedAsymmetric(engine, cq, cr, density = 0.9, energy = 0.6) {
  // lopsided blob: a cluster with a trailing line, to break symmetry and bias initial momentum.
  seedCluster(engine, cq, cr, 2, density, energy);
  seedLine(engine, cq - 1, cr + 2, 4, 5, density * 0.8, energy * 0.7);
  seedLine(engine, cq + 2, cr - 1, 3, 0, density * 0.85, energy * 0.5);
}

export function seedScattered(engine, cq, cr, count, spread, density = 0.9, energy = 0.5) {
  for (let i = 0; i < count; i++) {
    const dq = Math.round((Math.random() - 0.5) * spread * 2);
    const dr = Math.round((Math.random() - 0.5) * spread * 2);
    engine.setCell(cq + dq, cr + dr, density * (0.6 + 0.4 * Math.random()), energy);
  }
}
