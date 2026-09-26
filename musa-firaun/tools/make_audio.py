"""Synthesize the 60 s score + sound design for the film (no samples needed).

Music: D Hijaz (D Eb F# G A Bb C) — mysterious oud and ney at first, frame
drums as tension grows, fast pulse for the chase, a big swell when the sea
parts, then a peaceful D-major close.
SFX: desert wind, Nile water, crowd murmur, fire, frogs, locusts, thunder,
hooves and chariot wheels, rushing sea.

Writes ../soundtrack.wav (and ../soundtrack.m4a when ffmpeg is available).
"""
import os, shutil, subprocess, wave
import numpy as np
from scipy import signal

SR = 44100
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
HERE = os.path.dirname(os.path.abspath(__file__))

# scene starts — keep in sync with film.js SCENES durations
DURS = [5.0, 4.8, 5.5, 4.5, 5.0, 5.5, 4.0, 4.2, 4.5, 4.2, 5.5, 7.3]
ST = np.concatenate([[0], np.cumsum(DURS)])
S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, END = ST

t_all = np.arange(N) / SR
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def idx(t):
    return int(np.clip(t * SR, 0, N))


def env_curve(points):
    """Piecewise-linear envelope over the whole timeline: [(t, v), ...]."""
    ts, vs = zip(*points)
    return np.interp(t_all, ts, vs)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def smooth_noise(n, rate):
    """Slow random modulation in [0, 1] with ~`rate` changes per second."""
    k = max(2, int(n / SR * rate) + 2)
    pts = rng.random(k)
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)


def add(buf, t0, x, gain=1.0, pan=0.0):
    i = idx(t0)
    j = min(N, i + len(x))
    if j <= i:
        return
    x = x[: j - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:j, 0] += x * l * 1.414
    buf[i:j, 1] += x * r * 1.414


# ------------------------------------------------------------------ instruments
def pluck(freq, dur, bright=0.5):
    """Karplus-Strong oud-like pluck."""
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p)
    buf = lp(buf, 1500 + 4000 * bright, 1)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    out += 0.3 * np.sin(2 * np.pi * freq * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 5)
    return out * np.exp(-np.arange(n) / SR * 1.2)


def ney(freq, dur, vib=5.2):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    att = np.minimum(1, tt / 0.18) * np.minimum(1, (dur - tt) / 0.35).clip(0)
    vibrato = 1 + 0.006 * np.sin(2 * np.pi * vib * tt) * np.minimum(1, tt / 0.6)
    ph = 2 * np.pi * np.cumsum(freq * vibrato) / SR
    tone = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    breath = bp(rng.normal(0, 1, n), freq * 0.9, min(freq * 3.5, 18000)) * 0.35
    return (tone + breath) * att


def pad(freqs, dur, bright=900, detune=0.004):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0, detune):
            ph = (f * (1 + d) * tt + rng.random()) % 1.0
            out += (2 * ph - 1)
    out = lp(out / (len(freqs) * 3), bright, 2)
    return out


def dum(gain=1.0):
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    f = 55 + 70 * np.exp(-tt * 25)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
    x += lp(rng.normal(0, 1, n), 400) * np.exp(-tt * 40) * 0.3
    return x * gain


def tek(gain=1.0):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    x = bp(rng.normal(0, 1, n), 2500, 7000) * np.exp(-tt * 55)
    x += np.sin(2 * np.pi * 640 * tt) * np.exp(-tt * 45) * 0.3
    return x * gain


def boom(gain=1.0, length=2.5, f0=48):
    n = int(length * SR)
    tt = np.arange(n) / SR
    f = f0 + 40 * np.exp(-tt * 8)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    x += lp(rng.normal(0, 1, n), 250) * np.exp(-tt * 3) * 0.6
    return x * gain


def cymbal(length=3.0):
    n = int(length * SR)
    tt = np.arange(n) / SR
    x = hp(rng.normal(0, 1, n), 4000) * np.exp(-tt * 1.6) * np.minimum(1, tt / 0.3)
    return x


