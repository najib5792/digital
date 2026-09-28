"""Synthesizes the 20 s showreel soundtrack, hit-synced to the timeline in index.html.
120 BPM, A minor. Writes soundtrack.wav (48 kHz stereo) and soundtrack.m4a (for live playback)."""
import subprocess, wave
import numpy as np

SR, DUR, BPM = 48000, 20.0, 120
BEAT = 60 / BPM
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)


def at(t): return int(t * SR)


def add(sig, t, gain=1.0, pan=0.0):
    i = at(t)
    if i >= N: return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414


def env(n, a=0.005, d=0.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d * curve / 4)
    return e


def lp(x, cutoff):
    """one-pole low-pass; cutoff may be an array (sweeps)."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y


def hp(x, cutoff): return x - lp(x, cutoff)


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0, detune):
        ph = (t * f * (1 + d)) % 1
        out += 2 * ph - 1
    return out / 3


def note(m): return 440 * 2 ** ((m - 69) / 12)


# ---------- drums ----------
def kick(big=False):
    n = at(0.5 if not big else 1.6)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28) if not big else 32 + 140 * np.exp(-t * 14)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * (7 if not big else 2.2))
    click = rng.standard_normal(n) * np.exp(-t * 400) * 0.3
    return np.tanh((s + click) * 1.6)


def snare():
    n = at(0.3); t = np.arange(n) / SR
    noise = hp(rng.standard_normal(n), 1200) * np.exp(-t * 18)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (noise * 0.7 + body * 0.5)


def clap():
    n = at(0.35); t = np.arange(n) / SR
    e = sum(np.exp(-np.maximum(0, t - k * 0.011) * 90) * (t >= k * 0.011) for k in range(3)) + np.exp(-t * 16) * 0.6
    return hp(rng.standard_normal(n), 900) * e * 0.5


def hat(open_=False):
    n = at(0.25 if open_ else 0.06); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (14 if open_ else 70))


def impact(size=1.0):
    n = at(2.5); t = np.arange(n) / SR
    boom = kick(big=True)
    noise = lp(rng.standard_normal(n), 2500 * np.exp(-t * 2) + 200) * np.exp(-t * 2.5)
    out = noise * 0.6
    out[: len(boom)] += boom * 1.1
    return out * size


def riser(length, top=6000):
    n = at(length); t = np.arange(n) / SR; p = t / length
    noise = rng.standard_normal(n)
    sw = lp(noise, 300 + top * p ** 2) - lp(noise, 150 + top * 0.4 * p ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1400 * p ** 3) / SR) * 0.15
    return (sw * 1.2 + tone) * p ** 2.2


def whoosh(length=0.45):
    n = at(length); t = np.arange(n) / SR; p = t / length
    x = rng.standard_normal(n)
    shape = np.sin(np.pi * p) ** 2
    return lp(x, 400 + 5000 * shape) * shape * 0.8


def blip(freq, d=0.12, kind='sine'):
    n = at(d); t = np.arange(n) / SR
    w = np.sin(2 * np.pi * freq * t) if kind == 'sine' else np.sign(np.sin(2 * np.pi * freq * t)) * 0.4
    return w * np.exp(-t * 30)


def pluck(freq, d=0.35):
    n = at(d); t = np.arange(n) / SR
    s = saw(freq, n, 0.004)
    return lp(s, 800 + 5000 * np.exp(-t * 18)) * np.exp(-t * 9)


def key_click():
    n = at(0.03); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 2500) * np.exp(-t * 250) * 0.5


# ---------- harmony: Am – F – C – G (2 s per bar) ----------
CHORDS = [[57, 60, 64, 71], [53, 57, 60, 67], [48, 55, 60, 64], [55, 59, 62, 67]]
ROOTS = [33, 29, 36, 31]


def chord_at(t): return int((t // (4 * BEAT)) % 4)


# pad (whole track), sidechained by the kick once the groove starts
pad = np.zeros(N)
for bar in range(10):
    t0 = bar * 2.0
    n = at(2.3)
    ch = CHORDS[bar % 4]
    tone = sum(saw(note(m), n, 0.006) for m in ch) / 4
    tt = np.arange(n) / SR
    e = np.minimum(1, tt / 0.25) * np.minimum(1, np.maximum(0, (2.3 - tt)) / 0.3)
    seg = tone * e
    i = at(t0); seg = seg[: N - i]
    pad[i:i + len(seg)] += seg
cut = np.interp(np.arange(N) / SR, [0, 1.9, 2.0, 4, 18, 20], [500, 1400, 2600, 3200, 5000, 900])
pad = lp(pad, cut)
side = np.ones(N)
for b in range(int(4.0 / BEAT), int(18.0 / BEAT)):
    i = at(b * BEAT); n = at(0.3)
    side[i:i + n] = np.minimum(side[i:i + n], 0.25 + 0.75 * (np.arange(n) / n) ** 0.7)
pad_gain = np.interp(np.arange(N) / SR, [0, 1.5, 2.0, 18.0, 19.2, 20], [0.15, 0.25, 0.4, 0.4, 0.55, 0.0])
pad *= side * pad_gain
L += pad; R += np.roll(pad, 240)

# ---------- S1 boot: typing + blips + riser ----------
for a, b, s in [(0.18, 0.42, 'npm run build'), (1.08, 1.30, 'deploy --prod')]:
    for k in range(len(s)):
        add(key_click(), a + (b - a) * k / len(s), 1.1, rng.uniform(-.3, .3))
for t in (0.08, 0.5, 0.82, 0.96):
    add(blip(1760, 0.08), t, 0.3, 0.2)
add(blip(1318, 0.25) + np.pad(blip(1976, 0.25), (at(0.06), 0))[:at(0.25)], 1.42, 0.25)
add(riser(1.0, 7000), 1.0, 0.7)

# ---------- impacts & transitions ----------
add(impact(1.0), 2.0, 1.0)
for t in (3.0, 3.33, 3.66):
    add(snare(), t, 0.8); add(kick(), t, 0.9)
    stab = sum(pluck(note(m + 12), 0.3) for m in CHORDS[0]) / 3
    add(stab, t, 0.45)
add(riser(0.5, 5000), 3.5, 0.5)
add(impact(0.6), 4.0, 0.8)
for t, s in ((7.6, 0.5), (11.6, 0.45), (15.1, 0.45)):
    add(riser(0.4, 6000), t, s)
for t, s in ((8.0, 0.7), (12.0, 0.65), (15.5, 0.55)):
    add(impact(s), t, 0.85)
add(riser(1.0, 9000), 17.0, 0.9)
add(impact(1.2), 18.0, 1.1)
for t in (3.88, 7.84, 11.8, 15.3, 17.62):
    add(whoosh(0.4), t, 0.5, rng.uniform(-.5, .5))

# ---------- groove 4.0 – 18.0 ----------
b = 4.0
while b < 17.99:
    beat_i = round((b - 4.0) / BEAT)
    add(kick(), b, 0.95)
    if beat_i % 2 == 1: add(clap(), b, 0.55, 0.1)
    for k in range(4):
        tt = b + k * BEAT / 4
        if k == 2: add(hat(True), tt, 0.16, 0.35)
        else: add(hat(), tt, 0.10 if k else 0.06, -0.3)
    # bass: 8ths on the root
    for k in range(2):
        tt = b + k * BEAT / 2
        f = note(ROOTS[chord_at(tt)])
        n = at(BEAT / 2 * 0.9)
        tone = lp(saw(f, n, 0.003), 500) * env(n, 0.004, 0.25) + np.sin(2 * np.pi * f * np.arange(n) / SR) * env(n, 0.004, 0.3) * 0.8
        add(tone, tt, 0.55)
    b += BEAT
# arpeggio through the product scenes (8 – 15.5)
t = 8.0; k = 0
while t < 15.5:
    ch = CHORDS[chord_at(t)]
    m = ch[[0, 1, 2, 3, 2, 1][k % 6]] + 12
    add(pluck(note(m), 0.3), t, 0.16, 0.5 if k % 2 else -0.5)
    t += BEAT / 4; k += 1

# ---------- UI sound design ----------
for t in (4.92, 6.06, 7.16):          # agent switches
    add(blip(1568, 0.2), t, 0.22, 0.4); add(blip(2093, 0.2), t + 0.05, 0.18, 0.4)
add(blip(900, 0.06, 'sq'), 9.3, 0.3)  # KIRA press
for i in range(5):                     # cards fanning out
    add(pluck(note(69 + [0, 3, 7, 10, 12][i] + 12), 0.25), 9.42 + i * 0.07, 0.22, -0.6 + 0.3 * i)
for t in (10.85, 11.1):                # toggles
    add(blip(2400, 0.05, 'sq'), t, 0.2)
add(blip(1320, 0.3) , 11.35, 0.2)
for t in (12.42, 13.5, 13.76):         # lead packets
    add(blip(1046, 0.1), t, 0.2, -0.3); add(blip(1568, 0.1), t + 0.04, 0.15, 0.3)
add(blip(2637, 0.15), 13.42, 0.2)      # WhatsApp double tick
for i in range(4):                     # stat slams
    add(snare(), 15.52 + i * 0.1, 0.35); add(blip(note(81 + [0, 3, 7, 12][i]), 0.2), 15.52 + i * 0.1, 0.18)
for i in range(8):                     # credits letter drops
    add(pluck(note(81 + [0, 2, 3, 7, 10, 12, 14, 15][i]), 0.4), 18.05 + i * 0.045, 0.12, -0.7 + i * 0.2)
add(sum(pluck(note(m + 12), 1.5) for m in [57, 60, 64, 71, 76]) / 3, 19.02, 0.4)

# ---------- reverb (FFT convolution with decaying stereo noise) ----------
def reverb(x, seed, secs=1.8):
    n = at(secs); t = np.arange(n) / SR
    ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-t * 3.2)
    ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
    m = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]
    return y

wetL, wetR = reverb(L, 1), reverb(R, 2)
L = L + wetL * 0.28; R = R + wetR * 0.28

# ---------- master ----------
fade = np.interp(np.arange(N) / SR, [0, 0.05, 19.4, 20], [0, 1, 1, 0])
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L = np.tanh(L / peak * 1.1) / np.tanh(1.1) * 0.89
R = np.tanh(R / peak * 1.1) / np.tanh(1.1) * 0.89
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open('soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote soundtrack.wav')
try:
    import imageio_ffmpeg
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', 'soundtrack.wav', '-c:a', 'aac', '-b:a', '192k', 'soundtrack.m4a'], check=True)
    print('wrote soundtrack.m4a')
except Exception as e:
    print('m4a skipped:', e)
