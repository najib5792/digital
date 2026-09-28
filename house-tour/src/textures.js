// Procedural PBR textures. Everything is painted on canvases at load time so the
// tour ships as a single self-contained file with no image assets.
import * as THREE from 'three';

let seed = 1337;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export const rr = (a, b) => a + (b - a) * rand();

// ---------- value noise ----------
const PERM = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * (3 - 2 * t);
function hash2(x, y) {
  return PERM[(PERM[x & 255] + y) & 511] / 255;
}
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Tileable fbm: noise sampled on a torus-ish wrap via period
function tnoise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const m = (v) => ((v % period) + period) % period;
  const a = hash2(m(xi), m(yi)), b = hash2(m(xi + 1), m(yi));
  const c = hash2(m(xi), m(yi + 1)), d = hash2(m(xi + 1), m(yi + 1));
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4, period = 0) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * (period ? tnoise(x * f, y * f, period * f) : noise2(x * f, y * f));
    amp *= 0.5;
    f *= 2;
  }
  return s;
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Build a normal map from a grayscale height canvas (Sobel).
function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

let maxAniso = 8;
export function setAniso(a) { maxAniso = a; }

function tex(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function pixels(w, h, fn) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = fn(x, y);
      const i = (y * w + x) * 4;
      img.data[i] = v[0];
      img.data[i + 1] = v[1];
      img.data[i + 2] = v[2];
      img.data[i + 3] = v[3] ?? 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const clamp255 = (v) => Math.max(0, Math.min(255, v));

// ---------- specific surfaces ----------

// Oak planks: 4 planks across, each 1/4 of a 1 m tile (so repeat = metres).
export function woodFloor() {
  const S = 1024;
  const planks = 5;
  const pw = S / planks;
  const offsets = Array.from({ length: planks }, () => Math.floor(rand() * S));
  const tints = Array.from({ length: planks * 3 }, () => rr(-18, 18));
  const col = pixels(S, S, (x, y) => {
    const p = Math.floor(x / pw);
    const yy = (y + offsets[p]) % S;
    const seg = Math.floor(yy / (S / 1.5)) ;
    const tint = tints[(p * 3 + seg) % tints.length];
    const lx = (x % pw) / pw;
    const grain = fbm(lx * 3 + p * 7, yy / 90, 3) * 0.6 + Math.sin((lx * 30 + fbm(p, yy / 200, 2) * 12)) * 0.08;
    const ring = Math.sin(fbm(lx * 2 + p * 3, yy / 300, 2) * 40) * 0.06;
    const v = 0.72 + grain * 0.35 + ring;
    let r = 176 * v + tint, g = 128 * v + tint * 0.7, b = 84 * v + tint * 0.4;
    const edge = Math.min(x % pw, pw - (x % pw));
    const endEdge = yy % (S / 1.5);
    if (edge < 1.5 || endEdge < 1.5) { r *= 0.45; g *= 0.45; b *= 0.45; }
    return [clamp255(r), clamp255(g), clamp255(b)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const p = Math.floor(x / pw);
    const yy = (y + offsets[p]) % S;
    const edge = Math.min(x % pw, pw - (x % pw));
    const endEdge = yy % (S / 1.5);
    let v = 190 + fbm((x % pw) / pw * 3 + p * 7, yy / 60, 3) * 40;
    if (edge < 2 || endEdge < 2) v = 60;
    return [v, v, v];
  });
  const rough = pixels(256, 256, (x, y) => {
    const v = 120 + fbm(x / 20, y / 40, 3) * 70;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 3), { srgb: false }), roughnessMap: tex(rough, { srgb: false }) };
}

// Large format porcelain (600x600) marble look: one texture = 1.2 m (2x2 tiles)
export function marbleTile(base = [236, 233, 228], vein = [150, 145, 140]) {
  const S = 1024;
  const col = pixels(S, S, (x, y) => {
    const u = x / S, v = y / S;
    const tile = (Math.floor(u * 2) + Math.floor(v * 2) * 2);
    const n = fbm(u * 4 + tile * 3.1, v * 4 + tile * 1.7, 5);
    const veinV = Math.abs(Math.sin((u * 3 + v * 5 + n * 5) * Math.PI));
    const vv = Math.pow(1 - veinV, 14) * 0.8 + Math.pow(1 - veinV, 60) * 0.5;
    const cloud = fbm(u * 8, v * 8, 4) * 0.08;
    let r = base[0] - cloud * 90, g = base[1] - cloud * 90, b = base[2] - cloud * 80;
    r = r * (1 - vv) + vein[0] * vv;
    g = g * (1 - vv) + vein[1] * vv;
    b = b * (1 - vv) + vein[2] * vv;
    const gx = (x % (S / 2)), gy = (y % (S / 2));
    if (gx < 2 || gy < 2) { r = 190; g = 186; b = 180; }
    return [clamp255(r), clamp255(g), clamp255(b)];
  });
  const hgt = pixels(512, 512, (x, y) => {
    const gx = x % 256, gy = y % 256;
    const v = gx < 1.5 || gy < 1.5 ? 40 : 200;
    return [v, v, v];
  });
  const rough = pixels(256, 256, (x, y) => {
    const gx = x % 128, gy = y % 128;
    const v = gx < 2 || gy < 2 ? 230 : 40 + fbm(x / 10, y / 10, 3) * 40;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 2), { srgb: false }), roughnessMap: tex(rough, { srgb: false }) };
}