def bell(freq, length=2.0):
    n = int(length * SR)
    tt = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt * d)
            for r, a, d in [(1, 1, 2.5), (2.76, 0.5, 4), (5.4, 0.25, 6), (8.9, 0.12, 9)])
    return x * np.minimum(1, tt / 0.005)


def reverb(x, length=2.2, decay=3.0, mix=0.35):
    n = int(length * SR)
    tt = np.arange(n) / SR
    ir_l = rng.normal(0, 1, n) * np.exp(-tt * decay)
    ir_r = rng.normal(0, 1, n) * np.exp(-tt * decay)
    ir_l = lp(ir_l, 5000); ir_r = lp(ir_r, 5000)
    ir_l /= np.sqrt((ir_l ** 2).sum()); ir_r /= np.sqrt((ir_r ** 2).sum())
    wet = np.stack([signal.fftconvolve(x[:, 0], ir_l)[:len(x)], signal.fftconvolve(x[:, 1], ir_r)[:len(x)]], 1)
    return x * (1 - mix) + wet * mix * 1.2


# ------------------------------------------------------------------ MUSIC
D2, A2, D3, F3s, A3, D4 = 38, 45, 50, 54, 57, 62
HIJAZ = {'D': 62, 'Eb': 63, 'F#': 66, 'G': 67, 'A': 69, 'Bb': 70, 'C': 72, 'D5': 74, 'C4': 60, 'A3': 57}

# drone bed across the whole piece
drone = pad([mtof(D2), mtof(A2), mtof(D3)], DUR, bright=700)
drone_env = env_curve([(0, 0), (1.5, 0.22), (S6, 0.24), (S7, 0.3), (S10, 0.34), (S11, 0.2),
                       (S11 + 0.5, 0.0), (S12, 0.0), (END, 0)])
add(music, 0, drone * drone_env, 1.0)

# mysterious oud phrases (scenes 1-5)
oud_line = [
    (0.6, 'D', 0.8), (1.2, 'Eb', 0.5), (1.6, 'F#', 1.0), (2.8, 'G', 0.5), (3.2, 'F#', 0.5), (3.6, 'Eb', 0.5), (4.2, 'D', 1.2),
    (5.4, 'A3', 0.6), (6.0, 'D', 0.5), (6.5, 'Eb', 0.5), (7.0, 'D', 0.8), (7.9, 'C4', 0.5), (8.4, 'D', 1.2),
    (9.9, 'F#', 0.6), (10.5, 'G', 0.6), (11.1, 'A', 1.2), (12.4, 'Bb', 0.5), (12.9, 'A', 0.5), (13.4, 'G', 0.6), (14.0, 'F#', 1.2),
    (15.3, 'D', 0.6), (15.9, 'F#', 0.6), (16.5, 'A', 1.0), (17.6, 'G', 0.6), (18.2, 'F#', 0.6), (18.8, 'D', 1.2),
]
for t0, note, d in oud_line:
    x = pluck(mtof(HIJAZ[note]), d + 1.2, 0.45)
    add(music, t0, x, 0.32, pan=-0.25)
    # soft octave-down double
    add(music, t0 + 0.01, pluck(mtof(HIJAZ[note] - 12), d + 1.0, 0.3), 0.12, pan=0.2)

# ney melody over the burning bush and the palace
ney_line = [
    (S5 + 0.4, 'A', 1.6), (S5 + 2.1, 'Bb', 0.8), (S5 + 2.9, 'A', 0.8), (S5 + 3.7, 'G', 1.3),
    (S6 + 0.2, 'F#', 1.2), (S6 + 1.5, 'G', 0.6), (S6 + 2.1, 'A', 1.4), (S6 + 3.6, 'G', 0.6), (S6 + 4.2, 'F#', 1.1),
    (S7 + 0.1, 'Eb', 1.0), (S7 + 1.2, 'D', 2.2),
]
for t0, note, d in ney_line:
    add(music, t0, ney(mtof(HIJAZ[note]), d + 0.2), 0.16, pan=0.15)

