// Reusable geometry builders for the 3D viewer's three instanced layers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bakes a per-vertex "color" attribute (a plain brightness multiplier, not a
// hue) from each vertex's normal.y: top-facing ~1.0, side-facing ~0.6. Combined
// with MeshBasicMaterial's vertexColors, this fakes a top-lit look for free —
// three.js multiplies geometry vertex color by instanceColor automatically
// (color_vertex.glsl.js: vColor *= color; vColor.rgb *= instanceColor.rgb), so
// the density hue still comes entirely from instanceColor. Used instead of real
// scene lighting because MeshStandardMaterial's per-pixel lighting was the
// dominant cost under software rasterization (see viewer3d.js comment).
function bakeTopLitShading(geo, { top = 1.0, side = 0.6 } = {}) {
  const normal = geo.attributes.normal;
  const count = normal.count;
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ny = normal.getY(i);
    const brightness = side + (top - side) * Math.max(0, ny);
    color[i * 3] = brightness;
    color[i * 3 + 1] = brightness;
    color[i * 3 + 2] = brightness;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return geo;
}

// A hex prism (6-sided cylinder) with its base pinned at y=0 so that scaling an
// instance's Y axis grows the prism upward from the ground plane instead of from
// its center — used so density can drive extrusion height intuitively.
// Rotated 30 deg to match the pointy-top orientation used by the 2D hex layout
// (src/render.js / src/engine.js axialToPixel), so adjacent prisms tile cleanly.
export function createHexPrismGeometry(radius = 1, unitHeight = 1) {
  const geo = new THREE.CylinderGeometry(radius, radius, unitHeight, 6, 1, false);
  geo.translate(0, unitHeight / 2, 0);
  geo.rotateY(Math.PI / 6);
  bakeTopLitShading(geo);
  return geo;
}

// A flat-ish hex "puck" for the energy layer (short, so scaling gives a disc-like glow base).
export function createHexPuckGeometry(radius = 1, unitHeight = 0.18) {
  return createHexPrismGeometry(radius, unitHeight);
}

// An arrow (shaft + cone head) pointing along +X by default, base at the origin,
// so instances can be positioned at a cell and rotated about Y by the momentum
// angle (atan2(momY, momX), since momentum lives in the hex XZ-plane).
export function createArrowGeometry({ shaftLength = 0.7, shaftRadius = 0.05, headLength = 0.35, headRadius = 0.13 } = {}) {
  const shaft = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 6);
  shaft.rotateZ(Math.PI / 2);
  shaft.translate(shaftLength / 2, 0, 0);

  const head = new THREE.ConeGeometry(headRadius, headLength, 8);
  head.rotateZ(-Math.PI / 2);
  head.translate(shaftLength + headLength / 2, 0, 0);

  return mergeGeometries([shaft, head]);
}

// A small icosahedron used for the energy layer's glow instances. detail=0
// (20 triangles) rather than 1 (80): additive-blended, overlapping transparent
// fragments are expensive to rasterize (no early-z rejection), so this layer's
// per-instance triangle count matters more than the others.
export function createEnergyOrbGeometry(radius = 1) {
  return new THREE.IcosahedronGeometry(radius, 0);
}