// Ceramic tiles. w x h tiles per texture; texture spans `span` metres.
export function ceramicTile({ cols = 4, rows = 8, color = [240, 240, 236], grout = [175, 172, 168], vary = 10, stagger = false, S = 512 } = {}) {
  const tw = S / cols, th = S / rows;
  const tintOf = {};
  const col = pixels(S, S, (x, y) => {
    const row = Math.floor(y / th);
    const xo = stagger && row % 2 ? tw / 2 : 0;
    const cx = Math.floor((x + xo) / tw) % cols;
    const key = row * 100 + cx;
    if (tintOf[key] === undefined) tintOf[key] = rr(-vary, vary);
    const lx = (x + xo) % tw, ly = y % th;
    if (lx < 2 || ly < 2) return grout;
    const t = tintOf[key];
    const n = fbm(x / 30, y / 30, 2) * 10;
    const bevel = Math.min(lx, tw - lx, ly, th - ly) < 5 ? -12 : 0;
    return [clamp255(color[0] + t + n + bevel), clamp255(color[1] + t + n + bevel), clamp255(color[2] + t + n + bevel)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const row = Math.floor(y / th);
    const xo = stagger && row % 2 ? tw / 2 : 0;
    const lx = (x + xo) % tw, ly = y % th;
    const d = Math.min(lx, tw - lx, ly, th - ly);
    const v = d < 2 ? 30 : d < 6 ? 30 + (d - 2) * 40 : 200;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 2.5), { srgb: false }) };
}

export function plaster(color = [238, 234, 226]) {
  const S = 512;
  const col = pixels(S, S, (x, y) => {
    const n = fbm(x / 60, y / 60, 5, 8.533) * 10 + fbm(x / 6, y / 6, 2, 85.33) * 4;
    return [clamp255(color[0] + n - 7), clamp255(color[1] + n - 7), clamp255(color[2] + n - 7)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const v = 128 + fbm(x / 3, y / 3, 3, 170.67) * 60;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 0.6), { srgb: false }) };
}

export function concrete(base = [150, 148, 144]) {
  const S = 512;
  const col = pixels(S, S, (x, y) => {
    const n = fbm(x / 50, y / 50, 5, 10.24) * 40 + fbm(x / 4, y / 4, 2, 128) * 14;
    const spot = fbm(x / 12 + 50, y / 12, 3, 42.67) > 0.72 ? -20 : 0;
    return [clamp255(base[0] + n - 25 + spot), clamp255(base[1] + n - 25 + spot), clamp255(base[2] + n - 25 + spot)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const v = 128 + fbm(x / 4, y / 4, 3, 128) * 90;
    return [v, v, v];
  });
  const rough = pixels(256, 256, (x, y) => {
    const v = 200 + fbm(x / 20, y / 20, 3, 12.8) * 50;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 1.2), { srgb: false }), roughnessMap: tex(rough, { srgb: false }) };
}

// Interlocking pavers (herringbone-ish running bond), texture = 1 m
export function pavers() {
  const S = 512;
  const bw = S / 5, bh = S / 10;
  const tints = {};
  const col = pixels(S, S, (x, y) => {
    const row = Math.floor(y / bh);
    const xo = row % 2 ? bw / 2 : 0;
    const c = Math.floor((x + xo) / bw);
    const k = row * 50 + c;
    if (tints[k] === undefined) tints[k] = [rr(-22, 22), rand() < 0.3 ? 1 : 0];
    const lx = (x + xo) % bw, ly = y % bh;
    if (lx < 3 || ly < 3) return [70, 66, 60];
    const [t, alt] = tints[k];
    const n = fbm(x / 8, y / 8, 3, 64) * 30;
    const base = alt ? [120, 112, 104] : [168, 150, 128];
    return [clamp255(base[0] + t + n), clamp255(base[1] + t + n), clamp255(base[2] + t + n)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const row = Math.floor(y / bh);
    const xo = row % 2 ? bw / 2 : 0;
    const lx = (x + xo) % bw, ly = y % bh;
    const d = Math.min(lx, bw - lx, ly, bh - ly);
    const v = d < 3 ? 20 : Math.min(220, 20 + d * 30) + fbm(x / 3, y / 3, 2, 170.67) * 30;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 2.5), { srgb: false }) };
}