# frame drums: maqsum grows from the palace to the signs and the exodus
def maqsum(t0, t1, bpm, g):
    beat = 60 / bpm
    pat = [('d', 0), ('t', 1), ('t', 2), ('d', 2.5), ('t', 3)]
    bar = 4 * beat
    t = t0
    while t < t1:
        for kind, b in pat:
            tt = t + b * beat
            if tt < t1:
                add(music, tt, dum(g) if kind == 'd' else tek(g * 0.6), 1, pan=-0.1 if kind == 'd' else 0.2)
        t += bar


maqsum(S6 + 0.4, S7, 84, 0.18)
maqsum(S7, S8, 92, 0.30)
maqsum(S8, S9, 100, 0.34)
maqsum(S9, S10, 100, 0.24)
# chase: urgent pulse + low ostinato
beat = 60 / 150
t = S10
while t < S11 - 0.05:
    add(music, t, dum(0.45), 1)
    add(music, t + beat / 2, tek(0.35), 1, pan=0.3)
    t += beat
t = S10
k = 0
while t < S11 - 0.05:
    n = [D2, D2, 51, D2, 49, D2, 51, 52][k % 8]
    x = pad([mtof(n), mtof(n + 12)], beat / 2 * 0.9, bright=1400, detune=0.002)
    x *= np.exp(-np.arange(len(x)) / SR * 6)
    add(music, t, x, 0.5)
    t += beat / 2
    k += 1
# rising tension swell into the sea
sw = pad([mtof(D3), mtof(63 - 12), mtof(A3)], S11 - S10 + 0.5, bright=1800)
sw *= np.linspace(0, 1, len(sw)) ** 2
add(music, S10, sw, 0.35)

# pharaoh rises — deep hit; signs montage hits on each panel
add(music, S7 + 0.4, boom(0.55), 1)
for k in range(4):
    add(music, S8 + k * (S9 - S8) / 4, boom(0.35, 1.2, 60), 1)

# CLIMAX: the sea parts
climax = pad([mtof(D3), mtof(A3), mtof(D4), mtof(66), mtof(69), mtof(74)], S12 - S11 + 1.0, bright=2400, detune=0.006)
cl_env = np.interp(np.arange(len(climax)) / SR, [0, 1.0, 2.2, 4.8, 6.0, 6.5], [0.0, 0.25, 1.0, 0.9, 0.2, 0.0])
add(music, S11, climax * cl_env, 0.5)
# choir-ish "aah" (formant filtered saws)
ch = pad([mtof(57), mtof(62), mtof(66)], S12 - S11 + 0.8, bright=3000, detune=0.008)
ch = bp(ch, 600, 1300) * 2.2 + bp(ch, 2200, 3000) * 0.8
add(music, S11 + 1.0, ch * np.interp(np.arange(len(ch)) / SR, [0, 1.2, 4.0, 5.3], [0, 1, 0.8, 0]), 0.35)
add(music, S11 + 1.2, boom(1.0, 3.0, 40), 1)
add(music, S11 + 1.2, cymbal(3.5), 0.12)
for k in range(10):   # timpani roll
    add(music, S11 + 0.2 + k * 0.1, boom(0.12 + k * 0.03, 0.6, 70), 1, pan=0.2)
add(music, S11 + 0.6, bell(mtof(81), 2.5), 0.12, pan=0.3)
add(music, S11 + 0.75, bell(mtof(86), 2.5), 0.08, pan=-0.3)

# peaceful, hopeful ending in D major
end_pad = pad([mtof(D3), mtof(F3s), mtof(A3), mtof(D4)], END - S12, bright=1200, detune=0.003)
end_pad *= np.interp(np.arange(len(end_pad)) / SR, [0, 1.5, 4.5, 6.5], [0, 1, 0.8, 0])
add(music, S12, end_pad, 0.3)
for t0, m in [(0.4, 62), (1.0, 66), (1.6, 69), (2.4, 74), (3.2, 73), (3.8, 69), (4.6, 66), (5.2, 62)]:
    add(music, S12 + t0, pluck(mtof(m), 1.8, 0.35), 0.28, pan=-0.2)
