"""Kinetic typography render for IMG_8542.mov -> annur_kinetic.mp4"""
import math, subprocess, sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = sys.argv[1]
OUT = sys.argv[2]
PREVIEW = len(sys.argv) > 3  # render a few stills only
W, H, FPS = 1080, 1920, 30000 / 1001
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

WHITE = (255, 255, 255)
YELLOW = (255, 212, 0)
PINK = (255, 59, 127)
CYAN = (0, 229, 255)

# ---------- easing ----------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def prog(t, t0, d): return clamp((t - t0) / d)
def ease_out_cubic(x): return 1 - (1 - x) ** 3
def ease_in_cubic(x): return x ** 3
def ease_in_out(x): return 3 * x * x - 2 * x ** 3
def ease_out_back(x, s=2.2): x -= 1; return x * x * ((s + 1) * x + s) + 1
def ease_out_elastic(x):
    if x in (0, 1): return x
    return 2 ** (-10 * x) * math.sin((x * 10 - 0.75) * (2 * math.pi / 3)) + 1

# ---------- word sprites ----------
_cache = {}
def sprite(text, size, fill, stroke=(0, 0, 0), sw=None, box=None):
    key = (text, size, fill, box)
    if key in _cache: return _cache[key]
    f = ImageFont.truetype(FONT, size)
    sw = sw if sw is not None else max(4, size // 14)
    l, t, r, b = f.getbbox(text, stroke_width=sw)
    pad = 40
    w, h = r - l + pad * 2, b - t + pad * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if box:  # solid highlight box behind text
        d.rounded_rectangle([pad - 24, pad - 14, w - pad + 24, h - pad + 14], radius=18, fill=box)
    # drop shadow
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((pad - l + 10, pad - t + 14), text, font=f, fill=(0, 0, 0, 170),
                            stroke_width=sw, stroke_fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(8))
    im = Image.alpha_composite(sh, im)
    d = ImageDraw.Draw(im)
    d.text((pad - l, pad - t), text, font=f, fill=fill, stroke_width=0 if box else sw, stroke_fill=stroke)
    _cache[key] = im
    return im

def place(canvas, spr, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    if alpha <= 0.01 or scale <= 0.01: return
    s = spr
    if abs(scale - 1) > 1e-3:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.BICUBIC)
    if abs(rot) > 0.05:
        s = s.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 0.999:
        a = s.getchannel("A").point(lambda v: int(v * alpha))
        s = s.copy(); s.putalpha(a)
    canvas.alpha_composite(s, (int(cx - s.width / 2), int(cy - s.height / 2))) if (
        0 <= int(cx - s.width / 2) and 0 <= int(cy - s.height / 2)
        and int(cx - s.width / 2) + s.width <= W and int(cy - s.height / 2) + s.height <= H
    ) else _paste_clipped(canvas, s, int(cx - s.width / 2), int(cy - s.height / 2))

def _paste_clipped(canvas, s, x, y):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(s, (x, y), s)
    canvas.alpha_composite(layer)

# ---------- camera (zoom / punch / shake / tilt) ----------
PUNCHES = [  # (time, strength) — zoom kicks landing on each shout
    (0.45, 0.06), (1.62, 0.12), (2.95, 0.10), (4.40, 0.10), (5.40, 0.20),
]
TILTS = [(2.95, -3.0), (4.00, 3.0)]

def camera(t):
    # base zoom: slow push-in to 1.15, hold, ease back out during outro
    base = 1.0 + 0.15 * ease_in_out(prog(t, 0.0, 1.5))
    base -= 0.15 * ease_in_out(prog(t, 6.3, 1.4))
    punch = 0.0
    for tp, s in PUNCHES:
        dt = t - tp
        if 0 <= dt < 0.6:
            punch += s * math.exp(-dt * 7) * (1 if dt > 0.03 else dt / 0.03)
    tilt = 0.0
    for tp, a in TILTS:
        dt = t - tp
        if 0 <= dt < 0.9:
            tilt += a * math.exp(-dt * 4) * math.cos(dt * 10)
    # shake: strong on OH YESS, light elsewhere
    amp = 4 + 26 * math.exp(-max(0, t - 5.40) * 3.5) * (t >= 5.40) + 10 * math.exp(-max(0, t - 1.62) * 6) * (t >= 1.62)
    rnd = random.Random(int(t * 60))
    sx, sy = (rnd.uniform(-1, 1) * amp, rnd.uniform(-1, 1) * amp)
    return base + punch, tilt, sx, sy

def apply_camera(img, t):
    z, tilt, sx, sy = camera(t)
    # zoom about centre (+ shake offset) with optional rotation
    c, s = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
    cx, cy = W / 2 + sx, H / 2 + sy
    # inverse affine: output (x,y) -> input
    a, b = c / z, s / z
    d, e = -s / z, c / z
    x0 = cx - a * W / 2 - b * H / 2
    y0 = cy - d * W / 2 - e * H / 2
    return img.transform((W, H), Image.AFFINE, (a, b, x0, d, e, y0), resample=Image.BILINEAR)

# ---------- typography timeline ----------
CY = int(H * 0.50)

def pop(t, t0, dur=0.28):
    p = prog(t, t0, dur)
    return ease_out_back(p) if p > 0 else 0.0

def out(t, t1, dur=0.18):
    return 1 - ease_in_cubic(prog(t, t1, dur))

def draw_text(canvas, t):
    # 1) APA KHABAR / ANNUR?  — speaker line, drop-in + slam
    if t < 1.55:
        k = out(t, 1.30)
        p = prog(t, 0.08, 0.35)
        y = CY - 170 - (1 - ease_out_cubic(p)) * 500
        place(canvas, sprite("APA KHABAR", 118, WHITE), W / 2, y, 1.0, 0, min(1, p * 3) * k)
        s = pop(t, 0.45, 0.30)
        place(canvas, sprite("ANNUR?", 165, (20, 20, 20), box=YELLOW), W / 2, CY + 40,
              (0.2 + 0.8 * s) * (1 + 0.6 * (1 - k)), -4 * s, (1 if s > 0 else 0) * k)

    # 2) I GREAT — "I" pops, GREAT slams from huge
    if 1.35 < t < 2.95:
        k = out(t, 2.70)
        place(canvas, sprite("I", 170, WHITE), W / 2, CY - 170, pop(t, 1.42) * (1 + 0.3 * (1 - k)), 0, k)
        p = prog(t, 1.58, 0.16)
        if p > 0:
            sc = 3.2 - 2.2 * ease_out_cubic(p)
            place(canvas, sprite("GREAT", 230, YELLOW), W / 2, CY + 40, sc, 0, min(1, p * 2) * k)

    # 3) WE GREAT — whip in from left
    if 2.85 < t < 4.1:
        k = out(t, 3.82)
        p1 = ease_out_back(prog(t, 2.90, 0.30), 1.6)
        place(canvas, sprite("WE", 170, WHITE), -300 + (W / 2 + 300) * p1, CY - 170, 1, 6 * (1 - p1), k)
        p2 = ease_out_back(prog(t, 3.05, 0.30), 1.6)
        if p2 > 0:
            place(canvas, sprite("GREAT", 230, PINK), -600 + (W / 2 + 600) * p2, CY + 40, 1, 8 * (1 - p2),
                  k)
        # exit: whip off to right
        if t > 3.82:
            pass

    # 4) YOU GREAT — whip in from right
    if 3.95 < t < 5.1:
        k = out(t, 4.85, 0.15)
        p1 = ease_out_back(prog(t, 3.98, 0.30), 1.6)
        place(canvas, sprite("YOU", 170, WHITE), W + 300 - (W / 2 + 300) * p1, CY - 170, 1, -6 * (1 - p1), k)
        p2 = ease_out_back(prog(t, 4.35, 0.28), 1.6)
        if p2 > 0:
            place(canvas, sprite("GREAT", 230, CYAN), W + 600 - (W / 2 + 600) * p2, CY + 40, 1,
                  -8 * (1 - p2), k)

    # 5) OH YESS!!! — elastic stagger + flash, then settle to top
    if t >= 5.0:
        rise = ease_in_out(prog(t, 6.25, 0.6))  # move up to make room for recap
        fade = out(t, 7.85, 0.3)
        oh_s = ease_out_elastic(prog(t, 5.03, 0.6))
        oh_y = CY - 200 - rise * 520
        place(canvas, sprite("OH", 200, WHITE), W / 2, oh_y, oh_s * (1 - 0.35 * rise), 0, fade)
        letters = list("YESS!!!")
        sizes = [sprite(ch, 205, YELLOW) for ch in letters]
        scale_all = 1 - 0.40 * rise
        widths = [s.width - 80 - 18 for s in sizes]  # remove padding for tight tracking
        total = sum(widths)
        x = W / 2 - total * scale_all / 2
        y = CY + 60 - rise * 560
        for i, (spr, wch) in enumerate(zip(sizes, widths)):
            p = prog(t, 5.22 + i * 0.05, 0.45)
            if p > 0:
                sc = ease_out_elastic(p) * scale_all
                wob = math.sin((t - 5.22) * 14 + i) * 5 * math.exp(-max(0, t - 5.6) * 2)
                place(canvas, spr, x + wch * scale_all / 2, y - 60 * (1 - ease_out_cubic(p)), sc, wob, fade)
            x += wch * scale_all

        # 6) outro recap stack
        for i, (word, col) in enumerate([("I GREAT", YELLOW), ("WE GREAT", PINK), ("YOU GREAT", CYAN)]):
            p = prog(t, 6.55 + i * 0.22, 0.35)
            if p > 0:
                place(canvas, sprite(word, 110, col), W / 2 + (1 - ease_out_cubic(p)) * (220 if i % 2 else -220),
                      CY + 20 + i * 150, 1, 0, min(1, p * 2) * fade)


def flash(canvas, t):
    a = 0
    for tp, strength in [(1.62, 0.35), (5.40, 0.7)]:
        dt = t - tp
        if 0 <= dt < 0.25: a = max(a, strength * (1 - dt / 0.25))
    if a > 0:
        canvas.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, int(255 * a))))


