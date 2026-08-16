// Particle effects for visualizing energy leakage (intent doc section 4: "particle
// effects for leaking energy"). Simulation-rate-agnostic: the caller drives
// spawn()/update() once per rendered frame, independent of how often the CA itself
// steps. Positions are read from render.js's layout.positions + leakPrimaryTarget,
// so a particle always travels along an actual hex-to-hex edge.

export class ParticleSystem {
  constructor({ maxParticles = 220, speed = 0.045 } = {}) {
    this.particles = [];
    this.maxParticles = maxParticles;
    this.speed = speed;
  }

  // Call once per frame, right after engine.step(), to spawn new particles from
  // cells that are currently leaking energy toward a neighbor.
  spawn(engine, layout, { threshold = 0.04, spawnRate = 0.35 } = {}) {
    const { leakPrimaryAmount, leakPrimaryTarget, n } = engine;
    const { positions, offsetX, offsetY } = layout;
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const amt = leakPrimaryAmount[i];
      if (amt < threshold) continue;
      const target = leakPrimaryTarget[i];
      if (target < 0) continue;
      if (Math.random() > spawnRate) continue;
      const from = positions[i], to = positions[target];
      this.particles.push({
        fx: from[0] + offsetX, fy: from[1] + offsetY,
        tx: to[0] + offsetX, ty: to[1] + offsetY,
        progress: 0, amount: amt,
      });
    }
  }

  // Advance all particles by one frame; drop any that reached their target.
  update() {
    const speed = this.speed;
    const alive = [];
    for (const p of this.particles) {
      p.progress += speed;
      if (p.progress < 1) alive.push(p);
    }
    this.particles = alive;
  }

  render(ctx) {
    for (const p of this.particles) {
      const x = p.fx + (p.tx - p.fx) * p.progress;
      const y = p.fy + (p.ty - p.fy) * p.progress;
      const fade = Math.sin(p.progress * Math.PI); // fade in at spawn, fade out at arrival
      const glow = Math.min(1, p.amount * 10);
      const alpha = (0.25 + glow * 0.75) * fade;
      const r = 1.1 + glow * 1.6;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
      grad.addColorStop(0, `rgba(255, 226, 150, ${alpha})`);
      grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  clear() {
    this.particles = [];
  }
}
