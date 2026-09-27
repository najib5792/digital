"""Synthesises every sound (effects + music bed) from code and writes audio.wav.

Reads cues.json (written by render.mjs from the animation timeline) so each effect lands on its frame.
"""
import json
import wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)
cfg = json.load(open('cues.json'))
DUR = cfg['duration']
N = int(DUR * SR)


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be a scalar or per-sample array."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def add(buf, sig, at, gain=1.0):
    i = int(round(at * SR))
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    buf[i:i + len(sig)] += sig * gain


# ---------------- effects ----------------
def pop(p):
    # soft bubbly pop, a little higher each call index
    f0 = 520 * 2 ** (p / 12)
    t = t_(0.14)
    f = f0 * (1 + 1.2 * np.exp(-t / 0.012))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.035)
    s += 0.25 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * env(len(t), 0.001, 0.015)
    return s * 0.55


def dab(k):
    # tiny felt pen dab: short soft filtered noise tap
    n = int(0.035 * SR)
    s = lowpass(rng.standard_normal(n), 2600 + 150 * k) * env(n, 0.001, 0.008)
    return highpass(s, 300) * 1.6


def tick():
    out = np.zeros(int(0.4 * SR))
    for j, m in enumerate([88, 95]):  # E6 -> B6, bright two-note
        t = t_(0.25)
        s = (np.sin(2 * np.pi * midi(m) * t) + 0.3 * np.sin(2 * np.pi * midi(m) * 3 * t)) * env(len(t), 0.001, 0.07)
        add(out, s, j * 0.075, 0.35)
    return out


def bell():
    t = t_(2.2)
    f = midi(72)  # C5, warm
    s = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 1.4), (2.0, .5, .9), (2.76, .35, .6), (5.4, .15, .3), (8.93, .06, .15)]:
        s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / dec)
    return s * np.minimum(t / 0.002, 1) * 0.28


MARIMBA_SCALE = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95]  # D major pentatonic, rising


def marimba_note(m, dur=0.5, gain=1.0):
    t = t_(dur)
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.18) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.025)
    return s * np.minimum(t / 0.001, 1) * gain