# vignette + center darkening to keep text readable
yy, xx = np.mgrid[0:H, 0:W]
r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
vig = np.clip((r - 0.55) * 0.9, 0, 0.6) + 0.18 * np.exp(-(((yy - H * 0.52) / (H * 0.22)) ** 2))
VIGNETTE = Image.fromarray((np.dstack([np.zeros_like(vig)] * 3 + [np.clip(vig, 0, 1) * 255])).astype(np.uint8), "RGBA")

TONEMAP = ("zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=203,format=gbrpf32le,"
           "zscale=p=bt709,tonemap=mobius:desat=0,zscale=t=bt709:m=bt709:r=pc,format=rgb24")
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-map", "0:v:0", "-vf", TONEMAP,
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
enc = None
if not PREVIEW:
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{W}x{H}", "-r", "30000/1001", "-i", "-", "-i", SRC,
                            "-map", "0:v", "-map", "1:a:0", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                            "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709",
                            "-color_trc", "bt709", "-c:a", "aac", "-b:a", "192k", "-shortest",
                            "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)

stills = {0.6, 1.75, 3.3, 4.6, 5.5, 7.0}
i = 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    t = i / FPS
    frame = Image.frombuffer("RGB", (W, H), buf).copy()
    frame = apply_camera(frame, t).convert("RGBA")
    frame.alpha_composite(VIGNETTE)
    draw_text(frame, t)
    flash(frame, t)
    if PREVIEW:
        for s in stills:
            if abs(t - s) < 0.5 / FPS:
                frame.convert("RGB").resize((360, 640)).save(f"still_{s:.2f}.png")
    else:
        enc.stdin.write(frame.convert("RGB").tobytes())
    i += 1
if enc:
    enc.stdin.close(); enc.wait()
print("frames", i)