add(music, S12 + 0.3, bell(mtof(78), 3), 0.05)

music = reverb(music, 2.6, 2.4, 0.38)

# ------------------------------------------------------------------ SFX
white = rng.normal(0, 1, N)

# desert wind: always present, swells in scenes 4 and 11
wind = bp(white, 180, 1400) * (0.4 + 0.6 * smooth_noise(N, 0.6))
wind_env = env_curve([(0, 0.05), (S2, 0.06), (S3, 0.03), (S4, 0.11), (S5, 0.05), (S6, 0.01), (S8, 0.01),
                      (S8 + 0.75 * (S9 - S8), 0.08), (S9, 0.06), (S10, 0.06), (S11, 0.08), (S11 + 0.8, 0.26), (S11 + 3, 0.22),
                      (S12, 0.06), (END - 1, 0.04), (END, 0)])
w2 = bp(rng.normal(0, 1, N), 180, 1400) * (0.4 + 0.6 * smooth_noise(N, 0.5))
sfx[:, 0] += wind * wind_env
sfx[:, 1] += w2 * wind_env

# Nile water (scenes 1 & 3, a little in the frog panel)
bubbles = bp(rng.normal(0, 1, N), 350, 2600) * (smooth_noise(N, 9) ** 2)
water_env = env_curve([(0, 0.05), (S2 - 0.3, 0.05), (S2 + 0.3, 0), (S3 - 0.3, 0), (S3 + 0.3, 0.14), (S4 - 0.3, 0.12),
                       (S4 + 0.3, 0), (S8, 0.05), (S8 + 0.25 * (S9 - S8), 0), (END, 0)])
add(sfx, 0, bubbles * water_env, 1, pan=-0.2)

# crowd murmur (babble) — Egypt, labour, exodus, arrival
babble = sum(bp(rng.normal(0, 1, N), 250 + 200 * k, 900 + 350 * k) * smooth_noise(N, 4 + k) for k in range(5))
crowd_env = env_curve([(0, 0.03), (S2, 0.06), (S3, 0.0), (S9, 0.0), (S9 + 0.3, 0.05), (S10, 0.02),
                       (S11 + 3.2, 0.02), (S12, 0.05), (END - 1.5, 0.03), (END, 0)])
add(sfx, 0, babble * crowd_env, 1, pan=0.1)

# labour: rhythmic thuds of bricks in scene 2
for k in range(6):
    add(sfx, S2 + 0.4 + k * 0.7, boom(0.10, 0.4, 90), 1, pan=0.3)

# burning bush: soft roar + crackles
roar = lp(rng.normal(0, 1, N), 500) * (0.6 + 0.4 * smooth_noise(N, 3))
add(sfx, 0, roar * env_curve([(0, 0), (S5, 0), (S5 + 0.6, 0.12), (S6 - 0.2, 0.12), (S6 + 0.3, 0), (END, 0)]), 1, pan=0.4)
for k in range(70):
    tt = S5 + rng.random() * (S6 - S5)
    n = int(0.02 * SR)
    add(sfx, tt, hp(rng.normal(0, 1, n), 2000) * np.exp(-np.arange(n) / SR * 300), 0.18 * rng.random(), pan=0.4)
# torches in the palace
add(sfx, S6, roar[:int((S8 - S6) * SR)] * 0.03, 1)
# spear clank as the guards react
for k, tt in enumerate([S7 + 0.85, S7 + 0.95, S7 + 1.05]):
    add(sfx, tt, bell(900 + 230 * k, 0.5), 0.07, pan=(-0.5 + k * 0.5))

