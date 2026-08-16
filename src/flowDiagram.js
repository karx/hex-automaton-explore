// Small animated interaction-flow diagram (intent doc section 6: "interaction flow
// diagrams with animated arrows for leakage and coupling"). Three nodes for the
// three fields; arrow width/speed/color respond to the engine's live lastStats so
// the diagram is a genuine readout, not decoration.

const NODES = {
  density: { x: 0.22, y: 0.78, label: 'Density', color: '#ffb545' },
  energy: { x: 0.78, y: 0.78, label: 'Energy', color: '#ff8a3d' },
  momentum: { x: 0.5, y: 0.18, label: 'Momentum', color: '#8fe0ff' },
};

function drawArrow(ctx, x1, y1, x2, y2, { width, color, dashSpeed, dashOffset, curve = 0 }) {
  const mx = (x1 + x2) / 2 - curve * (y2 - y1);
  const my = (y1 + y2) / 2 + curve * (x2 - x1);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -dashOffset * dashSpeed;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  ctx.restore();

  // arrowhead at ~85% along the curve
  const t = 0.85;
  const ax = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
  const ay = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
  const dx = 2 * (1 - t) * (mx - x1) + 2 * t * (x2 - mx);
  const dy = 2 * (1 - t) * (my - y1) + 2 * t * (y2 - my);
  const dlen = Math.hypot(dx, dy) || 1;
  const ux = dx / dlen, uy = dy / dlen;
  const perpX = -uy, perpY = ux;
  const headLen = Math.max(5, width * 2.2);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax + ux * headLen * 0.6, ay + uy * headLen * 0.6);
  ctx.lineTo(ax - ux * headLen * 0.3 + perpX * headLen * 0.4, ay - uy * headLen * 0.3 + perpY * headLen * 0.4);
  ctx.lineTo(ax - ux * headLen * 0.3 - perpX * headLen * 0.4, ay - uy * headLen * 0.3 - perpY * headLen * 0.4);
  ctx.closePath();
  ctx.fill();
}

export function renderFlowDiagram(ctx, width, height, stats, animT) {
  ctx.clearRect(0, 0, width, height);

  const P = (n) => [NODES[n].x * width, NODES[n].y * height];
  const [dx, dy] = P('density');
  const [ex, ey] = P('energy');
  const [mx, my] = P('momentum');

  const production = Math.min(1, stats.totalProduction / 8);
  const leak = Math.min(1, stats.totalLeak / 20);
  const decay = Math.min(1, stats.totalDecayLoss / 8);
  const directionality = stats.leakDirectionality ?? 0;

  // Density -> Energy (production)
  drawArrow(ctx, dx, dy, ex, ey, {
    width: 1.2 + production * 5,
    color: `rgba(255, 200, 110, ${0.35 + production * 0.6})`,
    dashSpeed: 14, dashOffset: animT, curve: -0.18,
  });

  // Energy -> Density (reinforcement / coupling), gentler + opposite curve
  drawArrow(ctx, ex, ey, dx, dy, {
    width: 1 + decay * 3,
    color: 'rgba(255, 140, 90, 0.4)',
    dashSpeed: 8, dashOffset: animT, curve: -0.18,
  });

  // Energy -> Momentum (leak, momentum-biased): color shifts isotropic(blue)->directional(orange)
  const leakHue = 210 - directionality * 175;
  drawArrow(ctx, ex, ey, mx, my, {
    width: 1.2 + leak * 5,
    color: `hsla(${leakHue.toFixed(0)}, 85%, 68%, ${0.35 + leak * 0.55})`,
    dashSpeed: 10 + directionality * 20, dashOffset: animT, curve: 0.15,
  });

  // Momentum -> Density (birth inherits neighbor momentum), thin/static-ish
  drawArrow(ctx, mx, my, dx, dy, {
    width: 1,
    color: 'rgba(150, 220, 255, 0.3)',
    dashSpeed: 5, dashOffset: animT, curve: 0.15,
  });

  // nodes on top
  for (const key of ['density', 'energy', 'momentum']) {
    const n = NODES[key];
    const x = n.x * width, y = n.y * height;
    const r = key === 'energy' ? 9 + Math.min(10, Math.abs(stats.totalEnergy) / 40) : 9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = n.color;
    ctx.fill();
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#c9cddc';
    ctx.textAlign = 'center';
    ctx.fillText(n.label, x, y + r + 13);
  }
}
