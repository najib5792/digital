import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { makeMaterials, buildWorld, ROOMS, roomAt, floorAt, W, L, FL, CH, FRONT, BACK } from './house.js';
import * as T from './textures.js';
import { AudioEngine } from './audio.js';
import { STOPS } from './tour.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const V = (x, y, d) => new THREE.Vector3(x, y, -d);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const isTouch = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------- renderer ----------------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
T.setAniso(renderer.capabilities.getMaxAnisotropy());
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 900);
camera.rotation.order = 'YXZ';
camera.position.set(-14, 9, 20);

// sky + environment
const sky = new Sky();
sky.scale.setScalar(800);
scene.add(sky);
const envScene = new THREE.Scene();
const envSky = new Sky();
envSky.scale.setScalar(100);
envScene.add(envSky);
// The Sky shader outputs raw radiance far brighter than interior lighting; scale it down
for (const s of [sky, envSky]) {
  s.material.uniforms.skyGain = { value: 0.5 };
  s.material.fragmentShader = 'uniform float skyGain;\n' + s.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
}
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 2048 : 4096, isTouch ? 2048 : 4096);
const sc = sun.shadow.camera;
sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 120;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 3;
sun.target.position.set(W / 2, 0, -10);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x8a7560, 0.4);
scene.add(hemi);

// stars for the night preset
const starGeo = new THREE.BufferGeometry();
{
  const n = 1500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    p.set([Math.cos(a) * r * 500, Math.abs(u) * 500 + 20, Math.sin(a) * r * 500], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
scene.add(new THREE.Points(starGeo, starMat));

// ---------------- post-processing ----------------
const rt = new THREE.WebGLRenderTarget(innerWidth * pixelRatio, innerHeight * pixelRatio, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(pixelRatio);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.blendIntensity = 0.9;
gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 1.2, scale: 1.2, samples: 12 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
gtao.enabled = !isTouch;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(innerWidth, innerHeight) }, vignette: { value: 0.32 }, grain: { value: 0.035 }, fade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float vignette; uniform float grain; uniform float fade;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float ca = dot(c, c) * 0.006;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + c * ca).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - c * ca).b;
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.12);
      col *= vec3(1.015, 1.0, 0.975);
      float v = smoothstep(0.9, 0.2, length(c * vec2(1.0, 0.85)));
      col *= mix(1.0 - vignette, 1.0, v);
      col += (hash(vUv * res + fract(time) * 91.7) - 0.5) * grain;
      col = mix(col, vec3(0.0), fade);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(grade);

// ---------------- world ----------------
const audio = new AudioEngine();
let M, world;
const doorsNear = new Set();

