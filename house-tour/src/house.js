// Builds the 22' x 70' Type 2A single-storey terrace unit, its neighbours and street.
// Plan coordinates: x = across the lot (0 = left party wall, W = right party wall),
// d = depth from the front gate (0) to the back boundary (L). World z = -d.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as T from './textures.js';

export const W = 6.706;
export const L = 21.336;
export const FRONT = 5.6; // front wall of the house
export const BACK = 19.3; // back wall (yard beyond)
export const FL = 0.12; // finished floor level inside
export const CH = FL + 3.0; // ceiling height
export const MID = 3.0; // line between the living spine and the rooms on the right

export const ROOMS = [
  { id: 'bath2', name: 'Bathroom 2', short: 'B2', rects: [[MID, 4.7, 16.3, BACK]], color: '#2e8b45', surface: 'tile', size: '1.7 × 3.0 m' },
  { id: 'kitchen', name: 'Kitchen', short: 'Kitchen', rects: [[MID, W, 13.4, 16.3], [4.7, W, 16.3, BACK]], color: '#f6b98f', surface: 'tile', size: '3.7 × 5.9 m' },
  { id: 'bed2', name: 'Bedroom 2', short: 'Bed 2', rects: [[0, MID, 15.6, BACK]], color: '#f2de3a', surface: 'wood', size: '3.0 × 3.7 m' },
  { id: 'living', name: 'Living Room', short: 'Living', rects: [[0, MID, FRONT, 10.6]], color: '#f4a9c6', surface: 'tile', size: '3.0 × 5.0 m' },
  { id: 'dining', name: 'Dining', short: 'Dining', rects: [[0, MID, 10.6, 15.6]], color: '#f4a9c6', surface: 'tile', size: '3.0 × 5.0 m' },
  { id: 'bed1', name: 'Master Bedroom', short: 'Bed 1', rects: [[MID, W, FRONT, 9.0]], color: '#f2de3a', surface: 'wood', size: '3.7 × 3.4 m' },
  { id: 'bath1', name: 'Bathroom 1', short: 'B1', rects: [[MID, W, 9.0, 10.5]], color: '#2e8b45', surface: 'tile', size: '3.7 × 1.5 m' },
  { id: 'bed3', name: 'Bedroom 3', short: 'Bed 3', rects: [[MID, W, 10.5, 13.4]], color: '#f2de3a', surface: 'wood', size: '3.7 × 2.9 m' },
  { id: 'porch', name: 'Car Porch', short: 'Car Porch', rects: [[0, W, 0, FRONT]], color: '#d8d8d6', surface: 'outdoor', size: '6.7 × 5.6 m', outside: true },
  { id: 'yard', name: 'Yard', short: 'Yard', rects: [[0, W, BACK, L]], color: '#d8d8d6', surface: 'outdoor', size: '6.7 × 2.0 m', outside: true },
];

export function roomAt(x, d) {
  for (const r of ROOMS) for (const [x0, x1, d0, d1] of r.rects) if (x >= x0 && x <= x1 && d >= d0 && d <= d1) return r;
  if (d < 0) return { id: 'street', name: 'Street', short: 'Street', surface: 'outdoor', outside: true, size: '' };
  return null;
}

export function floorAt(x, d) {
  return x > 0 && x < W && d > FRONT - 0.1 && d < BACK + 0.1 ? FL : 0;
}

// ---------------- geometry helpers ----------------
function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = p.getX(i); v = p.getZ(i); }
    else if (nx >= nz) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function boxGeo(x0, x1, y0, y1, d0, d1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(d1 - d0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, -(d0 + d1) / 2);
  return worldUV(g);
}

export function place(obj, x, y, d, ry = 0) {
  obj.position.set(x, y, -d);
  obj.rotation.y = ry;
  return obj;
}

// Collects static geometry per material and merges it to keep draw calls low.
class Builder {
  constructor() {
    this.batches = new Map();
    this.colliders = [];
  }
  add(mat, geo, cast = true, receive = true) {
    const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    if (!this.batches.has(key)) this.batches.set(key, { mat, cast, receive, geos: [] });
    this.batches.get(key).geos.push(geo);
  }
  box(mat, x0, x1, y0, y1, d0, d1, o = {}) {
    this.add(mat, boxGeo(x0, x1, y0, y1, d0, d1), o.cast ?? true, o.receive ?? true);
    if (o.collide) this.collide(x0, x1, d0, d1);
  }
  collide(x0, x1, d0, d1) {
    this.colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), d0: Math.min(d0, d1), d1: Math.max(d0, d1) });
  }
  flush(parent) {
    for (const { mat, cast, receive, geos } of this.batches.values()) {
      const anyNonIndexed = geos.some((g) => !g.index);
      const list = geos.map((g) => {
        let h = anyNonIndexed && g.index ? g.toNonIndexed() : g;
        for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k);
        return h;
      });
      const merged = mergeGeometries(list, false);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      parent.add(m);
    }
    this.batches.clear();
  }
}

// ---------------- materials ----------------
function std(o) { return new THREE.MeshStandardMaterial(o); }
function withRepeat(set, span) {
  for (const k of ['map', 'normalMap', 'roughnessMap']) if (set[k]) set[k].repeat.set(1 / span, 1 / span);
  return set;
}

