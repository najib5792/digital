"""Synthesizes the showcase audio entirely in code: a light 112 BPM launch beat plus UI sound effects
timed from cues.json (written by render.mjs from the page's own timeline). Every buffer wraps
around the loop point (sounds, echoes and reverb are circular), so the MP4 loops seamlessly.
Writes soundtrack.wav (48 kHz stereo) and soundtrack.m4a (for live playback in index.html)."""
import json, subprocess, wave
import numpy as np

cfg = json.load(open('cues.json'))
SR, DUR, BPM = 48000, cfg['dur'], cfg['bpm']
BEAT = 60 / BPM
N = int(round(SR * DUR))
rng = np.random.default_rng(3)
music = np.zeros((2, N)); fx = np.zeros((2, N))


def add(bus, sig, t, gain=1.0, pan=0.0):
    """mix a mono signal at time t with constant-power pan, wrapping past the loop point."""
    sig = np.asarray(sig) * gain
    idx = (int(round(t * SR)) + np.arange(len(sig))) % N
    np.add.at(bus[0], idx, sig * np.cos((pan + 1) * np.pi / 4))
    np.add.at(bus[1], idx, sig * np.sin((pan + 1) * np.pi / 4))


def T(d): return np.arange(int(d * SR)) / SR


def lp(x, cutoff):
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y


def hp(x, cutoff): return x - lp(x, cutoff)


def sweep(f0, f1, d, shape=1.0):
    t = T(d); p = (t / d) ** shape
    f = f0 * (f1 / f0) ** p
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def note(m): return 440 * 2 ** ((m - 69) / 12)


# ======================= MUSIC =======================
BAR = 4 * BEAT
CHORDS = {  # warm voicings
    'C': [48, 55, 59, 62, 64], 'G': [43, 50, 57, 59, 62], 'Am': [45, 52, 55, 60, 64],
    'F': [41, 48, 55, 57, 64], 'Em': [40, 47, 55, 59, 62],
}
PROG = ['C', 'G', 'Am', 'F', 'C', 'Em', 'F'] * 2          # 14 bars; F resolves back to C at the loop
ROOT = {'C': 36, 'G': 31, 'Am': 33, 'F': 29, 'Em': 28}

# pad: detuned soft saws + sine body, slow swell, overlapping bars
for b, ch in enumerate(PROG):
    d = BAR + 0.6; t = T(d)
    env = np.minimum(1, t / 0.45) * np.minimum(1, np.maximum(0, d - t) / 0.6)
    sig = np.zeros(len(t))
    for m in CHORDS[ch]:
        f = note(m)
        for det in (-0.004, 0.004):
            sig += (2 * ((t * f * (1 + det)) % 1) - 1) * 0.5
        sig += np.sin(2 * np.pi * f * t) * 0.8
    sig = lp(sig / len(CHORDS[ch]), 1100 + 300 * np.sin(np.pi * t / d)) * env
    add(music, sig, b * BAR, 0.16, -0.25); add(music, np.roll(sig, 300), b * BAR, 0.16, 0.25)

# soft four-on-the-floor pulse, sub bass, gentle snaps and hats
def kick():
    t = T(0.35); f = 48 + 70 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) + hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 600) * 0.05

def snap():
    t = T(0.18); n = hp(lp(rng.standard_normal(len(t)), 5000), 1500)
    return n * np.exp(-t * 38) * 0.6

def hat(d=0.05, dec=90):
    t = T(d); return hp(rng.standard_normal(len(t)), 8000) * np.exp(-t * dec)

beats = int(round(DUR / BEAT))
for k in range(beats):
    tb = k * BEAT
    add(music, kick(), tb, 0.42)
    if k % 2 == 1: add(music, snap(), tb, 0.16, 0.15)
    add(music, hat(), tb + BEAT / 2, 0.07, 0.35)
    add(music, hat(0.03, 140), tb + BEAT / 4, 0.025, -0.35); add(music, hat(0.03, 140), tb + 3 * BEAT / 4, 0.025, -0.35)
    ch = PROG[int(tb // BAR) % len(PROG)]
    t = T(BEAT * 0.95); f = note(ROOT[ch])
    duck = np.minimum(1, t / 0.08)                     # sidechain-style swell after each kick
    add(music, np.sin(2 * np.pi * f * t) * duck * np.exp(-t * 2.5), tb, 0.2)

# plucked synth tune: 2-bar motif, C major pentatonic, echoed on the dotted eighth
MOTIF = [(0, 76), (1.5, 79), (2, 81), (3, 79), (4.5, 76), (5, 74), (6, 72), (7, 74)]  # (8th index, midi)
ANSWER = [(0, 79), (1, 81), (2, 84), (3.5, 81), (4, 79), (5.5, 76), (6, 74), (7, 76)]
def pluck(f, d=0.5):
    t = T(d); tri = 2 * np.abs(2 * ((t * f) % 1) - 1) - 1
    return (np.sin(2 * np.pi * f * t) * 0.7 + tri * 0.35) * np.exp(-t * 7) * np.minimum(1, t / 0.004)
for ph in range(7):
    notes = MOTIF if ph % 2 == 0 else ANSWER
    for eighth, m in notes:
        tn = ph * 2 * BAR + eighth * BEAT / 2
        if ph == 0 and eighth < 2: continue              # leave room for the opening
        s = pluck(note(m))
        add(music, s, tn, 0.085, 0.2)
        add(music, s, tn + BEAT * 0.75, 0.04, -0.4)      # dotted-8th echo
        add(music, s, tn + BEAT * 1.5, 0.018, 0.4)

# ======================= UI SOUND EFFECTS =======================
def tap():
    t = T(0.03); click = hp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 500) * 0.5 + np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 220) * 0.35
    drop = sweep(520, 1500, 0.07, 0.6) * np.exp(-T(0.07) * 45) * np.minimum(1, T(0.07) / 0.002)
    out = np.zeros(int(0.12 * SR)); out[:len(click)] += click
    i = int(0.022 * SR); out[i:i + len(drop)] += drop * 0.55
    return out

