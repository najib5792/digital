// Generative soundtrack + spatial-ish effects, synthesized live with Web Audio.
// No audio files: an ambient piano/pad score, birds or crickets outside,
// footsteps per floor material, door creaks, chimes and UI sounds.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.musicVol = 0.55;
    this.sfxVol = 0.8;
    this.muted = false;
    this.night = false;
    this.outside = 1;
  }

  start() {
    if (this.started) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.started = true;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(4.2, 2.6);
    this.revGain = ctx.createGain();
    this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain).connect(this.master);

    this.roomVerb = ctx.createConvolver();
    this.roomVerb.buffer = this.impulse(0.9, 3.5);
    this.roomVerbGain = ctx.createGain();
    this.roomVerbGain.gain.value = 0.35;
    this.roomVerb.connect(this.roomVerbGain).connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.master);
    this.musicSend = ctx.createGain();
    this.musicSend.gain.value = 0.7;
    this.musicBus.connect(this.musicSend).connect(this.reverb);

    // ping-pong delay for the piano sparkle
    const dl = ctx.createDelay(1.5), dr = ctx.createDelay(1.5);
    dl.delayTime.value = 0.375; dr.delayTime.value = 0.5;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2800;
    const merger = ctx.createChannelMerger(2);
    this.delayIn = ctx.createGain(); this.delayIn.gain.value = 0.22;
    this.delayIn.connect(dl); dl.connect(dr); dr.connect(dlf).connect(fb).connect(dl);
    dl.connect(merger, 0, 0); dr.connect(merger, 0, 1);
    merger.connect(this.musicBus);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.roomVerb);

    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.5;
    this.ambBus.connect(this.master);

    this.noiseBuf = this.makeNoise(2);
    this.startPad();
    this.startAmbience();
    this.nextNoteTime = ctx.currentTime + 0.4;
    this.step = 0;
    this.chordIdx = 0;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  impulse(sec, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  makeNoise(sec) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------- score ----------
  // D major, lydian colour: Dmaj9 – Bm11 – Gmaj9(#11) – Aadd9/C#  (8 beats each at 72 bpm)
  get chords() {
    return [
      { root: 38, pad: [50, 54, 57, 61, 64], scale: [62, 64, 66, 69, 71, 73, 74, 76, 78, 81] },
      { root: 35, pad: [47, 50, 54, 57, 64], scale: [59, 61, 62, 66, 69, 71, 74, 76, 78] },
      { root: 31, pad: [50, 54, 55, 59, 61], scale: [59, 62, 66, 67, 69, 71, 73, 74, 78, 79] },
      { root: 33, pad: [49, 52, 57, 59, 64], scale: [61, 64, 66, 69, 71, 73, 76, 78, 81] },
    ];
  }

  startPad() {
    const ctx = this.ctx;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padFilter.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 380;
    lfo.connect(lfoGain).connect(this.padFilter.frequency);
    lfo.start();
    this.padOut = ctx.createGain();
    this.padOut.gain.value = 0.13;
    this.padFilter.connect(this.padOut).connect(this.musicBus);
    this.padOut.connect(this.reverb);
  }

  playPadChord(ch, t, dur) {
    const ctx = this.ctx;
    for (const n of ch.pad) {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = det + (Math.random() - 0.5) * 4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 2.2);
        g.gain.setValueAtTime(0.06, t + dur - 0.4);
        g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
        o.connect(g).connect(this.padFilter);
        o.start(t);
        o.stop(t + dur + 2.6);
      }
    }
    // warm sub bass
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = midi(ch.root);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.16, t + 0.8);
    bg.gain.exponentialRampToValueAtTime(0.03, t + dur);
    bg.gain.linearRampToValueAtTime(0, t + dur + 0.5);
    b.connect(bg).connect(this.musicBus);
    b.start(t);
    b.stop(t + dur + 0.6);
  }

  piano(note, t, vel = 0.5, len = 3.5) {
    const ctx = this.ctx;
    const f = midi(note);
    const out = ctx.createGain();
    out.gain.value = vel * 0.18;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + len);
    lp.connect(out);
    out.connect(this.musicBus);
    out.connect(this.delayIn);
    const partials = [[1, 1], [2, 0.42], [3, 0.18], [4, 0.1], [5.02, 0.05]];
    for (const [m, a] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * m;
      o.detune.value = (Math.random() - 0.5) * 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(a * 0.35, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len / m ** 0.3);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + len + 0.1);
    }
    // hammer noise
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = f * 4; nf.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(nf).connect(ng).connect(out);
    n.start(t, Math.random());
    n.stop(t + 0.05);
  }

  schedule() {
    const ctx = this.ctx;
    const beat = 60 / 72;
    while (this.nextNoteTime < ctx.currentTime + 0.4) {
      const t = this.nextNoteTime;
      const chords = this.chords;
      const ch = chords[this.chordIdx % chords.length];
      const beatInChord = this.step % 16; // 16 eighths = 8 beats
      if (beatInChord === 0) {
        this.playPadChord(ch, t, beat * 8);
        this.piano(ch.root + 24, t, 0.45, 5);
      }
      // sparse, humanised melody
      const density = this.night ? 0.3 : 0.38;
      if (beatInChord > 0 && Math.random() < density) {
        const idx = Math.floor(Math.pow(Math.random(), 1.3) * ch.scale.length);
        const note = ch.scale[idx] + (Math.random() < 0.15 ? 12 : 0);
        this.piano(note, t + (Math.random() - 0.5) * 0.03, 0.25 + Math.random() * 0.35, 4);
        if (Math.random() < 0.2) this.piano(note - (Math.random() < 0.5 ? 3 : 4), t + 0.01, 0.2, 4);
      }
      this.step++;
      if (this.step % 16 === 0) this.chordIdx++;
      this.nextNoteTime += beat / 2;
    }
  }

  // ---------- ambience ----------
  startAmbience() {
    const ctx = this.ctx;
    // wind / distant traffic bed
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.06;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lg = ctx.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg).connect(g.gain); lfo.start();
    src.connect(f).connect(g);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 1;
    g.connect(this.windGain).connect(this.ambBus);
    src.start();
    this.ambTimer = setInterval(() => this.ambienceTick(), 250);
  }

  ambienceTick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const level = 0.15 + this.outside * 0.85;
    this.windGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.6);
    if (this.night) {
      if (Math.random() < 0.55) this.cricket(level);
    } else if (Math.random() < 0.09) {
      this.bird(level);
    }
  }

  bird(level) {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const base = 2200 + Math.random() * 2400;
    const notes = 2 + Math.floor(Math.random() * 5);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.ambBus);
    pan.connect(this.reverb);
    for (let i = 0; i < notes; i++) {
      const st = t + i * (0.09 + Math.random() * 0.07);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = base * (0.9 + Math.random() * 0.3);
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.5 : 0.7), st + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.05 * level, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.09);
      o.connect(g).connect(pan);
      o.start(st);
      o.stop(st + 0.1);
    }
  }

  cricket(level) {
    const ctx = this.ctx;
    const t = ctx.currentTime + Math.random() * 0.2;
    const f = 4200 + Math.random() * 600;
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const am = ctx.createOscillator();
    am.frequency.value = 45 + Math.random() * 20;
    const amg = ctx.createGain();
    amg.gain.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.018 * level, t + 0.02);
    env.gain.setValueAtTime(0.018 * level, t + 0.18);
    env.gain.linearRampToValueAtTime(0, t + 0.22);
    am.connect(amg).connect(g.gain);
    o.connect(g).connect(env).connect(this.ambBus);
    o.start(t); am.start(t);
    o.stop(t + 0.25); am.stop(t + 0.25);
  }

  // ---------- effects ----------
  footstep(surface = 'tile') {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const cfg = {
      tile: { type: 'bandpass', freq: 2400, q: 1.2, vol: 0.09, dec: 0.06 },
      wood: { type: 'lowpass', freq: 700, q: 2, vol: 0.2, dec: 0.09 },
      outdoor: { type: 'highpass', freq: 1400, q: 0.5, vol: 0.06, dec: 0.12 },
      grass: { type: 'highpass', freq: 2600, q: 0.3, vol: 0.05, dec: 0.16 },
    }[surface] || { type: 'bandpass', freq: 1800, q: 1, vol: 0.08, dec: 0.07 };
    f.type = cfg.type;
    f.frequency.value = cfg.freq * (0.85 + Math.random() * 0.3);
    f.Q.value = cfg.q;
    g.gain.setValueAtTime(cfg.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.dec);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + cfg.dec + 0.02);
    // heel thump
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(surface === 'wood' ? 110 : 80, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.07);
    const og = ctx.createGain();
    og.gain.setValueAtTime(surface === 'wood' ? 0.14 : 0.07, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(og).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.1);
  }

  door(open = true) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // creak: sawtooth with wobbling pitch through a resonant bandpass
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = open ? 180 : 150;
    o.frequency.setValueAtTime(base, t);
    for (let i = 1; i < 8; i++) o.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.5), t + i * 0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(bp).connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + 0.55);
    // latch click + soft air
    const c = ctx.createBufferSource();
    c.buffer = this.noiseBuf;
    const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 3000;
    const cg = ctx.createGain();
    const ct = open ? t : t + 0.45;
    cg.gain.setValueAtTime(0.18, ct);
    cg.gain.exponentialRampToValueAtTime(0.0001, ct + 0.025);
    c.connect(cf).connect(cg).connect(this.sfxBus);
    c.start(ct, Math.random()); c.stop(ct + 0.03);
    this.whoosh(0.03, 0.6, 400);
  }

  whoosh(vol = 0.08, dur = 1.2, to = 2400) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
    f.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g);
    g.connect(this.sfxBus);
    g.connect(this.reverb);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  chime() {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [[81, 0], [85, 0.09], [88, 0.18]].forEach(([n, dt]) => {
      for (const [m, a] of [[1, 1], [2.76, 0.3], [5.4, 0.12]]) {
        const o = ctx.createOscillator();
        o.frequency.value = midi(n) * m;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + dt);
        g.gain.linearRampToValueAtTime(0.03 * a, t + dt + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 2.2 / m);
        o.connect(g);
        g.connect(this.sfxBus);
        g.connect(this.reverb);
        o.start(t + dt);
        o.stop(t + dt + 2.3);
      }
    });
  }

  click() {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.07);
  }

  lightSwitch() {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const dt of [0, 0.03]) {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.02);
      s.connect(f).connect(g).connect(this.sfxBus);
      s.start(t + dt, Math.random()); s.stop(t + dt + 0.03);
    }
  }

  setNight(n) { this.night = n; }
  setOutside(v) { this.outside = v; }
  setMusic(v) {
    this.musicVol = v;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }
  setSfx(v) {
    this.sfxVol = v;
    if (this.sfxBus) {
      this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
      this.ambBus.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.1);
    }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08);
  }
}