// dust motes drifting in the air (bright where light hits in reality; kept subtle)
function makeDust() {
  const n = 700;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  const vols = [[0.2, 2.9, FRONT + 0.2, 15.4], [3.1, 6.6, 13.5, 19.2], [3.1, 6.6, FRONT + 0.2, 8.9]];
  for (let i = 0; i < n; i++) {
    const v = vols[i % vols.length];
    pos.set([v[0] + Math.random() * (v[1] - v[0]), FL + 0.2 + Math.random() * 2.7, -(v[2] + Math.random() * (v[3] - v[2]))], i * 3);
    seed[i] = Math.random() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, strength: { value: 0.5 }, pr: { value: pixelRatio } },
    vertexShader: `attribute float seed; uniform float time; uniform float pr; varying float vA;
      void main(){ vec3 p = position;
        p.x += sin(time*0.13 + seed)*0.25; p.y += sin(time*0.09 + seed*1.7)*0.2; p.z += cos(time*0.11 + seed*0.7)*0.25;
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = pr * 9.0 / -mv.z; vA = 0.5 + 0.5*sin(time*0.7 + seed*3.0); }`,
    fragmentShader: `uniform float strength; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0,0.93,0.8) * a * vA * strength, 1.0); }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  scene.add(p);
  return mat;
}
let dustMat;

// volumetric-looking sun beams through the front windows and kitchen skylight
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  uniforms: { time: { value: 0 }, strength: { value: 0 }, color: { value: new THREE.Color(0xffd9a0) } },
  vertexShader: `attribute float along; varying float vAlong; varying vec3 vW;
    void main(){ vAlong = along; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float time; uniform float strength; uniform vec3 color; varying float vAlong; varying vec3 vW;
    void main(){ float n = 0.75 + 0.25*sin(vW.x*3.1 + vW.z*2.3 + time*0.4) * sin(vW.y*4.0 - time*0.3);
      float a = strength * pow(1.0 - vAlong, 1.6) * n;
      gl_FragColor = vec4(color * a, 1.0); }`,
});
const beams = new THREE.Group();
scene.add(beams);
function rebuildBeams(dir) {
  beams.clear();
  if (dir.y > -0.02) return;
  const rects = [
    [[1.62, FL + 0.47, FRONT], [2.78, FL + 0.47, FRONT], [2.78, FL + 2.33, FRONT], [1.62, FL + 2.33, FRONT]],
    [[3.62, FL + 0.92, FRONT], [6.08, FL + 0.92, FRONT], [6.08, FL + 2.33, FRONT], [3.62, FL + 2.33, FRONT]],
    [[4.92, CH, 17.06], [6.18, CH, 17.06], [6.18, CH, 17.94], [4.92, CH, 17.94]],
  ];
  for (const r of rects) {
    const near = r.map(([x, y, d]) => V(x, y, d));
    const far = near.map((p) => {
      const t = Math.min(7, (p.y - FL) / -dir.y);
      return p.clone().addScaledVector(dir, t);
    });
    const pos = [], al = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const q = [near[i], near[j], far[j], near[i], far[j], far[i]];
      const a = [0, 0, 1, 0, 1, 1];
      q.forEach((v, k) => { pos.push(v.x, v.y, v.z); al.push(a[k]); });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('along', new THREE.Float32BufferAttribute(al, 1));
    const m = new THREE.Mesh(g, beamMat);
    m.frustumCulled = false;
    m.renderOrder = 5;
    beams.add(m);
  }
}

// ---------------- time of day ----------------
const PRESETS = {
  day: { gain: 0.42, elev: 52, azim: -28, turbidity: 5, rayleigh: 1.1, mie: 0.004, sun: 0xfff1de, sunI: 3.4, hemi: 0.55, exposure: 0.9, fog: 0xc9d6e2, beam: 0.05, dust: 0.35, emissive: 0.25, stars: 0, label: 'Day' },
  golden: { gain: 0.55, elev: 7, azim: -14, turbidity: 9, rayleigh: 2.6, mie: 0.008, sun: 0xffa55c, sunI: 3.2, hemi: 0.35, exposure: 0.95, fog: 0xe0b89a, beam: 0.16, dust: 0.9, emissive: 1.0, stars: 0, label: 'Golden hour' },
  night: { gain: 1.4, elev: -3.5, azim: 150, turbidity: 2, rayleigh: 0.6, mie: 0.003, sun: 0x8fa8d8, sunI: 0.25, hemi: 0.08, exposure: 0.72, fog: 0x1b2230, beam: 0, dust: 0.12, emissive: 1.3, stars: 0.9, label: 'Night' },
};
let tod = 'golden';
const todState = { k: 0 };
function applyTime(name, animate = true) {
  tod = name;
  const p = PRESETS[name];
  const phi = THREE.MathUtils.degToRad(90 - p.elev), theta = THREE.MathUtils.degToRad(p.azim);
  const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  for (const s of [sky, envSky]) {
    const u = s.material.uniforms;
    u.turbidity.value = p.turbidity;
    u.rayleigh.value = p.rayleigh;
    u.mieCoefficient.value = p.mie;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(sunPos);
    u.skyGain.value = p.gain;
  }
  // the moon lights the night scene from high above
  const lightDir = name === 'night' ? new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(-40)) : sunPos;
  sun.position.copy(sun.target.position).addScaledVector(lightDir, 50);
  sun.color.set(p.sun);
  sun.intensity = p.sunI;
  hemi.intensity = p.hemi;
  hemi.color.set(name === 'night' ? 0x3a4a70 : 0xcfe0ff);
  renderer.toneMappingExposure = p.exposure;
  scene.fog = new THREE.FogExp2(p.fog, name === 'night' ? 0.008 : 0.0035);
  starMat.opacity = p.stars;
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0, 0.1, 500);
  scene.environment = envRT.texture;
  if (name === 'night') {
    // keep the reflections from going pitch black
    scene.environment = envRT.texture;
  }
  rebuildBeams(sunPos.clone().negate());
  beamMat.uniforms.strength.value = p.beam;
  beamMat.uniforms.color.value.set(name === 'golden' ? 0xffc27a : 0xfff0d8);
  if (dustMat) dustMat.uniforms.strength.value = p.dust;
  // interior + fixture lights
  const key = name;
  for (const l of world.lights) l.light.intensity = l[key] * (name === 'night' ? 1.2 : 2.2);
  for (const l of world.windowLights) l.intensity = name === 'day' ? 4 : name === 'golden' ? 2 : 0;
  const e = p.emissive;
  M.downlight.emissiveIntensity = 0.6 + e * 2.2;
  M.bulb.emissiveIntensity = 0.8 + e * 3;
  M.globe.emissiveIntensity = 0.3 + e * 1.4;
  M.ledStrip.emissiveIntensity = e * 3;
  M.shade.emissiveIntensity = 0.1 + e * 0.8;
  M.headlight.emissiveIntensity = 0.2;
  for (const m of world.nightWindows) m.emissiveIntensity = m.userData.on ? (name === 'night' ? 1.6 : name === 'golden' ? 0.35 : 0) : 0;
  bloom.strength = name === 'night' ? 0.42 : 0.3;
  audio.setNight(name === 'night');
  document.querySelectorAll('[data-time]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.time === name));
  if (animate) { audio.lightSwitch(); flash(); }
}

function flash() {
  const f = $('#flash');
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}

// ---------------- modes ----------------
let mode = 'intro'; // intro | tour | walk | orbit
const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(W / 2, 1, -11);
controls.minDistance = 5;
controls.maxDistance = 70;
controls.maxPolarAngle = 1.48;
controls.autoRotateSpeed = 0.5;
controls.addEventListener('start', () => { controls.autoRotate = false; });

let camAnim = null; // { from, to, fromT, toT, t, dur, done }
function flyTo(pos, target, dur = 2.2, done) {
  camAnim = { fromP: camera.position.clone(), toP: pos.clone(), fromT: controls.target.clone(), toT: target.clone(), t: 0, dur, done };
}

function setMode(m, opts = {}) {
  const prev = mode;
  mode = m;
  document.body.dataset.mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === m));
  controls.enabled = m === 'orbit';
  world.roofGroup.visible = m !== 'orbit';
  fixtures(m !== 'orbit');
  if (m !== 'walk' && document.pointerLockElement) document.exitPointerLock();
  if (m === 'orbit') {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    controls.target.copy(camera.position).addScaledVector(dir, 4);
    const top = opts.plan;
    flyTo(top ? V(W / 2, 30, 10.7) : V(W / 2 + 6, 24, 0), V(W / 2, 0, top ? 10.69 : 8.6), 2.6, () => { controls.autoRotate = !top && !reduceMotion; });
    camera.fov = 45;
    camera.updateProjectionMatrix();
  } else {
    camAnim = null;
    camera.fov = m === 'tour' ? 58 : 64;
    camera.updateProjectionMatrix();
  }
  if (m === 'walk') {
    walk.x = camera.position.x;
    walk.d = -camera.position.z;
    if (prev === 'orbit' || prev === 'intro' || opts.at) {
      const at = opts.at || { x: 3.4, d: -5.5, yaw: 0 };
      walk.x = at.x; walk.d = at.d; walk.yaw = at.yaw ?? 0; walk.pitch = -0.05;
    } else {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      walk.yaw = e.y; walk.pitch = clamp(e.x, -1.2, 1.2);
    }
    walk.y = floorAt(walk.x, walk.d) + 1.62;
    showHelp(true);
  } else showHelp(false);
  if (m === 'tour') tour.playing = true;
  document.body.classList.toggle('finale', m === 'orbit' && !!opts.finale);
  updateTourUI();
  if (prev !== m && prev !== 'intro') audio.whoosh(0.06, 1.1);
}

function fixtures(v) {
  for (const f of world.fans) f.rot.parent.visible = v;
}

// ---------------- walking ----------------
const walk = { x: 3.4, d: -5, y: 1.62, yaw: 0, pitch: 0, vx: 0, vd: 0, bob: 0, stepAcc: 0 };
const keys = new Set();
const joy = { x: 0, y: 0, active: false };
const R = 0.22;
function blocked(x, d) {
  if (d > -0.3 && (x < 0.1 + R || x > W - 0.1 - R)) return true;
  if (d > L - 0.12 - R || d < -11 || x < -40 || x > 46) return true;
  for (const c of world.colliders) {
    const cx = clamp(x, c.x0, c.x1), cd = clamp(d, c.d0, c.d1);
    if ((x - cx) ** 2 + (d - cd) ** 2 < R * R) return true;
  }
  return false;
}
function updateWalk(dt) {
  let f = 0, s = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (joy.active) { f += -joy.y; s += joy.x; }
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = run ? 3.0 : 1.55;
  const len = Math.hypot(f, s);
  if (len > 1) { f /= len; s /= len; }
  // plan-space forward: yaw 0 looks toward +d
  const fx = -Math.sin(walk.yaw), fd = Math.cos(walk.yaw);
  const rx = Math.cos(walk.yaw), rd = Math.sin(walk.yaw);
  const tx = (fx * f + rx * s) * speed, td = (fd * f + rd * s) * speed;
  const k = 1 - Math.exp(-dt * 10);
  walk.vx += (tx - walk.vx) * k;
  walk.vd += (td - walk.vd) * k;
  const nx = walk.x + walk.vx * dt, nd = walk.d + walk.vd * dt;
  if (!blocked(nx, walk.d)) walk.x = nx; else walk.vx = 0;
  if (!blocked(walk.x, nd)) walk.d = nd; else walk.vd = 0;
  const v = Math.hypot(walk.vx, walk.vd);
  walk.bob += v * dt * 5.2;
  walk.stepAcc += v * dt;
  if (walk.stepAcc > (run ? 0.85 : 0.68)) {
    walk.stepAcc = 0;
    const r = roomAt(walk.x, walk.d);
    audio.footstep(r?.surface ?? 'outdoor');
  }
  const targetY = floorAt(walk.x, walk.d) + 1.62;
  walk.y += (targetY - walk.y) * (1 - Math.exp(-dt * 8));
  const bobAmt = reduceMotion ? 0 : Math.min(1, v / 1.5) * 0.025;
  camera.position.set(walk.x, walk.y + Math.sin(walk.bob * 2) * bobAmt, -walk.d);
  // with rotation.y = yaw the camera faces (-sin yaw, 0, -cos yaw): yaw 0 looks toward +d
  camera.rotation.set(walk.pitch, walk.yaw, 0);
}

// ---------------- guided tour ----------------
const tour = { i: -1, seg: null, t: 0, hold: 0, playing: true, look: new THREE.Vector3(), base: null };
function eye(p) {
  const [x, y, d] = p;
  return V(x, floorAt(x, d) + y, d);
}
function goStop(i, instant = false) {
  if (i < 0 || i >= STOPS.length) return;
  tour.i = i;
  const s = STOPS[i];
  if (s.dollhouse) {
    showCaption(s, i);
    speak(s);
    setMode('orbit', { finale: true });
    tour.i = i;
    updateTourUI();
    return;
  }
  const start = camera.position.clone();
  const pts = [start, ...(s.via || []).map(([x, d]) => eye([x, 1.6, d])), eye(s.pos)];
  // drop duplicate points that would break the curve
  const clean = pts.filter((p, k) => k === 0 || p.distanceTo(pts[k - 1]) > 0.05);
  if (clean.length < 2) clean.push(eye(s.pos).add(new THREE.Vector3(0, 0.001, 0)));
  const curve = new THREE.CatmullRomCurve3(clean, false, 'centripetal', 0.5);
  const len = curve.getLength();
  const outside = s.pos[2] < 1 || i === 0;
  const dur = instant ? 0.01 : clamp(len / (outside ? 2.6 : 1.05), 2.2, 16);
  const lookFrom = tour.look.lengthSq() ? tour.look.clone() : eye(s.look);
  tour.seg = { curve, dur, lookFrom, lookTo: eye(s.look), len, walked: 0 };
  tour.t = 0;
  tour.hold = 0;
  showCaption(s, i);
  updateTourUI();
}
function updateTour(dt, time) {
  if (!tour.seg) return;
  const s = STOPS[tour.i];
  const seg = tour.seg;
  if (tour.t < 1) {
    tour.t = Math.min(1, tour.t + dt / seg.dur);
    const e = ease(tour.t);
    const p = seg.curve.getPointAt(e);
    const ahead = seg.curve.getPointAt(Math.min(1, e + 0.08));
    const dir = ahead.clone().sub(p);
    dir.y = 0;
    const travel = dir.lengthSq() > 1e-6 ? p.clone().add(dir.normalize().multiplyScalar(3)).setY(p.y - 0.1) : seg.lookTo;
    const w1 = smooth(0, 0.22, e), w2 = smooth(0.55, 1, e);
    const look = seg.lookFrom.clone().lerp(travel, w1).lerp(seg.lookTo, w2);
    tour.look.copy(look);
    const prev = camera.position.clone();
    camera.position.copy(p);
    // footsteps while gliding indoors
    seg.walked += prev.distanceTo(p);
    if (seg.walked > 0.72 && p.y < 3) {
      seg.walked = 0;
      const r = roomAt(p.x, -p.z);
      audio.footstep(r?.surface ?? 'outdoor');
    }
    camera.lookAt(look);
    if (tour.t >= 1) {
      audio.chime();
      speak(s);
    }
  } else {
    // subtle handheld drift while holding at a stop
    tour.hold += dt;
    const base = eye(s.pos);
    const k = reduceMotion ? 0 : 1;
    camera.position.set(base.x + Math.sin(time * 0.31) * 0.04 * k, base.y + Math.sin(time * 0.53) * 0.012 * k, base.z + Math.cos(time * 0.27) * 0.04 * k);
    const look = tour.seg.lookTo.clone();
    look.x += Math.sin(time * 0.17) * 0.25 * k;
    look.y += Math.sin(time * 0.23) * 0.08 * k;
    tour.look.copy(look);
    camera.lookAt(look);
    const holdFor = s.hold ?? 6;
    $('#tourProgress').style.transform = `scaleX(${clamp(tour.hold / holdFor, 0, 1)})`;
    if (tour.playing && tour.hold > holdFor) goStop(tour.i + 1);
  }
}

// ---------------- narration ----------------
let narrate = false;
function speak(s) {
  if (!narrate || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${s.title}. ${s.text}`);
    u.rate = 0.97;
    u.pitch = 1;
    u.volume = audio.muted ? 0 : 0.9;
    speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}

