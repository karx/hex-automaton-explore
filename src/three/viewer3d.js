// 3D scene: each simulation field gets its own spatial layer stacked along Y,
// over the same hex grid laid out in the XZ plane, so a viewer can isolate any
// single field or watch how they interact. Cross-field beams connect
// corresponding cells between layers, driven by real per-cell interaction
// magnitudes (engine.productionField / reinforcementField / leakOutField).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeLayout } from '../render.js';
import { createHexPrismGeometry, createHexPuckGeometry, createArrowGeometry, createEnergyOrbGeometry } from './hexGeometry.js';

const DENSITY_MAX_HEIGHT = 2.6;
const ENERGY_ORB_MAX_RADIUS = 0.5;
const LAYER_GAP = 2.2;
const HEX_RADIUS = 0.92;

// warm amber <-> cool violet, matching the 2D energy glow palette
function energyColor(e, out) {
  const mag = Math.min(1, Math.abs(e) / 2);
  if (e >= 0) return out.setRGB(1.0 * mag + 0.05, 0.75 * mag + 0.03, 0.35 * mag + 0.02);
  return out.setRGB(0.35 * mag + 0.02, 0.4 * mag + 0.03, 1.0 * mag + 0.06);
}

function densityColor(d, out) {
  const hue = (252 - 218 * Math.min(1, d)) / 360;
  const sat = 0.5 + 0.35 * Math.min(1, d);
  const light = 0.12 + 0.45 * Math.min(1, d);
  return out.setHSL(hue, sat, light);
}

export class Viewer3D {
  constructor(container) {
    this.container = container;
    // antialias:false — a meaningful fragment-cost saving under software
    // rasterization (see the material comment below); pixelRatio capped lower
    // for the same reason.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.012);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(28, 26, 34);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, LAYER_GAP, 0);
    this.controls.update();

    // All three field layers use unlit (MeshBasicMaterial) instances — colors
    // are fully baked per-instance already, so no scene lighting is needed.

    // ground reference grid under the density layer
    const grid = new THREE.GridHelper(50, 20, 0x2a2e42, 0x181b28);
    grid.position.y = -0.01;
    this.scene.add(grid);

    this.layerGroups = { density: new THREE.Group(), energy: new THREE.Group(), momentum: new THREE.Group() };
    this.layerGroups.energy.position.y = LAYER_GAP;
    this.layerGroups.momentum.position.y = LAYER_GAP * 2;
    for (const g of Object.values(this.layerGroups)) this.scene.add(g);

    this.beamGroup = new THREE.Group();
    this.scene.add(this.beamGroup);

    this._densityMesh = null;
    this._energyMesh = null;
    this._momentumMesh = null;
    this._beamDE = null; // density <-> energy
    this._beamEM = null; // energy <-> momentum
    this.n = 0;
    this.positions = null; // Float32Array [n*2]: worldX, worldZ per cell

    this._scratchMatrix = new THREE.Matrix4();
    this._scratchQuat = new THREE.Quaternion();
    this._scratchPos = new THREE.Vector3();
    this._scratchScale = new THREE.Vector3();
    this._scratchColor = new THREE.Color();
    this._scratchColor2 = new THREE.Color();
    this._yAxis = new THREE.Vector3(0, 1, 0);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // (Re)build the instanced layers for a new grid size. Cheap enough to call on
  // every preset/grid-size change; only needed when `engine.n` changes.
  buildForGrid(width, height) {
    this._disposeMeshes();
    const n = width * height;
    this.n = n;
    this.gridWidth = width;
    this.gridHeight = height;

    const layout = computeLayout(width, height, 1);
    const centerX = layout.canvasWidth / 2 - layout.offsetX;
    const centerZ = layout.canvasHeight / 2 - layout.offsetY;
    this.positions = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const [px, py] = layout.positions[i];
      this.positions[i * 2] = px - centerX;
      this.positions[i * 2 + 1] = py - centerZ;
    }

    // MeshBasicMaterial (unlit) rather than MeshStandardMaterial: colors are fully
    // baked via instanceColor already, and real-time PBR lighting on ~n instances
    // is the dominant cost under software rasterization (measured: hiding just the
    // density+momentum layers took a scene from ~4fps to ~48fps under swiftshader,
    // while the CPU-side per-cell update loop alone profiles at ~9ms/frame) — so
    // the lighting computation itself, not instance-matrix bookkeeping, was the
    // bottleneck. A cheap synthetic diagonal shading term below keeps some sense
    // of depth/form without per-pixel lighting.
    const densityGeo = createHexPrismGeometry(HEX_RADIUS, 1);
    const densityMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this._densityMesh = new THREE.InstancedMesh(densityGeo, densityMat, n);
    this._densityMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

    const energyGeo = createEnergyOrbGeometry(1);
    const energyMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this._energyMesh = new THREE.InstancedMesh(energyGeo, energyMat, n);
    this._energyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

    const arrowGeo = createArrowGeometry({ shaftLength: 0.6, shaftRadius: 0.045, headLength: 0.32, headRadius: 0.12 });
    const momentumMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this._momentumMesh = new THREE.InstancedMesh(arrowGeo, momentumMat, n);
    this._momentumMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

    this.layerGroups.density.add(this._densityMesh);
    this.layerGroups.energy.add(this._energyMesh);
    this.layerGroups.momentum.add(this._momentumMesh);

    // beams: 2 points per cell per beam set
    this._beamDE = this._makeBeamLines(n);
    this._beamEM = this._makeBeamLines(n);
    this.beamGroup.add(this._beamDE.lines, this._beamEM.lines);
  }