export function asphalt() {
  const S = 512;
  const col = pixels(S, S, (x, y) => {
    const n = fbm(x / 3, y / 3, 2, 170.67) * 50 + fbm(x / 60, y / 60, 3, 8.53) * 25;
    const g = 48 + n - 20;
    return [g, g, g + 2];
  });
  const hgt = pixels(S, S, (x, y) => {
    const v = 128 + fbm(x / 2, y / 2, 2, 256) * 110;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 1.5), { srgb: false }) };
}

export function grass() {
  const S = 512;
  const c = pixels(S, S, (x, y) => {
    const n = fbm(x / 40, y / 40, 4, 12.8);
    const blade = fbm(x / 1.5, y / 5, 2, 341.33);
    return [clamp255(50 + n * 50 + blade * 40), clamp255(92 + n * 60 + blade * 60), clamp255(36 + n * 25)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const v = 90 + fbm(x / 1.5, y / 5, 2, 341.33) * 150;
    return [v, v, v];
  });
  return { map: tex(c), normalMap: tex(normalFromHeight(hgt, 2), { srgb: false }) };
}

// Clay roof tiles, texture = 1 m
export function roofTiles() {
  const S = 512;
  const cw = S / 3, ch = S / 3;
  const tints = {};
  const col = pixels(S, S, (x, y) => {
    const row = Math.floor(y / ch);
    const xo = row % 2 ? cw / 2 : 0;
    const c = Math.floor((x + xo) / cw);
    const k = row * 20 + c;
    if (tints[k] === undefined) tints[k] = rr(-18, 18);
    const lx = ((x + xo) % cw) / cw, ly = (y % ch) / ch;
    const wave = Math.sin(lx * Math.PI * 2) * 0.5 + 0.5;
    const shade = 0.65 + wave * 0.35 - ly * 0.25;
    const n = fbm(x / 10, y / 10, 3, 51.2) * 25;
    const t = tints[k];
    return [clamp255((96 + t + n) * shade), clamp255((52 + t * 0.5 + n * 0.6) * shade), clamp255((40 + n * 0.5) * shade)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const row = Math.floor(y / ch);
    const xo = row % 2 ? cw / 2 : 0;
    const lx = ((x + xo) % cw) / cw, ly = (y % ch) / ch;
    const v = (Math.sin(lx * Math.PI * 2) * 0.5 + 0.5) * 140 + (1 - ly) * 80;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 3), { srgb: false }) };
}

export function fabric(color = [120, 118, 112], weave = 4) {
  const S = 256;
  const col = pixels(S, S, (x, y) => {
    const w = ((Math.floor(x / weave) + Math.floor(y / weave)) % 2) * 8;
    const n = fbm(x / 20, y / 20, 3, 12.8) * 18 + fbm(x, y, 1, 256) * 10;
    return [clamp255(color[0] + w + n - 12), clamp255(color[1] + w + n - 12), clamp255(color[2] + w + n - 12)];
  });
  const hgt = pixels(S, S, (x, y) => {
    const a = Math.sin(x / weave * Math.PI) * Math.sin(y / weave * Math.PI);
    const v = 128 + a * 90;
    return [v, v, v];
  });
  return { map: tex(col), normalMap: tex(normalFromHeight(hgt, 1.2), { srgb: false }) };
}

// Wood veneer for cabinetry / doors (vertical grain), texture = 1 m
export function veneer(base = [150, 104, 66], contrast = 1) {
  const S = 512;
  const col = pixels(S, S, (x, y) => {
    const n = fbm(x / 22, y / 220, 3, 23.27);
    const lines = Math.sin(x / 3 + n * 30) * 0.5 + 0.5;
    const v = 0.8 + (n - 0.5) * 0.5 * contrast + lines * 0.08 * contrast;
    return [clamp255(base[0] * v), clamp255(base[1] * v), clamp255(base[2] * v)];
  });
  return { map: tex(col) };
}

export function rug() {
  const S = 512;
  const c = pixels(S, S, (x, y) => {
    const u = x / S - 0.5, v = y / S - 0.5;
    const border = Math.max(Math.abs(u), Math.abs(v));
    let base = [196, 184, 164];
    if (border > 0.44) base = [70, 78, 88];
    else if (border > 0.41) base = [188, 150, 96];
    else {
      const d = Math.abs(Math.sin(u * 18) * Math.cos(v * 18));
      if (d > 0.85) base = [150, 120, 80];
      const ring = Math.abs(Math.hypot(u, v) - 0.22);
      if (ring < 0.01) base = [90, 96, 104];
    }
    const n = fbm(x / 2, y / 2, 2, 256) * 22;
    return [clamp255(base[0] + n - 11), clamp255(base[1] + n - 11), clamp255(base[2] + n - 11)];
  });
  const hgt = pixels(256, 256, (x, y) => {
    const v = 100 + fbm(x / 1.2, y / 1.2, 2, 213.3) * 140;
    return [v, v, v];
  });
  return { map: tex(c), normalMap: tex(normalFromHeight(hgt, 1.2), { srgb: false }) };
}

// Abstract art in the gold-line style of the brochure
export function artwork(kind = 0) {
  const W = 512, H = 640;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const palettes = [
    ['#2d2a27', '#c9a36b', '#e8dcc6', '#6d5a45'],
    ['#e9e2d6', '#1f3b4d', '#c67b5c', '#9fb3a6'],
    ['#1d2327', '#8aa39b', '#d9c7a4', '#b35c44'],
  ];
  const p = palettes[kind % palettes.length];
  g.fillStyle = p[0];
  g.fillRect(0, 0, W, H);
  if (kind % 3 === 0) {
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(201,163,107,${0.25 + (i % 5) * 0.08})`;
      g.lineWidth = 1;
      g.beginPath();
      for (let t = 0; t <= 1.001; t += 0.01) {
        const x = t * W;
        const y = H * 0.5 + Math.sin(t * 6 + i * 0.07) * (80 + i) * Math.sin(t * 3.1 + i * 0.03) + i * 1.5 - 60;
        t === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (kind % 3 === 1) {
    g.fillStyle = p[3];
    g.beginPath(); g.arc(W * 0.35, H * 0.4, 150, 0, Math.PI * 2); g.fill();
    g.fillStyle = p[1];
    g.fillRect(W * 0.45, H * 0.35, W * 0.4, H * 0.5);
    g.fillStyle = p[2];
    g.beginPath(); g.arc(W * 0.7, H * 0.3, 60, 0, Math.PI * 2); g.fill();
  } else {
    for (let i = 0; i < 7; i++) {
      g.fillStyle = p[1 + (i % 3)];
      g.globalAlpha = 0.85;
      g.beginPath();
      const y = H * (0.15 + i * 0.11);
      g.moveTo(0, y);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x / 70 + i) * 30 + fbm(x / 90, i, 2) * 40);
      g.lineTo(W, H); g.lineTo(0, H); g.fill();
    }
    g.globalAlpha = 1;
  }
  // canvas grain
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 16;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}

export function leafTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0, '#2f5a26');
  grd.addColorStop(0.5, '#4f8a3a');
  grd.addColorStop(1, '#2c5224');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(128, 4);
  g.bezierCurveTo(250, 60, 230, 200, 128, 252);
  g.bezierCurveTo(26, 200, 6, 60, 128, 4);
  g.fill();
  g.strokeStyle = 'rgba(210,240,180,0.55)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(128, 8); g.lineTo(128, 250); g.stroke();
  g.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    const y = 30 + i * 24;
    g.beginPath(); g.moveTo(128, y); g.quadraticCurveTo(170, y + 6, 205, y + 26); g.stroke();
    g.beginPath(); g.moveTo(128, y); g.quadraticCurveTo(86, y + 6, 51, y + 26); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Radial soft gradient used for light pools, shafts and particles
export function softDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(128);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function shaftTexture() {
  const c = canvas(64, 256);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,240,210,0.9)');
  grd.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.2, 'rgba(0,0,0,0)');
  h.addColorStop(0.8, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Cluster of small leaves on a transparent card, used for tree canopies
export function leafCluster() {
  const c = canvas(256);
  const g = c.getContext('2d');
  const greens = ['#2f5a2a', '#3c6d31', '#4b7f38', '#5a8f3f', '#294d25', '#6c9a47'];
  for (let i = 0; i < 140; i++) {
    const r = Math.sqrt(rand()) * 110;
    const a = rand() * Math.PI * 2;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    g.save();
    g.translate(x, y);
    g.rotate(rand() * Math.PI * 2);
    g.fillStyle = greens[Math.floor(rand() * greens.length)];
    const s = 7 + rand() * 9;
    g.beginPath();
    g.moveTo(0, -s);
    g.quadraticCurveTo(s * 0.6, 0, 0, s);
    g.quadraticCurveTo(-s * 0.6, 0, 0, -s);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