// ---------------- UI ----------------
function showCaption(s, i) {
  const c = $('#caption');
  c.classList.remove('in');
  void c.offsetWidth;
  $('#capIndex').textContent = `${String(i + 1).padStart(2, '0')} / ${String(STOPS.length).padStart(2, '0')}`;
  $('#capTitle').textContent = s.title;
  $('#capText').textContent = s.text;
  $('#capMeta').textContent = s.meta || '';
  c.classList.add('in');
  $('#tourProgress').style.transform = 'scaleX(0)';
}
function updateTourUI() {
  $('#playBtn').setAttribute('aria-label', tour.playing ? 'Pause tour' : 'Play tour');
  $('#playBtn').dataset.state = tour.playing ? 'playing' : 'paused';
  $('#prevBtn').disabled = tour.i <= 0;
  $('#nextBtn').disabled = tour.i >= STOPS.length - 1;
  document.querySelectorAll('#stops button').forEach((b, k) => b.setAttribute('aria-current', k === tour.i ? 'true' : 'false'));
}
function showHelp(v) {
  $('#walkHelp').hidden = !v;
}

let lastRoom = null;
let envTarget = 1;
function updateRoomHUD() {
  const x = camera.position.x, d = -camera.position.z;
  let r = roomAt(x, d);
  if (mode === 'orbit') r = { name: 'Dollhouse', size: '6.7 × 21.3 m lot · 22 × 70 ft', id: 'doll' };
  const id = r ? r.id : 'none';
  if (id !== lastRoom) {
    lastRoom = id;
    const el = $('#roomName');
    el.classList.remove('swap');
    void el.offsetWidth;
    el.textContent = r ? r.name : 'Type 2A';
    el.classList.add('swap');
    $('#roomSize').textContent = r?.size || '';
  }
  // outside-ness for the ambience mix
  const inside = x > 0 && x < W && d > FRONT && d < BACK && mode !== 'orbit';
  audio.setOutside(inside ? 0.12 : 1);
  envTarget = inside ? 0.4 : 1;
  scene.environmentIntensity += (envTarget - scene.environmentIntensity) * 0.05;
  hemi.intensity = PRESETS[tod].hemi * (inside ? 0.45 : 1);
}