def whoosh(d=0.62):
    t = T(d); p = t / d
    x = rng.standard_normal(len(t)); shape = np.sin(np.pi * np.minimum(1, p * 1.15)) ** 2
    band = lp(x, 500 + 3200 * shape) - lp(x, 180 + 700 * shape)
    return hp(band, 150) * shape

def pop_out():
    t = T(0.06); pop = np.sin(2 * np.pi * np.cumsum(260 * np.exp(-t * 30) + 110) / SR) * np.exp(-t * 55)
    rise = sweep(640, 1000, 0.2, 0.8) * np.exp(-T(0.2) * 9) * np.minimum(1, T(0.2) / 0.015)
    out = np.zeros(int(0.26 * SR)); out[:len(pop)] += pop * 0.7; i = int(0.02 * SR); out[i:i + len(rise)] += rise * 0.4
    return out

def sink():
    d = 0.24; return sweep(900, 540, d, 1.0) * np.exp(-T(d) * 10) * np.minimum(1, T(d) / 0.02) * 0.3

def bell(f, d, partials=((1, 1), (2.0, .35), (3.01, .15))):
    t = T(d); return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * (4 + 3 * r)) for r, a in partials) * np.minimum(1, t / 0.003)

def chime():
    out = np.zeros(int(1.2 * SR)); a = bell(note(83), 1.0); b = bell(note(88), 1.0)
    out[:len(a)] += a * 0.5; i = int(0.13 * SR); out[i:i + len(b)] += b[: len(out) - i] * 0.5
    return out

def ding():
    return bell(note(96), 1.4, ((1, 1), (2.0, .3), (2.76, .25), (4.07, .12))) * 0.45 + bell(note(84), 1.4) * 0.25

pan_of = {'whoosh': 0.0}
for c in cfg['cues']:
    t, ty = c['t'], c['type']
    if ty == 'tap': add(fx, tap(), t, 0.8, 0.1)
    elif ty == 'whoosh':
        w = whoosh(); add(fx, w, t - 0.08, 0.32, -0.35); add(fx, np.roll(w, 900), t - 0.08, 0.32, 0.35)
    elif ty == 'pop': add(fx, pop_out(), t, 0.8, 0.2)
    elif ty == 'sink': add(fx, sink(), t, 0.8, -0.1)
    elif ty == 'chime': add(fx, chime(), t, 0.55)
    elif ty == 'ding': add(fx, ding(), t, 0.7)

# ======================= REVERB (circular, so tails wrap the loop) =======================
def reverb(bus, secs, seed, damp):
    t = T(secs); out = np.zeros_like(bus)
    for ch in range(2):
        ir = np.random.default_rng(seed + ch).standard_normal(len(t)) * np.exp(-t * damp)
        ir = lp(ir, 4500); ir /= np.sqrt((ir ** 2).sum())
        out[ch] = np.fft.irfft(np.fft.rfft(bus[ch]) * np.fft.rfft(ir, N), N)
    return out

music = music + reverb(music, 2.2, 10, 3.0) * 0.35
fx = fx + reverb(fx, 1.4, 20, 4.5) * 0.25
mix = music * 0.6 + fx

peak = np.abs(mix).max()
mix = np.tanh(mix / peak * 1.05) / np.tanh(1.05) * 0.89
pcm = (mix.T * 32767).astype('<i2')
with wave.open('soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f'wrote soundtrack.wav ({DUR:.2f}s, {len(cfg["cues"])} cues)')
try:
    import imageio_ffmpeg
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', 'soundtrack.wav', '-c:a', 'aac', '-b:a', '192k', 'soundtrack.m4a'], check=True)
    print('wrote soundtrack.m4a')
except Exception as e:
    print('m4a skipped:', e)