# signs: frogs, locusts, thunder, dry wind
for k in range(14):
    tt = S8 + 0.05 + rng.random() * 0.25 * (S9 - S8)
    n = int(0.22 * SR)
    ts = np.arange(n) / SR
    f = 180 + rng.random() * 160
    x = np.sin(2 * np.pi * f * ts) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * ts))) * np.exp(-ts * 9)
    add(sfx, tt, lp(x, 1400), 0.16, pan=rng.uniform(-0.7, 0.7))
n = int(1.3 * SR)
buzz = bp(rng.normal(0, 1, n), 1800, 6000) * (0.6 + 0.4 * np.sin(2 * np.pi * 42 * np.arange(n) / SR))
buzz *= np.interp(np.arange(n) / SR, [0, 0.3, 1.0, 1.3], [0, 1, 1, 0])
add(sfx, S8 + 0.25 * (S9 - S8), buzz, 0.12, pan=-0.3)
add(sfx, S8 + 0.64 * (S9 - S8), lp(rng.normal(0, 1, int(2.2 * SR)), 160) * np.exp(-np.arange(int(2.2 * SR)) / SR * 1.6), 0.5)

# chase: galloping hooves + chariot wheels
stride = 0.42
t = S10 - 0.15
while t < S11 + 0.1:
    for off in (0, 0.07, 0.19, 0.26):
        n = int(0.09 * SR)
        ts = np.arange(n) / SR
        hit = lp(rng.normal(0, 1, n), 900) * np.exp(-ts * 60) + np.sin(2 * np.pi * 95 * ts) * np.exp(-ts * 45)
        add(sfx, t + off + rng.uniform(-0.01, 0.01), hit, 0.30, pan=rng.uniform(-0.3, 0.3))
    t += stride
rumble = lp(rng.normal(0, 1, N), 220) * (0.7 + 0.3 * np.sin(2 * np.pi * 6 * t_all))
add(sfx, 0, rumble * env_curve([(0, 0), (S10 - 0.3, 0), (S10 + 0.2, 0.35), (S11, 0.3), (S11 + 0.5, 0), (END, 0)]), 1)
for k in range(60):
    tt = S10 + rng.random() * (S11 - S10)
    n = int(0.03 * SR)
    add(sfx, tt, bp(rng.normal(0, 1, n), 1500, 5000) * np.exp(-np.arange(n) / SR * 150), 0.08, pan=rng.uniform(-0.5, 0.5))

# sea parting: rising whoosh, then a powerful rushing wall of water
n = int(1.6 * SR)
ts = np.arange(n) / SR
whoosh = np.zeros(n)
noise = rng.normal(0, 1, n)
for k in range(8):
    seg = slice(k * n // 8, (k + 1) * n // 8)
    lo = 200 * (1.5 ** k)
    whoosh[seg] = bp(noise, lo, min(lo * 4, 18000))[seg]
whoosh *= (ts / ts[-1]) ** 2
add(sfx, S11 + 0.2, whoosh, 0.3)
rush_l = lp(rng.normal(0, 1, N), 3200) * (0.7 + 0.3 * smooth_noise(N, 2))
rush_r = lp(rng.normal(0, 1, N), 3200) * (0.7 + 0.3 * smooth_noise(N, 2))
rush_env = env_curve([(0, 0), (S11 + 1.1, 0), (S11 + 1.8, 0.34), (S12 - 0.4, 0.3), (S12 + 0.6, 0.05), (S12 + 2.4, 0.08),
                      (S12 + 3.5, 0.02), (END, 0.01)])
sfx[:, 0] += rush_l * rush_env
sfx[:, 1] += rush_r * rush_env
add(sfx, S11 + 1.2, lp(rng.normal(0, 1, int(2.5 * SR)), 120) * np.exp(-np.arange(int(2.5 * SR)) / SR * 1.2), 0.6)
# gentle shore waves and a few dawn birds at the end
waves = lp(rng.normal(0, 1, N), 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * t_all / 3.2) ** 2)
add(sfx, 0, waves * env_curve([(0, 0), (S12, 0), (S12 + 1, 0.06), (END - 1, 0.05), (END, 0)]), 1, pan=-0.4)
for k in range(6):
    tt = S12 + 1.5 + k * 0.7 + rng.random() * 0.3
    n = int(0.16 * SR)
    ts = np.arange(n) / SR
    f = 2600 + 900 * np.sin(np.pi * ts / ts[-1])
    add(sfx, tt, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * ts / ts[-1]), 0.03, pan=0.5)