  _makeBeamLines(n) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(n * 2 * 3);
    const colors = new Float32Array(n * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    return { lines, positions, colors };
  }

  _disposeMeshes() {
    for (const mesh of [this._densityMesh, this._energyMesh, this._momentumMesh]) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.parent && mesh.parent.remove(mesh);
    }
    for (const beam of [this._beamDE, this._beamEM]) {
      if (!beam) continue;
      beam.lines.geometry.dispose();
      beam.lines.material.dispose();
      beam.lines.parent && beam.lines.parent.remove(beam.lines);
    }
  }

  setLayerVisible(layer, visible) {
    if (this.layerGroups[layer]) this.layerGroups[layer].visible = visible;
  }

  setBeamsVisible(visible) {
    this.beamGroup.visible = visible;
  }

  // Read the engine's current field state and update all instance transforms,
  // colors, and beam geometry. Call once per rendered frame after engine.step().
  update(engine) {
    if (engine.n !== this.n || engine.width !== this.gridWidth || engine.height !== this.gridHeight) {
      this.buildForGrid(engine.width, engine.height);
    }
    const { density, energy, momX, momY, productionField, reinforcementField, leakOutField, leakPrimaryAmount, n } = engine;
    const pos = this.positions;
    const M = this._scratchMatrix, Q = this._scratchQuat, P = this._scratchPos, S = this._scratchScale;
    const C = this._scratchColor, C2 = this._scratchColor2;

    const dePos = this._beamDE.positions, deCol = this._beamDE.colors;
    const emPos = this._beamEM.positions, emCol = this._beamEM.colors;
    const energyY = LAYER_GAP, momentumY = LAYER_GAP * 2;

    for (let i = 0; i < n; i++) {
      const wx = pos[i * 2], wz = pos[i * 2 + 1];
      const d = density[i];
      const e = energy[i];

      // --- density layer: extrusion height + hue driven by density ---
      const hScale = Math.max(0.02, d) * DENSITY_MAX_HEIGHT;
      P.set(wx, 0, wz);
      Q.identity();
      S.set(1, hScale, 1);
      M.compose(P, Q, S);
      this._densityMesh.setMatrixAt(i, M);
      densityColor(d, C);
      this._densityMesh.setColorAt(i, C);

      // --- energy layer: glow orb, radius + color driven by |energy| and sign ---
      // Collapse near-zero energy to true zero scale (not just a small floor):
      // additive-blended fragments are expensive to rasterize under software
      // rendering, and most cells sit at exactly 0 energy for most of a run —
      // rendering all of them as small-but-nonzero orbs was pure waste.
      const eMag = Math.abs(e);
      const eRadius = eMag < 0.03 ? 0 : 0.06 + Math.min(1, eMag / 2) * ENERGY_ORB_MAX_RADIUS;
      P.set(wx, energyY, wz);
      Q.identity();
      S.set(eRadius, eRadius, eRadius);
      M.compose(P, Q, S);
      this._energyMesh.setMatrixAt(i, M);
      energyColor(e, C);
      this._energyMesh.setColorAt(i, C);

      // --- momentum layer: arrow oriented by (momX, momY), dimmed where density is low ---
      const mx = momX[i], my = momY[i];
      const angle = Math.atan2(-my, mx);
      Q.setFromAxisAngle(this._yAxis, angle);
      P.set(wx, momentumY, wz);
      const armScale = 0.5 + Math.min(1, d) * 0.9;
      S.set(armScale, armScale, armScale);
      M.compose(P, Q, S);
      this._momentumMesh.setMatrixAt(i, M);
      const dim = 0.15 + Math.min(1, d) * 0.85;
      this._momentumMesh.setColorAt(i, C.setRGB(0.55 * dim, 0.85 * dim, 0.95 * dim));

      // --- beams: density-top <-> energy (production/reinforcement) ---
      const prod = productionField[i], reinf = reinforcementField[i];
      const activity = prod + reinf;
      const idx6 = i * 6;
      dePos[idx6] = wx; dePos[idx6 + 1] = hScale; dePos[idx6 + 2] = wz;
      dePos[idx6 + 3] = wx; dePos[idx6 + 4] = energyY; dePos[idx6 + 5] = wz;
      const activityMag = Math.min(1, activity * 6);
      if (prod >= reinf) C.setRGB(1.0 * activityMag, 0.65 * activityMag, 0.25 * activityMag);
      else C.setRGB(1.0 * activityMag, 0.25 * activityMag, 0.45 * activityMag);
      deCol[idx6] = C.r; deCol[idx6 + 1] = C.g; deCol[idx6 + 2] = C.b;
      deCol[idx6 + 3] = C.r; deCol[idx6 + 4] = C.g; deCol[idx6 + 5] = C.b;

      // --- beams: energy <-> momentum (leak, directionality-colored) ---
      const leak = leakOutField[i];
      const directionality = leak > 1e-6 ? Math.min(1, leakPrimaryAmount[i] / leak) : 0;
      const leakMag = Math.min(1, leak * 5);
      const hue = (210 - directionality * 175) / 360;
      C2.setHSL(hue, 0.85, 0.5 + leakMag * 0.15);
      emPos[idx6] = wx; emPos[idx6 + 1] = energyY; emPos[idx6 + 2] = wz;
      emPos[idx6 + 3] = wx; emPos[idx6 + 4] = momentumY; emPos[idx6 + 5] = wz;
      const emR = C2.r * leakMag, emG = C2.g * leakMag, emB = C2.b * leakMag;
      emCol[idx6] = emR; emCol[idx6 + 1] = emG; emCol[idx6 + 2] = emB;
      emCol[idx6 + 3] = emR; emCol[idx6 + 4] = emG; emCol[idx6 + 5] = emB;
    }

    this._densityMesh.instanceMatrix.needsUpdate = true;
    this._densityMesh.instanceColor.needsUpdate = true;
    this._energyMesh.instanceMatrix.needsUpdate = true;
    this._energyMesh.instanceColor.needsUpdate = true;
    this._momentumMesh.instanceMatrix.needsUpdate = true;
    this._momentumMesh.instanceColor.needsUpdate = true;
    this._beamDE.lines.geometry.attributes.position.needsUpdate = true;
    this._beamDE.lines.geometry.attributes.color.needsUpdate = true;
    this._beamEM.lines.geometry.attributes.position.needsUpdate = true;
    this._beamEM.lines.geometry.attributes.color.needsUpdate = true;
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this._disposeMeshes();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