export function makeMaterials() {
  const M = {};
  const plasterT = T.plaster([242, 239, 233]);
  withRepeat(plasterT, 2.5);
  M.wall = std({ ...plasterT, color: 0xe4dfd6, roughness: 0.93, normalScale: new THREE.Vector2(0.4, 0.4) });
  M.ceiling = std({ map: plasterT.map, color: 0xeeebe6, roughness: 0.95 });
  M.accentSage = std({ ...plasterT, color: 0x9fae98, roughness: 0.92 });
  M.accentBlue = std({ ...plasterT, color: 0x93a7b8, roughness: 0.92 });
  M.accentClay = std({ ...plasterT, color: 0xd1ab8c, roughness: 0.92 });
  M.accentCharcoal = std({ ...plasterT, color: 0x57534e, roughness: 0.9 });
  const extT = T.plaster([236, 230, 219]);
  withRepeat(extT, 3);
  M.exterior = std({ ...extT, color: 0xffffff, roughness: 0.95 });
  M.exteriorDark = std({ ...extT, color: 0x5b5752, roughness: 0.9 });
  M.boundary = std({ ...extT, color: 0xd9d3c7, roughness: 0.95 });
  const stoneT = withRepeat(T.concrete([150, 140, 126]), 1.2);
  M.stone = std({ ...stoneT, roughness: 1, normalScale: new THREE.Vector2(2, 2) });
  M.marble = std({ ...withRepeat(T.marbleTile(), 1.2), roughness: 1, metalness: 0, envMapIntensity: 0.8 });
  M.wood = std({ ...withRepeat(T.woodFloor(), 1.3), roughness: 1, envMapIntensity: 0.7 });
  M.bathFloor = std({ ...withRepeat(T.ceramicTile({ cols: 8, rows: 8, color: [92, 94, 96], grout: [60, 60, 60], vary: 6 }), 0.8), roughness: 0.35 });
  M.bathWall = std({ ...withRepeat(T.ceramicTile({ cols: 3, rows: 6, color: [232, 230, 224], grout: [196, 192, 186], vary: 4 }), 1.2), roughness: 0.18 });
  M.bathAccent = std({ ...withRepeat(T.ceramicTile({ cols: 8, rows: 4, color: [58, 102, 88], grout: [200, 200, 196], vary: 14, stagger: true }), 0.6), roughness: 0.15 });
  M.subway = std({ ...withRepeat(T.ceramicTile({ cols: 4, rows: 8, color: [226, 232, 224], grout: [190, 190, 184], vary: 5, stagger: true }), 0.6), roughness: 0.12 });
  M.pavers = std({ ...withRepeat(T.pavers(), 1.0), roughness: 0.92 });
  M.concrete = std({ ...withRepeat(T.concrete(), 2.5), roughness: 1 });
  M.sidewalk = std({ ...withRepeat(T.ceramicTile({ cols: 2, rows: 2, color: [168, 164, 156], grout: [120, 118, 112], vary: 12, S: 256 }), 1.0), roughness: 0.95 });
  M.asphalt = std({ ...withRepeat(T.asphalt(), 4), roughness: 0.92 });
  M.grass = std({ ...withRepeat(T.grass(), 2), roughness: 1 });
  M.roof = std({ ...withRepeat(T.roofTiles(), 1.0), roughness: 0.75 });
  M.fascia = std({ color: 0xf2f0ea, roughness: 0.6 });
  M.alu = std({ color: 0x2a2b2d, roughness: 0.38, metalness: 0.7 });
  M.black = std({ color: 0x151515, roughness: 0.5, metalness: 0.3 });
  M.chrome = std({ color: 0xffffff, roughness: 0.08, metalness: 1 });
  M.brushed = std({ color: 0xd8d8d8, roughness: 0.32, metalness: 1 });
  M.brass = std({ color: 0xc9a36b, roughness: 0.28, metalness: 1 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0xdfeaf0, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  M.glassFrost = new THREE.MeshPhysicalMaterial({ color: 0xf2f5f5, roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false });
  M.showerGlass = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f0, roughness: 0.02, transparent: true, opacity: 0.12, envMapIntensity: 2, depthWrite: false, side: THREE.DoubleSide });
  M.walnut = std({ ...withRepeat(T.veneer([118, 78, 50]), 1.0), roughness: 0.55 });
  M.oak = std({ ...withRepeat(T.veneer([192, 150, 104], 0.8), 1.0), roughness: 0.6 });
  M.doorWood = std({ ...withRepeat(T.veneer([96, 62, 38], 1.2), 1.2), roughness: 0.5 });
  M.paintWhite = std({ color: 0xf1efe9, roughness: 0.5 });
  M.lacquerSage = std({ color: 0x7f9384, roughness: 0.42 });
  M.lacquerCream = std({ color: 0xe8e2d4, roughness: 0.45 });
  M.quartz = std({ ...withRepeat(T.marbleTile([246, 245, 242], [190, 186, 180]), 1.4), roughness: 0.15 });
  M.sofa = std({ ...withRepeat(T.fabric([126, 120, 110]), 0.35), roughness: 1 });
  M.sofaCushion = std({ ...withRepeat(T.fabric([178, 140, 92], 3), 0.3), roughness: 1 });
  M.cushionBlue = std({ ...withRepeat(T.fabric([62, 84, 104], 3), 0.3), roughness: 1 });
  M.linen = std({ ...withRepeat(T.fabric([236, 232, 222], 2), 0.25), roughness: 1 });
  M.duvetSand = std({ ...withRepeat(T.fabric([206, 186, 156], 3), 0.3), roughness: 1 });
  M.duvetBlue = std({ ...withRepeat(T.fabric([118, 136, 154], 3), 0.3), roughness: 1 });
  M.duvetSage = std({ ...withRepeat(T.fabric([150, 166, 142], 3), 0.3), roughness: 1 });
  M.headboard = std({ ...withRepeat(T.fabric([94, 88, 82], 5), 0.4), roughness: 1 });
  M.curtain = std({ ...withRepeat(T.fabric([226, 216, 198], 2), 0.3), roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
  M.rug = std({ ...T.rug(), roughness: 1 });
  M.rugPlain = std({ ...withRepeat(T.fabric([150, 132, 110], 2), 0.2), roughness: 1 });
  M.ceramic = std({ color: 0xfbfbf8, roughness: 0.08, metalness: 0 });
  M.terracotta = std({ color: 0xb4674a, roughness: 0.85 });
  M.potGrey = std({ color: 0x6d6a66, roughness: 0.9 });
  M.soil = std({ color: 0x3a2a1e, roughness: 1 });
  M.leaf = std({ map: T.leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  M.foliage = std({ color: 0x3f6b35, roughness: 0.9 });
  M.foliageDark = std({ color: 0x24401f, roughness: 1 });
  M.leafCard = std({ map: T.leafCluster(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
  M.bark = std({ color: 0x4e3b2c, roughness: 1 });
  M.rubber = std({ color: 0x141414, roughness: 0.85 });
  M.carPaint = new THREE.MeshPhysicalMaterial({ color: 0x8a1c22, roughness: 0.32, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.04 });
  M.carGlass = new THREE.MeshPhysicalMaterial({ color: 0x0c1116, roughness: 0.05, metalness: 0.2, envMapIntensity: 2 });
  M.screenOff = std({ color: 0x050505, roughness: 0.12, metalness: 0.3 });
  // emissive fixtures (intensity driven by time of day)
  M.bulb = std({ color: 0xffffff, emissive: 0xffd6a0, emissiveIntensity: 3, roughness: 0.4 });
  M.downlight = std({ color: 0xffffff, emissive: 0xfff0dd, emissiveIntensity: 2, roughness: 0.4 });
  M.ledStrip = std({ color: 0xffffff, emissive: 0xffc98a, emissiveIntensity: 2 });
  M.shade = std({ color: 0xf1e7d4, emissive: 0xffc98a, emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
  M.globe = new THREE.MeshPhysicalMaterial({ color: 0xfff4e0, emissive: 0xffd2a0, emissiveIntensity: 1.5, roughness: 0.2, transparent: true, opacity: 0.85 });
  M.nightWindow = std({ color: 0x1a1d22, emissive: 0xffb866, emissiveIntensity: 0, roughness: 0.3 });
  M.darkWindow = new THREE.MeshPhysicalMaterial({ color: 0x1b2026, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.8 });
  M.headlight = std({ color: 0xffffff, emissive: 0xeaf2ff, emissiveIntensity: 0.3, roughness: 0.1 });
  M.taillight = std({ color: 0x550000, emissive: 0xff1a10, emissiveIntensity: 0.2, roughness: 0.2 });
  M.art = [0, 1, 2, 3, 4].map((k) => std({ map: T.artwork(k), roughness: 0.8 }));
  M.water = new THREE.MeshPhysicalMaterial({ color: 0x9ec9d6, roughness: 0.05, transparent: true, opacity: 0.6 });
  return M;
}

// ---------------- the house ----------------
export function buildWorld(scene, M, renderer) {
  const root = new THREE.Group();
  scene.add(root);
  const B = new Builder();
  const doors = [];
  const fans = [];
  const lights = []; // { light, day, golden, night }
  const roofGroup = new THREE.Group();
  const interiorLights = new THREE.Group();
  root.add(roofGroup, interiorLights);
  const anim = []; // per-frame callbacks
  const cardGeo = new THREE.PlaneGeometry(0.9, 0.9);

  const mesh = (geo, mat, x, y, d, ry = 0, parent = root, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    place(m, x, y, d, ry);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ---- walls ----
  function wall(axis, at, a, b, t, openings = [], o = {}) {
    const mat = o.mat ?? M.wall;
    const y0 = o.y0 ?? 0, y1 = o.y1 ?? CH;
    const ops = [...openings].sort((p, q) => p.a - q.a);
    const solid = (p, q, ya, yb, collide) => {
      if (q - p < 0.005 || yb - ya < 0.005) return;
      if (axis === 'x') B.box(mat, p, q, ya, yb, at - t / 2, at + t / 2, { collide });
      else B.box(mat, at - t / 2, at + t / 2, ya, yb, p, q, { collide });
      if (o.skirt && ya === y0) {
        const s = t + 0.024;
        if (axis === 'x') B.box(M.paintWhite, p, q, FL, FL + 0.09, at - s / 2, at + s / 2, { cast: false });
        else B.box(M.paintWhite, at - s / 2, at + s / 2, FL, FL + 0.09, p, q, { cast: false });
      }
    };
    let cur = a;
    for (const op of ops) {
      solid(cur, op.a, y0, y1, true);
      if (op.y0 > y0 + 0.01) solid(op.a, op.b, y0, op.y0, true);
      if (op.y1 < y1 - 0.01) solid(op.a, op.b, op.y1, y1, false);
      cur = op.b;
    }
    solid(cur, b, y0, y1, true);
  }

  // ---- window with frame, glass, sill ----
  function windowAt(axis, at, a, b, y0, y1, t, o = {}) {
    const fd = 0.07; // frame depth
    const fw = 0.05;
    const frame = (p, q, ya, yb) => {
      if (axis === 'x') B.box(M.alu, p, q, ya, yb, at - fd / 2, at + fd / 2);
      else B.box(M.alu, at - fd / 2, at + fd / 2, ya, yb, p, q);
    };
    frame(a, a + fw, y0, y1);
    frame(b - fw, b, y0, y1);
    frame(a, b, y0, y0 + fw);
    frame(a, b, y1 - fw, y1);
    const panes = o.panes ?? Math.max(2, Math.round((b - a) / 0.7));
    for (let i = 1; i < panes; i++) {
      const m = a + ((b - a) * i) / panes;
      frame(m - 0.02, m + 0.02, y0, y1);
    }
    if (o.transom) frame(a, b, y1 - 0.45, y1 - 0.41);
    const gmat = o.glass ?? M.glass;
    const g = new THREE.PlaneGeometry(b - a, y1 - y0);
    const gm = new THREE.Mesh(g, gmat);
    gm.renderOrder = 2;
    if (axis === 'x') place(gm, (a + b) / 2, (y0 + y1) / 2, at);
    else place(gm, at, (y0 + y1) / 2, (a + b) / 2, Math.PI / 2);
    gm.castShadow = false;
    o.parent ? o.parent.add(gm) : root.add(gm);
    // interior sill (side = +1 means interior is +d or +x)
    if (o.sill !== false) {
      const s = o.side ?? 1;
      if (axis === 'x') B.box(M.paintWhite, a - 0.05, b + 0.05, y0 - 0.03, y0, at, at + s * (t / 2 + 0.05));
      else B.box(M.paintWhite, at, at + s * (t / 2 + 0.05), y0 - 0.03, y0, a - 0.05, b + 0.05);
    }
    return gm;
  }

  function architrave(axis, at, a, b, top, t) {
    const e = t + 0.03, w = 0.07;
    if (axis === 'x') {
      B.box(M.paintWhite, a - w, a, FL, top + w, at - e / 2, at + e / 2);
      B.box(M.paintWhite, b, b + w, FL, top + w, at - e / 2, at + e / 2);
      B.box(M.paintWhite, a - w, b + w, top, top + w, at - e / 2, at + e / 2);
    } else {
      B.box(M.paintWhite, at - e / 2, at + e / 2, FL, top + w, a - w, a);
      B.box(M.paintWhite, at - e / 2, at + e / 2, FL, top + w, b, b + w);
      B.box(M.paintWhite, at - e / 2, at + e / 2, top, top + w, a - w, b + w);
    }
  }

  // Door leaf on a hinge. `into` is the side (+1/-1 along the perpendicular axis) it swings into.
  function door(name, axis, at, a, b, into, o = {}) {
    const top = o.top ?? FL + 2.1;
    const base = o.base ?? FL;
    const width = b - a;
    const thick = o.thick ?? 0.045;
    const pivot = new THREE.Group();
    const leaf = new THREE.Group();
    pivot.add(leaf);
    const h = top - base - 0.01;
    const mat = o.mat ?? M.paintWhite;
    const panel = new THREE.Mesh(worldUV(new THREE.BoxGeometry(width - 0.01, h, thick)), mat);
    panel.castShadow = true;
    panel.receiveShadow = true;
    leaf.add(panel);
    panel.position.set(width / 2, h / 2, 0);
    if (o.grooves) {
      for (let i = 1; i < 6; i++) {
        const gv = new THREE.Mesh(new THREE.BoxGeometry(0.012, h - 0.3, thick + 0.004), M.black);
        gv.position.set((width * i) / 6, h / 2, 0);
        leaf.add(gv);
      }
    }
    if (o.glassSlit) {
      const gs = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.7, thick + 0.006), M.glassFrost);
      gs.position.set(width * 0.78, h / 2, 0);
      leaf.add(gs);
    }
    // lever handles on both faces
    for (const s of [-1, 1]) {
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 16), o.handle ?? M.brushed);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(width - 0.07, 1.0, s * (thick / 2 + 0.005));
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, 0.018), o.handle ?? M.brushed);
      lever.position.set(width - 0.12, 1.0, s * (thick / 2 + 0.03));
      leaf.add(rose, lever);
      if (o.pull) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 10), M.brass);
        bar.position.set(width - 0.1, 1.1, s * (thick / 2 + 0.05));
        leaf.add(bar);
      }
    }
    // orient: leaf local +x runs from the hinge (at `a`) toward `b`
    let theta;
    if (axis === 'x') {
      place(pivot, a, base, at);
      theta = (Math.PI / 2) * into;
    } else {
      place(pivot, at, base, a);
      leaf.rotation.y = Math.PI / 2; // make local +x point toward +d
      theta = -(Math.PI / 2) * into;
    }
    if (o.flip) { // hinge on the `b` end instead
      if (axis === 'x') { pivot.position.x = b; leaf.rotation.y = Math.PI; theta = -(Math.PI / 2) * into; }
      else { pivot.position.z = -b; leaf.rotation.y = -Math.PI / 2; theta = (Math.PI / 2) * into; }
    }
    root.add(pivot);
    const cx = axis === 'x' ? (a + b) / 2 : at;
    const cd = axis === 'x' ? at : (a + b) / 2;
    const dr = { name, pivot, open: 0, target: 0, maxAngle: theta * (o.angle ?? 0.95), x: cx, d: cd, range: o.range ?? 1.9, sound: o.sound ?? 'door', isOpen: false };
    doors.push(dr);
    return dr;
  }

  // ================= ground, street, plot =================
  const ground = new THREE.PlaneGeometry(260, 200).rotateX(-Math.PI / 2);
  ground.translate(W / 2, -0.02, -L / 2 + 10);
  worldUV(ground);
  B.add(M.grass, ground, false, true);
  // road
  B.box(M.asphalt, -120, 130, -0.05, 0.0, -9.5, -2.6, { cast: false });
  // lane dashes
  for (let x = -110; x < 120; x += 6) B.box(M.paintWhite, x, x + 3, 0.0, 0.004, -6.1, -6.0, { cast: false });
  // curbs + sidewalks + monsoon drain
  B.box(M.concrete, -120, 130, 0, 0.15, -2.6, -2.45);
  B.box(M.concrete, -120, 130, 0, 0.15, -9.65, -9.5);
  B.box(M.sidewalk, -120, 130, 0, 0.06, -2.45, -0.9, { cast: false });
  B.box(M.concrete, -120, 130, -0.3, 0.02, -0.9, -0.5, { cast: false });
  for (let x = -120; x < 130; x += 0.5) B.box(M.black, x, x + 0.46, 0.02, 0.035, -0.88, -0.52, { cast: false });
  B.box(M.sidewalk, -120, 130, 0, 0.06, -11.4, -9.65, { cast: false });
  // driveway apron over the drain
  B.box(M.concrete, 1.2, 5.6, 0.0, 0.07, -2.45, 0, { cast: false });

  // plot floors
  B.box(M.pavers, 0, W, -0.02, 0.02, 0, FRONT - 0.1, { cast: false });
  B.box(M.concrete, 0, W, -0.02, 0.02, BACK + 0.1, L, { cast: false });
  // raised house slab + entrance step
  B.box(M.concrete, 0, W, 0, FL - 0.005, FRONT - 0.1, BACK + 0.1, { cast: false });
  B.box(M.marble, 0.15, 1.45, 0, FL - 0.06, FRONT - 0.5, FRONT - 0.1, { cast: false });

  // interior floors
  const floor = (mat, x0, x1, d0, d1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, d1 - d0).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, FL, -(d0 + d1) / 2);
    B.add(mat, worldUV(g), false, true);
  };
  floor(M.marble, 0, MID, FRONT, 15.6); // living + dining
  floor(M.marble, MID, W, 13.4, 16.3); // kitchen
  floor(M.marble, 4.7, W, 16.3, BACK);
  floor(M.wood, MID, W, FRONT, 9.0); // bed 1
  floor(M.bathFloor, MID, W, 9.0, 10.5); // B1
  floor(M.wood, MID, W, 10.5, 13.4); // bed 3
  floor(M.wood, 0, MID, 15.6, BACK); // bed 2
  floor(M.bathFloor, MID, 4.7, 16.3, BACK); // B2

  // ceilings (face down, so they vanish when viewed from above in dollhouse mode)
  const ceiling = (x0, x1, d0, d1, y = CH) => {
    const g = new THREE.PlaneGeometry(x1 - x0, d1 - d0).rotateX(Math.PI / 2);
    g.translate((x0 + x1) / 2, y, -(d0 + d1) / 2);
    B.add(M.ceiling, worldUV(g), false, true);
  };
  ceiling(0, W, FRONT, BACK);
  // living-room plaster bulkhead with a hidden LED cove
  const bh = CH - 0.28;
  const bulk = (x0, x1, d0, d1) => {
    B.box(M.ceiling, x0, x1, bh, CH, d0, d1, { cast: false });
  };
  bulk(0.1, 0.55, FRONT + 0.1, 10.4);
  bulk(2.45, 2.94, FRONT + 0.1, 10.4);
  bulk(0.55, 2.45, FRONT + 0.1, FRONT + 0.5);
  bulk(0.55, 2.45, 10.0, 10.4);
  for (const [x0, x1, d0, d1] of [[0.55, 0.57, FRONT + 0.5, 10.0], [2.43, 2.45, FRONT + 0.5, 10.0], [0.55, 2.45, FRONT + 0.5, FRONT + 0.52], [0.55, 2.45, 9.98, 10.0]]) {
    B.box(M.ledStrip, x0, x1, bh + 0.02, bh + 0.05, d0, d1, { cast: false });
  }
  // porch ceiling
  const pc = new THREE.PlaneGeometry(W, FRONT - 0.9).rotateX(Math.PI / 2);
  pc.translate(W / 2, CH, -(0.9 + FRONT) / 2);
  B.add(M.ceiling, worldUV(pc), false, true);

  // ================= walls =================
  const TX = 0.2, TI = 0.12;
  const DOOR_H = FL + 2.1;
  // party walls (full length of the house) + porch/yard sections
  for (const x of [0, W]) {
    wall('d', x, 0.9, FRONT - 0.1, TX, [], { mat: M.exterior });
    wall('d', x, FRONT - 0.1, BACK + 0.1, TX, [], { skirt: true });
    wall('d', x, BACK + 0.1, L, TX, [], { mat: M.boundary, y1: 2.2 });
  }
  // front facade: main door 0.25–1.25, living window 1.6–2.8, bed1 window 3.6–6.1
  wall('x', FRONT, 0.1, W - 0.1, TX, [
    { a: 0.25, b: 1.3, y0: 0, y1: FL + 2.35 },
    { a: 1.6, b: 2.8, y0: FL + 0.45, y1: FL + 2.35 },
    { a: 3.6, b: 6.1, y0: FL + 0.9, y1: FL + 2.35 },
  ], { skirt: true, mat: M.exterior });
  // back wall: bed2 window 0.6–2.2, B2 louvre 3.5–4.2, back door 5.1–5.95
  wall('x', BACK, 0.1, W - 0.1, TX, [
    { a: 0.6, b: 2.2, y0: FL + 0.9, y1: FL + 2.1 },
    { a: 3.5, b: 4.2, y0: FL + 1.6, y1: FL + 2.1 },
    { a: 5.1, b: 5.95, y0: 0, y1: DOOR_H },
  ], { skirt: true, mat: M.exterior });
  // spine wall x = MID with bed1 door, bed3 door and the open kitchen
  wall('d', MID, FRONT + 0.1, 13.4, TI, [
    { a: 8.05, b: 8.9, y0: 0, y1: DOOR_H },
    { a: 11.2, b: 12.05, y0: 0, y1: DOOR_H },
  ], { skirt: true });
  // kitchen opening header (bulkhead over the open side)
  B.box(M.wall, MID - TI / 2, MID + TI / 2, CH - 0.35, CH, 13.4, 15.6, { cast: false });
  wall('d', MID, 15.6, BACK - 0.1, TI, [], { skirt: true, mat: M.wall });
  // bed1 | B1 at d = 9.0 with B1 door 4.5–5.25
  wall('x', 9.0, MID, W - 0.1, TI, [{ a: 4.5, b: 5.25, y0: 0, y1: DOOR_H }], { skirt: true });
  wall('x', 10.5, MID, W - 0.1, TI, [], { skirt: true });
  wall('x', 13.4, MID, W - 0.1, TI, [], { skirt: true });
  // dining | bed2 at d = 15.6 with door 2.05–2.9
  wall('x', 15.6, 0.1, MID, TI, [{ a: 2.05, b: 2.9, y0: 0, y1: DOOR_H }], { skirt: true });
  // B2 box
  wall('x', 16.3, MID, 4.7 + TI / 2, TI, [{ a: 3.2, b: 3.9, y0: 0, y1: DOOR_H }], { skirt: true });
  wall('d', 4.7, 16.3, BACK - 0.1, TI, [], { skirt: true });

  // accent walls (thin painted panels)
  B.box(M.accentSage, W - 0.1 - 0.01, W - 0.1, FL + 0.09, CH, FRONT + 0.1, 9.0 - 0.06, { cast: false }); // bed1 headboard wall
  B.box(M.accentBlue, 0.1, 0.11, FL + 0.09, CH, 15.6 + 0.06, BACK - 0.1, { cast: false }); // bed2 headboard wall
  B.box(M.accentClay, MID + 0.06, W - 0.1, FL + 0.09, CH, 13.4 - 0.07, 13.4 - 0.06, { cast: false }); // bed3 desk wall

  // bathroom tiling (inner faces up to 2.4 m)
  const tile = (mat, x0, x1, d0, d1, top = FL + 2.4) => B.box(mat, x0, x1, FL, top, d0, d1, { cast: false });
  // B1 interior faces: x MID+0.06 .. W-0.1, d 9.06 .. 10.44
  tile(M.bathWall, MID + 0.06, 4.43, 9.06, 9.075);
  tile(M.bathWall, 5.32, W - 0.1, 9.06, 9.075);
  tile(M.bathAccent, MID + 0.06, W - 0.1, 10.425, 10.44);
  tile(M.bathWall, MID + 0.06, MID + 0.075, 9.06, 10.44);
  tile(M.bathAccent, W - 0.115, W - 0.1, 9.06, 10.44);
  // B2 interior faces: x MID+0.06 .. 4.64, d 16.36 .. BACK-0.1
  tile(M.bathWall, MID + 0.06, 3.13, 16.36, 16.375);
  tile(M.bathWall, 3.97, 4.64, 16.36, 16.375);
  tile(M.bathAccent, MID + 0.06, 4.64, BACK - 0.115, BACK - 0.1, FL + 1.55);
  tile(M.bathWall, MID + 0.06, MID + 0.075, 16.36, BACK - 0.1);
  tile(M.bathWall, 4.625, 4.64, 16.36, BACK - 0.1);

  // architraves & doors
  architrave('x', FRONT, 0.25, 1.3, FL + 2.35, TX);
  architrave('d', MID, 8.05, 8.9, DOOR_H, TI);
  architrave('d', MID, 11.2, 12.05, DOOR_H, TI);
  architrave('x', 9.0, 4.5, 5.25, DOOR_H, TI);
  architrave('x', 15.6, 2.05, 2.9, DOOR_H, TI);
  architrave('x', 16.3, 3.2, 3.9, DOOR_H, TI);
  architrave('x', BACK, 5.1, 5.95, DOOR_H, TX);

  door('Main door', 'x', FRONT, 0.25, 1.3, +1, { flip: true, top: FL + 2.35, mat: M.doorWood, thick: 0.055, grooves: true, glassSlit: true, pull: true, range: 2.0 });
  door('Bedroom 1', 'd', MID, 8.05, 8.9, +1, {});
  door('Bedroom 3', 'd', MID, 11.2, 12.05, +1, {});
  door('Bathroom 1', 'x', 9.0, 4.5, 5.25, +1, {});
  door('Bedroom 2', 'x', 15.6, 2.05, 2.9, +1, { flip: true });
  door('Bathroom 2', 'x', 16.3, 3.2, 3.9, +1, {});
  door('Back door', 'x', BACK, 5.1, 5.95, -1, { mat: M.alu });

  // windows
  const winLiving = windowAt('x', FRONT, 1.6, 2.8, FL + 0.45, FL + 2.35, TX, { side: 1, panes: 2, transom: true });
  windowAt('x', FRONT, 3.6, 6.1, FL + 0.9, FL + 2.35, TX, { side: 1, panes: 3, transom: true });
  windowAt('x', BACK, 0.6, 2.2, FL + 0.9, FL + 2.1, TX, { side: -1, panes: 2 });
  windowAt('x', BACK, 3.5, 4.2, FL + 1.6, FL + 2.1, TX, { side: -1, panes: 1, glass: M.glassFrost });
  // back door has a glazed upper half: add frosted panel inside the leaf
  {
    const bd = doors[doors.length - 1];
    const gp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.05), M.glassFrost);
    gp.position.set(0.42, 1.45, 0);
    bd.pivot.children[0].add(gp);
  }

  // kitchen skylight
  {
    B.box(M.alu, 4.9, 6.2, CH - 0.02, CH + 0.05, 17.0, 17.06, { cast: false });
    B.box(M.alu, 4.9, 6.2, CH - 0.02, CH + 0.05, 17.94, 18.0, { cast: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.94).rotateX(Math.PI / 2), M.glassFrost);
    place(sky, 5.55, CH + 0.03, 17.5);
    root.add(sky);
  }

  // ================= front: facade, porch, fence =================
  // facade detailing: stone-clad pier by the door, dark band over openings
  B.box(M.stone, 1.3, 1.6, FL, CH, FRONT - 0.13, FRONT - 0.1);
  B.box(M.exteriorDark, 0.1, W - 0.1, FL + 2.35, FL + 2.6, FRONT - 0.12, FRONT - 0.1);
  B.box(M.stone, 2.8, 3.6, FL, CH, FRONT - 0.13, FRONT - 0.1);
  // facade above porch roof up to the eaves
  wall('x', FRONT, 0.1, W - 0.1, TX, [], { mat: M.exterior, y0: CH, y1: CH + 0.4 });
  // porch roof slab & fascia
  for (const [mat, g] of [[M.concrete, boxGeo(0, W, CH, CH + 0.22, 0.9, FRONT - 0.1)], [M.fascia, boxGeo(-0.02, W + 0.02, CH - 0.05, CH + 0.3, 0.8, 0.92)]]) {
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    roofGroup.add(m);
  }
  // party-wall piers at the front of the porch
  B.box(M.exteriorDark, -0.12, 0.12, 0, CH, 0.8, 1.2, { collide: true });
  B.box(M.exteriorDark, W - 0.12, W + 0.12, 0, CH, 0.8, 1.2, { collide: true });
  // front fence: low walls + pillars either side of the gate opening (1.2 – 5.6)
  for (const [x0, x1] of [[0.0, 0.95], [5.9, W]]) {
    B.box(M.boundary, x0, x1, 0, 0.9, -0.1, 0.1, { collide: true });
    B.box(M.exteriorDark, x0, x1, 0.9, 0.95, -0.12, 0.12);
    for (let x = x0 + 0.08; x < x1 - 0.02; x += 0.12) B.box(M.black, x, x + 0.02, 0.95, 1.6, -0.01, 0.01);
    B.box(M.black, x0, x1, 1.58, 1.62, -0.02, 0.02);
  }
  for (const x of [0.95, 5.65]) B.box(M.boundary, x, x + 0.25, 0, 1.75, -0.14, 0.14, { collide: true });
  // planter boxes behind the fence
  for (const [x0, x1] of [[0.12, 0.98], [5.9, 6.58]]) {
    B.box(M.exteriorDark, x0, x1, 0, 0.45, 0.14, 0.5);
    B.box(M.soil, x0 + 0.04, x1 - 0.04, 0.4, 0.44, 0.18, 0.46, { cast: false });
  }
  // pillar lamps
  const pillarLamps = [];
  for (const x of [1.075, 5.775]) {
    const lamp = mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), M.globe, x, 1.86, 0);
    pillarLamps.push(lamp);
    mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), M.black, x, 1.975, 0);
  }

  // swing gates (open outward toward the street)
  function gateLeaf(name, hingeX, len, into, flip) {
    const pivot = new THREE.Group();
    const leaf = new THREE.Group();
    pivot.add(leaf);
    const H = 1.55;
    const add = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), M.black);
      m.position.set(x, y, 0);
      m.castShadow = true;
      leaf.add(m);
    };
    add(len, 0.06, len / 2, 0.12);
    add(len, 0.06, len / 2, H);
    add(len, 0.04, len / 2, 0.75);
    add(0.06, H, 0.03, H / 2 + 0.05);
    add(0.06, H, len - 0.03, H / 2 + 0.05);
    for (let x = 0.12; x < len - 0.06; x += 0.11) add(0.018, H - 0.1, x, H / 2 + 0.07);
    // perforated timber-look panel at top
    const top = new THREE.Mesh(worldUV(new THREE.BoxGeometry(len - 0.12, 0.35, 0.02)), M.walnut);
    top.position.set(len / 2, H - 0.22, 0);
    leaf.add(top);
    place(pivot, hingeX, 0.04, 0);
    let theta = (Math.PI / 2) * into;
    if (flip) { leaf.rotation.y = Math.PI; theta = -theta; }
    root.add(pivot);
    const dr = { name, pivot, open: 0, target: 0, maxAngle: theta * 0.85, x: 3.4, d: 0, range: 7, sound: 'gate', isOpen: false, gate: true };
    doors.push(dr);
  }
  gateLeaf('Gate L', 1.22, 2.2, -1, false);
  gateLeaf('Gate R', 5.63, 2.2, -1, true);

  // wall sconces by the main door
  for (const x of [0.12, 1.45]) {
    mesh(new THREE.BoxGeometry(0.1, 0.3, 0.08), M.black, x + 0.05, FL + 2.0, FRONT - 0.15);
    mesh(new THREE.BoxGeometry(0.06, 0.2, 0.02), M.bulb, x + 0.05, FL + 2.0, FRONT - 0.195, 0, root, false);
  }
  // doormat, shoe bench
  B.box(M.rugPlain, 0.3, 1.25, 0.02, 0.035, FRONT - 1.0, FRONT - 0.55, { cast: false });
  B.box(M.walnut, 0.14, 0.5, 0.35, 0.4, 3.2, 4.6, { collide: true });
  B.box(M.black, 0.16, 0.48, 0, 0.35, 3.25, 3.3);
  B.box(M.black, 0.16, 0.48, 0, 0.35, 4.5, 4.55);
  // porch downlights
  for (const [x, d] of [[1.7, 2.2], [4.3, 2.2], [1.7, 4.4], [4.3, 4.4]]) downlight(x, d, CH);

  // ================= back: yard =================
  wall('x', L - 0.1, 0.1, W - 0.1, TX, [{ a: 5.75, b: 6.5, y0: 0, y1: 2.0 }], { mat: M.boundary, y1: 2.2 });
  B.box(M.exteriorDark, 0, W, 2.2, 2.25, L - 0.22, L + 0.02);
  door('Back gate', 'x', L - 0.1, 5.75, 6.5, -1, { base: 0.02, top: 2.0, mat: M.alu, handle: M.black, range: 1.4 });
  // drain along the back wall
  B.box(M.black, 0.1, W - 0.1, 0.02, 0.03, BACK + 0.12, BACK + 0.3, { cast: false });
  // washing machine
  {
    const wm = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.85, 0.6, 3, 0.03), M.paintWhite);
    body.position.y = 0.425;
    body.castShadow = true;
    wm.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 12, 32), M.brushed);
    ring.position.set(0, 0.42, 0.3);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), M.carGlass);
    glass.position.set(0, 0.42, 0.305);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.01), M.black);
    panel.position.set(0, 0.78, 0.3);
    wm.add(ring, glass, panel);
    place(wm, 0.55, 0.02, 20.9, Math.PI);
    root.add(wm);
    B.collide(0.2, 0.9, 20.55, 21.25);
  }
  // clothes rack with laundry
  {
    const rack = new THREE.Group();
    for (const x of [-0.9, 0.9]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), M.brushed);
      post.position.set(x, 0.75, 0);
      rack.add(post);
    }
    const colors = [0xd9d4ca, 0x6f8fa8, 0xc98f6b, 0xf2efe8, 0x4d5b4f];
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.8, 8).rotateZ(Math.PI / 2), M.brushed);
      bar.position.set(0, 1.5, (i - 1) * 0.18);
      rack.add(bar);
      for (let k = 0; k < 4; k++) {
        if (T.rand() < 0.3) continue;
        const cloth = new THREE.PlaneGeometry(0.34, 0.5 + T.rand() * 0.2, 4, 6);
        const p = cloth.attributes.position;
        for (let j = 0; j < p.count; j++) p.setZ(j, Math.sin(p.getX(j) * 9) * 0.02);
        cloth.computeVertexNormals();
        const cm = new THREE.Mesh(cloth, std({ color: colors[(i * 4 + k) % colors.length], roughness: 1, side: THREE.DoubleSide }));
        cm.position.set(-0.6 + k * 0.4, 1.5 - 0.3, (i - 1) * 0.18);
        cm.castShadow = true;
        rack.add(cm);
      }
    }
    place(rack, 3.0, 0.02, 20.35);
    root.add(rack);
    B.collide(2.0, 4.0, 20.1, 20.6);
  }
  // wall tap
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8).rotateX(Math.PI / 2), M.brass, 1.6, 0.6, BACK + 0.16);

  // ================= roof =================
  function roofRow(group, x0, x1) {
    const eave = CH + 0.4, ridge = CH + 2.3;
    const dF = FRONT - 0.6, dB = BACK + 0.6, dR = (FRONT + BACK) / 2;
    const slope = (da, db, ya, yb) => {
      const len = Math.hypot(db - da, yb - ya);
      const g = worldUV(new THREE.BoxGeometry(x1 - x0, 0.06, len + 0.02));
      g.translate((x0 + x1) / 2, 0, 0);
      g.rotateX(Math.atan2(yb - ya, db - da));
      g.translate(0, (ya + yb) / 2, -(da + db) / 2);
      const m = new THREE.Mesh(g, M.roof);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    };
    slope(dF, dR, eave, ridge);
    slope(dB, dR, eave, ridge);
    const ridgeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, x1 - x0, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), M.roof);
    place(ridgeCap, (x0 + x1) / 2, ridge + 0.02, dR);
    group.add(ridgeCap);
    // fascia boards
    const fb = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.22, 0.03), M.fascia);
    place(fb, (x0 + x1) / 2, eave - 0.08, dF - 0.02);
    const fb2 = fb.clone();
    place(fb2, (x0 + x1) / 2, eave - 0.08, dB + 0.02);
    group.add(fb, fb2);
    // gable infill between ceiling and roof (hidden inside the row)
  }
  roofRow(roofGroup, 0, W);
  // gutters
  // ================= interior fittings =================
  function downlight(x, d, y = CH) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20), M.paintWhite);
    place(rim, x, y - 0.006, d);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20).rotateX(Math.PI / 2), M.downlight);
    place(lens, x, y - 0.013, d);
    root.add(rim, lens);
  }
  const roomLight = (x, d, color, day, golden, night, dist = 7, y = CH - 0.35) => {
    const l = new THREE.PointLight(color, 0, dist, 2);
    place(l, x, y, d);
    interiorLights.add(l);
    lights.push({ light: l, day, golden, night });
    return l;
  };
  // downlights per room
  for (const [x, d] of [[1.5, 6.8], [1.5, 8.2], [1.5, 9.6], [1.5, 13.8], [1.5, 15.0], [4.0, 14.2], [5.6, 14.2], [5.6, 16.6], [4.2, 7.3], [5.9, 7.3], [4.3, 11.9], [5.9, 11.9], [1.5, 17.4], [4.0, 9.75], [5.8, 9.75], [3.85, 17.8], [5.5, 18.6]]) downlight(x, d);
  roomLight(1.5, 7.4, 0xffd6aa, 2, 5, 10);
  roomLight(1.5, 12.2, 0xffcf99, 1.5, 5, 10, 6, CH - 0.9);
  roomLight(4.9, 15.4, 0xfff0dc, 2.5, 5, 11);
  roomLight(4.85, 7.4, 0xffd6aa, 1.2, 3, 7);
  roomLight(4.85, 12.0, 0xffd6aa, 1.2, 3, 7);
  roomLight(1.5, 17.5, 0xffd6aa, 1.2, 3, 7);
  roomLight(4.85, 9.75, 0xfff4e6, 1.5, 3, 6, 4);
  roomLight(3.85, 17.8, 0xfff4e6, 1.2, 3, 6, 4);
  const porchLight = roomLight(3.35, 3.2, 0xffd9a8, 0, 2, 9, 9, CH - 0.2);
  roomLight(3.35, 20.3, 0xffe2b8, 0, 1, 4, 6, 2.6);

  // ceiling fans
  function fan(x, d) {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8), M.brushed);
    rod.position.y = -0.175;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.12, 20), M.brushed);
    hub.position.y = -0.4;
    const rot = new THREE.Group();
    rot.position.y = -0.42;
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.012, 0.13, 2, 0.005), M.walnut);
      blade.position.x = 0.42;
      blade.rotation.x = 0.12;
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI * 2) / 3;
      arm.add(blade);
      rot.add(arm);
    }
    const lightBowl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.globe);
    lightBowl.position.y = -0.47;
    g.add(rod, hub, rot, lightBowl);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    place(g, x, CH, d);
    root.add(g);
    fans.push({ rot, speed: 2.4 + T.rand() });
  }
  fan(1.5, 8.2);
  fan(4.85, 7.3);
  fan(4.85, 12.0);
  fan(1.5, 17.6);

  // curtains
  function curtain(axis, at, a, b, y0, y1, side, open = 0.35) {
    const make = (x0, x1) => {
      const w = x1 - x0;
      const g = new THREE.PlaneGeometry(w, y1 - y0, Math.max(8, Math.floor(w * 40)), 4);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 28) * 0.035);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, M.curtain);
      m.castShadow = true;
      if (axis === 'x') place(m, (x0 + x1) / 2, (y0 + y1) / 2, at + side * 0.16);
      else place(m, at + side * 0.16, (y0 + y1) / 2, (x0 + x1) / 2, Math.PI / 2);
      root.add(m);
    };
    const span = b - a;
    make(a - 0.15, a + span * open * 0.5);
    make(b - span * open * 0.5, b + 0.15);
    // track
    if (axis === 'x') B.box(M.alu, a - 0.2, b + 0.2, y1, y1 + 0.03, at + side * 0.14, at + side * 0.19);
  }
  curtain('x', FRONT, 1.6, 2.8, FL + 0.05, CH - 0.3, 1, 0.5);
  curtain('x', FRONT, 3.6, 6.1, FL + 0.1, CH - 0.1, 1, 0.45);
  curtain('x', BACK, 0.6, 2.2, FL + 0.3, CH - 0.1, -1, 0.5);

  // artwork frames
  function art(axis, at, c, y, w, h, matIdx, side) {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.03), M.black);
    const cv = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.art[matIdx]);
    const g = new THREE.Group();
    fr.castShadow = true;
    cv.position.z = 0.017;
    g.add(fr, cv);
    // side: which direction the art faces (+1 = +d / +x)
    if (axis === 'x') place(g, c, y, at + side * 0.02, side > 0 ? Math.PI : 0);
    else place(g, at + side * 0.02, y, c, side > 0 ? Math.PI / 2 : -Math.PI / 2);
    root.add(g);
  }
  art('d', 0.1, 12.2, FL + 1.65, 0.9, 1.1, 0, 1); // dining
  art('d', MID - 0.06, 6.9, FL + 1.55, 0.8, 0.55, 1, -1); // over sofa
  art('d', MID - 0.06, 9.7, FL + 1.55, 0.45, 0.6, 2, -1);
  art('x', 9.0 - 0.06, 3.9, FL + 1.6, 0.5, 0.65, 3, -1); // bed1
  art('d', MID - 0.06, 17.6, FL + 1.55, 0.5, 0.7, 4, -1); // bed2, opposite the bed
  art('x', 13.4 - 0.07, 5.9, FL + 1.7, 0.6, 0.45, 2, -1); // bed3

  // ------------- LIVING -------------
  // rug
  mesh(new THREE.BoxGeometry(1.9, 0.012, 2.4), M.rug, 1.4, FL + 0.006, 7.1, 0, root, false);
  // sofa against the spine wall, facing -x (towards the TV on the party wall)
  function sofa(x, d, len) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.3, len, 3, 0.04), M.sofa);
    base.position.set(0, 0.28, 0);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.5, len - 0.1, 3, 0.06), M.sofa);
    back.position.set(0.35, 0.62, 0);
    const armL = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.55, 0.18, 3, 0.06), M.sofa);
    armL.position.set(0, 0.45, len / 2 - 0.09);
    const armR = armL.clone();
    armR.position.z = -len / 2 + 0.09;
    g.add(base, back, armL, armR);
    const seats = 3;
    const sw = (len - 0.36) / seats;
    for (let i = 0; i < seats; i++) {
      const c = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.16, sw - 0.02, 3, 0.06), M.sofa);
      c.position.set(-0.08, 0.5, -len / 2 + 0.18 + sw / 2 + i * sw);
      const bc = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.42, sw - 0.03, 3, 0.08), M.sofa);
      bc.position.set(0.18, 0.76, c.position.z);
      bc.rotation.z = -0.12;
      g.add(c, bc);
    }
    for (const [cz, m] of [[-len / 2 + 0.45, M.sofaCushion], [len / 2 - 0.45, M.cushionBlue], [len / 2 - 0.75, M.sofaCushion]]) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.4, 0.4, 3, 0.07), m);
      p.position.set(0.1, 0.8, cz);
      p.rotation.set(0.1, 0.2, -0.25);
      g.add(p);
    }
    for (const [lx, lz] of [[-0.38, len / 2 - 0.06], [0.38, len / 2 - 0.06], [-0.38, -len / 2 + 0.06], [0.38, -len / 2 + 0.06]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.13, 8), M.brass);
      leg.position.set(lx, 0.065, lz);
      g.add(leg);
    }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    place(g, x, FL, d);
    root.add(g);
    B.collide(x - 0.46, x + 0.46, d - len / 2, d + len / 2);
  }
  sofa(2.44, 7.03, 1.95);
  // coffee table (walnut, round)
  {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 40), M.walnut);
    top.position.y = 0.4;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 40), M.walnut);
    lower.position.y = 0.12;
    g.add(top, lower);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8), M.black);
      leg.position.set(Math.cos(a) * 0.26, 0.2, Math.sin(a) * 0.26);
      g.add(leg);
    }
    const books = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.2), std({ color: 0x3c4d5c, roughness: 0.7 }));
    books.position.set(0.1, 0.445, 0.05);
    books.rotation.y = 0.3;
    const vase = new THREE.Mesh(new THREE.LatheGeometry([0.001, 0.05, 0.07, 0.06, 0.03, 0.035].map((r, i) => new THREE.Vector2(r, i * 0.04)), 24), M.ceramic);
    vase.position.set(-0.15, 0.42, -0.1);
    g.add(books, vase);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    place(g, 1.45, FL, 7.2);
    root.add(g);
    B.collide(1.1, 1.8, 6.85, 7.55);
  }
  // TV wall: timber slat feature panel on the left party wall
  for (let i = 0; i < 28; i++) {
    const d = 5.85 + i * 0.085;
    B.box(M.walnut, 0.1, 0.14, FL, CH - 0.28, d, d + 0.045);
  }
  B.box(M.accentCharcoal, 0.1, 0.105, FL, CH - 0.28, 5.8, 8.3, { cast: false });
  // floating TV console
  B.box(M.oak, 0.14, 0.54, FL + 0.25, FL + 0.55, 5.95, 8.15, { collide: true });
  B.box(M.black, 0.53, 0.545, FL + 0.28, FL + 0.52, 6.5, 6.52, { cast: false });
  B.box(M.black, 0.53, 0.545, FL + 0.28, FL + 0.52, 7.6, 7.62, { cast: false });
  // TV with animated screen
  const tvCanvas = document.createElement('canvas');
  tvCanvas.width = 256; tvCanvas.height = 144;
  const tvTex = new THREE.CanvasTexture(tvCanvas);
  tvTex.colorSpace = THREE.SRGBColorSpace;
  const tvMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tvTex, emissiveIntensity: 1.1, roughness: 0.15 });
  B.box(M.black, 0.15, 0.2, FL + 1.05, FL + 1.85, 5.95 + 0.05, 8.15 - 0.05);
  const tv = mesh(new THREE.PlaneGeometry(1.36, 0.76), tvMat, 0.206, FL + 1.45, 7.05, Math.PI / 2, root, false);
  const tvCtx = tvCanvas.getContext('2d');
  let tvT = 0;
  anim.push((dt, t) => {
    tvT += dt;
    if (tvT < 1 / 15) return;
    tvT = 0;
    const g = tvCtx;
    const grd = g.createLinearGradient(0, 0, 256, 144);
    const h = (t * 8) % 360;
    grd.addColorStop(0, `hsl(${h},55%,22%)`);
    grd.addColorStop(1, `hsl(${(h + 60) % 360},60%,12%)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 144);
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = `rgba(201,163,107,${0.25 + i * 0.1})`;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const y = 72 + Math.sin(x / 30 + t * 0.8 + i) * (20 + i * 6) * Math.sin(t * 0.3 + i);
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = '11px sans-serif';
    g.fillText('TYPE 2A  ·  22 × 70', 12, 132);
    tvTex.needsUpdate = true;
  });
  // arc floor lamp by the sofa
  {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 30), M.stone);
    base.position.y = 0.02;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(-0.9, 1.9, 0));
    const arc = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.012, 8), M.brass);
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.brass);
    shade.position.set(-0.9, 1.82, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8), M.bulb);
    bulb.position.set(-0.9, 1.78, 0);
    g.add(base, arc, shade, bulb);
    g.traverse((m) => { if (m.isMesh) m.castShadow = m !== bulb; });
    place(g, 2.62, FL, 5.88, -Math.PI / 2);
    root.add(g);
    roomLight(2.62, 6.78, 0xffc98a, 0, 1, 2, 4, FL + 1.6);
    B.collide(2.46, 2.78, 5.7, 6.04);
  }
  // shoe cabinet + mirror near entrance on the spine side
  B.box(M.oak, 2.55, 2.94, FL, FL + 0.9, 9.0, 10.3, { collide: true });
  B.box(M.brass, 2.54, 2.55, FL + 0.4, FL + 0.7, 9.6, 9.62);
  plant(2.75, 10.1, 0.6, 'small', FL + 0.9);
  plant(0.4, 9.1, 1.1, 'monstera', FL);
  plant(2.7, 10.55, 0.9, 'fiddle', FL);

  // ------------- DINING -------------
  {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.045, 1.8, 3, 0.015), M.oak);
    top.position.y = 0.75;
    g.add(top);
    for (const [lx, lz] of [[-0.35, -0.75], [0.35, -0.75], [-0.35, 0.75], [0.35, 0.75]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.73, 0.05), M.oak);
      leg.position.set(lx, 0.365, lz);
      g.add(leg);
    }
    // chairs
    const chair = () => {
      const c = new THREE.Group();
      const seat = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.05, 0.45, 2, 0.02), M.sofaCushion);
      seat.position.y = 0.46;
      const back = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.3, 0.04, 2, 0.015), M.oak);
      back.position.set(0, 0.72, 0.21);
      back.rotation.x = -0.1;
      c.add(seat, back);
      for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.45, 8), M.black);
        leg.position.set(lx, 0.225, lz);
        c.add(leg);
      }
      return c;
    };
    const seatsAt = [[-0.62, -0.5, -Math.PI / 2], [-0.62, 0.05, -Math.PI / 2], [-0.62, 0.6, -Math.PI / 2], [0.62, -0.5, Math.PI / 2], [0.62, 0.05, Math.PI / 2], [0.62, 0.6, Math.PI / 2]];
    for (const [cx, cz, r] of seatsAt) {
      const c = chair();
      c.position.set(cx, 0, cz);
      c.rotation.y = r + (T.rand() - 0.5) * 0.12;
      g.add(c);
    }
    // table setting: runner + bowl
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.004, 1.5), M.rugPlain);
    runner.position.y = 0.775;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.ceramic);
    bowl.position.y = 0.94;
    bowl.rotation.x = Math.PI;
    g.add(runner, bowl);
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), std({ color: [0xe0a030, 0xc0392b, 0x8fbf4a][i % 3], roughness: 0.4 }));
      f.position.set((T.rand() - 0.5) * 0.14, 0.84, (T.rand() - 0.5) * 0.14);
      g.add(f);
    }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    place(g, 1.45, FL, 12.2);
    root.add(g);
    B.collide(0.75, 2.15, 11.3, 13.1);
    // pendant cluster
    for (const [px, pd, len] of [[1.45, 11.6, 0.9], [1.45, 12.2, 1.05], [1.45, 12.8, 0.9]]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 6), M.black);
      place(cord, px, CH - len / 2, pd);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 16), M.globe);
      place(globe, px, CH - len - 0.12, pd);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.06, 16), M.brass);
      place(cap, px, CH - len - 0.01, pd);
      root.add(cord, globe, cap);
    }
    // sideboard on the party wall
    B.box(M.walnut, 0.1, 0.52, FL + 0.12, FL + 0.8, 13.7, 15.0, { collide: true });
    for (let i = 0; i < 3; i++) B.box(M.walnut, 0.52, 0.53, FL + 0.18, FL + 0.74, 13.74 + i * 0.425, 14.13 + i * 0.425);
    B.box(M.black, 0.12, 0.5, FL, FL + 0.12, 13.75, 13.8, { cast: false });
    B.box(M.black, 0.12, 0.5, FL, FL + 0.12, 14.9, 14.95, { cast: false });
    const vase = mesh(new THREE.LatheGeometry([0.001, 0.06, 0.1, 0.09, 0.05, 0.04, 0.05].map((r, i) => new THREE.Vector2(r, i * 0.06)), 28), M.terracotta, 0.3, FL + 0.8, 14.3);
    vase.scale.setScalar(1.1);
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.6, 4), M.bark);
      stem.position.set(0.3 + (T.rand() - 0.5) * 0.08, FL + 1.3, -14.3 + (T.rand() - 0.5) * 0.08);
      stem.rotation.set((T.rand() - 0.5) * 0.4, 0, (T.rand() - 0.5) * 0.4);
      root.add(stem);
    }
  }
  plant(0.4, 15.3, 1.1, 'palm', FL);

  // ------------- KITCHEN -------------
  {
    const kx0 = W - 0.1 - 0.6, kx1 = W - 0.1; // base run along the right party wall
    const d0 = 13.55, d1 = 18.45;
    B.box(M.black, kx0 + 0.06, kx1, FL, FL + 0.1, d0, d1, { cast: false }); // plinth
    B.box(M.lacquerSage, kx0, kx1, FL + 0.1, FL + 0.87, d0, d1, { collide: true });
    // door gaps and handles
    for (let dd = d0 + 0.6; dd < d1 - 0.05; dd += 0.6) B.box(M.black, kx0 - 0.002, kx0 + 0.01, FL + 0.1, FL + 0.87, dd - 0.004, dd + 0.004, { cast: false });
    for (let dd = d0 + 0.3; dd < d1; dd += 0.6) B.box(M.brass, kx0 - 0.025, kx0 - 0.005, FL + 0.75, FL + 0.77, dd - 0.12, dd + 0.12);
    B.box(M.quartz, kx0 - 0.03, kx1, FL + 0.87, FL + 0.9, d0 - 0.03, d1);
    B.box(M.subway, kx1 - 0.012, kx1, FL + 0.9, FL + 1.5, d0, d1, { cast: false });
    // wall cabinets
    B.box(M.lacquerCream, kx1 - 0.35, kx1, FL + 1.5, FL + 2.3, d0, 15.0);
    B.box(M.lacquerCream, kx1 - 0.35, kx1, FL + 1.5, FL + 2.3, 15.9, d1);
    for (let dd = d0 + 0.5; dd < 15.0; dd += 0.5) B.box(M.black, kx1 - 0.352, kx1 - 0.34, FL + 1.5, FL + 2.3, dd - 0.003, dd + 0.003, { cast: false });
    for (let dd = 16.4; dd < d1; dd += 0.5) B.box(M.black, kx1 - 0.352, kx1 - 0.34, FL + 1.5, FL + 2.3, dd - 0.003, dd + 0.003, { cast: false });
    B.box(M.ledStrip, kx1 - 0.34, kx1 - 0.32, FL + 1.49, FL + 1.5, d0, 15.0, { cast: false });
    B.box(M.ledStrip, kx1 - 0.34, kx1 - 0.32, FL + 1.49, FL + 1.5, 15.9, d1, { cast: false });
    // hob + hood at d 15.0–15.9
    B.box(M.carGlass, kx0 + 0.05, kx1 - 0.05, FL + 0.9, FL + 0.905, 15.1, 15.8, { cast: false });
    for (const [hx, hd, r] of [[kx0 + 0.18, 15.28, 0.09], [kx0 + 0.18, 15.62, 0.09], [kx0 + 0.42, 15.45, 0.11]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.006, r, 32).rotateX(-Math.PI / 2), M.brushed);
      place(ring, hx, FL + 0.907, hd);
      root.add(ring);
    }
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.35, 0.35, 4, 1), M.brushed);
    hood.rotation.y = Math.PI / 4;
    place(hood, kx1 - 0.3, FL + 1.85, 15.45);
    hood.rotation.y = Math.PI / 4;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.25, CH - FL - 2.0, 0.25), M.brushed);
    place(chimney, kx1 - 0.2, (FL + 2.0 + CH) / 2, 15.45);
    root.add(hood, chimney);
    // sink + tap at d ~ 17.0
    B.box(M.black, kx0 + 0.08, kx1 - 0.1, FL + 0.8, FL + 0.905, 16.7, 17.4, { cast: false });
    const spout = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.32, 0), new THREE.Vector3(-0.08, 0.38, 0), new THREE.Vector3(-0.2, 0.3, 0)]);
    const tap = new THREE.Mesh(new THREE.TubeGeometry(spout, 24, 0.012, 10), M.brass);
    place(tap, kx1 - 0.06, FL + 0.9, 17.05);
    root.add(tap);
    // fridge
    const fr = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.68, 1.85, 0.7, 3, 0.02), M.brushed);
    body.position.y = 0.925;
    const split = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.8, 0.02), M.black);
    split.position.set(0, 0.95, 0.35);
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.03), M.black);
    h1.position.set(-0.04, 1.1, 0.37);
    const h2 = h1.clone();
    h2.position.x = 0.04;
    fr.add(body, split, h1, h2);
    fr.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    place(fr, W - 0.45, FL, 18.9, Math.PI / 2);
    root.add(fr);
    B.collide(W - 0.8, W - 0.1, 18.55, 19.25);
    // island with waterfall top
    B.box(M.quartz, 4.15, 5.25, FL, FL + 0.93, 14.2, 14.24);
    B.box(M.quartz, 4.15, 5.25, FL, FL + 0.93, 15.76, 15.8);
    B.box(M.quartz, 4.15, 5.25, FL + 0.9, FL + 0.93, 14.2, 15.8, { collide: true });
    B.box(M.walnut, 4.45, 5.2, FL, FL + 0.9, 14.24, 15.76);
    for (const sd of [14.55, 15.0, 15.45]) {
      const s = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.05, 24), M.sofaCushion);
      seat.position.y = 0.66;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.64, 8), M.black);
      post.position.y = 0.33;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.008, 6, 24).rotateX(Math.PI / 2), M.black);
      ring.position.y = 0.25;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 24), M.black);
      s.add(seat, post, ring, foot);
      s.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      place(s, 3.85, FL, sd);
      root.add(s);
    }
    B.collide(3.65, 4.15, 14.3, 15.7);
    // island pendants
    for (const pd of [14.6, 15.4]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.95, 6), M.black);
      place(cord, 4.7, CH - 0.475, pd);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 32, 1, true), M.brass);
      place(shade, 4.7, CH - 1.02, pd);
      shade.material = M.brass;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.bulb);
      place(bulb, 4.7, CH - 1.1, pd);
      root.add(cord, shade, bulb);
    }
    // countertop props
    const kettle = mesh(new THREE.LatheGeometry([0.001, 0.08, 0.09, 0.085, 0.06, 0.02].map((r, i) => new THREE.Vector2(r, i * 0.04)), 24), M.black, kx0 + 0.3, FL + 0.9, 14.1);
    kettle.castShadow = true;
    const board = mesh(new RoundedBoxGeometry(0.02, 0.4, 0.28, 2, 0.008), M.oak, kx1 - 0.03, FL + 1.1, 16.2);
    board.rotation.z = 0.12;
    plant(kx0 + 0.3, 18.1, 0.35, 'small', FL + 0.9);
    // bowl of lemons on island
    const bowl = mesh(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.ceramic, 4.7, FL + 1.07, 15.0);
    bowl.rotation.x = Math.PI;
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.04, 12, 8), std({ color: 0xe8c547, roughness: 0.5 }), 4.7 + (T.rand() - 0.5) * 0.12, FL + 0.99, 15.0 + (T.rand() - 0.5) * 0.12);
  }

  // ------------- BEDROOMS -------------
  function bed(x, d, w, len, rotY, duvetMat, headMat = M.headboard) {
    // local: headboard at local -z... build with width along x, length along z; head at z = -len/2
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, 0.28, len + 0.06, 3, 0.03), headMat);
    frame.position.y = 0.2;
    const head = new THREE.Mesh(new RoundedBoxGeometry(w + 0.3, 1.1, 0.12, 3, 0.05), headMat);
    head.position.set(0, 0.6, -len / 2 - 0.06);
    for (let i = 0; i < 6; i++) {
      const tuft = new THREE.Mesh(new RoundedBoxGeometry((w + 0.2) / 6 - 0.02, 0.7, 0.05, 3, 0.02), headMat);
      tuft.position.set(-(w + 0.2) / 2 + ((w + 0.2) / 6) * (i + 0.5), 0.75, -len / 2 + 0.01);
      g.add(tuft);
    }
    const mattress = new THREE.Mesh(new RoundedBoxGeometry(w, 0.22, len, 4, 0.06), M.linen);
    mattress.position.y = 0.43;
    // draped duvet: a subdivided box whose lower edges fall over the sides
    const dg = new THREE.BoxGeometry(w + 0.12, 0.06, len * 0.72, 24, 1, 24);
    const p = dg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i);
      const ex = Math.max(0, Math.abs(px) - w / 2 + 0.05);
      const ez = Math.max(0, pz - len * 0.36 + 0.05);
      p.setY(i, p.getY(i) - (ex + ez) * 3.2 + Math.sin(px * 7 + pz * 5) * 0.012);
    }
    dg.computeVertexNormals();
    const duvet = new THREE.Mesh(dg, duvetMat);
    duvet.position.set(0, 0.57, len * 0.14);
    const throwB = new THREE.Mesh(new RoundedBoxGeometry(w + 0.16, 0.03, 0.45, 2, 0.012), M.sofaCushion);
    throwB.position.set(0, 0.61, len * 0.34);
    g.add(frame, head, mattress, duvet, throwB);
    for (const sx of [-1, 1]) {
      const pil = new THREE.Mesh(new RoundedBoxGeometry(w / 2 - 0.1, 0.14, 0.42, 4, 0.06), M.linen);
      pil.position.set(sx * (w / 4), 0.62, -len / 2 + 0.3);
      pil.rotation.x = -0.35;
      const deco = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.34, 0.1, 3, 0.05), sx > 0 ? M.cushionBlue : M.sofaCushion);
      deco.position.set(sx * 0.22, 0.72, -len / 2 + 0.52);
      deco.rotation.x = -0.25;
      g.add(pil, deco);
    }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.rotation.y = rotY;
    place(g, x, FL, d, rotY);
    root.add(g);
  }
  function nightstand(x, d, rotY, lampOn = true) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.45, 0.38, 2, 0.015), M.walnut);
    body.position.y = 0.28;
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.01), M.black);
    drawer.position.set(0, 0.34, 0.19);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.32), M.black);
    legs.position.y = 0.03;
    g.add(body, drawer, legs);
    if (lampOn) {
      const base = new THREE.Mesh(new THREE.LatheGeometry([0.001, 0.07, 0.09, 0.07, 0.02, 0.012].map((r, i) => new THREE.Vector2(r, i * 0.05)), 24), M.ceramic);
      base.position.y = 0.5;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.2, 28, 1, true), M.shade);
      shade.position.y = 0.87;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.bulb);
      bulb.position.y = 0.85;
      g.add(base, shade, bulb);
    }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = m.material !== M.bulb; m.receiveShadow = true; } });
    place(g, x, FL, d, rotY);
    root.add(g);
    if (lampOn) {
      const l = new THREE.PointLight(0xffc27a, 0, 3.5, 2);
      place(l, x, FL + 0.95, d);
      interiorLights.add(l);
      lights.push({ light: l, day: 0, golden: 0.6, night: 1.6 });
    }
  }
  function wardrobe(x0, x1, d0, d1, mat, doorsAlong = 'd', facing = -1) {
    B.box(mat, x0, x1, FL, FL + 2.4, d0, d1, { collide: true });
    B.box(M.paintWhite, x0, x1, FL + 2.4, CH, d0, d1, { cast: false });
    if (doorsAlong === 'd') {
      const fx = facing < 0 ? x0 : x1;
      const n = Math.round((d1 - d0) / 0.5);
      for (let i = 1; i < n; i++) {
        const dd = d0 + ((d1 - d0) * i) / n;
        B.box(M.black, fx - 0.004, fx + 0.004, FL + 0.02, FL + 2.38, dd - 0.003, dd + 0.003, { cast: false });
      }
      for (let i = 0; i < n; i++) {
        const dd = d0 + ((d1 - d0) * (i + (i % 2 ? 0.12 : 0.88))) / n;
        B.box(M.brass, fx + facing * 0.02, fx + facing * 0.005, FL + 0.9, FL + 1.5, dd - 0.008, dd + 0.008);
      }
    } else {
      const fd = facing < 0 ? d0 : d1;
      const n = Math.round((x1 - x0) / 0.5);
      for (let i = 1; i < n; i++) {
        const xx = x0 + ((x1 - x0) * i) / n;
        B.box(M.black, xx - 0.003, xx + 0.003, FL + 0.02, FL + 2.38, fd - 0.004, fd + 0.004, { cast: false });
      }
      for (let i = 0; i < n; i++) {
        const xx = x0 + ((x1 - x0) * (i + (i % 2 ? 0.12 : 0.88))) / n;
        B.box(M.brass, xx - 0.008, xx + 0.008, FL + 0.9, FL + 1.5, fd + facing * 0.02, fd + facing * 0.005);
      }
    }
  }

  // Bed 1 (master): headboard on the right party wall, bed runs along -x
  mesh(new THREE.BoxGeometry(2.4, 0.012, 2.6), M.rugPlain, 5.2, FL + 0.006, 7.3, 0, root, false);
  bed(5.55, 7.3, 1.6, 2.0, -Math.PI / 2, M.duvetSand);
  B.collide(4.45, W - 0.1, 6.45, 8.15);
  nightstand(W - 0.35, 6.1, -Math.PI / 2);
  nightstand(W - 0.35, 8.5, -Math.PI / 2);
  wardrobe(MID + 0.06, MID + 0.66, FRONT + 0.15, 7.85, M.oak, 'd', 1);
  // Bed 3: single bed along the right wall, desk on the back wall
  bed(6.0, 11.62, 1.07, 2.0, Math.PI, M.duvetSage);
  B.collide(5.4, W - 0.1, 10.56, 12.7);
  nightstand(5.15, 10.8, Math.PI, true);
  {
    B.box(M.oak, 3.6, 4.9, FL + 0.72, FL + 0.75, 12.8, 13.34, { collide: true });
    B.box(M.black, 3.62, 3.66, FL, FL + 0.72, 12.85, 13.3);
    B.box(M.black, 4.84, 4.88, FL, FL + 0.72, 12.85, 13.3);
    // laptop
    const lap = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.012, 0.22), M.brushed);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.008), M.brushed);
    lid.position.set(0, 0.11, -0.11);
    lid.rotation.x = -0.25;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.19), tvMat);
    scr.position.set(0, 0.11, -0.105);
    scr.rotation.x = -0.25;
    lap.add(base, lid, scr);
    place(lap, 4.1, FL + 0.76, 13.0, Math.PI);
    lap.rotation.y = 0;
    root.add(lap);
    // desk lamp
    const dl = new THREE.Group();
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), M.black);
    arm1.position.set(0, 0.2, 0);
    arm1.rotation.z = 0.3;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 16, 1, true), M.black);
    head.position.set(-0.1, 0.4, 0);
    head.rotation.z = 2.4;
    dl.add(arm1, head);
    place(dl, 4.65, FL + 0.75, 13.15);
    root.add(dl);
    // chair
    const ch = new THREE.Group();
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.06, 0.44, 2, 0.02), M.headboard);
    seat.position.y = 0.47;
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.45, 0.05, 2, 0.02), M.headboard);
    back.position.set(0, 0.78, 0.22);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), M.black);
    post.position.y = 0.24;
    const star = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 5), M.black);
    star.position.y = 0.05;
    ch.add(seat, back, post, star);
    ch.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    place(ch, 4.2, FL, 12.45, Math.PI - 0.3);
    root.add(ch);
    // bookshelf on the spine wall
    B.box(M.paintWhite, MID + 0.06, MID + 0.36, FL, FL + 1.9, 10.7, 11.1, { collide: true });
    const bookColors = [0x8c3b2e, 0x2f4858, 0xc9a36b, 0x5b6b4f, 0xe7dfd0, 0x3d3a35];
    for (let s = 0; s < 4; s++) {
      B.box(M.oak, MID + 0.07, MID + 0.36, FL + 0.35 + s * 0.42, FL + 0.37 + s * 0.42, 10.72, 11.08, { cast: false });
      let dd = 10.74;
      while (dd < 11.05) {
        const bw = 0.025 + T.rand() * 0.02, bhh = 0.2 + T.rand() * 0.12;
        const bk = new THREE.Mesh(new THREE.BoxGeometry(0.2, bhh, bw), std({ color: bookColors[Math.floor(T.rand() * bookColors.length)], roughness: 0.7 }));
        place(bk, MID + 0.2, FL + 0.37 + s * 0.42 + bhh / 2, dd + bw / 2);
        root.add(bk);
        dd += bw + 0.004;
      }
    }
  }
  mesh(new THREE.BoxGeometry(1.4, 0.012, 1.8), M.rug, 4.6, FL + 0.006, 11.7, 0, root, false);
  // Bed 2: headboard on the left party wall, wardrobe on the dining wall
  bed(1.1, 17.6, 1.5, 2.0, Math.PI / 2, M.duvetBlue);
  B.collide(0.1, 2.15, 16.8, 18.4);
  nightstand(0.35, 18.75, Math.PI / 2);
  wardrobe(0.1, 1.9, 15.66, 16.26, M.lacquerCream, 'x', 1);
  mesh(new THREE.BoxGeometry(1.6, 0.012, 2.3), M.rugPlain, 1.4, FL + 0.006, 17.6, 0, root, false);

  // ------------- BATHROOMS -------------
  function toilet(x, d, rotY) {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.12, 0], [0.15, 0.2], [0.19, 0.38], [0.18, 0.4], [0.001, 0.4]].map(([r, y]) => new THREE.Vector2(r, y)), 32), M.ceramic);
    bowl.scale.set(1, 1, 1.3);
    bowl.position.z = 0.08;
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 12, 32).rotateX(Math.PI / 2), M.ceramic);
    seat.scale.set(1, 1, 1.3);
    seat.position.set(0, 0.42, 0.08);
    const tank = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.38, 0.17, 3, 0.03), M.ceramic);
    tank.position.set(0, 0.6, -0.18);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 16), M.chrome);
    btn.position.set(0, 0.795, -0.18);
    g.add(bowl, seat, tank, btn);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    place(g, x, FL, d, rotY);
    root.add(g);
  }
  function vanity(x, d, rotY, w = 0.8) {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(new RoundedBoxGeometry(w, 0.45, 0.46, 2, 0.01), M.walnut);
    cab.position.y = 0.62;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.03, 0.48), M.quartz);
    top.position.y = 0.86;
    const basin = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.1, 0.005], [0.17, 0.06], [0.19, 0.13], [0.18, 0.13], [0.16, 0.065], [0.09, 0.02], [0.001, 0.02]].map(([r, y]) => new THREE.Vector2(r, y)), 36), M.ceramic);
    basin.position.y = 0.875;
    basin.scale.set(1, 1, 0.8);
    const tapC = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0, 0.3, 0.06), new THREE.Vector3(0, 0.26, 0.14)]);
    const tap = new THREE.Mesh(new THREE.TubeGeometry(tapC, 20, 0.01, 8), M.chrome);
    tap.position.set(0, 0.875, -0.2);
    g.add(cab, top, basin, tap);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    place(g, x, FL, d, rotY);
    root.add(g);
  }
  function mirror(axis, at, c, y, w, h, side) {
    const geo = new THREE.PlaneGeometry(w, h);
    const refl = new Reflector(geo, { textureWidth: 512, textureHeight: 512 * (h / w), color: 0xb8bcbc, clipBias: 0.003 });
    if (axis === 'x') place(refl, c, y, at + side * 0.02, side > 0 ? Math.PI : 0);
    else place(refl, at + side * 0.02, y, c, side > 0 ? -Math.PI / 2 : Math.PI / 2);
    // Reflector faces its local +z; rotate so it faces into the room
    if (axis === 'x') refl.rotation.y = side > 0 ? Math.PI : 0;
    else refl.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(refl);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.02), M.brass);
    fr.position.copy(refl.position);
    fr.rotation.copy(refl.rotation);
    fr.translateZ(-0.012);
    root.add(fr);
    // ring light behind
    return refl;
  }
  // B1: vanity on the back (d = 10.5) wall at left, toilet centre, shower right
  vanity(3.7, 10.2, Math.PI);
  mirror('x', 10.44, 3.7, FL + 1.55, 0.7, 0.8, -1);
  toilet(4.9, 10.15, Math.PI);
  B.collide(MID, 4.15, 9.9, 10.5);
  B.collide(4.65, 5.15, 9.7, 10.5);
  // shower zone
  {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.95).rotateY(Math.PI / 2), M.showerGlass);
    place(glass, 5.6, FL + 1.0, 9.75);
    root.add(glass);
    B.box(M.chrome, 5.59, 5.61, FL, FL + 2.0, 9.06, 9.08);
    B.box(M.chrome, 5.59, 5.61, FL + 1.95, FL + 2.0, 9.06, 10.44);
    B.collide(5.58, 5.62, 9.06, 10.44);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 32), M.chrome);
    place(head, 6.2, FL + 2.2, 9.75);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 8).rotateZ(Math.PI / 2), M.chrome);
    place(arm, 6.4, FL + 2.22, 9.75);
    const mixer = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 20).rotateZ(Math.PI / 2), M.chrome);
    place(mixer, W - 0.14, FL + 1.1, 9.75);
    root.add(head, arm, mixer);
    B.box(M.chrome, 6.1, 6.3, FL + 0.001, FL + 0.004, 9.7, 9.8, { cast: false });
    // niche + towel
    B.box(M.bathAccent, W - 0.13, W - 0.115, FL + 1.3, FL + 1.6, 9.3, 9.7, { cast: false });
    const towel = mesh(new RoundedBoxGeometry(0.06, 0.55, 0.4, 2, 0.02), M.linen, MID + 0.12, FL + 1.3, 9.6);
    towel.castShadow = true;
  }
  // B2: toilet at back, vanity on the right wall, shower left
  vanity(4.4, 17.2, -Math.PI / 2, 0.6);
  mirror('d', 4.625, 17.2, FL + 1.55, 0.55, 0.75, -1);
  toilet(4.2, 18.95, Math.PI);
  B.collide(4.1, 4.62, 16.9, 17.5);
  B.collide(3.95, 4.45, 18.6, BACK - 0.1);
  {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.95), M.showerGlass);
    place(glass, 3.45 + 0.1, FL + 1.0, 17.9);
    glass.scale.x = 0.7;
    root.add(glass);
    B.collide(3.06, 3.95, 17.88, 17.92);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 32), M.chrome);
    place(head, 3.4, FL + 2.2, 18.6);
    root.add(head);
    const towel = mesh(new RoundedBoxGeometry(0.4, 0.55, 0.06, 2, 0.02), M.duvetSage, 3.9, FL + 1.3, 16.42);
    towel.castShadow = true;
  }

  // ------------- PLANTS -------------
  function plant(x, d, s, kind, y = 0) {
    const g = new THREE.Group();
    const potPts = kind === 'small'
      ? [[0.001, 0], [0.07, 0], [0.09, 0.12], [0.085, 0.13]]
      : [[0.001, 0], [0.16, 0], [0.2, 0.38], [0.21, 0.4], [0.19, 0.4]];
    const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts.map(([r, yy]) => new THREE.Vector2(r, yy)), 28), kind === 'fiddle' ? M.terracotta : kind === 'palm' ? M.ceramic : M.potGrey);
    pot.castShadow = true;
    g.add(pot);
    const topY = potPts[potPts.length - 2][1];
    const leafGeos = [];
    const count = kind === 'small' ? 14 : kind === 'palm' ? 12 : 22;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + T.rand() * 0.5;
      let lg;
      if (kind === 'palm') {
        lg = new THREE.PlaneGeometry(0.16, 0.9, 1, 6);
        const p = lg.attributes.position;
        for (let j = 0; j < p.count; j++) {
          const yy = p.getY(j) + 0.45;
          p.setZ(j, -yy * yy * 0.5);
          p.setX(j, p.getX(j) * (1 - yy));
        }
        lg.translate(0, 0.45, 0);
        lg.rotateX(-0.5 - T.rand() * 0.4);
        lg.rotateY(a);
        lg.translate(0, topY + 0.3 + T.rand() * 0.5, 0);
        // stem
      } else {
        const sz = kind === 'small' ? 0.1 : kind === 'fiddle' ? 0.22 : 0.3;
        lg = new THREE.PlaneGeometry(sz, sz * 1.2, 2, 2);
        const p = lg.attributes.position;
        for (let j = 0; j < p.count; j++) p.setZ(j, Math.abs(p.getX(j)) * 0.3);
        lg.translate(0, sz * 0.6, 0);
        lg.rotateX(-0.6 - T.rand() * 0.7);
        lg.rotateY(a);
        const h = kind === 'small' ? 0.05 + T.rand() * 0.12 : kind === 'fiddle' ? 0.2 + (i / count) * 1.1 : 0.15 + T.rand() * 0.7;
        const r = kind === 'fiddle' ? 0.05 : 0.08 + T.rand() * 0.12;
        lg.translate(Math.cos(a) * r, topY + h, -Math.sin(a) * r);
      }
      leafGeos.push(lg);
    }
    const leaves = new THREE.Mesh(mergeGeometries(leafGeos), M.leaf);
    leaves.castShadow = true;
    g.add(leaves);
    if (kind === 'fiddle' || kind === 'palm') {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, kind === 'fiddle' ? 1.3 : 0.6, 6), M.bark);
      stem.position.y = topY + (kind === 'fiddle' ? 0.65 : 0.3);
      g.add(stem);
    }
    g.scale.setScalar(s);
    place(g, x, y, d);
    root.add(g);
  }
  plant(0.55, 0.3, 0.9, 'palm', 0.45);
  plant(6.25, 0.3, 0.8, 'monstera', 0.45);
  plant(0.4, 20.9, 0.9, 'monstera', 0.02);
  plant(1.3, 21.0, 0.7, 'palm', 0.02);
  plant(4.6, 21.0, 0.6, 'fiddle', 0.02);

  // ------------- CAR -------------
  const car = buildCar(M, M.carPaint);
  place(car, 3.38, 0.02, 0.75, Math.PI / 2);
  root.add(car);
  B.collide(3.3, 5.3, 0.7, 5.4);

  // ================= neighbours & street =================
  const shell = buildShell(M);
  const neighbours = new THREE.Group();
  root.add(neighbours);
  const nightWindows = [];
  const tints = [0xe9e4da, 0xe4e0d6, 0xdcd6ca, 0xece8e0, 0xe2ddd2, 0xd7d2c8];
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const s = cloneShell(shell, M, tints[(k + 10) % tints.length], nightWindows);
    s.position.x = k * W;
    neighbours.add(s);
    // left porch wall for each neighbour except the one sharing the main house's right wall
    if (k !== 1) {
      const pw = new THREE.Mesh(boxGeo(k * W - 0.1, k * W + 0.1, 0, CH, 1.2, FRONT), M.exterior);
      pw.castShadow = pw.receiveShadow = true;
      neighbours.add(pw);
    }
    if (T.rand() < 0.6) {
      const c = buildCar(M, new THREE.MeshPhysicalMaterial({ color: [0xdedede, 0x1c1f24, 0x6d7a86, 0x2a3d5a, 0xf2f2f0][Math.floor(T.rand() * 5)], roughness: 0.3, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.05 }));
      place(c, k * W + 3.2 + T.rand() * 0.4, 0.02, 0.8 + T.rand() * 0.4, Math.PI / 2);
      neighbours.add(c);
    }
    const r = new THREE.Group();
    roofRow(r, k * W, (k + 1) * W);
    neighbours.add(r);
  }
  // end-lot gable walls of the row
  for (const x of [-4 * W, 5 * W]) {
    const g = new THREE.Shape();
    g.moveTo(FRONT - 0.6, 0); g.lineTo(BACK + 0.6, 0); g.lineTo(BACK + 0.6, CH + 0.4); g.lineTo((FRONT + BACK) / 2, CH + 2.3); g.lineTo(FRONT - 0.6, CH + 0.4);
    const eg = new THREE.ExtrudeGeometry(g, { depth: 0.2, bevelEnabled: false });
    const em = new THREE.Mesh(eg, M.exterior);
    em.rotation.y = Math.PI / 2;
    em.position.set(x - 0.1, 0, 0);
    em.castShadow = true;
    // shape x maps to world -z after rotation → depth along d
    neighbours.add(em);
  }
  // row across the street, facing us
  const across = new THREE.Group();
  for (let k = -4; k <= 5; k++) {
    const s = cloneShell(shell, M, tints[(k + 12) % tints.length], nightWindows);
    s.position.x = k * W;
    const pw = new THREE.Mesh(boxGeo(k * W - 0.1, k * W + 0.1, 0, CH, 1.2, FRONT), M.exterior);
    pw.castShadow = true;
    s.add(pw);
    const r = new THREE.Group();
    roofRow(r, k * W, (k + 1) * W);
    s.add(r);
    across.add(s);
  }
  // rotated half a turn: local d = 0 lands at d = -12.1 and the row extends away from the road
  across.rotation.y = Math.PI;
  across.position.set(W, 0, 12.1);
  root.add(across);

  // street trees & lamps on our side
  for (let i = -6; i <= 7; i++) {
    const x = i * 7.2 - 1.8;
    if (Math.abs(x - 3.4) < 2.5) continue;
    tree(x, -1.7, 0.8 + T.rand() * 0.5);
  }
  for (let i = -5; i <= 6; i++) tree(i * 8.4 + 1.1, -10.6, 0.8 + T.rand() * 0.5);
  const streetLamps = [];
  for (const x of [-12, 8.5, 29]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 7, 10), M.alu);
    pole.position.y = 3.5;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8).rotateX(Math.PI / 2), M.alu);
    arm.position.set(0, 6.9, 0.8);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.6), M.alu);
    head.position.set(0, 6.85, 1.5);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.5).rotateX(Math.PI / 2), M.downlight);
    lens.position.set(0, 6.79, 1.5);
    g.add(pole, arm, head, lens);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    place(g, x, 0, -2.2);
    root.add(g);
    const l = new THREE.SpotLight(0xffd7a0, 0, 22, 0.9, 0.6, 1.6);
    l.position.set(x, 6.7, 2.2 + 1.5);
    l.target.position.set(x, 0, 2.2 + 1.5);
    root.add(l, l.target);
    streetLamps.push(l);
    lights.push({ light: l, day: 0, golden: 0, night: 60 });
  }

  function tree(x, d, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 3, 8), M.bark);
    trunk.position.y = 1.5;
    g.add(trunk);
    // dark core so the canopy reads as dense, wrapped in alpha-tested leaf cards
    const blobs = [];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Vector3((T.rand() - 0.5) * 1.8, 3.3 + T.rand() * 1.3, (T.rand() - 0.5) * 1.8);
      const r = 0.8 + T.rand() * 0.5;
      blobs.push([c, r]);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.72, 2), M.foliageDark);
      core.position.copy(c);
      core.castShadow = true;
      g.add(core);
    }
    const cards = new THREE.InstancedMesh(cardGeo, M.leafCard, 260);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
    for (let i = 0; i < 260; i++) {
      const [c, r] = blobs[i % blobs.length];
      pp.set(T.rand() - 0.5, T.rand() - 0.5, T.rand() - 0.5).normalize().multiplyScalar(r * (0.55 + T.rand() * 0.5)).add(c);
      q.setFromEuler(e.set(T.rand() * 6.3, T.rand() * 6.3, T.rand() * 6.3));
      sc.setScalar(0.8 + T.rand() * 0.6);
      cards.setMatrixAt(i, m4.compose(pp, q, sc));
      cards.setColorAt(i, new THREE.Color().setHSL(0.27 + (T.rand() - 0.5) * 0.05, 0.45, 0.5 + T.rand() * 0.25));
    }
    cards.castShadow = true;
    cards.receiveShadow = true;
    g.add(cards);
    trunk.castShadow = true;
    g.scale.setScalar(s);
    place(g, x, 0, d, T.rand() * 6);
    root.add(g);
  }

  // Flush merged static geometry
  B.flush(root);

  // RectArea "sky light" through windows during the day
  const windowLights = [];
  const rect = (x, y, d, w, h, ry, color = 0xdfeaff) => {
    const l = new THREE.RectAreaLight(color, 0, w, h);
    place(l, x, y, d, ry);
    root.add(l);
    windowLights.push(l);
    return l;
  };
  // Front windows face +d (inward) → look toward +d → rotation so light points to -z world
  const rl1 = rect(2.2, FL + 1.4, FRONT + 0.12, 1.2, 1.9, Math.PI);
  const rl2 = rect(4.85, FL + 1.6, FRONT + 0.12, 2.5, 1.4, Math.PI);
  const rl3 = rect(1.4, FL + 1.5, BACK - 0.12, 1.6, 1.2, 0);
  const rl4 = new THREE.RectAreaLight(0xe8f0ff, 0, 1.3, 0.94);
  place(rl4, 5.55, CH - 0.01, 17.5);
  rl4.rotation.x = -Math.PI / 2;
  root.add(rl4);
  windowLights.push(rl4);
  // RectAreaLight emits along its local -z; point front window lights into the house
  rl1.lookAt(2.2, FL + 1.2, -(FRONT + 3));
  rl2.lookAt(4.85, FL + 1.2, -(FRONT + 3));
  rl3.lookAt(1.4, FL + 1.2, -(BACK - 3));

  return {
    root, doors, fans, lights, windowLights, roofGroup, neighbours, across, colliders: B.colliders, anim,
    pillarLamps, streetLamps, nightWindows, porchLight, tvMat, winLiving,
  };
}

// ---------- car ----------
export function buildCar(M, paint) {
  const car = new THREE.Group();
  const body = new THREE.Shape();
  // side profile: x = length (0 front bumper → 4.6 rear), y = height
  body.moveTo(0.02, 0.32);
  body.lineTo(0.0, 0.62);
  body.quadraticCurveTo(0.02, 0.8, 0.25, 0.84);
  body.lineTo(1.25, 0.95);
  body.lineTo(3.95, 0.98);
  body.quadraticCurveTo(4.55, 0.98, 4.6, 0.84);
  body.lineTo(4.62, 0.4);
  body.quadraticCurveTo(4.6, 0.32, 4.45, 0.32);
  body.lineTo(3.95, 0.32);
  body.absarc(3.55, 0.35, 0.4, 0, Math.PI, false);
  body.lineTo(1.45, 0.32);
  body.absarc(1.05, 0.35, 0.4, 0, Math.PI, false);
  body.lineTo(0.02, 0.32);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 1.66, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 5, curveSegments: 20 });
  const bm = new THREE.Mesh(bodyGeo, paint);
  bm.position.z = 0.09;
  car.add(bm);
  const cabin = new THREE.Shape();
  cabin.moveTo(1.3, 0.94);
  cabin.lineTo(2.2, 1.38);
  cabin.quadraticCurveTo(2.35, 1.43, 2.6, 1.43);
  cabin.lineTo(3.4, 1.42);
  cabin.quadraticCurveTo(3.55, 1.4, 3.65, 1.33);
  cabin.lineTo(4.1, 0.97);
  cabin.lineTo(1.3, 0.94);
  const cg = new THREE.ExtrudeGeometry(cabin, { depth: 1.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3 });
  const cm = new THREE.Mesh(cg, M.carGlass);
  cm.position.z = 0.24;
  car.add(cm);
  // roof skin + pillars
  const roofS = new THREE.Shape();
  roofS.moveTo(2.25, 1.4);
  roofS.quadraticCurveTo(2.4, 1.46, 2.6, 1.46);
  roofS.lineTo(3.4, 1.45);
  roofS.quadraticCurveTo(3.55, 1.43, 3.62, 1.38);
  roofS.lineTo(2.25, 1.4);
  const rg = new THREE.ExtrudeGeometry(roofS, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2 });
  const rm = new THREE.Mesh(rg, paint);
  rm.position.z = 0.22;
  car.add(rm);
  for (const z of [0.2, 1.63]) {
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.06), paint);
    bp.position.set(2.95, 1.18, z);
    car.add(bp);
  }
  // wheels
  for (const [x, z] of [[1.05, 0.13], [1.05, 1.71], [3.55, 0.13], [3.55, 1.71]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.1, 16, 32), M.rubber);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 32).rotateX(Math.PI / 2), M.brushed);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16).rotateX(Math.PI / 2), M.black);
    w.add(tire, rim, hub);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.03), M.black);
      sp.rotation.z = (i / 5) * Math.PI * 2;
      sp.position.set(Math.sin(-sp.rotation.z) * 0.12, Math.cos(sp.rotation.z) * 0.12, z < 1 ? -0.1 : 0.1);
      w.add(sp);
    }
    w.position.set(x, 0.35, z);
    car.add(w);
  }
  // lights, grille, mirrors, plates
  for (const z of [0.35, 1.5]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.34), M.headlight);
    hl.position.set(0.1, 0.72, z);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.38), M.taillight);
    tl.position.set(4.62, 0.78, z);
    car.add(hl, tl);
    const mir = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.14, 2, 0.03), paint);
    mir.position.set(1.95, 1.02, z < 1 ? -0.02 : 1.86);
    car.add(mir);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.9), M.black);
  grille.position.set(0.02, 0.55, 0.92);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.5), M.black);
  plate.position.set(-0.03, 0.4, 0.92);
  const plateR = plate.clone();
  plateR.position.x = 4.66;
  car.add(grille, plate, plateR);
  // contact shadow
  car.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return car;
}

// ---------- neighbour shell (exterior only) ----------
function buildShell(M) {
  const g = new THREE.Group();
  const B = new Builder();
  const TX = 0.2;
  // facade with same openings as the main house; windows filled with dark glass + curtains
  const facade = [
    [0.1, 0.25, 0, CH + 0.4], [1.3, 1.6, 0, CH + 0.4], [2.8, 3.6, 0, CH + 0.4], [6.1, W - 0.1, 0, CH + 0.4],
    [0.25, 1.3, FL + 2.35, CH + 0.4], [1.6, 2.8, 0, FL + 0.45], [1.6, 2.8, FL + 2.35, CH + 0.4], [3.6, 6.1, 0, FL + 0.9], [3.6, 6.1, FL + 2.35, CH + 0.4],
  ];
  for (const [a, b, y0, y1] of facade) B.box(M.exterior, a, b, y0, y1, FRONT - TX / 2, FRONT + TX / 2);
  B.box(M.stone, 1.3, 1.6, FL, CH, FRONT - 0.13, FRONT - 0.1);
  B.box(M.stone, 2.8, 3.6, FL, CH, FRONT - 0.13, FRONT - 0.1);
  B.box(M.exteriorDark, 0.1, W - 0.1, FL + 2.35, FL + 2.6, FRONT - 0.12, FRONT - 0.1);
  B.box(M.doorWood, 0.25, 1.3, FL, FL + 2.35, FRONT - 0.02, FRONT + 0.02);
  B.box(M.brass, 1.15, 1.17, FL + 0.6, FL + 1.7, FRONT - 0.07, FRONT - 0.05);
  // back wall
  B.box(M.exterior, 0.1, W - 0.1, 0, CH + 0.4, BACK - TX / 2, BACK + TX / 2);
  // porch slab, fascia, piers, fence
  B.box(M.concrete, 0, W, CH, CH + 0.22, 0.9, FRONT - 0.1);
  B.box(M.fascia, -0.02, W + 0.02, CH - 0.05, CH + 0.3, 0.8, 0.92);
  B.box(M.exteriorDark, -0.12, 0.12, 0, CH, 0.8, 1.2);
  B.box(M.pavers, 0, W, -0.02, 0.02, 0, FRONT - 0.1, { cast: false });
  B.box(M.concrete, 0, W, -0.02, 0.02, BACK + 0.1, L, { cast: false });
  B.box(M.concrete, 1.2, 5.6, 0.0, 0.07, -2.45, 0, { cast: false });
  B.box(M.boundary, 0.1, W - 0.1, 0, 2.2, L - 0.2, L);
  for (const [x0, x1] of [[0.0, 1.2], [5.6, W]]) {
    B.box(M.boundary, x0, x1, 0, 0.9, -0.1, 0.1);
    B.box(M.exteriorDark, x0, x1, 0.9, 0.95, -0.12, 0.12);
    for (let x = x0 + 0.08; x < x1 - 0.02; x += 0.12) B.box(M.black, x, x + 0.02, 0.95, 1.6, -0.01, 0.01);
  }
  for (const x of [1.05, 5.6]) B.box(M.boundary, x, x + 0.25, 0, 1.75, -0.14, 0.14);
  // closed gate
  for (let x = 1.35; x < 5.55; x += 0.11) B.box(M.black, x, x + 0.018, 0.1, 1.55, -0.02, 0.02);
  B.box(M.black, 1.3, 5.6, 0.1, 0.16, -0.03, 0.03);
  B.box(M.black, 1.3, 5.6, 1.5, 1.56, -0.03, 0.03);
  B.box(M.walnut, 1.35, 5.55, 1.2, 1.5, -0.015, 0.015);
  // window frames
  for (const [a, b, y0, y1] of [[1.6, 2.8, FL + 0.45, FL + 2.35], [3.6, 6.1, FL + 0.9, FL + 2.35]]) {
    B.box(M.alu, a, a + 0.05, y0, y1, FRONT - 0.04, FRONT + 0.04);
    B.box(M.alu, b - 0.05, b, y0, y1, FRONT - 0.04, FRONT + 0.04);
    B.box(M.alu, a, b, y0, y0 + 0.05, FRONT - 0.04, FRONT + 0.04);
    B.box(M.alu, a, b, y1 - 0.05, y1, FRONT - 0.04, FRONT + 0.04);
    B.box(M.alu, (a + b) / 2 - 0.02, (a + b) / 2 + 0.02, y0, y1, FRONT - 0.04, FRONT + 0.04);
  }
  // porch ceiling
  const pc = new THREE.PlaneGeometry(W, FRONT - 0.9).rotateX(Math.PI / 2);
  pc.translate(W / 2, CH, -(0.9 + FRONT) / 2);
  B.add(M.ceiling, worldUV(pc), false, true);
  B.flush(g);
  g.userData.windows = [[1.6, 2.8, FL + 0.45, FL + 2.35], [3.6, 6.1, FL + 0.9, FL + 2.35]];
  return g;
}

function cloneShell(shell, M, tint, nightWindows) {
  const s = shell.clone();
  const ext = M.exterior.clone();
  ext.color.set(tint).multiplyScalar(1 / 0.92);
  s.traverse((m) => { if (m.isMesh && m.material === M.exterior) m.material = ext; });
  for (const [a, b, y0, y1] of shell.userData.windows) {
    // glass reflective at day; curtain glows at night
    const mat = M.nightWindow.clone();
    mat.userData.on = T.rand() < 0.6;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(b - a, y1 - y0), mat);
    place(pane, (a + b) / 2, (y0 + y1) / 2, FRONT + 0.05);
    s.add(pane);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(b - a, y1 - y0), M.darkWindow);
    place(gl, (a + b) / 2, (y0 + y1) / 2, FRONT - 0.01);
    gl.material = M.glass;
    s.add(gl);
    nightWindows.push(mat);
  }
  return s;
}