# ------------------------------------------------------------------ NARRATION
# narration/NN.wav from tools/make_narration.mjs. Each line is slowed with
# ffmpeg's pitch-preserving atempo (to at most 1.22x) to fill its scene,
# starting 0.25 s in and ending >= 0.3 s before the next scene.
LEAD, TAIL, MAX_STRETCH = 0.25, 0.3, 1.22
narr = np.zeros(N)
cues = []
ff = os.environ.get('FFMPEG') or shutil.which('ffmpeg')
ndir = os.path.join(HERE, '..', 'narration')
for i in range(12):
    src = os.path.join(ndir, f'{i + 1:02d}.wav')
    if not os.path.exists(src) or not ff:
        continue
    with wave.open(src) as w:
        sr0 = w.getframerate()
        raw_len = w.getnframes() / sr0
    slot = DURS[i] - LEAD - TAIL
    stretch = min(MAX_STRETCH, max(1.0, slot / raw_len))
    pcm = subprocess.run([ff, '-loglevel', 'error', '-i', src, '-af', f'atempo={1 / stretch:.4f}',
                          '-ar', str(SR), '-ac', '1', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, '<i2') / 32768.0
    x = hp(x, 90)
    x = x + 0.35 * bp(x, 2000, 5000)            # a little presence
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    t0 = ST[i] + LEAD
    j0 = idx(t0)
    j1 = min(N, j0 + len(x))
    narr[j0:j1] += x[: j1 - j0]
    cues.append((t0, t0 + len(x) / SR, stretch))
    print(f'line {i + 1:2d}: {t0:5.2f}-{t0 + len(x) / SR:5.2f}s  x{stretch:.2f}')

# duck music + sfx under the voice (smooth 0.25 s ramps)
duck = np.ones(N)
for a0, a1, _ in cues:
    duck[idx(a0 - 0.1):idx(a1 + 0.15)] = 0.42
k = int(0.25 * SR)
duck = np.convolve(duck, np.ones(k) / k, mode='same')
narr_st = np.stack([narr, narr], 1)
narr_st = reverb(narr_st, 0.8, 7.0, 0.12)

# ------------------------------------------------------------------ mix
mix = (music * 0.9 + sfx * 0.85) * duck[:, None]
fade = np.ones(N)
fade[: int(0.5 * SR)] = np.linspace(0, 1, int(0.5 * SR))
fade[-int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR)) ** 1.5
mix *= fade[:, None]
mix = hp(mix.T, 30).T
mix = mix / np.max(np.abs(mix)) * 0.85            # music + sfx bed
mix += narr_st / (np.max(np.abs(narr_st)) + 1e-9) * 0.85
mix = np.tanh(mix * 1.1) / np.tanh(1.1) * 0.89     # gentle soft-limit
out = os.path.join(HERE, '..', 'soundtrack.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out)

texts = [l.split("text: '")[1].split("'")[0] for l in open(os.path.join(HERE, '..', 'film.js'), encoding='utf-8')
         if "{ id: '" in l]
def srt_t(x):
    ms = int(round(x * 1000))
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'
if cues:
    with open(os.path.join(HERE, '..', 'narration_ms.srt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(f'{n + 1}\n{srt_t(a0)} --> {srt_t(a1)}\n{texts[n]}\n' for n, (a0, a1, _) in enumerate(cues)))

if ff:
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', out, '-c:a', 'aac', '-b:a', '192k',
                    os.path.join(HERE, '..', 'soundtrack.m4a')], check=True)
    print('wrote soundtrack.m4a')