def nope():
    # friendly low "no-pe": two soft falling tones
    out = np.zeros(int(0.5 * SR))
    for j, (m0, m1) in enumerate([(55, 53), (50, 47)]):
        t = t_(0.2)
        f = midi(m0) + (midi(m1) - midi(m0)) * t / 0.2
        ph = 2 * np.pi * np.cumsum(f) / SR
        s = (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * env(len(t), 0.01, 0.12)
        add(out, lowpass(s, 1400), j * 0.15, 0.4)
    return out


def whoosh(dur):
    n = int((dur + 0.15) * SR)
    x = np.linspace(0, 1, n)
    shape = np.sin(np.pi * np.clip(x * 1.05, 0, 1)) ** 2
    cut = 500 + 3500 * np.sin(np.pi * x)
    s = highpass(lowpass(rng.standard_normal(n), cut), 250) * shape
    return s * 0.22


def swell():
    n = int(1.9 * SR)
    t = np.arange(n) / SR
    shape = np.where(t < 1.25, (t / 1.25) ** 2, np.exp(-(t - 1.25) / 0.25))
    air = lowpass(rng.standard_normal(n), 400 + 3000 * np.clip(t / 1.25, 0, 1)) * 0.7
    pad = sum(np.sin(2 * np.pi * midi(m) * t + k) for k, m in enumerate([62, 66, 69, 74])) / 4
    return (air * 0.25 + pad * 0.18) * shape


fx = np.zeros(N)
for c in cfg['cues']:
    typ, p, at = c['type'], c['p'], c['t']
    if typ == 'pop':
        add(fx, pop(p), at)
    elif typ == 'dab':
        add(fx, dab(p), at, 0.5)
    elif typ == 'tick':
        add(fx, tick(), at)
    elif typ == 'bell':
        add(fx, bell(), at)
    elif typ == 'marimba':
        add(fx, marimba_note(MARIMBA_SCALE[int(p)], 0.6, 0.3), at)
    elif typ == 'nope':
        add(fx, nope(), at)
    elif typ == 'whoosh':
        add(fx, whoosh(p), at)
    elif typ == 'swell':
        add(fx, swell(), at)

# ---------------- music bed: 120 bpm, D major, loops cleanly at DUR ----------------
BPM = 120
beat = 60 / BPM          # 0.5 s ; 15 s = 30 beats
mus = np.zeros(N)
# 5 chords x 6 beats = 30 beats = exactly the video length -> seamless loop
CHORDS = [  # (bass root, arpeggio notes)
    (38, [62, 66, 69, 74]),  # D
    (45, [61, 64, 69, 73]),  # A
    (47, [62, 66, 71, 74]),  # Bm
    (43, [62, 67, 71, 74]),  # G
    (45, [61, 64, 69, 76]),  # A
]
ARP = [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 1]  # 12 eighth notes per chord


def wrap_add(buf, sig, at, gain=1.0):
    """Add with wrap-around so tails ring into the loop start (seamless loop)."""
    i = int(round(at * SR)) % len(buf)
    sig = sig * gain
    end = min(len(buf), i + len(sig))
    buf[i:end] += sig[: end - i]
    rest = sig[end - i:]
    if len(rest):
        buf[: len(rest)] += rest


def pluck_bass(m):
    t = t_(0.6)
    f = midi(m)
    ph = 2 * np.pi * f * t
    s = np.sin(ph) + 0.5 * np.sin(2 * ph) * np.exp(-t / 0.05) + 0.25 * np.sin(3 * ph) * np.exp(-t / 0.03)
    return s * env(len(t), 0.003, 0.22)


def kick():
    t = t_(0.3)
    f = 50 + 90 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.001, 0.12)


def clap():
    n = int(0.2 * SR)
    s = highpass(lowpass(rng.standard_normal(n), 2500), 900)
    e = np.zeros(n)
    for o in (0, 0.01, 0.02):
        k = int(o * SR)
        e[k:] += np.exp(-np.arange(n - k) / SR / (0.012 if o < 0.02 else 0.06))
    return s * e * 0.5


def shaker():
    n = int(0.06 * SR)
    return highpass(rng.standard_normal(n), 6000) * env(n, 0.01, 0.015)


for ci, (root, notes) in enumerate(CHORDS):
    c0 = ci * 6 * beat
    for k, idx in enumerate(ARP):
        wrap_add(mus, marimba_note(notes[idx], 0.7), c0 + k * beat / 2, 0.20 if k % 2 == 0 else 0.14)
    for b in range(6):
        tb = c0 + b * beat
        gb = ci * 6 + b  # global beat
        if b in (0, 3):
            wrap_add(mus, pluck_bass(root), tb, 0.45)
        if b in (2, 5):
            wrap_add(mus, pluck_bass(root + 12 if b == 5 else root + 7), tb + beat / 2, 0.30)
        if gb % 2 == 0:
            wrap_add(mus, kick(), tb, 0.55)
        else:
            wrap_add(mus, clap(), tb, 0.30)
        for s16 in range(4):
            wrap_add(mus, shaker(), tb + s16 * beat / 4, 0.10 if s16 % 2 else 0.05)

# simple stereo: marimba bed slightly wide via short delay on the right
mus /= np.max(np.abs(mus)) + 1e-9
fx_peak = np.max(np.abs(fx)) + 1e-9
fx = fx / fx_peak * 0.85
music_gain = 0.16  # well under the effects
L = fx + mus * music_gain
R = fx + np.roll(mus, int(0.012 * SR)) * music_gain
st = np.stack([L, R], 1)
st /= max(1.0, np.max(np.abs(st)) / 0.95)
pcm = (st * 32767).astype(np.int16)
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote audio.wav', pcm.shape[0] / SR, 's, cues:', len(cfg['cues']))