// minimap: the brochure plan, coloured the same way
const mm = $('#minimap');
const mmc = mm.getContext('2d');
const MM = { pad: 6, scale: 0 };
function sizeMinimap() {
  const h = mm.clientHeight, w = mm.clientWidth;
  const dpr = Math.min(2, devicePixelRatio);
  mm.width = w * dpr;
  mm.height = h * dpr;
  MM.scale = Math.min((w - MM.pad * 2) / W, (h - MM.pad * 2) / L) * dpr;
  MM.ox = (mm.width - W * MM.scale) / 2;
  MM.oy = (mm.height - L * MM.scale) / 2;
}
function mmP(x, d) { return [MM.ox + x * MM.scale, MM.oy + (L - d) * MM.scale]; }
function drawMinimap() {
  const g = mmc;
  g.clearRect(0, 0, mm.width, mm.height);
  const s = MM.scale;
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(MM.ox, MM.oy, W * s, L * s);
  for (const r of ROOMS) {
    for (const [x0, x1, d0, d1] of r.rects) {
      const [px, py] = mmP(x0, d1);
      g.fillStyle = r.color;
      g.globalAlpha = r.outside ? 0.35 : 0.85;
      g.fillRect(px, py, (x1 - x0) * s, (d1 - d0) * s);
    }
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#1c1916';
  g.lineWidth = Math.max(1, s * 0.12);
  const walls = [[0, FRONT, 0, BACK], [W, FRONT, W, BACK], [0, FRONT, 1.6, FRONT], [2.8, FRONT, W, FRONT], [0, BACK, 5.1, BACK], [5.95, BACK, W, BACK],
    [3, FRONT, 3, 8.05], [3, 8.9, 3, 11.2], [3, 12.05, 3, 13.4], [3, 15.6, 3, BACK], [3, 9, 4.5, 9], [5.25, 9, W, 9], [3, 10.5, W, 10.5], [3, 13.4, W, 13.4],
    [0, 15.6, 2.05, 15.6], [3, 16.3, 3.2, 16.3], [3.9, 16.3, 4.7, 16.3], [4.7, 16.3, 4.7, BACK]];
  g.beginPath();
  for (const [x0, d0, x1, d1] of walls) { g.moveTo(...mmP(x0, d0)); g.lineTo(...mmP(x1, d1)); }
  g.stroke();
  g.font = `${Math.round(s * 0.34)}px Jost, sans-serif`;
  g.fillStyle = 'rgba(20,18,16,0.85)';
  g.textAlign = 'center';
  for (const r of ROOMS) {
    const [x0, x1, d0, d1] = r.rects[0];
    const [px, py] = mmP((x0 + x1) / 2, (d0 + d1) / 2);
    g.fillText(r.short.toUpperCase(), px, py + s * 0.12);
  }
  // viewer
  const x = camera.position.x, d = -camera.position.z;
  if (mode !== 'orbit' && d > -3 && d < L + 1) {
    const [px, py] = mmP(clamp(x, -0.3, W + 0.3), clamp(d, -0.5, L));
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const a = Math.atan2(dir.x, dir.z); // screen: up = +d = -z
    g.save();
    g.translate(px, py);
    g.rotate(-a + Math.PI);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, s * 2.2);
    grd.addColorStop(0, 'rgba(201,163,107,0.55)');
    grd.addColorStop(1, 'rgba(201,163,107,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, s * 2.2, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
    g.fillStyle = '#c9a36b';
    g.strokeStyle = '#1c1916';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 0, s * 0.28, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }
}
mm.addEventListener('click', (e) => {
  const rect = mm.getBoundingClientRect();
  const dpr = mm.width / rect.width;
  const px = (e.clientX - rect.left) * dpr, py = (e.clientY - rect.top) * dpr;
  const x = (px - MM.ox) / MM.scale, d = L - (py - MM.oy) / MM.scale;
  const r = roomAt(x, d);
  if (!r) return;
  audio.click();
  teleport(x, d);
});

function teleport(x, d, yaw) {
  // find a free spot near the requested point
  let best = null;
  for (let rad = 0; rad < 2 && !best; rad += 0.15) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const tx = x + Math.cos(a) * rad, td = d + Math.sin(a) * rad;
      if (!blocked(tx, td) && roomAt(tx, td) === roomAt(x, d)) { best = [tx, td]; break; }
    }
  }
  if (!best) return;
  fade(() => {
    setMode('walk', { at: { x: best[0], d: best[1], yaw: yaw ?? walk.yaw } });
  });
}

