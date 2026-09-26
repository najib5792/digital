/*
 * Kisah Nabi Musa AS & Firaun — 60-second 2D sticker animation.
 *
 * Every character, prop and set piece is a sticker cut from the provided
 * sheet (see tools/extract_assets.py); skies, dunes, water, interiors and
 * particles are painted procedurally in the same bold-outline style.
 *
 * RULE: Nabi Musa AS is only ever drawn from behind / back-three-quarter,
 * using sprites whose head-cloth fully hides the face. No sprite is ever
 * mirrored or rotated toward the camera, and there are no close-ups.
 */
(function (global) {
  'use strict';

  const W = 1920, H = 1080;

  // ---------------------------------------------------------------- timeline
  // Durations (seconds) sum to 60. Keep in sync with tools/make_audio.py.
  const SCENES = [
    { id: 'mesir',      dur: 5.0, text: 'Pada zaman dahulu, Mesir diperintah oleh seorang Firaun yang sangat zalim.' },
    { id: 'penindasan', dur: 4.5, text: 'Bani Israel hidup dalam penindasan dan ketakutan di bawah pemerintahannya.' },
    { id: 'bayi',       dur: 5.5, text: 'Ketika Nabi Musa masih bayi, ibunya menghanyutkannya di Sungai Nil demi menyelamatkannya.' },
    { id: 'dewasa',     dur: 4.5, text: 'Musa membesar, dan kemudian Allah memilih baginda sebagai seorang nabi.', trans: 'glow' },
    { id: 'semak',      dur: 5.0, text: 'Allah memerintahkan Nabi Musa untuk menyampaikan kebenaran kepada Firaun.', trans: 'dip' },
    { id: 'istana',     dur: 5.5, text: 'Nabi Musa datang menghadap Firaun dan menyerunya supaya meninggalkan kesombongan dan kezaliman.' },
    { id: 'menolak',    dur: 4.0, text: 'Namun Firaun tetap angkuh dan menolak seruan Nabi Musa.', trans: 'cut' },
    { id: 'tanda',      dur: 5.0, text: 'Pelbagai tanda diperlihatkan, tetapi Firaun masih enggan tunduk.' },
    { id: 'keluar',     dur: 4.5, text: 'Akhirnya, Nabi Musa membawa Bani Israel keluar meninggalkan Mesir.', trans: 'dip' },
    { id: 'kejar',      dur: 4.5, text: 'Firaun dan tenteranya mengejar mereka sehingga ke tepi laut.' },
    { id: 'laut',       dur: 5.5, text: 'Dengan izin Allah, laut terbelah dan terbukalah jalan untuk Nabi Musa dan pengikutnya.' },
    { id: 'akhir',      dur: 6.5, text: 'Nabi Musa dan Bani Israel terselamat. Kisah ini mengingatkan kita bahawa kesombongan dan kezaliman tidak akan kekal selamanya.' },
  ];
  let acc = 0;
  for (const s of SCENES) { s.start = acc; acc += s.dur; }
  const DURATION = acc;
  const TR = 0.6; // cross-transition length

  const ASSETS = [
    'boat', 'burning_bush', 'cave', 'chariot', 'cloud_dark', 'cloud_grey', 'cloud_white', 'cobra',
    'crowd', 'dry_land', 'dry_mountain', 'fire', 'frog', 'guard_a', 'guard_b', 'guard_c',
    'locust_green', 'locusts', 'mother_baby', 'musa_lead', 'musa_stand_body', 'musa_walk',
    'night_moon', 'palace_nile', 'palms_bush', 'palms_pair', 'pharaoh_point', 'pharaoh_throne',
    'pyramids_tent', 'reeds', 'rocks', 'rocks_flat', 'ruins', 'sandstorm', 'sea_parted', 'smoke_city',
    'soldier', 'staff', 'storm', 'sun', 'swarm_dark', 'swarm_dust', 'temple', 'wave', 'well',
    'women_back', 'workers',
  ];
  const IMG = {};

  function load(base) {
    base = base || 'assets/';
    return Promise.all(ASSETS.map((n) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { IMG[n] = im; res(); };
      im.onerror = () => rej(new Error('missing asset ' + n));
      im.src = base + n + '.png';
    })));
  }

  // ---------------------------------------------------------------- maths
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sat = (t) => clamp(t, 0, 1);
  const ease = (t) => { t = sat(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - sat(t), 3);
  const easeIn = (t) => Math.pow(sat(t), 2.2);
  const range = (t, a, b) => sat((t - a) / (b - a));
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TAU = Math.PI * 2;

  const INK = '#4a2f1a';

  // ---------------------------------------------------------------- drawing
  /** Draw sticker `name` with its bottom-centre at (x, y), `h` px tall. */
  function spr(c, name, x, y, h, o) {
    o = o || {};
    const im = IMG[name];
    const w = im.width * (h / im.height);
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.skew) c.transform(1, 0, o.skew, 1, 0, 0);
    if (o.sx || o.sy) c.scale(o.sx || 1, o.sy || 1);
    if (o.flip) c.scale(-1, 1);
    if (o.a !== undefined) c.globalAlpha *= o.a;
    if (o.filter) c.filter = o.filter;
    c.drawImage(im, -w * (o.ax === undefined ? 0.5 : o.ax), -h * (o.ay === undefined ? 1 : o.ay), w, h);
    c.restore();
    return w;
  }

  function shadow(c, x, y, w, a) {
    c.save();
    c.globalAlpha *= (a === undefined ? 0.28 : a);
    c.fillStyle = '#3b2412';
    c.beginPath(); c.ellipse(x, y, w / 2, w / 9, 0, 0, TAU); c.fill();
    c.restore();
  }

  /**
   * Nabi Musa, standing, seen from behind. The staff is a separate sticker
   * so it can be raised (`raise` 0..1). Never flipped toward camera.
   */
  function musaStand(c, x, y, h, o) {
    o = o || {};
    const body = IMG.musa_stand_body;
    const s = h / 258;                 // body bbox height in the sprite
    const ox = x - 90 * s, oy = y - 273 * s;
    const bw = body.width * s, bh = body.height * s;
    const r = o.raise || 0;
    c.save();
    if (o.filter) c.filter = o.filter;
    if (o.a !== undefined) c.globalAlpha *= o.a;
    // gentle wind in the robe: shear around the feet
    c.translate(x, y);
    c.transform(1, 0, o.skew || 0, 1, 0, 0);
    c.translate(-x, -y);
    // staff (behind the hand)
    c.save();
    const px = ox + 153 * s, py = oy + 109 * s;
    c.translate(px, py - r * 95 * s);
    c.rotate(r * 0.16);
    c.translate(-px, -py);
    c.drawImage(IMG.staff, ox, oy, bw, bh);
    c.restore();
    if (o.glow) staffGlow(c, px + Math.sin(r * 0.16) * 100 * s, py - (r * 95 + 95) * s, 60 * s * o.glow, o.glow);
    c.drawImage(body, ox, oy, bw, bh);
    c.restore();
  }

  function staffGlow(c, x, y, rad, a) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, rad * 3);
    g.addColorStop(0, `rgba(255,248,220,${0.85 * a})`);
    g.addColorStop(0.3, `rgba(255,220,150,${0.35 * a})`);
    g.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = g;
    c.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
    c.restore();
  }

  function sky(c, stops, y0, y1) {
    const g = c.createLinearGradient(0, y0 === undefined ? 0 : y0, 0, y1 === undefined ? H : y1);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    c.fillStyle = g;
    c.fillRect(-W, -H, W * 3, H * 3);
  }

  /** Rolling dune band with a bold sticker outline on its crest. */
  function dunes(c, baseY, amp, fill, seed, o) {
    o = o || {};
    const x0 = -W * 0.8, x1 = W * 1.8, step = 24;
    c.beginPath();
    c.moveTo(x0, H * 2);
    for (let x = x0; x <= x1; x += step) {
      const y = baseY
        + Math.sin(x * 0.0021 + seed) * amp
        + Math.sin(x * 0.0053 + seed * 2.3) * amp * 0.45
        + Math.sin(x * 0.011 + seed * 5.1) * amp * 0.12;
      c.lineTo(x, y);
    }
    c.lineTo(x1, H * 2);
    c.closePath();
    if (Array.isArray(fill)) {
      const g = c.createLinearGradient(0, baseY - amp, 0, baseY + (o.depth || 300));
      fill.forEach((s, i) => g.addColorStop(i / (fill.length - 1), s));
      c.fillStyle = g;
    } else c.fillStyle = fill;
    c.fill();
    if (o.line !== false) {
      c.lineWidth = o.lw || 5;
      c.strokeStyle = o.line || INK;
      c.globalAlpha *= o.lineA === undefined ? 0.55 : o.lineA;
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  function withCam(c, cam, p, fn) {
    const z = 1 + (cam.z - 1) * p;
    c.save();
    c.translate(W / 2 + (cam.sx || 0), H / 2 + (cam.sy || 0));
    c.scale(z, z);
    c.translate(-W / 2 - cam.x * p, -H / 2 - cam.y * p);
    fn();
    c.restore();
  }

  function stars(c, t, n, a) {
    c.save();
    for (let i = 0; i < n; i++) {
      const x = rnd(i) * W * 1.4 - W * 0.2, y = rnd(i + 99) * H * 0.55;
      const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + rnd(i + 7) * 3) + i);
      c.globalAlpha = a * tw * (0.4 + rnd(i + 3) * 0.6);
      c.fillStyle = '#fff6d8';
      const r = 1 + rnd(i + 5) * 2.2;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.restore();
  }

  function motes(c, t, n, col, seed, speed, area) {
    area = area || [0, 0, W, H];
    c.save();
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const k = i + seed;
      const x = area[0] + ((rnd(k) * area[2] + t * speed * (0.5 + rnd(k + 1))) % area[2]);
      const y = area[1] + rnd(k + 2) * area[3] + Math.sin(t * 1.3 + k) * 12;
      c.globalAlpha = 0.25 + 0.5 * rnd(k + 4);
      c.beginPath(); c.arc(x, y, 1.5 + rnd(k + 3) * 3.5, 0, TAU); c.fill();
    }
    c.restore();
  }

  function glow(c, x, y, r, col, a) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col.replace('A', String(a)));
    g.addColorStop(1, col.replace('A', '0'));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }

  function vignette(c, a, col) {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, col || `rgba(40,20,5,${a})`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function water(c, y0, y1, t, cols, o) {
    o = o || {};
    const g = c.createLinearGradient(0, y0, 0, y1);
    cols.forEach((s, i) => g.addColorStop(i / (cols.length - 1), s));
    c.fillStyle = g;
    c.fillRect(-W, y0, W * 3, y1 - y0);
    // shimmer strokes
    c.save();
    c.strokeStyle = o.shine || 'rgba(255,255,255,0.55)';
    c.lineCap = 'round';
    const n = o.n || 60;
    for (let i = 0; i < n; i++) {
      const yy = y0 + 8 + rnd(i + 40) * (y1 - y0 - 16);
      const depth = (yy - y0) / (y1 - y0);
      const len = 20 + depth * 70 * rnd(i + 2);
      const x = ((rnd(i) * W * 1.6 + t * (o.flow || 30) * (0.4 + depth)) % (W * 1.6)) - W * 0.3;
      c.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 1.7 + i));
      c.lineWidth = 2 + depth * 3;
      c.beginPath(); c.moveTo(x, yy); c.lineTo(x + len, yy); c.stroke();
    }
    c.restore();
    // bold outline on the water's top edge
    c.save();
    c.strokeStyle = o.edge || '#1f4c78'; c.lineWidth = 4; c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(-W, y0); c.lineTo(W * 2, y0); c.stroke();
    c.restore();
  }

  function outlinedPoly(c, pts, fill, lw, stroke) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    c.fillStyle = fill; c.fill();
    if (lw) { c.lineWidth = lw; c.strokeStyle = stroke || INK; c.lineJoin = 'round'; c.stroke(); }
  }

  /** Woven reed basket with baby Musa fully swaddled (no face). */
  function basket(c, x, y, s, t) {
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(t * 2.1) * 0.05);
    c.scale(s, s);
    // ripples
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.6 + i / 3) % 1);
      c.globalAlpha = 0.6 * (1 - k);
      c.beginPath(); c.ellipse(0, 18, 120 + k * 120, 22 + k * 22, 0, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
    // white sticker border
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(0, -2, 118, 50, 0, 0, Math.PI); c.lineTo(-118, -20); c.ellipse(0, -22, 118, 30, 0, Math.PI, TAU); c.fill();
    // blanket mound (baby wrapped completely)
    c.fillStyle = '#f6f2e8';
    c.beginPath(); c.ellipse(-8, -34, 80, 40, 0, Math.PI, TAU); c.fill();
    c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
    c.strokeStyle = '#cfc6b4'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-60, -40); c.quadraticCurveTo(-10, -70, 50, -44); c.stroke();
    c.beginPath(); c.moveTo(-30, -26); c.quadraticCurveTo(10, -48, 60, -30); c.stroke();
    // bowl
    const g = c.createLinearGradient(0, -30, 0, 50);
    g.addColorStop(0, '#c98d45'); g.addColorStop(1, '#8a5424');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, -20, 110, 26, 0, 0, Math.PI); c.ellipse(0, -8, 110, 50, 0, Math.PI * 0.02, Math.PI * 0.98); c.fill();
    c.beginPath(); c.moveTo(-110, -20); c.ellipse(0, -18, 110, 58, 0, Math.PI, 0, true); c.closePath();
    c.fill();
    c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
    // weave
    c.strokeStyle = 'rgba(80,45,15,0.55)'; c.lineWidth = 2.5;
    for (let i = -4; i <= 4; i++) {
      c.beginPath(); c.moveTo(i * 24, -18); c.quadraticCurveTo(i * 26, 10, i * 20, 36); c.stroke();
    }
    for (let j = 0; j < 3; j++) {
      c.beginPath(); c.ellipse(0, -14 + j * 14, 104 - j * 12, 18 + j * 10, 0, 0.1, Math.PI - 0.1); c.stroke();
    }
    // rim
    c.fillStyle = '#d8a060';
    c.beginPath(); c.ellipse(0, -20, 112, 16, 0, 0, TAU); c.globalAlpha = 0.0; c.fill(); c.globalAlpha = 1;
    c.lineWidth = 7; c.strokeStyle = '#a86c30';
    c.beginPath(); c.ellipse(0, -20, 110, 14, 0, 0, Math.PI); c.stroke();
    c.lineWidth = 4; c.strokeStyle = INK;
    c.beginPath(); c.ellipse(0, -20, 114, 17, 0, 0, Math.PI); c.stroke();
    c.restore();
  }

  function column(c, x, yTop, yBot, w) {
    const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#b98a52'); g.addColorStop(0.35, '#e8c98f'); g.addColorStop(1, '#a2733e');
    outlinedPoly(c, [[x - w / 2, yTop + 50], [x + w / 2, yTop + 50], [x + w / 2, yBot], [x - w / 2, yBot]], g, 5);
    // capital
    outlinedPoly(c, [[x - w * 0.8, yTop], [x + w * 0.8, yTop], [x + w * 0.55, yTop + 55], [x - w * 0.55, yTop + 55]], '#d9b06a', 5);
    // painted bands (no writing)
    const bands = [['#2f5aa8', 70], ['#e0a93a', 88], ['#2f5aa8', 106]];
    for (const [col, dy] of bands) {
      c.fillStyle = col; c.fillRect(x - w / 2 + 3, yTop + dy, w - 6, 12);
    }
    c.fillStyle = '#d9b06a';
    c.fillRect(x - w * 0.62, yBot - 26, w * 1.24, 26);
    c.lineWidth = 4; c.strokeStyle = INK; c.strokeRect(x - w * 0.62, yBot - 26, w * 1.24, 26);
  }

  function emptyThrone(c, x, y, h) {
    const s = h / 300;
    c.save(); c.translate(x, y); c.scale(s, s);
    outlinedPoly(c, [[-120, -300], [120, -300], [120, 0], [-120, 0]], '#fff', 0);
    outlinedPoly(c, [[-110, -290], [110, -290], [110, -120], [-110, -120]], '#d7a531', 6);
    outlinedPoly(c, [[-80, -265], [80, -265], [80, -140], [-80, -140]], '#8a2d2a', 5);
    outlinedPoly(c, [[-130, -130], [130, -130], [130, -95], [-130, -95]], '#e8b93c', 6);
    outlinedPoly(c, [[-125, -95], [-90, -95], [-90, 0], [-125, 0]], '#d7a531', 6);
    outlinedPoly(c, [[90, -95], [125, -95], [125, 0], [90, 0]], '#d7a531', 6);
    c.fillStyle = '#2f5aa8'; c.fillRect(-116, -80, 18, 60); c.fillRect(98, -80, 18, 60);
    c.restore();
  }

  function rays(c, x, y, n, len, a, t, col) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ang = Math.PI / 2 + (i / (n - 1) - 0.5) * 1.1 + Math.sin(t * 0.3 + i) * 0.02;
      const g = c.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.addColorStop(0, (col || 'rgba(255,240,200,A)').replace('A', String(a)));
      g.addColorStop(1, (col || 'rgba(255,240,200,A)').replace('A', '0'));
      c.fillStyle = g;
      const wdt = 0.035 + rnd(i) * 0.03;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(ang - wdt) * len, y + Math.sin(ang - wdt) * len);
      c.lineTo(x + Math.cos(ang + wdt) * len, y + Math.sin(ang + wdt) * len);
      c.closePath(); c.fill();
    }
    c.restore();
  }

  // ---------------------------------------------------------------- scenes
  const S = {};

  // 1 — Egypt establishing, push toward the palace
  S.mesir = (c, t, d) => {
    const e = ease(t / d);
    const cam = { x: lerp(-20, 60, e), y: lerp(0, -30, e), z: lerp(1.0, 1.42, e) };
    withCam(c, cam, 0.05, () => {
      sky(c, ['#8fcbe6', '#cfe7e6', '#fbe3b0'], 0, 700);
      spr(c, 'sun', 1560, 330, 190, { rot: t * 0.05 });
      spr(c, 'cloud_white', 400 + t * 12, 230, 120, { a: 0.9 });
      spr(c, 'cloud_white', 1150 + t * 8, 170, 90, { a: 0.8, flip: true });
    });
    withCam(c, cam, 0.25, () => {
      dunes(c, 640, 26, ['#f0cd8a', '#e6b76c'], 1.2, { lineA: 0.35 });
      spr(c, 'pyramids_tent', 380, 700, 230);
      spr(c, 'temple', 1580, 690, 190);
    });
    withCam(c, cam, 0.5, () => {
      dunes(c, 735, 10, ['#e9bf78', '#dcaa5e'], 3.1, { lineA: 0.4 });
      spr(c, 'palace_nile', 1000, 790, 300);
    });
    withCam(c, cam, 0.7, () => {
      water(c, 800, 890, t, ['#5fb2de', '#2f7fbf'], { n: 40, flow: 25 });
      spr(c, 'boat', 380 + t * 22, 880, 170);
      spr(c, 'reeds', 1500, 895, 90);
      spr(c, 'reeds', 150, 895, 80, { flip: true });
    });
    withCam(c, cam, 0.9, () => {
      dunes(c, 905, 14, ['#ecc07a', '#d9a55c'], 5.2, { lineA: 0.5 });
      const wx = 560 + t * 18;
      shadow(c, wx, 965, 230);
      spr(c, 'workers', wx, 965, 120, { sy: 1 + Math.sin(t * 5) * 0.01 });
      shadow(c, 1250, 1010, 90);
      spr(c, 'soldier', 1250, 1010, 185, { sy: 1 + Math.sin(t * 2) * 0.008 });
      shadow(c, 1360, 1005, 80);
      spr(c, 'guard_b', 1360, 1005, 165);
    });
    withCam(c, cam, 1.25, () => {
      spr(c, 'palms_bush', 90, 1130, 420, { skew: Math.sin(t * 1.2) * 0.02 });
      spr(c, 'palms_pair', 1860, 1140, 470, { skew: Math.sin(t * 1.1 + 1) * 0.02 });
    });
    motes(c, t, 26, '#fff4d6', 10, 18);
    vignette(c, 0.28);
  };

  // 2 — Bani Israel under oppression (non-graphic)
  S.penindasan = (c, t, d) => {
    const e = ease(t / d);
    const cam = { x: lerp(-70, 70, e), y: 0, z: 1.08 };
    withCam(c, cam, 0.05, () => {
      sky(c, ['#e9a95f', '#f3c985', '#f8e0b0'], 0, 700);
      spr(c, 'sun', 1400, 330, 170, { a: 0.9 });
    });
    withCam(c, cam, 0.25, () => {
      dunes(c, 620, 24, ['#e2ac66', '#d39a55'], 7, { lineA: 0.3 });
      spr(c, 'dry_mountain', 330, 640, 150);
      spr(c, 'ruins', 1250, 660, 230);
    });
    withCam(c, cam, 0.6, () => {
      dunes(c, 700, 8, ['#e2b16b', '#cf9a52'], 2, { lineA: 0.4, depth: 400 });
      // stacked mud bricks
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6 - r; k++) {
        const bx = 900 + k * 58 + r * 29, by = 830 - r * 30;
        outlinedPoly(c, [[bx, by], [bx + 56, by], [bx + 56, by + 30], [bx, by + 30]], r % 2 ? '#b8743e' : '#c7844a', 3);
      }
      spr(c, 'workers', 620 + t * 28, 870, 150, { a: 0.95, sy: 1 + Math.sin(t * 4 + 1) * 0.012 });
    });
    withCam(c, cam, 0.9, () => {
      const wx = 300 + t * 34;
      shadow(c, wx + 20, 1020, 360);
      spr(c, 'workers', wx, 1020, 250, { sy: 1 + Math.sin(t * 4) * 0.015, skew: Math.sin(t * 4) * 0.01 });
      shadow(c, 1470, 1030, 150);
      spr(c, 'guard_a', 1470, 1030, 330, { sy: 1 + Math.sin(t * 1.8) * 0.006 });
      shadow(c, 1700, 1010, 130);
      spr(c, 'soldier', 1700, 1010, 330, { sy: 1 + Math.sin(t * 1.6 + 2) * 0.006 });
    });
    withCam(c, cam, 1.3, () => {
      spr(c, 'rocks', 120, 1140, 170);
      spr(c, 'rocks', 1900, 1150, 150, { flip: true });
    });
    motes(c, t, 40, '#fbe2b0', 3, 40);
    c.fillStyle = 'rgba(160,80,20,0.10)'; c.fillRect(0, 0, W, H);
    vignette(c, 0.4);
  };

  // 3 — baby Musa set afloat on the Nile; camera follows downstream
  S.bayi = (c, t, d) => {
    const bx = lerp(640, 1700, easeIn(range(t, 1.2, d + 0.6)) * 0.35 + range(t, 1.2, d + 0.6) * 0.65);
    const camX = lerp(-40, bx - 880, ease(range(t, 0.9, 2.6)));
    const cam = { x: camX, y: 0, z: 1.05 };
    withCam(c, cam, 0.05, () => {
      sky(c, ['#a9d8ea', '#dcefe9', '#fbe6c4'], 0, 600);
      spr(c, 'cloud_white', 600 + t * 10, 200, 110, { a: 0.85 });
      spr(c, 'cloud_white', 1500 + t * 6, 150, 80, { a: 0.7 });
    });
    withCam(c, cam, 0.3, () => {
      dunes(c, 540, 12, ['#b7c784', '#95ad63'], 4, { lineA: 0.3 });
      for (let i = 0; i < 7; i++) spr(c, 'palms_pair', -200 + i * 420, 590, 150 + rnd(i) * 40);
      spr(c, 'temple', 1900, 585, 120);
    });
    withCam(c, cam, 0.75, () => {
      water(c, 580, 1100, t, ['#6fc0e2', '#3b8fc7', '#2a6da8'], { n: 90, flow: 40 });
      // near-left bank where the mother stands
      outlinedPoly(c, [[-600, 760], [320, 740], [560, 800], [660, 1100], [-600, 1100]], '#d8b06a', 5);
      spr(c, 'reeds', 610, 830, 120);
      const bend = ease(range(t, 0.5, 1.3));
      const mAlpha = 1 - range(t, 2.4, 2.9);
      shadow(c, 330, 790, 120, 0.28 * mAlpha);
      spr(c, 'mother_baby', 330, 792, 330, { rot: bend * 0.08, a: mAlpha });
      for (let i = 0; i < 6; i++) spr(c, 'reeds', 900 + i * 520, 640 + rnd(i) * 20, 90, { flip: i % 2 === 1 });
    });
    withCam(c, cam, 0.85, () => {
      const appear = ease(range(t, 1.1, 1.6));
      if (appear > 0) {
        const bxx = lerp(560, bx, 1);
        basket(c, bxx, 800 + Math.sin(t * 2.4) * 6, 1.05 * appear, t);
      }
    });
    withCam(c, cam, 1.4, () => {
      // foreground reeds slide past, hiding the bank as we follow the basket
      for (let i = 0; i < 5; i++) spr(c, 'reeds', 60 + i * 700, 1190, 250 + rnd(i + 9) * 60, { skew: Math.sin(t * 1.5 + i) * 0.03, flip: i % 2 === 0 });
      spr(c, 'palms_bush', 1180, 1230, 330, { skew: Math.sin(t) * 0.02 });
    });
    motes(c, t, 18, '#ffffff', 50, 14, [0, 0, W, 600]);
    vignette(c, 0.25);
  };

  // 4 — Musa grown: desert, seen only from behind
  S.dewasa = (c, t, d) => {
    const e = ease(t / d);
    const cam = { x: lerp(-30, 10, e), y: lerp(10, -10, e), z: lerp(1.0, 1.12, e) };
    withCam(c, cam, 0.05, () => {
      sky(c, ['#f0a868', '#f7c886', '#fde6b4'], 0, 760);
      glow(c, 1420, 560, 520, 'rgba(255,220,150,A)', 0.55);
      spr(c, 'sun', 1420, 620, 210);
    });
    withCam(c, cam, 0.2, () => {
      dunes(c, 640, 30, ['#e9a764', '#d99052'], 0.5, { lineA: 0.3 });
      spr(c, 'dry_mountain', 1650, 650, 150, { filter: 'saturate(0.8) brightness(1.05)' });
    });
    withCam(c, cam, 0.5, () => {
      dunes(c, 740, 36, ['#eeb46e', '#dc9b58'], 2.6, { lineA: 0.4 });
      spr(c, 'palms_pair', 380, 760, 150);
    });
    withCam(c, cam, 0.85, () => {
      dunes(c, 880, 18, ['#f0bd78', '#dca25c'], 4.4, { lineA: 0.5 });
      shadow(c, 900, 900, 260, 0.3);
      musaStand(c, 880, 902, 560, { skew: Math.sin(t * 1.4) * 0.012 });
    });
    withCam(c, cam, 1.3, () => {
      spr(c, 'rocks', 1830, 1130, 180);
      spr(c, 'palms_bush', 60, 1150, 260, { skew: Math.sin(t * 1.3) * 0.03 });
    });
    // blowing sand
    c.save();
    c.strokeStyle = 'rgba(255,236,200,0.5)'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const y = 300 + rnd(i) * 700, x = ((rnd(i + 5) * W + t * 520) % (W + 400)) - 200;
      c.globalAlpha = 0.3 + 0.4 * rnd(i + 2);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 60 + rnd(i) * 80, y - 6); c.stroke();
    }
    c.restore();
    motes(c, t, 30, '#fff0cf', 70, 90);
    vignette(c, 0.3);
  };

  // 5 — the burning bush at night (Musa from behind; no depiction of Allah)
  S.semak = (c, t, d) => {
    const e = ease(t / d);
    const cam = { x: lerp(-60, 60, e), y: 0, z: lerp(1.0, 1.1, e) };
    const flick = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
    withCam(c, cam, 0.03, () => {
      sky(c, ['#0b1633', '#1d2b58', '#3d3b66', '#6b4a5e'], 0, 800);
      stars(c, t, 140, 0.9);
      spr(c, 'night_moon', 330, 330, 240, { a: 0.95 });
    });
    withCam(c, cam, 0.2, () => {
      dunes(c, 650, 40, ['#2f2c52', '#262444'], 1.9, { line: '#120d24', lineA: 0.7 });
      spr(c, 'dry_mountain', 1500, 680, 200, { filter: 'brightness(0.38) saturate(0.6) hue-rotate(-10deg)' });
    });
    withCam(c, cam, 0.6, () => {
      dunes(c, 800, 20, ['#433357', '#2e2440'], 3.3, { line: '#120d24', lineA: 0.7 });
      spr(c, 'rocks', 560, 850, 160, { filter: 'brightness(0.45) saturate(0.7)' });
    });
    withCam(c, cam, 0.85, () => {
      dunes(c, 925, 10, ['#5a3d44', '#3a2834'], 6.1, { line: '#1a0f16', lineA: 0.7 });
      glow(c, 1360, 800, 700 * flick, 'rgba(255,150,60,A)', 0.45);
      spr(c, 'rocks_flat', 1360, 990, 150, { filter: 'brightness(0.8)' });
      spr(c, 'rocks', 1720, 1010, 170, { filter: 'brightness(0.65)' });
      // the bush burns yet is not consumed
      glow(c, 1360, 780, 260, 'rgba(255,230,160,A)', 0.55 * flick);
      spr(c, 'burning_bush', 1360, 915, 330, { sx: 1 + 0.02 * Math.sin(t * 9), sy: 1 + 0.03 * Math.sin(t * 11) });
      // rising sparks
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) {
        const k = (t * (0.35 + rnd(i) * 0.4) + rnd(i + 9)) % 1;
        const x = 1360 + (rnd(i + 3) - 0.5) * 220 + Math.sin(k * 8 + i) * 18;
        const y = 860 - k * 480;
        c.globalAlpha = (1 - k) * 0.9;
        c.fillStyle = k < 0.4 ? '#ffe28a' : '#ff9a3c';
        c.beginPath(); c.arc(x, y, 2.5 + rnd(i) * 3, 0, TAU); c.fill();
      }
      c.restore();
      // Musa walks toward the light — from behind
      const mx = lerp(520, 800, ease(range(t, 0, d * 0.9)));
      const walk = Math.abs(Math.sin(t * 5.2));
      shadow(c, mx, 1010, 200, 0.35);
      spr(c, 'musa_walk', mx, 1012 - walk * 6, 440, { filter: 'brightness(0.62) saturate(0.85)', skew: Math.sin(t * 5.2) * 0.008 });
      // warm rim light from the fire on his right side
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.28 * flick;
      spr(c, 'musa_walk', mx, 1012 - walk * 6, 440, { filter: 'brightness(0.6) sepia(1) saturate(3) hue-rotate(-15deg)' });
      c.restore();
    });
    withCam(c, cam, 1.3, () => {
      spr(c, 'rocks', 130, 1150, 190, { filter: 'brightness(0.3)' });
    });
    vignette(c, 0.55, 'rgba(5,5,20,0.7)');
  };

  function throneRoom(c, t, cam, o) {
    withCam(c, cam, 0.35, () => {
      sky(c, ['#b3834b', '#cf9f63', '#b9894f'], 0, 820);
      // back wall panels + painted friezes (patterns only, no writing)
      for (let i = -2; i < 9; i++) {
        const x = i * 260;
        outlinedPoly(c, [[x + 10, 140], [x + 250, 140], [x + 250, 640], [x + 10, 640]], 'rgba(230,190,130,0.35)', 3, 'rgba(90,55,25,0.5)');
      }
      for (let i = -12; i < 60; i++) {
        c.fillStyle = i % 2 ? '#2f5aa8' : '#e0a93a';
        c.fillRect(i * 40, 100, 40, 22);
      }
      c.fillStyle = '#7a1f22'; c.fillRect(-W, 640, W * 3, 20);
      // curtains behind throne
      outlinedPoly(c, [[1020, 150], [1340, 150], [1320, 640], [1040, 640]], '#8a2d2a', 5);
      outlinedPoly(c, [[1040, 150], [1320, 150], [1310, 230], [1050, 230]], '#e0a93a', 4);
    });
    withCam(c, cam, 0.55, () => {
      // floor
      const g = c.createLinearGradient(0, 640, 0, H);
      g.addColorStop(0, '#caa06a'); g.addColorStop(1, '#8e643b');
      c.fillStyle = g; c.fillRect(-W, 640, W * 3, H * 2);
      c.strokeStyle = 'rgba(80,50,25,0.35)'; c.lineWidth = 3;
      for (let i = -14; i <= 14; i++) { c.beginPath(); c.moveTo(1180 + i * 60, 640); c.lineTo(1180 + i * 420, 1400); c.stroke(); }
      for (let j = 0; j < 8; j++) { const y = 640 + Math.pow(j / 8, 1.8) * 700; c.beginPath(); c.moveTo(-W, y); c.lineTo(W * 2, y); c.stroke(); }
      // carpet toward the dais
      outlinedPoly(c, [[1120, 700], [1240, 700], [1500, 1400], [700, 1400]], '#9c2f2a', 5);
      c.strokeStyle = '#e0a93a'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(1134, 700); c.lineTo(740, 1400); c.moveTo(1226, 700); c.lineTo(1460, 1400); c.stroke();
      // dais steps
      outlinedPoly(c, [[960, 690], [1400, 690], [1430, 720], [930, 720]], '#d9b06a', 4);
      outlinedPoly(c, [[930, 720], [1430, 720], [1460, 752], [900, 752]], '#c69a58', 4);
      column(c, 560, 150, 760, 90);
      column(c, 1800, 150, 760, 90);
      // torches
      for (const tx of [760, 1600]) {
        outlinedPoly(c, [[tx - 12, 560], [tx + 12, 560], [tx + 8, 760], [tx - 8, 760]], '#6b4a2a', 4);
        glow(c, tx, 520, 240, 'rgba(255,170,70,A)', 0.4 + 0.08 * Math.sin(t * 12 + tx));
        spr(c, 'fire', tx, 568, 90, { sy: 1 + 0.08 * Math.sin(t * 14 + tx) });
      }
      o.dais();
    });
    withCam(c, cam, 0.75, () => {
      const hop = o.hop || 0;
      shadow(c, 860, 802, 110); spr(c, 'guard_b', 860, 802 - hop * 14, 250, { rot: -hop * 0.04 });
      shadow(c, 1500, 802, 110); spr(c, 'guard_c', 1500, 802 - hop * 10, 250, { flip: true, rot: hop * 0.04 });
      shadow(c, 700, 880, 130); spr(c, 'guard_a', 700, 880 - hop * 18, 320, { rot: -hop * 0.05 });
      shadow(c, 1690, 880, 130); spr(c, 'soldier', 1690, 880 - hop * 12, 330, { flip: true, rot: hop * 0.05 });
    });
    withCam(c, cam, 1.0, () => {
      rays(c, 1180, -80, 7, 1000, 0.1, t);
    });
    withCam(c, cam, 1.15, () => {
      // Musa: large, foreground, entirely from behind, calm
      shadow(c, 470, 1150, 300, 0.35);
      musaStand(c, 450, 1165, 700, { skew: Math.sin(t * 1.1) * 0.006 });
    });
  }

  // 6 — Musa before Pharaoh
  S.istana = (c, t, d) => {
    const e = ease(t / d);
    const cam = { x: lerp(-40, 40, e), y: lerp(20, 0, e), z: lerp(1.0, 1.1, e) };
    throneRoom(c, t, cam, {
      dais: () => {
        spr(c, 'pharaoh_throne', 1180, 712, 400, { sy: 1 + 0.006 * Math.sin(t * 1.5) });
      },
    });
    vignette(c, 0.45);
  };

  // 7 — Pharaoh rises, points and rejects; guards react; Musa calm
  S.menolak = (c, t, d) => {
    const rise = ease(range(t, 0.35, 0.8));
    const shake = t > 0.7 && t < 1.5 ? (1 - range(t, 0.7, 1.5)) * 7 : 0;
    const cam = {
      x: lerp(40, 110, ease(t / d)), y: lerp(0, -30, ease(t / d)), z: lerp(1.1, 1.22, ease(t / d)),
      sx: Math.sin(t * 60) * shake, sy: Math.cos(t * 53) * shake,
    };
    const hop = Math.max(0, Math.sin(range(t, 0.8, 1.3) * Math.PI));
    throneRoom(c, t, cam, {
      hop,
      dais: () => {
        if (rise < 1) spr(c, 'pharaoh_throne', 1180, 712, 400, { a: 1 - rise });
        if (rise > 0) {
          emptyThrone(c, 1190, 700, 300 * rise);
          const jab = Math.sin(range(t, 0.9, 1.2) * Math.PI) * 0.04 + Math.sin(t * 3) * 0.01;
          spr(c, 'pharaoh_point', 1170, 712, lerp(300, 380, rise), { a: rise, rot: -jab });
        }
      },
    });
    c.fillStyle = `rgba(150,20,10,${0.12 * range(t, 0.6, 1.2)})`; c.fillRect(0, 0, W, H);
    vignette(c, 0.55);
  };

  // 8 — the signs: frogs, locusts, dark clouds, drought (stylised montage)
  S.tanda = (c, t, d) => {
    const seg = d / 4;
    const k = Math.min(3, Math.floor(t / seg));
    const lt = t - k * seg;
    const panel = (i, tt) => {
      const z = 1.05 + tt * 0.06;
      const cam = { x: 0, y: 0, z };
      if (i === 0) {
        withCam(c, cam, 0.1, () => {
          sky(c, ['#9fd0e0', '#e8efd8'], 0, 560);
          spr(c, 'palace_nile', 960, 600, 220, { a: 0.9 });
        });
        withCam(c, cam, 0.8, () => {
          water(c, 590, 760, tt + 3, ['#5fb2de', '#3a86c0'], { n: 30 });
          dunes(c, 760, 12, ['#9fb56a', '#7e9950'], 2, { lineA: 0.5 });
          spr(c, 'reeds', 200, 790, 140); spr(c, 'reeds', 1700, 790, 150, { flip: true });
          for (let f = 0; f < 9; f++) {
            const phase = (tt * 1.6 + rnd(f) * 1.3) % 1.2;
            const hopY = phase < 0.5 ? Math.sin(phase / 0.5 * Math.PI) * (80 + rnd(f + 1) * 60) : 0;
            const dir = f % 2 ? 1 : -1;
            const x = 100 + ((rnd(f + 5) * 1700 + dir * tt * (220 + rnd(f + 2) * 160)) % 1800 + 1800) % 1800;
            const y = 860 + rnd(f + 3) * 200;
            spr(c, 'frog', x, y - hopY, 90 + rnd(f + 4) * 90, { flip: dir < 0 });
          }
        });
      } else if (i === 1) {
        withCam(c, cam, 0.1, () => {
          sky(c, ['#d8b060', '#f0d58c', '#f6e3b2'], 0, 700);
          spr(c, 'sun', 1600, 260, 150, { a: 0.7 });
        });
        withCam(c, cam, 0.6, () => {
          dunes(c, 760, 14, ['#c9b060', '#a99248'], 1, { lineA: 0.5 });
          for (let i2 = 0; i2 < 6; i2++) spr(c, 'palms_pair', 150 + i2 * 330, 800, 150);
        });
        withCam(c, cam, 1.0, () => {
          spr(c, 'swarm_dark', 1300 - tt * 700, 520, 360, { a: 0.85 });
          for (let l = 0; l < 10; l++) {
            const x = W + 200 - ((tt * (700 + rnd(l) * 500) + rnd(l + 1) * 1200) % (W + 600));
            const y = 180 + rnd(l + 2) * 600 + Math.sin(tt * 18 + l) * 8;
            spr(c, 'locusts', x, y, 110 + rnd(l + 3) * 60, { rot: Math.sin(tt * 30 + l) * 0.03 });
          }
          spr(c, 'locust_green', 1500 - tt * 1400, 820 - tt * 260, 200, { rot: Math.sin(tt * 40) * 0.04 });
        });
      } else if (i === 2) {
        const dark = range(tt, 0, 0.8);
        withCam(c, cam, 0.1, () => {
          sky(c, [`rgb(${lerp(190, 70, dark)},${lerp(200, 75, dark)},${lerp(210, 100, dark)})`, `rgb(${lerp(230, 110, dark)},${lerp(215, 105, dark)},${lerp(190, 110, dark)})`], 0, 800);
        });
        withCam(c, cam, 0.6, () => {
          dunes(c, 820, 12, ['#b99a66', '#8e7446'], 3, { lineA: 0.5 });
          spr(c, 'smoke_city', 960, 900, 260, { filter: `brightness(${lerp(1, 0.7, dark)})` });
        });
        withCam(c, cam, 0.9, () => {
          const g = easeOut(range(tt, 0, 1));
          spr(c, 'cloud_dark', lerp(-300, 560, g), 380, 300);
          spr(c, 'cloud_grey', lerp(W + 300, 1380, g), 330, 320, { flip: true });
          spr(c, 'storm', lerp(960, 960, g), lerp(-100, 420, g), 340);
          spr(c, 'cloud_dark', lerp(W + 200, 1700, g), 200, 220);
          spr(c, 'cloud_grey', lerp(-200, 250, g), 180, 200);
        });
        const flash = tt > 0.75 && tt < 0.9 ? 0.25 : 0;
        if (flash) { c.fillStyle = `rgba(255,250,230,${flash})`; c.fillRect(0, 0, W, H); }
      } else {
        withCam(c, cam, 0.1, () => {
          sky(c, ['#f3b35c', '#fbd98e', '#fdebc0'], 0, 700);
          glow(c, 960, 260, 500, 'rgba(255,240,180,A)', 0.6);
          spr(c, 'sun', 960, 390, 260, { rot: tt * 0.3, sx: 1 + 0.03 * Math.sin(tt * 8), sy: 1 + 0.03 * Math.sin(tt * 8) });
        });
        withCam(c, cam, 0.5, () => {
          dunes(c, 700, 20, ['#e2a45c', '#c98848'], 2.2, { lineA: 0.4 });
          spr(c, 'dry_mountain', 400, 730, 200);
          spr(c, 'dry_mountain', 1550, 740, 170, { flip: true });
        });
        withCam(c, cam, 0.9, () => {
          spr(c, 'dry_land', 960, 1120, 470, { sx: 1.1 });
          spr(c, 'sandstorm', lerp(W + 200, 1300, easeOut(tt)), 900, 340, { a: 0.7 });
        });
        // heat shimmer lines
        c.save(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 3;
        for (let i2 = 0; i2 < 10; i2++) {
          const y = 620 + i2 * 30;
          c.beginPath();
          for (let x = 0; x <= W; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + tt * 10 + i2) * 4);
          c.stroke();
        }
        c.restore();
      }
    };
    panel(k, lt / seg);
    // diagonal wipe into the next panel during the last 0.22 s
    const wp = range(lt, seg - 0.22, seg);
    if (k < 3 && wp > 0) {
      c.save();
      c.beginPath();
      const xw = lerp(W + 600, -600, easeIn(wp));
      c.moveTo(xw, 0); c.lineTo(W + 800, 0); c.lineTo(W + 800, H); c.lineTo(xw - 500, H); c.closePath();
      c.clip();
      panel(k + 1, 0);
      c.restore();
      c.save();
      c.strokeStyle = '#fff'; c.lineWidth = 16;
      c.beginPath(); c.moveTo(xw, 0); c.lineTo(xw - 500, H); c.stroke();
      c.restore();
    }
    vignette(c, 0.4);
  };

  // 9 — leaving Egypt at night; Musa leads from the front, seen from behind
  S.keluar = (c, t, d) => {
    const e = t / d;
    const cam = { x: lerp(-40, 160, e), y: 0, z: 1.02 };
    const night = 'brightness(0.62) saturate(0.75) hue-rotate(-8deg)';
    withCam(c, cam, 0.03, () => {
      sky(c, ['#0a1430', '#1b2a5a', '#3a3f72', '#5b5277'], 0, 760);
      stars(c, t, 160, 0.95);
      spr(c, 'night_moon', 1500, 300, 230);
    });
    withCam(c, cam, 0.15, () => {
      dunes(c, 640, 26, ['#2a2d55', '#22244a'], 0.8, { line: '#0e0d24', lineA: 0.7 });
      spr(c, 'palace_nile', 260, 660, 200, { filter: 'brightness(0.35) saturate(0.5)' });
      glow(c, 240, 610, 160, 'rgba(255,170,90,A)', 0.2);
    });
    withCam(c, cam, 0.5, () => {
      dunes(c, 760, 22, ['#3a3564', '#2b2750'], 2.2, { line: '#0e0d24', lineA: 0.7 });
    });
    withCam(c, cam, 0.9, () => {
      dunes(c, 900, 12, ['#4c416a', '#342c4f'], 5.5, { line: '#130f24', lineA: 0.7 });
      const adv = t * 120;
      const bob = (ph) => Math.abs(Math.sin(t * 5 + ph)) * 7;
      // followers behind (left), leader in front (right)
      shadow(c, 360 + adv, 925, 330, 0.3);
      spr(c, 'crowd', 360 + adv, 925 - bob(1), 260, { filter: night, a: 0.9 });
      shadow(c, 700 + adv, 945, 200, 0.3);
      spr(c, 'women_back', 700 + adv, 945 - bob(2), 250, { filter: night });
      shadow(c, 1000 + adv, 950, 160, 0.3);
      spr(c, 'crowd', 60 + adv, 900 - bob(3), 200, { filter: 'brightness(0.5) saturate(0.6)', a: 0.85 });
      shadow(c, 1180 + adv, 965, 150, 0.35);
      spr(c, 'musa_lead', 1180 + adv, 968 - bob(0), 330, { filter: night, skew: Math.sin(t * 5) * 0.01 });
    });
    withCam(c, cam, 1.3, () => {
      spr(c, 'rocks', 1500, 1150, 180, { filter: 'brightness(0.3)' });
      spr(c, 'palms_bush', 300, 1160, 280, { filter: 'brightness(0.28)' });
    });
    motes(c, t, 20, '#dfe6ff', 21, 12, [0, 0, W, 700]);
    vignette(c, 0.6, 'rgba(5,5,25,0.75)');
  };

  // 10 — Pharaoh's chariots give chase (the only fast camera)
  S.kejar = (c, t, d) => {
    const sh = 5;
    const cam = { x: Math.sin(t * 2) * 30, y: 0, z: 1.06 + 0.04 * Math.sin(t * 1.3), sx: Math.sin(t * 47) * sh, sy: Math.cos(t * 41) * sh };
    const run = t * 1500;
    withCam(c, cam, 0.05, () => {
      sky(c, ['#e2a05a', '#f2c47c', '#f8dfae'], 0, 720);
      spr(c, 'sun', 1500, 300, 150, { a: 0.8 });
    });
    const loopX = (x, speed, span) => ((x - run * speed) % span + span) % span - 300;
    withCam(c, cam, 0.2, () => {
      c.save(); c.translate(-((run * 0.08) % 900), 0);
      for (let i = 0; i < 4; i++) spr(c, 'dry_mountain', i * 900, 640, 160, { flip: i % 2 === 1 });
      c.restore();
      dunes(c, 650, 18, ['#dfa564', '#cf9152'], 1.3 + run * 0.00008, { lineA: 0.3 });
    });
    withCam(c, cam, 0.5, () => {
      dunes(c, 760, 14, ['#e6b06c', '#d49a58'], 2 + run * 0.0004, { lineA: 0.4 });
      for (let i = 0; i < 4; i++) spr(c, 'palms_pair', loopX(i * 700, 0.5, 2800), 790, 150);
    });
    withCam(c, cam, 0.9, () => {
      const g = c.createLinearGradient(0, 820, 0, H);
      g.addColorStop(0, '#e9b872'); g.addColorStop(1, '#d59c56');
      c.fillStyle = g; c.fillRect(-W, 820, W * 3, H);
      c.strokeStyle = INK; c.globalAlpha = 0.4; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-W, 820); c.lineTo(W * 2, 820); c.stroke(); c.globalAlpha = 1;
      // ground tufts streaking past
      for (let i = 0; i < 14; i++) {
        const x = loopX(rnd(i) * 3000, 1.0, 3000);
        spr(c, i % 3 ? 'rocks' : 'reeds', x, 880 + rnd(i + 1) * 200, 40 + rnd(i + 2) * 50, { filter: 'saturate(0.7)' });
      }
      // dust clouds trailing
      for (let i = 0; i < 5; i++) {
        const k = ((t * 1.3 + i / 5) % 1);
        spr(c, 'swarm_dust', 520 - k * 900, 900 - k * 40, 170 + k * 200, { a: 0.55 * (1 - k), filter: 'blur(1px)' });
      }
      spr(c, 'sandstorm', 180 - (t * 200 % 400), 950, 360, { a: 0.35, rot: -1.2 });
      // running soldiers (background of the column)
      spr(c, 'soldier', 300 + Math.sin(t * 3) * 20, 870 - Math.abs(Math.sin(t * 12)) * 10, 190, { rot: 0.08 });
      spr(c, 'guard_a', 160 + Math.sin(t * 3 + 1) * 20, 875 - Math.abs(Math.sin(t * 12 + 1)) * 10, 185, { rot: 0.08 });
      // second chariot
      shadow(c, 560, 880, 230, 0.3);
      spr(c, 'chariot', 560 + Math.sin(t * 2) * 30, 880 - Math.abs(Math.sin(t * 15)) * 8, 250, { rot: Math.sin(t * 15) * 0.012 });
      // lead chariot
      const cx = 1150 + Math.sin(t * 1.7) * 40 + t * 30;
      shadow(c, cx, 1030, 420, 0.32);
      spr(c, 'chariot', cx, 1030 - Math.abs(Math.sin(t * 15 + 1)) * 12, 430, { rot: Math.sin(t * 15 + 1) * 0.015 });
    });
    // speed lines
    c.save(); c.strokeStyle = 'rgba(255,245,220,0.55)'; c.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const y = rnd(i) * H, len = 120 + rnd(i + 1) * 260;
      const x = W - ((t * 2600 + rnd(i + 2) * 3000) % (W + 600));
      c.lineWidth = 2 + rnd(i + 3) * 3; c.globalAlpha = 0.25 + rnd(i + 4) * 0.35;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke();
    }
    c.restore();
    c.fillStyle = 'rgba(160,70,20,0.08)'; c.fillRect(0, 0, W, H);
    vignette(c, 0.5);
  };

  function waterWall(c, side, cx, w, hNear, hFar, t, vis) {
    // path edges: near (y=930) and far (horizon y=560)
    const s = side;
    const nx = cx + s * w * 1.25, fx = cx + s * w * 0.16;
    const ny = 930, fy = 560;
    const topN = ny - hNear, topF = fy - hFar;
    const outer = cx + s * 1600;
    // wall body (front face toward the path)
    const g = c.createLinearGradient(nx, 0, outer, 0);
    g.addColorStop(0, '#6ec3ea'); g.addColorStop(0.08, '#2f8ccc'); g.addColorStop(0.5, '#1d5f9c'); g.addColorStop(1, '#174c80');
    c.save();
    c.globalAlpha *= vis;
    c.beginPath();
    c.moveTo(nx, ny);
    c.lineTo(fx, fy);
    // scalloped crest from far to near
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = lerp(fx, nx, k) + s * (Math.sin(t * 6 + i) * 6);
      const y = lerp(topF, topN, k) + Math.sin(t * 5 + i * 1.7) * 10 * (0.3 + k);
      c.lineTo(x, y);
    }
    c.lineTo(outer, topN - 40);
    c.lineTo(outer, ny + 200);
    c.lineTo(nx, ny + 200);
    c.closePath();
    c.fillStyle = g; c.fill();
    c.lineWidth = 6; c.strokeStyle = '#0f3558'; c.stroke();
    c.clip();
    // inner face light + falling streaks
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const k = rnd(i + (s > 0 ? 50 : 0));
      const x = lerp(fx, nx, k) + s * (10 + rnd(i + 3) * 90) * (0.3 + k);
      const topY = lerp(topF, topN, k);
      const len = (lerp(fy, ny, k) - topY);
      const off = ((t * 0.8 + rnd(i + 7)) % 1) * len;
      c.lineWidth = 2 + k * 5; c.globalAlpha = 0.35 + 0.35 * k;
      c.beginPath(); c.moveTo(x, topY + off); c.lineTo(x + s * 4, topY + off + 40 + k * 60); c.stroke();
    }
    c.restore();
    // foam crest
    c.save();
    c.globalAlpha *= vis;
    for (let i = 0; i <= 14; i++) {
      const k = i / 14;
      const x = lerp(fx, nx, k) + s * 30 * k;
      const y = lerp(topF, topN, k) + Math.sin(t * 5 + i) * 8;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(x, y, (12 + k * 38 + Math.sin(t * 7 + i) * 4) * vis, 0, TAU); c.fill();
      c.lineWidth = 3; c.strokeStyle = 'rgba(40,110,170,0.6)'; c.stroke();
    }
    c.restore();
    // curling wave sticker at the near crest
    spr(c, 'wave', nx + s * 120, topN + 70, 150 + hNear * 0.18, { flip: s < 0, a: vis, rot: s * -0.1 });
  }

  // 11 — the sea parts (the climax)
  S.laut = (c, t, d) => {
    const raise = ease(range(t, 0.5, 1.3));
    const open = ease(range(t, 1.2, 3.4));
    const cam = {
      x: lerp(-260, 0, ease(range(t, 0.2, 3.6))), y: lerp(90, 0, ease(range(t, 0.2, 3.6))),
      z: lerp(1.28, 1.0, ease(range(t, 0.2, 3.6))),
      sx: Math.sin(t * 40) * 4 * Math.sin(open * Math.PI), sy: Math.cos(t * 37) * 4 * Math.sin(open * Math.PI),
    };
    const cx = 1080;
    withCam(c, cam, 0.05, () => {
      sky(c, [
        `rgb(${lerp(40, 120, open)},${lerp(55, 170, open)},${lerp(90, 215, open)})`,
        `rgb(${lerp(90, 200, open)},${lerp(100, 220, open)},${lerp(130, 230, open)})`,
        `rgb(${lerp(150, 250, open)},${lerp(140, 230, open)},${lerp(140, 190, open)})`,
      ], 0, 580);
      spr(c, 'cloud_dark', 300 - open * 300, 260, 260, { a: 1 - open * 0.8 });
      spr(c, 'storm', 1650 + open * 300, 250, 240, { a: 1 - open });
      spr(c, 'cloud_grey', 900, 180 - open * 200, 240, { a: 1 - open });
      spr(c, 'cloud_white', 1500, 200, 160, { a: open });
      rays(c, cx, -100, 11, 900, 0.18 * open, t);
    });
    withCam(c, cam, 0.35, () => {
      // open sea to the horizon
      water(c, 560, 940, t, ['#3d8fc6', '#1e5f9e', '#18507f'], { n: 80, flow: 60 });
    });
    withCam(c, cam, 0.6, () => {
      const w = 360 * open;
      if (open > 0.001) {
        // the dry path revealed
        const pg = c.createLinearGradient(0, 560, 0, 940);
        pg.addColorStop(0, '#e8c888'); pg.addColorStop(1, '#d5a868');
        outlinedPoly(c, [[cx - w * 0.16, 560], [cx + w * 0.16, 560], [cx + w * 1.25, 940], [cx - w * 1.25, 940]], pg, 0);
        c.strokeStyle = 'rgba(150,100,50,0.35)'; c.lineWidth = 3;
        for (let i = 1; i < 6; i++) { const y = 560 + Math.pow(i / 6, 1.6) * 380; const ww = lerp(w * 0.16, w * 1.25, (y - 560) / 380); c.beginPath(); c.moveTo(cx - ww * 0.6, y); c.lineTo(cx + ww * 0.4, y + 4); c.stroke(); }
        // Bani Israel begin crossing (walking away into the path)
        const cross = range(t, 3.2, d + 0.6);
        if (cross > 0) {
          const groups = [['crowd', 0], ['women_back', 0.25], ['crowd', 0.5], ['women_back', 0.72]];
          for (const [nm, delay] of groups) {
            const k = sat(cross * 1.1 - delay * 0.4 + 0.15 - delay * 0.2);
            const y = lerp(930, 700, k), sc = lerp(1, 0.4, k);
            const x = cx + lerp(-40, 0, k) + (nm === 'crowd' ? -30 : 40) * sc;
            spr(c, nm, x, y - Math.abs(Math.sin(t * 5 + delay * 9)) * 5 * sc, 220 * sc, { a: range(cross, delay * 0.4, delay * 0.4 + 0.15) });
          }
        }
        const hN = 620 * open, hF = 260 * open;
        waterWall(c, -1, cx, w, hN, hF, t, open);
        waterWall(c, 1, cx, w, hN, hF, t, open);
      }
      // near shoreline foam
      c.save();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (const side of [-1, 1]) {
        const inner = cx + side * 360 * open * 1.25;
        const outer = cx + side * 1800;
        c.beginPath();
        c.moveTo(inner, 940);
        for (let k = 0; k <= 40; k++) {
          const x = lerp(inner, outer, k / 40);
          c.lineTo(x, 922 + Math.sin(x * 0.03 + t * 3) * 6);
        }
        c.lineTo(outer, 950); c.lineTo(inner, 950); c.closePath(); c.fill();
      }
      c.restore();
    });
    withCam(c, cam, 0.85, () => {
      // beach
      const bg = c.createLinearGradient(0, 930, 0, H);
      bg.addColorStop(0, '#e6c07e'); bg.addColorStop(1, '#cf9f5c');
      c.fillStyle = bg;
      c.beginPath(); c.moveTo(-W, 950);
      for (let x = -W; x <= W * 2; x += 40) c.lineTo(x, 945 + Math.sin(x * 0.01 + 1) * 8);
      c.lineTo(W * 2, H * 2); c.lineTo(-W, H * 2); c.closePath(); c.fill();
      c.strokeStyle = INK; c.globalAlpha = 0.5; c.lineWidth = 5; c.stroke(); c.globalAlpha = 1;
      // people waiting on the shore behind Musa
      spr(c, 'crowd', 1650, 1040, 230, { a: 1 - range(t, 3.4, 4.4) });
      spr(c, 'women_back', 1420, 1060, 230, { a: 1 - range(t, 3.6, 4.6) });
    });
    withCam(c, cam, 1.0, () => {
      // Musa at the shoreline, from behind, raises his staff
      shadow(c, 560, 1070, 260, 0.35);
      musaStand(c, 540, 1080, 600, { raise, glow: raise * (0.6 + 0.4 * open), skew: Math.sin(t * 2) * 0.008 + open * 0.01 });
    });
    // spray + wind streaks
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) {
      const k = (t * (0.5 + rnd(i) * 0.6) + rnd(i + 3)) % 1;
      const side = i % 2 ? 1 : -1;
      const x = W / 2 + side * (120 + rnd(i + 5) * 500) * (0.3 + open) + side * k * 120;
      const y = 700 - k * 400 * open;
      c.globalAlpha = (1 - k) * 0.5 * open;
      c.fillStyle = '#e8f6ff';
      c.beginPath(); c.arc(x, y, 3 + rnd(i) * 5, 0, TAU); c.fill();
    }
    c.restore();
    vignette(c, 0.45, 'rgba(5,15,35,0.6)');
  };

  // 12 — safe on the far shore; sea closes in the distance; sunrise
  S.akhir = (c, t, d) => {
    const dawn = ease(range(t, 0, d * 0.85));
    const cam = { x: lerp(40, -20, ease(t / d)), y: lerp(40, -10, ease(t / d)), z: lerp(1.12, 1.0, ease(t / d)) };
    const mix = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], dawn))).join(',')})`;
    withCam(c, cam, 0.03, () => {
      sky(c, [mix([30, 40, 90], [120, 170, 220]), mix([120, 80, 120], [250, 190, 140]), mix([230, 140, 110], [255, 225, 165])], 0, 660);
      const sy = lerp(760, 470, dawn);
      glow(c, 1330, sy - 60, 700, 'rgba(255,200,120,A)', 0.35 + dawn * 0.35);
      spr(c, 'sun', 1330, sy + 80, 190);
      stars(c, t, 80, 1 - dawn * 1.2);
      spr(c, 'cloud_white', 400 + t * 10, 250, 120, { a: 0.5 + dawn * 0.4, filter: `sepia(${1 - dawn}) saturate(1.2)` });
    });
    withCam(c, cam, 0.2, () => {
      // the sea behind, closing far away in the distance
      water(c, 600, 760, t, ['#4f86b8', '#3a6f9e'], { n: 40, shine: 'rgba(255,220,170,0.6)' });
      const close = ease(range(t, 0, 2.6));
      const gap = 60 * (1 - close);
      c.save();
      for (const s of [-1, 1]) {
        const h = 60 * (1 - close) + 6;
        outlinedPoly(c, [[520 + s * gap, 600], [520 + s * (gap + 180), 600], [520 + s * (gap + 140), 600 - h], [520 + s * gap, 600 - h * 1.2]], '#2f78b5', 3, '#15406a');
      }
      c.restore();
      if (close > 0.7 && close < 1) {
        c.save(); c.fillStyle = '#fff';
        for (let i = 0; i < 12; i++) { c.globalAlpha = (1 - close) * 3 * rnd(i); c.beginPath(); c.arc(520 + (rnd(i) - 0.5) * 140, 590 - rnd(i + 1) * 40, 6 + rnd(i + 2) * 8, 0, TAU); c.fill(); }
        c.restore();
      }
      // Pharaoh's host left behind on the distant far shore (halted, tiny)
      dunes(c, 596, 4, ['#8a6a5a', '#6e5448'], 1, { lineA: 0.3 });
      spr(c, 'chariot', 250, 596, 34, { filter: 'brightness(0.45) saturate(0.4)' });
      spr(c, 'chariot', 330, 598, 30, { filter: 'brightness(0.45) saturate(0.4)' });
      spr(c, 'soldier', 400, 598, 26, { filter: 'brightness(0.45) saturate(0.4)' });
    });
    withCam(c, cam, 0.55, () => {
      dunes(c, 760, 20, [mix([90, 70, 90], [228, 176, 110]), mix([70, 55, 75], [210, 150, 90])], 2.5, { lineA: 0.45 });
      spr(c, 'palms_pair', 1650, 790, 180, { filter: `brightness(${lerp(0.5, 1, dawn)})` });
    });
    withCam(c, cam, 0.8, () => {
      dunes(c, 900, 14, [mix([110, 80, 80], [236, 190, 120]), mix([80, 60, 60], [214, 160, 96])], 4.2, { lineA: 0.5 });
      const lit = `brightness(${lerp(0.55, 1, dawn)}) saturate(${lerp(0.7, 1, dawn)})`;
      const b = (ph) => Math.sin(t * 2 + ph) * 3;
      spr(c, 'crowd', 1250, 945 + b(0), 230, { filter: lit });
      spr(c, 'women_back', 1540, 960 + b(1), 220, { filter: lit });
      spr(c, 'crowd', 1760, 935 + b(2), 180, { filter: lit, a: 0.95 });
    });
    withCam(c, cam, 1.0, () => {
      const lit = `brightness(${lerp(0.5, 1, dawn)}) saturate(${lerp(0.7, 1, dawn)})`;
      spr(c, 'rocks_flat', 600, 1110, 190, { filter: lit });
      // Musa overlooks the horizon, facing away toward the sunrise
      musaStand(c, 620, 1040, 540, { filter: lit, skew: Math.sin(t * 1.2) * 0.008 });
      // warm rim light
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 * dawn;
      musaStand(c, 620, 1040, 540, { filter: 'sepia(1) saturate(2.5) brightness(0.9)' });
      c.restore();
    });
    withCam(c, cam, 1.3, () => {
      spr(c, 'palms_bush', 1880, 1170, 360, { filter: `brightness(${lerp(0.35, 0.9, dawn)})`, skew: Math.sin(t * 1.1) * 0.02 });
    });
    motes(c, t, 26, '#fff1cf', 90, 12);
    vignette(c, 0.35);
    // gentle fade to close
    const out = range(t, d - 1.2, d);
    if (out > 0) { c.fillStyle = `rgba(20,10,5,${out * 0.92})`; c.fillRect(0, 0, W, H); }
  };

  // ---------------------------------------------------------------- compositor
  let buf = null;
  function scratch() {
    if (!buf) {
      buf = document.createElement('canvas');
      buf.width = W; buf.height = H;
    }
    return buf;
  }

  function drawScene(c, i, lt) {
    c.save();
    c.imageSmoothingQuality = 'high';
    S[SCENES[i].id](c, lt, SCENES[i].dur);
    c.restore();
  }

  function sceneAt(t) {
    t = clamp(t, 0, DURATION - 1e-4);
    let i = 0;
    while (i < SCENES.length - 1 && t >= SCENES[i + 1].start) i++;
    return i;
  }

  function render(c, t) {
    t = clamp(t, 0, DURATION - 1e-4);
    const i = sceneAt(t);
    const sc = SCENES[i];
    const lt = t - sc.start;
    const kind = sc.trans || 'fade';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if (i > 0 && lt < TR && kind !== 'cut') {
      const k = lt / TR;
      const prev = SCENES[i - 1];
      if (kind === 'dip') {
        if (k < 0.5) drawScene(c, i - 1, prev.dur + lt);
        else drawScene(c, i, lt);
        c.fillStyle = `rgba(4,4,12,${1 - Math.abs(k - 0.5) * 2})`;
        c.fillRect(0, 0, W, H);
      } else {
        drawScene(c, i - 1, prev.dur + lt);
        const b = scratch(), bc = b.getContext('2d');
        bc.setTransform(1, 0, 0, 1, 0, 0);
        drawScene(bc, i, lt);
        c.save(); c.globalAlpha = ease(k); c.drawImage(b, 0, 0); c.restore();
        if (kind === 'glow') {
          c.save(); c.globalCompositeOperation = 'lighter';
          c.fillStyle = `rgba(255,225,170,${Math.sin(k * Math.PI) * 0.3})`;
          c.fillRect(0, 0, W, H); c.restore();
        }
      }
    } else {
      drawScene(c, i, lt);
    }
    // opening fade in
    if (t < 0.6) { c.fillStyle = `rgba(0,0,0,${1 - t / 0.6})`; c.fillRect(0, 0, W, H); }
  }

  global.MusaFilm = { W, H, SCENES, DURATION, load, render, sceneAt };
})(typeof window !== 'undefined' ? window : globalThis);