let fading = null;
function fade(mid) {
  audio.whoosh(0.07, 0.9, 1800);
  fading = { t: 0, mid, done: false };
}
function updateFade(dt) {
  if (!fading) return;
  fading.t += dt / 0.8;
  if (fading.t >= 0.5 && !fading.done) { fading.done = true; fading.mid?.(); }
  grade.uniforms.fade.value = Math.sin(Math.min(1, fading.t) * Math.PI);
  if (fading.t >= 1) { fading = null; grade.uniforms.fade.value = 0; }
}

// room labels in dollhouse mode
const labelsEl = $('#labels');
const labels = ROOMS.filter((r) => !['yard'].includes(r.id)).map((r) => {
  const b = document.createElement('button');
  b.className = 'label';
  b.type = 'button';
  b.innerHTML = `<span class="dot" style="background:${r.color}"></span>${r.name}`;
  const [x0, x1, d0, d1] = r.rects[0];
  const cx = (x0 + x1) / 2, cd = (d0 + d1) / 2;
  b.addEventListener('click', () => {
    audio.click();
    const yaw = r.id === 'living' ? Math.PI : r.id === 'porch' ? 0 : 0;
    teleport(cx, cd, yaw);
  });
  labelsEl.appendChild(b);
  return { el: b, p: V(cx, FL + 1.6, cd) };
});
function updateLabels() {
  const show = mode === 'orbit' && !camAnim;
  labelsEl.classList.toggle('on', show);
  if (!show) return;
  const v = new THREE.Vector3();
  for (const l of labels) {
    v.copy(l.p).project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    l.el.style.opacity = vis ? 1 : 0;
    l.el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px)`;
  }
}

// stop list
STOPS.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s.title;
  b.addEventListener('click', () => {
    audio.click();
    if (mode !== 'tour') { setMode('tour'); }
    goStop(i);
  });
  $('#stops').appendChild(b);
});

// ---------------- input ----------------
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input')) return;
  keys.add(e.code);
  if (mode === 'intro') return;
  if (e.code === 'Digit1') { setMode('tour'); goStop(Math.max(0, tour.i)); }
  if (e.code === 'Digit2') setMode('walk');
  if (e.code === 'Digit3') setMode('orbit');
  if (e.code === 'KeyT') { const order = ['day', 'golden', 'night']; applyTime(order[(order.indexOf(tod) + 1) % 3]); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyF') toggleFullscreen();
  if (mode === 'tour') {
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') goStop(tour.i + 1);
    if (e.code === 'ArrowLeft') goStop(tour.i - 1);
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (mode === 'tour' && e.pointerType === 'mouse') {
    // grabbing the view during the tour hands control to the visitor
  }
  if (mode !== 'walk') return;
  if (e.pointerType === 'mouse' && !isTouch) {
    canvas.requestPointerLock?.()?.catch?.(() => {});
  }
  dragging = true;
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (mode !== 'walk') return;
  if (document.pointerLockElement === canvas) {
    walk.yaw -= e.movementX * 0.0022;
    walk.pitch = clamp(walk.pitch - e.movementY * 0.0022, -1.25, 1.25);
  } else if (dragging && joy.pointer !== e.pointerId) {
    walk.yaw += (e.clientX - lastX) * 0.004;
    walk.pitch = clamp(walk.pitch + (e.clientY - lastY) * 0.004, -1.25, 1.25);
    lastX = e.clientX; lastY = e.clientY;
  }
});
// virtual joystick
const joyEl = $('#joystick'), knob = $('#knob');
joyEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  joy.active = true;
  joy.pointer = e.pointerId;
  joyEl.setPointerCapture(e.pointerId);
  moveJoy(e);
});
joyEl.addEventListener('pointermove', (e) => { if (joy.active && e.pointerId === joy.pointer) moveJoy(e); });
const endJoy = () => { joy.active = false; joy.x = joy.y = 0; joy.pointer = null; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  joy.x = x; joy.y = y;
  knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
}

function togglePlay() {
  tour.playing = !tour.playing;
  audio.click();
  updateTourUI();
}
$('#playBtn').addEventListener('click', togglePlay);
$('#prevBtn').addEventListener('click', () => { audio.click(); goStop(tour.i - 1); });
$('#nextBtn').addEventListener('click', () => { audio.click(); goStop(tour.i + 1); });
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  audio.click();
  const m = b.dataset.mode;
  if (m === 'tour') { setMode('tour'); goStop(tour.i < 0 || tour.i >= STOPS.length - 1 ? 0 : tour.i); }
  else setMode(m);
}));
document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => applyTime(b.dataset.time)));
$('#planBtn').addEventListener('click', () => { audio.click(); setMode('orbit', { plan: true }); });

function toggleMute() {
  audio.setMuted(!audio.muted);
  $('#muteBtn').setAttribute('aria-pressed', audio.muted);
  $('#muteBtn').setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
  if (audio.muted && 'speechSynthesis' in window) speechSynthesis.cancel();
}
$('#muteBtn').addEventListener('click', toggleMute);
$('#settingsBtn').addEventListener('click', () => {
  const p = $('#settings');
  p.hidden = !p.hidden;
  $('#settingsBtn').setAttribute('aria-expanded', !p.hidden);
  audio.click();
});
$('#musicVol').addEventListener('input', (e) => audio.setMusic(+e.target.value));
$('#sfxVol').addEventListener('input', (e) => audio.setSfx(+e.target.value));
$('#narration').addEventListener('change', (e) => { narrate = e.target.checked; if (!narrate && 'speechSynthesis' in window) speechSynthesis.cancel(); });
$('#aoToggle').addEventListener('change', (e) => { gtao.enabled = e.target.checked; autoQuality.locked = true; });
$('#fullBtn').addEventListener('click', toggleFullscreen);
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
  } catch { /* not allowed here */ }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  gtao.setSize(innerWidth, innerHeight);
  grade.uniforms.res.value.set(innerWidth, innerHeight);
  sizeMinimap();
});

// ---------------- adaptive quality ----------------
const autoQuality = { acc: 0, frames: 0, locked: false, warm: 4 };
function adaptQuality(dt) {
  if (autoQuality.locked || mode === 'intro') return;
  if (autoQuality.warm > 0) { autoQuality.warm -= dt; return; }
  autoQuality.acc += dt;
  autoQuality.frames++;
  if (autoQuality.acc < 2.5) return;
  const fps = autoQuality.frames / autoQuality.acc;
  autoQuality.acc = 0; autoQuality.frames = 0;
  if (fps < 38) {
    if (gtao.enabled) { gtao.enabled = false; $('#aoToggle').checked = false; }
    else if (pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.5); renderer.setPixelRatio(pixelRatio); composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight); }
    else if (bloom.enabled) bloom.enabled = false;
    else autoQuality.locked = true;
  }
}

// ---------------- doors ----------------
function updateDoors(dt) {
  const x = camera.position.x, d = -camera.position.z;
  for (const dr of world.doors) {
    const near = mode !== 'orbit' && Math.hypot(x - dr.x, d - dr.d) < dr.range;
    const want = dr.gate ? (mode === 'orbit' ? 0 : near ? 1 : 0) : near ? 1 : mode === 'orbit' ? 1 : 0;
    if (want !== dr.target) {
      dr.target = want;
      if (mode !== 'orbit' && mode !== 'intro') {
        if (dr.sound === 'gate') { if (dr.name === 'Gate L') audio.whoosh(0.05, 1.6, 600); }
        else if (Math.hypot(x - dr.x, d - dr.d) < 3) audio.door(want === 1);
      }
    }
    const speed = dr.gate ? 0.45 : 1.6;
    dr.open += clamp(dr.target - dr.open, -dt * speed, dt * speed);
    dr.pivot.rotation.y = dr.maxAngle * ease(clamp(dr.open, 0, 1));
  }
}

// ---------------- loop ----------------
const clock = new THREE.Clock();
let introT = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (mode === 'intro') {
    introT += dt;
    const a = introT * 0.05 + 2.4;
    camera.position.set(W / 2 + Math.sin(a) * 26, 11 + Math.sin(introT * 0.1) * 1.5, -6 - Math.cos(a) * 26);
    camera.lookAt(W / 2, 1.5, -8);
  } else if (mode === 'tour') updateTour(dt, t);
  else if (mode === 'walk') updateWalk(dt);
  else if (mode === 'orbit') {
    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
      const e = ease(camAnim.t);
      camera.position.lerpVectors(camAnim.fromP, camAnim.toP, e);
      controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
      camera.lookAt(controls.target);
      if (camAnim.t >= 1) { const d = camAnim.done; camAnim = null; d?.(); }
    } else controls.update();
  }
  if (world) {
    updateDoors(dt);
    for (const f of world.fans) f.rot.rotation.y += f.speed * dt;
    for (const a of world.anim) a(dt, t);
    updateRoomHUD();
    updateLabels();
    drawMinimap();
    adaptQuality(dt);
  }
  updateFade(dt);
  beamMat.uniforms.time.value = t;
  if (dustMat) dustMat.uniforms.time.value = t;
  grade.uniforms.time.value = t;
  composer.render(dt);
  requestAnimationFrame(frame);
}

// ---------------- boot ----------------
async function boot() {
  const bar = $('#loadBar'), status = $('#loadStatus');
  const step = async (pct, msg) => { bar.style.transform = `scaleX(${pct})`; status.textContent = msg; await nextFrame(); };
  await step(0.05, 'Mixing plaster and cutting tiles');
  M = makeMaterials();
  await step(0.45, 'Raising walls and hanging doors');
  world = buildWorld(scene, M, renderer);
  await step(0.7, 'Furnishing rooms');
  dustMat = makeDust();
  applyTime('golden', false);
  await step(0.85, 'Warming up the lights');
  try { await renderer.compileAsync(scene, camera); } catch { /* older drivers */ }
  sizeMinimap();
  requestAnimationFrame(frame);
  await step(1, 'Ready');
  document.body.classList.add('ready');
  $('#startTour').disabled = false;
  $('#startWalk').disabled = false;
  $('#startDoll').disabled = false;
}

function begin(m) {
  audio.start();
  audio.setMusic(+$('#musicVol').value);
  audio.setSfx(+$('#sfxVol').value);
  document.body.classList.add('started');
  $('#intro').setAttribute('aria-hidden', 'true');
  audio.whoosh(0.09, 2.2, 2200);
  if (m === 'tour') {
    camera.position.copy(V(-16, 10, -24));
    tour.look.copy(V(3.4, 2, 4));
    setMode('tour');
    goStop(0);
  } else if (m === 'walk') setMode('walk');
  else setMode('orbit');
}
$('#startTour').addEventListener('click', () => begin('tour'));
$('#startWalk').addEventListener('click', () => begin('walk'));
$('#startDoll').addEventListener('click', () => begin('orbit'));

// intro line art in the brochure's gold wave style
(function introArt() {
  const c = $('#introArt');
  const g = c.getContext('2d');
  let w, h;
  const size = () => { const d = Math.min(2, devicePixelRatio); w = c.width = c.clientWidth * d; h = c.height = c.clientHeight * d; };
  size();
  addEventListener('resize', size);
  const draw = (tm) => {
    if (document.body.classList.contains('started')) return;
    const t = reduceMotion ? 0 : tm / 1000;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(201,163,107,${0.06 + (i % 7) * 0.025})`;
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const u = x / w;
        const y = h * 0.55 + Math.sin(u * 5 + i * 0.045 + t * 0.25) * h * 0.18 * Math.sin(u * 2.2 + t * 0.1 + i * 0.02) + (i - 35) * h * 0.004;
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();

// small handle for scripted demos / debugging from the console
window.houseTour = {
  goStop, setMode, applyTime, teleport,
  get world() { return world; },
  get mode() { return mode; },
  snap() {
    updateDoors(0);
    for (const dr of world.doors) dr.open = dr.target;
    updateDoors(0);
    scene.environmentIntensity = envTarget;
    if (camAnim) camAnim.t = 0.999;
  },
};

boot().catch((err) => {
  console.error(err);
  $('#loadStatus').textContent = 'WebGL failed to start. Try another browser or enable hardware acceleration.';
});
