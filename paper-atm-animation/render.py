#!/usr/bin/env python3
"""
Medical Benefits ATM - handmade paper-cutout stop-motion animation.

Renders a 20 s, 1080x1920 (9:16) video.  Every element (ATM, screen pieces,
medical card, legs, gears, confetti, plaque, receipt, hand ...) is built as a
separate layered paper cutout with grain texture, lighter cut edges, a darker
card-thickness rim and contact shadows, then animated pose-by-pose at 12
poses per second (output 24 fps, every pose held for two frames) with
stop-motion "boil" jitter.  Sound effects are synthesised and muxed in.

    python3 render.py            # full render -> output/medical-atm-paper-cutout.mp4
    python3 render.py --frames 0,40,150   # preview single poses to output/preview_*.png
"""
import math
import os
import random
import shutil
import subprocess
import sys
import wave
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "assets", "LilitaOne-Regular.ttf")
OUT_DIR = os.path.join(HERE, "output")
OUT = os.path.join(OUT_DIR, "medical-atm-paper-cutout.mp4")
FRAMES_DIR = os.environ.get("FRAMES_DIR", os.path.join(OUT_DIR, "_frames"))

W, H = 1080, 1920
FPS = 12            # unique stop-motion poses per second
N = 240             # 20 seconds
SS = 2              # supersampling for cut masks


def hexc(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


C = dict(
    bg=hexc("efe8dc"), sheet=hexc("f6f1e7"),
    red=hexc("d8262f"), red_dark=hexc("b01d25"), body=hexc("efebe5"), body2=hexc("e3dfd8"),
    bezel=hexc("55585f"), navy=hexc("10254a"), navy_off=hexc("0b1833"), panel=hexc("cfccc7"),
    slit=hexc("16171c"), key=hexc("8d9098"), keypanel=hexc("d9d6d1"), screw=hexc("a9a9ad"),
    yellow=hexc("f5c52e"), green=hexc("22a65a"), blue=hexc("2f7de1"), sky=hexc("3a9bf0"),
    light_blue=hexc("bfe0ff"), gear1=hexc("5b9be8"), gear2=hexc("3a78d6"), track=hexc("26314a"),
    white=hexc("fbfaf6"), card=hexc("f8f6f1"), card_blue=hexc("1f5fbf"), gray=hexc("c7cad1"),
    skin=hexc("f4b98f"), nail=hexc("ffd8c6"), sleeve=hexc("2e63c4"), cuff=hexc("4f86e0"),
    kraft=hexc("c49a6c"), board=hexc("0f3b2c"), neon=hexc("3fdc7f"),
    gold=hexc("ffd23a"), gold_mid=hexc("e39a26"), gold_dark=hexc("a85a17"),
    pink=hexc("f07f95"), orange=hexc("f39c23"), leg=hexc("1c2d5a"), ok=hexc("22b35e"),
    paper=hexc("fdfcf8"), ink=hexc("17305e"),
)

# ----------------------------------------------------------------------------
# paper texture
# ----------------------------------------------------------------------------
TEXN = 2600


def _norm_noise(w, h, rng, blur):
    a = (rng.normal(0, 1, (h, w)) * 40 + 128).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(a, "L")
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    x = np.asarray(im, np.float32) - 128
    return x / (x.std() + 1e-6)


def make_texture(seed=3):
    rng = np.random.default_rng(seed)
    fine = _norm_noise(TEXN, TEXN, rng, 0.7)
    mid = _norm_noise(TEXN // 6, TEXN // 6, rng, 1.2)
    mid = Image.fromarray(((mid * 30 + 128).clip(0, 255)).astype(np.uint8)).resize((TEXN, TEXN), Image.BICUBIC)
    mid = (np.asarray(mid, np.float32) - 128) / 30
    fib = Image.new("L", (TEXN, TEXN), 128)
    d = ImageDraw.Draw(fib)
    r = random.Random(seed)
    for _ in range(14000):
        x, y = r.uniform(0, TEXN), r.uniform(0, TEXN)
        a = r.uniform(0, math.pi)
        ln = r.uniform(5, 24)
        v = int(128 + r.choice((-1, 1)) * r.uniform(18, 45))
        d.line([(x, y), (x + ln * math.cos(a), y + ln * math.sin(a))], fill=v, width=1)
    fib = (np.asarray(fib.filter(ImageFilter.GaussianBlur(0.6)), np.float32) - 128) / 40
    return (1 + 0.030 * fine + 0.015 * mid + 0.022 * fib).astype(np.float32)


TEX = make_texture()


def texcrop(w, h, seed):
    r = random.Random(seed)
    x = r.randint(0, max(0, TEXN - w))
    y = r.randint(0, max(0, TEXN - h))
    return TEX[y:y + h, x:x + w]


# ----------------------------------------------------------------------------
# paper-piece primitives
# ----------------------------------------------------------------------------

def paste(base, im, x, y):
    bw, bh = base.size
    w, h = im.size
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + w, bw), min(y + h, bh)
    if x1 <= x0 or y1 <= y0:
        return
    base.alpha_composite(im.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))


def shadow_of(alpha, blur, op, color=(52, 36, 26)):
    pad = int(blur * 2.5) + 2
    w, h = alpha.size
    big = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
    big.paste(alpha, (pad, pad))
    k = 4 if blur >= 8 else 2 if blur >= 3 else 1
    if k > 1:
        sm = big.resize((max(1, big.width // k), max(1, big.height // k)), Image.BILINEAR)
        sm = sm.filter(ImageFilter.GaussianBlur(blur / k)).resize(big.size, Image.BILINEAR)
    else:
        sm = big.filter(ImageFilter.GaussianBlur(blur))
    a = sm.point(lambda v: int(v * op))
    sh = Image.new("RGBA", big.size, color + (0,))
    sh.putalpha(a)
    return sh, pad


def paper(mask, color, seed, edge=0.35, grain=1.0):
    w, h = mask.size
    t = texcrop(w, h, seed)
    if grain != 1.0:
        t = 1 + (t - 1) * grain
    m = np.asarray(mask, np.float32) / 255
    er = np.asarray(mask.filter(ImageFilter.MinFilter(5)), np.float32) / 255
    e = np.clip(m - er, 0, 1)[..., None]
    rgb = np.array(color, np.float32)[None, None, :] * t[..., None]
    rgb = rgb + (255 - rgb) * e * edge
    out = np.dstack([rgb.clip(0, 255), m[..., None] * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def darken(piece, k=0.66):
    arr = np.asarray(piece).copy()
    arr[..., :3] = (arr[..., :3].astype(np.float32) * k).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def stack(canvas, piece, x, y, lift=1.0, thick=None, shadow=True):
    """Glue a paper piece onto a canvas: contact shadow, thickness rim, piece."""
    if thick is None:
        thick = max(1, round(2 * lift))
    if shadow and lift > 0:
        sh, pad = shadow_of(piece.getchannel("A"), 2.2 * lift + 0.8, 0.40)
        sx = x + round(1.6 * lift + 1) - pad
        sy = y + round(2.6 * lift + 1) - pad
        region = canvas.getchannel("A").crop((sx, sy, sx + sh.width, sy + sh.height))
        sh.putalpha(ImageChops.multiply(sh.getchannel("A"), region))
        paste(canvas, sh, sx, sy)
    if thick > 0:
        dark = darken(piece)
        for i in range(1, thick + 1):
            paste(canvas, dark, x + round(i * 0.3), y + i)
    paste(canvas, piece, x, y)


def densify(pts, step=26):
    out = []
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        k = max(1, int(math.hypot(x1 - x0, y1 - y0) // step))
        for j in range(k):
            out.append((x0 + (x1 - x0) * j / k, y0 + (y1 - y0) * j / k))
    return out


def wobble(pts, amt, seed):
    r = random.Random(seed)
    return [(x + r.uniform(-amt, amt), y + r.uniform(-amt, amt)) for x, y in pts]


def rrect(x0, y0, x1, y1, r):
    r = max(0.5, min(r, (x1 - x0) / 2, (y1 - y0) / 2))
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(7):
            a = math.radians(a0 + 90 * i / 6)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def ellipse(cx, cy, rx, ry, n=44):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def rot_pts(pts, cx, cy, deg):
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


_seed = [1000]


def nseed():
    _seed[0] += 1
    return _seed[0]


def mask_poly(polys, holes=(), lines=(), pad=5):
    allp = [p for poly in polys for p in poly] + [p for ln in lines for p in ln[0]]
    xs = [p[0] for p in allp]
    ys = [p[1] for p in allp]
    extra = max([ln[1] for ln in lines], default=0)
    bx = math.floor(min(xs)) - pad - extra
    by = math.floor(min(ys)) - pad - extra
    w = math.ceil(max(xs)) - bx + pad + extra
    h = math.ceil(max(ys)) - by + pad + extra
    m = Image.new("L", (w * SS, h * SS), 0)
    d = ImageDraw.Draw(m)
    for poly in polys:
        d.polygon([((x - bx) * SS, (y - by) * SS) for x, y in poly], fill=255)
    for pts, width in lines:
        d.line([((x - bx) * SS, (y - by) * SS) for x, y in pts], fill=255, width=int(width * SS), joint="curve")
        for x, y in (pts[0], pts[-1]):
            rr = width * SS / 2
            d.ellipse(((x - bx) * SS - rr, (y - by) * SS - rr, (x - bx) * SS + rr, (y - by) * SS + rr), fill=255)
    for poly in holes:
        d.polygon([((x - bx) * SS, (y - by) * SS) for x, y in poly], fill=0)
    return m.resize((w, h), Image.LANCZOS), bx, by


def cut(canvas, polys, color, lift=1.0, wob=0.8, holes=(), thick=None, edge=0.35, grain=1.0, shadow=True):
    if isinstance(polys[0][0], (int, float)):
        polys = [polys]
    s = nseed()
    polys = [wobble(densify(p), wob, s + i) for i, p in enumerate(polys)]
    holes = [wobble(densify(p), wob, s + 50 + i) for i, p in enumerate(holes)]
    m, bx, by = mask_poly(polys, holes)
    stack(canvas, paper(m, color, s, edge, grain), bx, by, lift, thick, shadow)


def cut_line(canvas, pts, width, color, lift=0.6, thick=1):
    s = nseed()
    m, bx, by = mask_poly([], lines=[(wobble(pts, 0.5, s), width)])
    stack(canvas, paper(m, color, s, 0.25), bx, by, lift, thick)


_fonts = {}


def font(sz):
    sz = int(sz)
    if sz not in _fonts:
        _fonts[sz] = ImageFont.truetype(FONT, sz)
    return _fonts[sz]


def text_mask(text, size, jitter=2.2, seed=0):
    """Text as individually cut paper letters (small random tilt / baseline)."""
    f = font(size * SS)
    asc, desc = f.getmetrics()
    pad = int(size * SS * 0.3)
    w = int(f.getlength(text) + 2 * pad)
    h = int(asc + desc + 2 * pad)
    m = Image.new("L", (w, h), 0)
    r = random.Random(seed)
    for i, ch in enumerate(text):
        if ch == " ":
            continue
        x = int(pad + f.getlength(text[:i]))
        gw = int(f.getlength(ch)) + 2 * pad
        g = Image.new("L", (gw, h), 0)
        ImageDraw.Draw(g).text((pad, pad), ch, font=f, fill=255)
        if jitter:
            g = g.rotate(r.uniform(-jitter, jitter), resample=Image.BICUBIC, center=(gw / 2, pad + asc * 0.6))
        dy = int(r.uniform(-1.4, 1.4) * SS) if jitter else 0
        box = (x - pad, dy, x - pad + gw, dy + h)
        m.paste(ImageChops.lighter(m.crop(box), g), box[:2])
    bb = m.getbbox()
    m = m.crop((bb[0] - 3 * SS, bb[1] - 3 * SS, bb[2] + 3 * SS, bb[3] + 3 * SS))
    return m.resize((m.width // SS, m.height // SS), Image.LANCZOS)


def fit_size(text, size, maxw):
    while maxw and font(size).getlength(text) > maxw and size > 8:
        size -= 1
    return size


def text_piece(text, size, color, jitter=2.2, edge=0.3, maxw=None):
    size = fit_size(text, size, maxw)
    s = nseed()
    return paper(text_mask(text, size, jitter, s), color, s, edge)


def place(piece, x, y, anchor):
    w, h = piece.size
    if anchor == "mm":
        return round(x - w / 2), round(y - h / 2)
    if anchor == "lm":
        return round(x), round(y - h / 2)
    return round(x), round(y)


def cut_text(canvas, text, x, y, size, color, lift=0.8, anchor="mm", jitter=2.2, maxw=None, thick=None):
    p = text_piece(text, size, color, jitter, maxw=maxw)
    px, py = place(p, x, y, anchor)
    stack(canvas, p, px, py, lift, thick)
    return p


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


# ----------------------------------------------------------------------------
# stop-motion sprite drawing (world space)
# ----------------------------------------------------------------------------
STATE = {"seed": 0, "boil": 1.0}
SH_TABLE = (10, 15, 12, 0.34)      # object lying on the table
SH_LIFT = (18, 26, 16, 0.28)       # object held up above the table


def draw(base, spr, x, y, anchor=None, rot=0.0, scale=1.0, shadow=None, clip=None, key=None, alpha=1.0, boil=1.0):
    """Composite a paper sprite; returns final (x, y, rot) incl. boil jitter."""
    if key is not None and STATE["boil"] > 0:
        r = random.Random(f"{STATE['seed']}-{key}")
        b = STATE["boil"] * boil
        x += r.uniform(-1.5, 1.5) * b
        y += r.uniform(-1.5, 1.5) * b
        rot += r.uniform(-0.45, 0.45) * b
    w, h = spr.size
    ax, ay = anchor if anchor else (w / 2, h / 2)
    im = spr.convert("RGBa")
    if abs(scale - 1) > 1e-3:
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        im = im.resize((nw, nh), Image.BICUBIC)
        ax, ay = ax * nw / w, ay * nh / h
        w, h = nw, nh
    if abs(rot) > 0.02:
        t = math.radians(rot)
        vx, vy = ax - w / 2, ay - h / 2
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
        ax = im.width / 2 + vx * math.cos(t) + vy * math.sin(t)
        ay = im.height / 2 - vx * math.sin(t) + vy * math.cos(t)
    im = im.convert("RGBA")
    ox, oy = round(x - ax), round(y - ay)
    if clip or alpha < 1:
        a = np.asarray(im.getchannel("A")).astype(np.float32)
        if clip:
            mode, cy = clip
            rows = np.arange(im.height) + oy
            if mode == "above":
                a[rows >= cy, :] = 0
            else:
                a[rows < cy, :] = 0
        a *= alpha
        im.putalpha(Image.fromarray(a.clip(0, 255).astype(np.uint8)))
    if shadow:
        dx, dy, bl, op = shadow
        sh, pad = shadow_of(im.getchannel("A"), bl, op * min(1.0, alpha * 1.2))
        paste(base, sh, ox + dx - pad, oy + dy - pad)
    paste(base, im, ox, oy)
    return x, y, rot


def xform(px, py, ax, ay, wx, wy, rot, scale):
    """Local sprite point -> world, for a sprite drawn with anchor (ax,ay) at (wx,wy)."""
    t = math.radians(rot)
    vx, vy = (px - ax) * scale, (py - ay) * scale
    return wx + vx * math.cos(t) + vy * math.sin(t), wy - vx * math.sin(t) + vy * math.cos(t)


# ----------------------------------------------------------------------------
# assets
# ----------------------------------------------------------------------------
ATM_OFF = (130, 220)            # world = local + offset
ATM_ANCHOR = (410, 670)         # local anchor == world (540, 890)
ATM_WORLD = (540, 890)
SCREEN_POS = (145, 298)         # local
SW, SH = 530, 384
SLOT_Y = 996                    # card slot line (world)
RSLOT_LOCAL = (190, 1152)       # receipt slot panel canvas (local)
RSLOT_Y = 1422                  # receipt slit line (world)


def build_background():
    t = texcrop(W, H, 7)
    rgb = np.array(C["bg"], np.float32)[None, None, :] * t[..., None]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    light = 1.035 - 0.075 * ((xx / W) * 0.4 + (yy / H) * 0.6)
    vig = 1 - 0.13 * (((xx - W / 2) / (W * 0.78)) ** 2 + ((yy - H * 0.48) / (H * 0.72)) ** 2)
    rgb = rgb * (light * vig)[..., None]
    bg = Image.fromarray(np.dstack([rgb.clip(0, 255), np.full((H, W, 1), 255)]).astype(np.uint8), "RGBA")
    # a slightly lighter card sheet glued to the table = the miniature set
    cut(bg, rrect(48, 150, 1032, 1780, 26), C["sheet"], lift=1.4, wob=1.4, thick=2, edge=0.5)
    return bg


def build_atm():
    c = new(820, 1340)
    ox, oy = ATM_OFF

    def R(x0, y0, x1, y1, r):
        return rrect(x0 - ox, y0 - oy, x1 - ox, y1 - oy, r)

    def E(cx, cy, rx, ry):
        return ellipse(cx - ox, cy - oy, rx, ry)

    cut(c, R(166, 436, 866, 1506, 30), C["red_dark"], lift=0, thick=5)          # red side panel
    cut(c, R(190, 420, 890, 1500, 30), C["body"], lift=1.3, thick=3)            # main body
    cut(c, R(214, 1052, 866, 1480, 20), C["body2"], lift=0.6)                   # lower plate
    for sx, sy in ((214, 446), (866, 446), (214, 1474), (866, 1474)):
        cut(c, E(sx, sy, 6, 6), C["screw"], lift=0.4, wob=0.2)
    # sign
    cut(c, R(250, 285, 830, 434, 22), C["red"], lift=1.6, thick=4)
    cut(c, R(264, 298, 816, 421, 16), C["white"], lift=0.5, holes=[R(272, 306, 808, 413, 12)], wob=0.6)
    cut_text(c, "MEDICAL", 540 - ox, 332 - oy, 54, C["white"], lift=0.9)
    cut_text(c, "BENEFITS ATM", 540 - ox, 386 - oy, 54, C["white"], lift=0.9)
    # screen bezel + placeholder
    cut(c, R(245, 490, 835, 930, 26), C["bezel"], lift=1.4, thick=3)
    cut(c, R(275, 518, 805, 902, 8), C["navy_off"], lift=0.4, wob=0.3)
    # card slot
    cut(c, R(330, 952, 750, 1040, 16), C["panel"], lift=1.3, thick=3)
    cut(c, R(365, 986, 715, 1006, 8), C["slit"], lift=0.4, thick=0, wob=0.4)
    # keypad
    cut(c, R(250, 1072, 580, 1360, 18), C["keypanel"], lift=1.2)
    for row in range(4):
        for col in range(3):
            x0 = 270 + col * 102
            y0 = 1092 + row * 66
            cut(c, R(x0, y0, x0 + 86, y0 + 50, 10), C["key"], lift=1.0)
    # coloured buttons
    for i, col in enumerate(("red", "yellow", "green")):
        y0 = 1086 + i * 84
        cut(c, R(620, y0, 840, y0 + 64, 16), C[col], lift=1.4, thick=3)
    return c


def build_rslot():
    c = new(440, 100)
    cut(c, rrect(10, 8, 430, 92, 16), C["panel"], lift=0, thick=3)
    cut(c, rrect(32, 42, 408, 58, 8), C["slit"], lift=0.4, thick=0, wob=0.4)
    return c


def screen_base(col):
    c = new(SW, SH)
    piece = paper(Image.new("L", (SW, SH), 255), col, nseed(), edge=0, grain=0.9)
    c.alpha_composite(piece)
    arr = np.asarray(c).astype(np.float32)
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    sh = (np.clip(1 - yy / 28, 0, 1) * 0.5 + np.clip(1 - xx / 22, 0, 1) * 0.4
          + np.clip(1 - (SW - xx) / 10, 0, 1) * 0.15 + np.clip(1 - (SH - yy) / 10, 0, 1) * 0.1)
    arr[..., :3] *= (1 - np.clip(sh, 0, 0.6))[..., None]
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def arc_poly(cx, cy, r0, r1, a0, a1, n=16):
    outer = [(cx + r1 * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
              cy + r1 * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    inner = [(cx + r0 * math.cos(math.radians(a1 - (a1 - a0) * i / n)),
              cy + r0 * math.sin(math.radians(a1 - (a1 - a0) * i / n))) for i in range(n + 1)]
    return outer + inner


def dash(cx, cy, length, width, ang):
    return rot_pts(rrect(cx - width / 2, cy - length / 2, cx + width / 2, cy + length / 2, width / 2), cx, cy, ang)


def build_screens():
    S = {}
    S["off"] = screen_base(C["navy_off"])
    S["flash"] = screen_base(hexc("c9dcff"))
    for name, blink in (("face", False), ("blink", True)):
        c = screen_base(C["navy"])
        for ex in (195, 335):
            if blink:
                cut(c, rrect(ex - 26, 162, ex + 26, 172, 5), C["white"], lift=0.8)
            else:
                cut(c, ellipse(ex, 160, 24, 34), C["white"], lift=1.0)
        for cx in (145, 385):
            cut(c, ellipse(cx, 222, 26, 14), C["pink"], lift=0.7)
        cut(c, arc_poly(265, 190, 36, 52, 25, 155), C["white"], lift=0.9)
        S[name] = c
    for bob in (0, 1):
        c = screen_base(C["navy"])
        cut_text(c, "INSERT", 265, 70, 54, C["white"])
        cut_text(c, "MEDICAL CARD", 265, 130, 54, C["white"], maxw=470)
        cut(c, rrect(198, 186, 332, 268, 10), C["light_blue"], lift=1.0)
        cut(c, rrect(198, 206, 332, 222, 2), C["blue"], lift=0.5, thick=1)
        cut(c, rrect(212, 236, 270, 246, 4), C["white"], lift=0.4, thick=1)
        dy = 10 * bob
        cut(c, [(256, 290 + dy), (274, 290 + dy), (274, 314 + dy), (292, 314 + dy), (265, 344 + dy),
                (238, 314 + dy), (256, 314 + dy)], C["white"], lift=0.9)
        S[f"insert{bob}"] = c
    # processing: dots x progress
    base_w = font(52).getlength("PROCESSING...")
    track = rrect(85, 300, 445, 334, 17)
    for dots in range(4):
        for pi, p in enumerate((0, 0.25, 0.5, 0.75, 1.0)):
            c = screen_base(C["navy"])
            cut_text(c, "PROCESSING" + "." * dots, 265 - base_w / 2, 72, 52, C["white"], anchor="lm")
            cut(c, track, C["track"], lift=0.8)
            if p > 0:
                cut(c, rrect(92, 306, 92 + 346 * p, 328, 11), C["sky"], lift=0.6)
            S[f"proc{dots}{pi}"] = c
    c = screen_base(C["navy"])
    r = random.Random(4)
    cols = ("yellow", "sky", "red", "green", "orange", "yellow", "sky", "red")
    for i, a in enumerate((-165, -135, -105, -75, -45, -15, 170, 10)):
        rad = r.uniform(118, 140)
        cx, cy = 265 + rad * math.cos(math.radians(a)), 128 + rad * math.sin(math.radians(a))
        cut(c, dash(cx, cy, 30, 11, a + 90), C[cols[i]], lift=0.8)
    cut_text(c, "APPROVED!", 265, 318, 66, C["white"])
    S["approved"] = c
    c = screen_base(C["navy"])
    cut_text(c, "YOUR MEDICAL LIMIT", 265, 56, 44, C["white"], maxw=480)
    for i, a in enumerate((-40, -20, 0, 20, 40)):
        cx = 265 + i * 58 - 116
        cut(c, dash(cx, 356, 26, 9, a), C["neon"], lift=0.6)
    S["limit"] = c
    return S


def gear_sprite(r, teeth, color):
    size = int(2 * r + 20)
    c = new(size, size)
    cx = cy = size / 2
    pts = []
    w = 2 * math.pi / teeth
    rr = r - 12
    for i in range(teeth):
        a = i * w
        for da, rad in ((-0.5 * w, rr), (-0.27 * w, rr), (-0.17 * w, r), (0.17 * w, r), (0.27 * w, rr)):
            pts.append((cx + rad * math.cos(a + da), cy + rad * math.sin(a + da)))
    cut(c, pts, color, lift=0, thick=3, holes=[ellipse(cx, cy, r * 0.3, r * 0.3)], wob=0.5)
    return c


def build_card():
    c = new(300, 196)
    cut(c, rrect(10, 10, 290, 186, 18), C["card"], lift=0, thick=4)
    cut_text(c, "MEDICAL CARD", 32, 46, 34, C["card_blue"], anchor="lm", maxw=230, lift=0.6)
    cut(c, rrect(34, 88, 176, 103, 7), C["gray"], lift=0.5)
    cut(c, rrect(34, 116, 140, 131, 7), C["gray"], lift=0.5)
    cut(c, ellipse(232, 136, 36, 36), C["blue"], lift=0.9)
    cut(c, rrect(214, 130, 250, 142, 3), C["white"], lift=0.5, thick=1)
    cut(c, rrect(226, 118, 238, 154, 3), C["white"], lift=0.5, thick=1)
    return c


def build_leg():
    c = new(64, 96)
    cut(c, rrect(25, 2, 38, 68, 6), C["leg"], lift=0, thick=2)
    cut(c, ellipse(38, 74, 19, 10), C["red_dark"], lift=0.6, thick=2)
    return c


def build_puff():
    c = new(110, 80)
    for (x, y, r) in ((30, 44, 18), (58, 32, 22), (82, 48, 16), (55, 58, 14)):
        cut(c, ellipse(x, y, r, r), C["white"], lift=0.6, thick=2)
    return c


def build_arrow():
    c = new(160, 100)
    cut(c, [(12, 50), (64, 10), (64, 33), (146, 33), (146, 67), (64, 67), (64, 90)], C["red"], lift=0, thick=4)
    return c


def build_check():
    c = new(240, 240)
    cut(c, ellipse(120, 120, 96, 96), C["ok"], lift=0, thick=5)
    cut(c, [(60, 122), (80, 102), (106, 128), (160, 70), (181, 90), (106, 166)], C["white"], lift=1.3)
    return c


def build_plaque_layers():
    """Stacked cardboard layers + board + extruded gold number -> 5 build stages."""
    stages = []
    size = (940, 330)
    steps = [(44, 58), (36, 47), (28, 36), (20, 25)]
    c = new(*size)
    for i, (x, y) in enumerate(steps[:3]):
        cut(c, rrect(x, y, x + 860, y + 250, 26), C["kraft"], lift=0 if i == 0 else 1.2, thick=4, edge=0.45)
        # corrugation hint on the kraft layer
        cut(c, rrect(x + 30, y + 236, x + 830, y + 240, 2), hexc("a57d52"), lift=0.2, thick=0, shadow=False)
        stages.append(c.copy())
    x, y = steps[3]
    cut(c, rrect(x, y, x + 860, y + 250, 26), C["board"], lift=1.4, thick=4)
    cut(c, rrect(x + 16, y + 16, x + 844, y + 234, 18), C["neon"], lift=0.8,
        holes=[rrect(x + 28, y + 28, x + 832, y + 222, 12)], wob=0.6)
    stages.append(c.copy())
    txt = "RM1,000,000"
    size_t = fit_size(txt, 170, 740)
    s = nseed()
    m = text_mask(txt, size_t, 1.8, s)
    cx, cy = x + 430, y + 125
    for (dx, dy, col, lift) in ((9, 12, C["gold_dark"], 0.8), (5, 6, C["gold_mid"], 0.6), (0, 0, C["gold"], 0.8)):
        p = paper(m, col, nseed(), 0.3)
        px, py = place(p, cx + dx, cy + dy, "mm")
        stack(c, p, px, py, lift)
    stages.append(c.copy())
    return stages


def build_receipt():
    c = new(340, 480)
    pts = []
    for i in range(21):
        pts.append((10 + i * 16, 10 if i % 2 == 0 else 19))
    for i in range(20, -1, -1):
        pts.append((10 + i * 16, 470 if i % 2 == 0 else 461))
    cut(c, pts, C["paper"], lift=0, thick=3, wob=0.4)
    cut_text(c, "MEDICAL LIMIT", 170, 74, 40, C["ink"], maxw=270, lift=0.5, jitter=1.5)
    cut_text(c, "RM1,000,000", 170, 146, 64, C["ink"], maxw=282, lift=0.7, jitter=1.5)
    for i in range(10):
        cut(c, rrect(42 + i * 26, 200, 58 + i * 26, 205, 2), C["gray"], lift=0.2, thick=0, shadow=False)
    for (x1, y) in ((250, 244), (210, 280), (232, 316)):
        cut(c, rrect(44, y, x1, y + 16, 8), C["gray"], lift=0.4)
    heart = []
    for i in range(48):
        t = 2 * math.pi * i / 48
        heart.append((258 + 2.1 * 16 * math.sin(t) ** 3,
                      392 - 2.1 * (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))))
    cut(c, heart, C["blue"], lift=0.9)
    cut_line(c, [(226, 392), (242, 392), (250, 374), (260, 410), (270, 384), (276, 392), (290, 392)], 6, C["white"])
    return c


RECEIPT_C = (170, 240)          # centre anchor of the receipt sprite
RW, RH = 320, 460


def build_hand():
    c = new(380, 1100)
    for (x0, top) in ((96, 60), (143, 34), (190, 42), (237, 74)):
        cut(c, rrect(x0, top, x0 + 45, 230, 22), C["skin"], lift=0.0 if x0 == 96 else 0.6, thick=3)
    cut(c, rrect(88, 150, 292, 410, 84), C["skin"], lift=0.9)
    cut(c, rrect(84, 392, 298, 1100, 10), C["sleeve"], lift=1.0, thick=3)
    cut(c, rrect(74, 372, 308, 432, 14), C["cuff"], lift=1.1)
    return c


HAND_GRIP = (185, 100)
THUMB_PIVOT_ON_HAND = (116, 262)


def build_thumb():
    c = new(90, 200)
    cut(c, rrect(18, 10, 72, 186, 27), C["skin"], lift=0, thick=3)
    cut(c, rrect(28, 20, 62, 58, 14), C["nail"], lift=0.5, thick=1)
    return c


THUMB_PIVOT = (45, 172)


def build_small(shape, color, s=1.0):
    c = new(70, 70)
    if shape == 0:
        p = rrect(35 - 8 * s, 35 - 15 * s, 35 + 8 * s, 35 + 15 * s, 3)
    elif shape == 1:
        p = [(35, 35 - 15 * s), (35 + 14 * s, 35 + 11 * s), (35 - 14 * s, 35 + 11 * s)]
    elif shape == 2:
        p = ellipse(35, 35, 10 * s, 10 * s, 20)
    elif shape == 3:
        p = rrect(35 - 10 * s, 35 - 10 * s, 35 + 10 * s, 35 + 10 * s, 2)
    else:
        p = rrect(35 - 4 * s, 35 - 19 * s, 35 + 4 * s, 35 + 19 * s, 3)
    cut(c, p, color, lift=0, thick=2, wob=0.4)
    return c


def build_ray(color, length=120):
    c = new(64, int(length + 20))
    cut(c, [(14, 6), (50, 6), (38, length + 6), (26, length + 6)], color, lift=0, thick=3)
    return c


def build_sparkle(color, r=30):
    c = new(2 * r + 16, 2 * r + 16)
    cx = cy = r + 8
    pts = []
    for i in range(8):
        rad = r if i % 2 == 0 else r * 0.32
        a = math.radians(-90 + 45 * i)
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    cut(c, pts, color, lift=0, thick=2)
    return c


def build_neon_dash():
    c = new(40, 70)
    cut(c, rrect(13, 8, 27, 58, 7), C["neon"], lift=0, thick=2)
    return c


print("building paper assets ...", flush=True)
BG = build_background()
ATM_BASE = build_atm()
RSLOT = build_rslot()
SCREENS = build_screens()
GEAR_A = gear_sprite(64, 10, C["gear1"])
GEAR_B = gear_sprite(44, 7, C["gear2"])
CARD = build_card()
LEG = build_leg()
PUFF = build_puff()
ARROW = build_arrow()
CHECK = build_check()
PLAQUE = build_plaque_layers()
RECEIPT = build_receipt()
HAND = build_hand()
THUMB = build_thumb()
NEON_DASH = build_neon_dash()
CONF_COLORS = ("red", "blue", "yellow", "green", "leg", "orange", "sky")
CONFETTI = [build_small(s, C[c]) for s in range(5) for c in CONF_COLORS]
PARTICLES = [build_small(i % 4, C[("sky", "red", "blue", "red_dark")[i % 4]], 0.8) for i in range(8)]
RAYS = [build_ray(C["gold"], 120), build_ray(C["orange"], 95)]
SPARKLES = [build_sparkle(C["gold"], 30), build_sparkle(C["sky"], 20)]
GRAIN = [(np.random.default_rng(i).normal(0, 2.2, (H, W, 1))).astype(np.float32) for i in range(5)]

# ----------------------------------------------------------------------------
# timeline
# ----------------------------------------------------------------------------

def atm_state(f):
    """(dx, dy, rot) of the ATM, or None before it enters."""
    entry = {5: (820, 2), 6: (700, 2.5), 7: (590, 2.5), 8: (500, 2), 9: (492, -1.2), 10: (500, 0.6), 11: (500, 0),
             12: (400, 2), 13: (300, 2.5), 14: (210, 2.5), 15: (140, 2), 16: (132, -1.2), 17: (140, 0.5), 18: (140, 0),
             19: (90, 2), 20: (40, 2), 21: (-24, -1.6), 22: (10, 1), 23: (-4, -0.4)}
    if f < 5:
        return None
    if f in entry:
        dx, rot = entry[f]
        return dx, 0, rot
    dy = {82: 8, 83: -18, 84: -4, 85: 4,
          133: -28, 134: -44, 135: -18, 136: 2, 137: -12, 138: 0, 139: 3,
          206: 3, 207: 4}.get(f, 0)
    rot = {133: 1.5, 134: -1.8, 135: 1.0, 136: -0.4, 137: 0.6}.get(f, 0)
    dx = 0
    if 94 <= f <= 127:              # processing shake
        r = random.Random(f * 31)
        dx, dy, rot = r.uniform(-6, 6), r.uniform(-5, 5), r.uniform(-1.0, 1.0)
    return dx, dy, rot


def screen_key(f):
    if f < 26 or f == 27:
        return "off"
    if f == 26:
        return "flash"
    if f in (28, 29, 31):
        return "face"
    if f == 30:
        return "blink"
    if f < 84:
        return f"insert{(f // 3) % 2}"
    if f < 132:
        ff = min(f, 127)
        prog = 0 if ff < 92 else 1 if ff < 100 else 2 if ff < 108 else 3 if ff < 116 else 4
        return f"proc{(ff // 3) % 4}{prog}"
    if f < 148:
        return "approved"
    return "limit"


def screen_for(f):
    k = screen_key(f)
    img = SCREENS[k]
    if not k.startswith("proc") or f < 86:
        return img
    img = img.copy()
    ff = min(f, 127)
    s = {86: 0.5, 87: 1.15}.get(f, 1.0)
    ang = 15 * (ff - 86)
    draw(img, GEAR_A, 205, 186, rot=-ang, scale=s, shadow=(3, 5, 3, 0.5), key="gA")
    draw(img, GEAR_B, 300, 218, rot=ang * 10 / 7 + 12, scale=s, shadow=(3, 5, 3, 0.5), key="gB")
    return img


# --- medical card walk ------------------------------------------------------
CARD_Y = 872
POSES = [(26, -22, -7, 3), (0, 0, 0, 0), (-22, 26, -7, -3), (0, 0, 0, 0)]   # legL, legR, bob, rot
STEP_DX = [30, 40, 30, 40]


def _build_walk():
    tab = {}
    x = -170.0
    for f in range(36, 44):
        i = f - 36
        x += STEP_DX[i % 4]
        aL, aR, bob, rot = POSES[i % 4]
        tab[f] = (x, bob, rot, aL, aR)
    wob_dx = [8, -4, 8, -2, 4, 0]
    wob_rot = [9, -8, 6, -5, 3, 0]
    wob_bob = [-6, 0, -4, 0, -2, 0]
    for j, f in enumerate(range(44, 50)):
        x += wob_dx[j]
        sp = 18 if j % 2 == 0 else -18
        tab[f] = (x, wob_bob[j], wob_rot[j], -sp, sp)
    remain = 556 - x
    for j, f in enumerate(range(50, 62)):
        x += STEP_DX[j % 4] * remain / 420
        aL, aR, bob, rot = POSES[j % 4]
        tab[f] = (x, bob, rot, aL, aR)
    tab[62] = (566, -3, -6, 12, 12)
    tab[63] = (537, 0, 3, 0, 0)
    tab[64] = (540, 0, 0, 0, 0)
    return tab


WALK = _build_walk()
STEP_FRAMES = [f for f in range(36, 62) if f in WALK and f not in range(44, 50) and (f - (36 if f < 44 else 50)) % 2 == 0]
LOWER = {67: (4, -3), 68: (10, -6), 69: (18, -8), 70: (26, -7), 71: (32, -5)}
SLIDE_DY = [12, 15, 18, 16, 20, 18, 22, 20, 24, 21]
SLIDE_ROT = [-3, -1.5, -0.5, 0, 0, 0, 0, 0, 0, 0]


def card_state(f):
    """-> (cx, cy, rot, legs) ; legs = (aL, aR, scale) or None."""
    if f < 36 or f > 81:
        return None
    if f in WALK:
        x, bob, rot, aL, aR = WALK[f]
        return x, CARD_Y + bob, rot, (aL, aR, 1.0)
    if f in (65, 66):
        return 540, CARD_Y, 0, ((0, 0, 0.5) if f == 65 else None)
    if f in LOWER:
        dy, rot = LOWER[f]
        return 540, CARD_Y + dy, rot, None
    j = f - 72
    dy = 32 + sum(SLIDE_DY[:j + 1])
    return 540 + (1.5 if j % 2 else -1.5), CARD_Y + dy, SLIDE_ROT[j], None


LEG_ATTACH = [(110, 176), (190, 176)]
CARD_ANCHOR = (150, 98)

# --- confetti ---------------------------------------------------------------
_cr = random.Random(99)
CONF = []
for i in range(64):
    a = _cr.uniform(-math.pi, math.pi)
    if _cr.random() < 0.6:
        a = _cr.uniform(-math.pi * 0.95, -math.pi * 0.05)   # mostly upward burst
    sp = _cr.uniform(22, 52)
    CONF.append(dict(vx=sp * math.cos(a), vy=sp * math.sin(a), spr=_cr.randrange(len(CONFETTI)),
                     rot=_cr.uniform(0, 360), spin=_cr.uniform(-40, 40), ph=_cr.uniform(0, 6.28),
                     sc=_cr.uniform(0.8, 1.25)))
CONF_T0 = 133
CONF_O = (540, 650)


def confetti_pos(p, t):
    x, y = CONF_O
    vx, vy = p["vx"], p["vy"]
    for k in range(t):
        x += vx + 3.5 * math.sin(p["ph"] + k * 0.9) * (k > 4)
        y += vy
        vx *= 0.87
        vy = vy * 0.88 + 5.2
    return x, y, p["rot"] + p["spin"] * t


PART_POS = [(120, 520), (960, 560), (92, 860), (990, 900), (110, 1220), (975, 1260), (150, 1560), (930, 1580),
            (300, 214), (780, 214), (74, 1040), (1004, 720), (250, 1660), (830, 1660), (540, 180), (1000, 1440)]

# --- receipt / hand ---------------------------------------------------------
_rr = random.Random(5)
_inc = [_rr.uniform(14, 24) for _ in range(26)]
for k in (7, 16):
    _inc[k] = 0.0                                      # tiny printer hesitations
_tot = sum(_inc)
FEED = {}
acc = 0.0
for j, f in enumerate(range(172, 198)):
    acc += _inc[j] * RH / _tot
    FEED[f] = acc
SWAY = {198: 2.5, 199: -2.0, 200: 1.2, 201: -0.5}
PULL = {205: 12, 206: 30, 207: 62, 208: 96}
TOCENTER = {209: 0.12, 210: 0.32, 211: 0.58, 212: 0.84, 213: 1.06, 214: 0.97}
FINAL_C = (540, 985)
FINAL_ROT = -3.0
FINAL_S = 1.35


def receipt_state(f, adx, ady):
    """-> (cx, cy, rot, scale, clip_y or None)"""
    if f < 172:
        return None
    top_x, top_y = 540 + adx, RSLOT_Y + ady
    if f < 198:
        L = FEED[f]
        jit = random.Random(f * 7).uniform(-1.5, 1.5)
        return top_x + jit, top_y + L - RH / 2, 0.0, 1.0, top_y
    if f < 205:
        rot = SWAY.get(f, 0.0)
        t = math.radians(rot)
        return top_x + RH / 2 * math.sin(t), top_y + RH / 2 * math.cos(t), rot, 1.0, top_y
    if f in PULL:
        return top_x, top_y + PULL[f] + RH / 2, 0.0, 1.0, top_y
    s0 = (top_x, top_y + 96 + RH / 2, 0.0, 1.0)
    k = TOCENTER.get(f, 1.0)
    return (s0[0] + (FINAL_C[0] - s0[0]) * k, s0[1] + (FINAL_C[1] - s0[1]) * k,
            FINAL_ROT * k, 1 + (FINAL_S - 1) * k, None)


GRIP_ON_RECEIPT = (170 + 22, 240 + RH / 2 - 52)
HAND_IN = {196: 520, 197: 360, 198: 220, 199: 100, 200: 20, 201: -8, 202: 0}
THUMB_ANG = {203: 5, 204: -20}      # relative rotation; open = +22, closed = -20

RAY_ANGLES = [-90 + i * 360 / 16 + 11 for i in range(16)]
RAY_R = (292, 380)
SPARK_POS = [(210, 700, 0), (880, 760, 1), (170, 1180, 1), (905, 1250, 0), (300, 560, 1), (790, 1420, 1)]

CAM = {218: 1.02, 219: 1.02, 220: 1.04, 221: 1.04, 222: 1.06, 223: 1.06, 224: 1.08, 225: 1.08, 226: 1.10, 227: 1.10}
CAM_FOCUS = (540, 985)


def cam_scale(f):
    if f < 218:
        return 1.0
    return CAM.get(f, 1.12)


# ----------------------------------------------------------------------------
# frame renderer
# ----------------------------------------------------------------------------

def render(f):
    freeze = 128 <= f <= 131
    STATE["seed"] = 128 if freeze else f
    STATE["boil"] = 0.0 if freeze else (0.4 if f >= 228 else 1.0)
    img = BG.copy()

    # ---- ATM -------------------------------------------------------------
    st = atm_state(f)
    adx = ady = 0.0
    if st:
        atm = ATM_BASE.copy()
        atm.alpha_composite(screen_for(f), SCREEN_POS)
        jx = jy = 0
        if 168 <= f <= 197:                          # receipt slot rattles while printing
            r = random.Random(f * 13)
            jx, jy = round(r.uniform(-2.5, 2.5)), round(r.uniform(-2, 2))
        stack(atm, RSLOT, RSLOT_LOCAL[0] + jx, RSLOT_LOCAL[1] + jy, lift=1.2, thick=0)
        x, y, _ = draw(img, atm, ATM_WORLD[0] + st[0], ATM_WORLD[1] + st[1], anchor=ATM_ANCHOR, rot=st[2],
                       shadow=SH_TABLE, key="atm")
        adx, ady = x - ATM_WORLD[0], y - ATM_WORLD[1]

    # ---- bouncing red arrow -> card slot ----------------------------------
    if 32 <= f <= 69:
        s = {32: 0.5, 33: 1.2, 67: 0.8, 68: 0.5, 69: 0.25}.get(f, 1.0)
        bounce = (0, -12, -22, -12)[f % 4] if f < 66 else 0
        draw(img, ARROW, 760 + adx + bounce, SLOT_Y + ady, anchor=(12, 50), scale=s, shadow=(8, 11, 7, 0.33), key="arrow")

    # ---- processing particles --------------------------------------------
    if 92 <= f <= 131:
        for i, (px, py) in enumerate(PART_POS):
            if f < 92 + i % 4:
                continue
            r = random.Random(f"{STATE['seed']}-p{i}")
            jx, jy, jr = (r.uniform(-5, 5), r.uniform(-5, 5), r.uniform(-18, 18)) if not freeze else (0, 0, 0)
            s = 0.6 if f == 92 + i % 4 else 1.0
            draw(img, PARTICLES[i % len(PARTICLES)], px + jx, py + jy, rot=i * 37 + jr, scale=s,
                 shadow=(7, 10, 6, 0.3), key=f"part{i}")

    # ---- neon dashes around hero number ----------------------------------
    if 152 <= f <= 167:
        for i, a in enumerate((-25, -5, 15, 38, 62, 90, 118, 142, 165, 185, 205)):   # sides + bottom, heading stays clear
            rx, ry = 500, 190
            cx = 540 + adx + rx * math.cos(math.radians(a))
            cy = 772 + ady + ry * math.sin(math.radians(a))
            s = 0.5 if f == 152 else (1.15 if f == 153 else 1.0)
            draw(img, NEON_DASH, cx, cy, rot=-(a + 90), scale=s, shadow=(6, 9, 5, 0.3), key=f"nd{i}")

    # ---- final rays (behind receipt) --------------------------------------
    if f >= 213:
        for i, a in enumerate(RAY_ANGLES):
            t = f - 213 - i % 4
            if t < 0:
                continue
            s = (0.4, 1.2)[t] if t < 2 else 1.0
            s *= (1.0, 0.85, 0.95, 0.8)[i % 4]
            cx = FINAL_C[0] + RAY_R[0] * math.cos(math.radians(a))
            cy = FINAL_C[1] + RAY_R[1] * math.sin(math.radians(a))
            spr = RAYS[i % 2]
            draw(img, spr, cx, cy, anchor=(32, spr.height - 14), rot=-(a + 90), scale=s,
                 shadow=(9, 13, 8, 0.28), key=f"ray{i}")
        for i, (sx, sy, k) in enumerate(SPARK_POS):
            t = f - 216 - i
            if t < 0:
                continue
            s = (0.4, 1.25)[t] if t < 2 else (1.0 if (f + i) % 6 else 0.85)
            draw(img, SPARKLES[k], sx, sy, rot=(f % 3) * 4, scale=s, shadow=(8, 12, 7, 0.28), key=f"spk{i}")

    # ---- medical card -----------------------------------------------------
    cs = card_state(f)
    if cs:
        cx, cy, crot, legs = cs
        walking = f <= 66
        if legs:
            aL, aR, ls = legs
            for k, (lx, ly) in enumerate(LEG_ATTACH):
                wx, wy = xform(lx, ly, CARD_ANCHOR[0], CARD_ANCHOR[1], cx, cy, crot, 1.0)
                draw(img, LEG, wx, wy, anchor=(31, 6), rot=crot + (aL, aR)[k], scale=ls,
                     shadow=(12, 16, 8, 0.28), key=f"leg{k}")
        if f in (65, 66):
            for k, (lx, ly) in enumerate(LEG_ATTACH):
                wx, wy = xform(lx, ly + 40, CARD_ANCHOR[0], CARD_ANCHOR[1], cx, cy, 0, 1.0)
                draw(img, PUFF, wx, wy, scale=0.55 if f == 65 else 0.85, alpha=1.0 if f == 65 else 0.55,
                     shadow=(8, 10, 6, 0.2), key=f"puff{k}")
        clip = ("above", SLOT_Y + ady) if f >= 69 else None
        draw(img, CARD, cx, cy, anchor=CARD_ANCHOR, rot=crot, clip=clip,
             shadow=(14, 20, 11, 0.30) if walking else (8, 12, 8, 0.3), key="card")

    # ---- approved check ---------------------------------------------------
    if 132 <= f <= 147:
        s, dy = {132: (0.35, 50), 133: (1.35, -26), 134: (0.88, 6), 135: (1.08, -3), 146: (1.12, 0), 147: (0.5, 0)}.get(f, (1.0, 0))
        draw(img, CHECK, 540 + adx, 640 + ady + dy, scale=s, shadow=(12, 17, 10, 0.32), key="check")

    # ---- hero RM1,000,000 plaque -------------------------------------------
    if f >= 148:
        table = {148: (0, 0.92, 0), 149: (1, 1.0, 0), 150: (2, 1.0, 0), 151: (3, 1.04, 0), 152: (4, 1.22, -3),
                 153: (4, 0.94, 2), 154: (4, 1.06, -1), 168: (4, 0.88, 0), 169: (4, 0.74, 0), 170: (4, 0.64, 0),
                 171: (4, 0.55, 0), 172: (4, 0.60, 0)}
        if f in table:
            stg, s, prot = table[f]
        else:
            stg, s, prot = 4, (1.0 if f < 168 else 0.58), 0
        sh = (22, 30, 18, 0.30) if s >= 0.85 else (7, 10, 6, 0.4)
        draw(img, PLAQUE[stg], 540 + adx, 774 + ady, rot=prot, scale=s, shadow=sh, key="plaque")

    # ---- receipt + hand ------------------------------------------------------
    rs = receipt_state(f, adx, ady)
    hand = None
    if rs and f >= 196:
        rcx, rcy, rrot, rsc, _ = rs
        gx, gy = xform(*GRIP_ON_RECEIPT, *RECEIPT_C, rcx, rcy, rrot, rsc)
        off = HAND_IN.get(f, 0)
        hrot = rrot + 12 + (4 if off > 0 else 0)
        hand = (gx + off * 0.35, gy + off, hrot, rsc)
        tang = 22 if f <= 202 else THUMB_ANG.get(f, -20)
        hx, hy, _ = draw(img, HAND, hand[0], hand[1], anchor=HAND_GRIP, rot=hrot, scale=rsc,
                         shadow=SH_LIFT, key="hand")
        hand = (hx, hy, hrot, rsc, tang)
    if rs:
        rcx, rcy, rrot, rsc, clip_y = rs
        lifted = f >= 205
        draw(img, RECEIPT, rcx, rcy, anchor=RECEIPT_C, rot=rrot, scale=rsc,
             clip=("below", clip_y) if clip_y is not None else None,
             shadow=SH_LIFT if lifted else (6, 10, 7, 0.32), key="receipt", boil=0.7)
    if hand:
        hx, hy, hrot, hs, tang = hand
        tx, ty = xform(*THUMB_PIVOT_ON_HAND, *HAND_GRIP, hx, hy, hrot, hs)
        draw(img, THUMB, tx, ty, anchor=THUMB_PIVOT, rot=hrot + tang, scale=hs, shadow=(9, 13, 8, 0.3),
             key="thumb", boil=0.3)

    # ---- confetti (front-most) ----------------------------------------------
    if CONF_T0 <= f <= 172:
        t = f - CONF_T0
        for i, p in enumerate(CONF):
            x, y, r = confetti_pos(p, t)
            if y > H + 60 or x < -60 or x > W + 60:
                continue
            s = p["sc"] * (0.6 if t == 0 else 1.0)
            draw(img, CONFETTI[p["spr"]], x, y, rot=r, scale=s, shadow=(14, 20, 7, 0.24), key=f"cf{i}")

    # ---- camera push-in, light flicker, grain ---------------------------------
    s = cam_scale(f)
    if s > 1.0:
        fx, fy = CAM_FOCUS
        x0, y0 = fx - fx / s, fy - fy / s
        img = img.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + W / s, y0 + H / s))
    arr = np.asarray(img.convert("RGB")).astype(np.float32)
    r = random.Random(f"flick{STATE['seed']}")
    arr = arr * (1 + r.uniform(-0.012, 0.012)) + GRAIN[STATE["seed"] % len(GRAIN)]
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB")


def render_to_disk(f):
    render(f).save(os.path.join(FRAMES_DIR, f"f_{f:04d}.png"), compress_level=1)
    return f


# ----------------------------------------------------------------------------
# sound design
# ----------------------------------------------------------------------------
SR = 44100
ARNG = np.random.default_rng(11)


def lp(x, k):
    k = int(k)
    return x if k <= 1 else np.convolve(x, np.ones(k) / k, "same")


def bp(x, k1, k2):
    return lp(x, k1) - lp(x, k2)


def envexp(n, rate):
    return np.exp(-np.arange(n) / SR * rate)


def tone(freq, n):
    freq = np.broadcast_to(np.asarray(freq, np.float64), (n,))
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def noise(n):
    return ARNG.uniform(-1, 1, n)


def s_tap(amp=0.5):
    n = int(0.09 * SR)
    x = lp(noise(n), 6) * envexp(n, 55) * 0.9 + tone(np.linspace(210, 120, n), n) * envexp(n, 45) * 0.8
    return x * amp


def s_slide(dur, amp=0.25):
    n = int(dur * SR)
    e = np.minimum(1, np.minimum(np.arange(n) / (0.03 * SR), (n - np.arange(n)) / (0.05 * SR)))
    x = bp(noise(n), 2, 14) * 2.5 * e
    crinkle = (ARNG.random(n) < 0.0008) * ARNG.uniform(-1, 1, n)
    return (x + lp(crinkle, 3) * 3) * amp


def s_thud(amp=0.6, f0=110):
    n = int(0.22 * SR)
    return (tone(np.linspace(f0, f0 * 0.55, n), n) * envexp(n, 18) + lp(noise(n), 20) * envexp(n, 30) * 0.6) * amp


def s_click(amp=0.7):
    n = int(0.06 * SR)
    x = np.zeros(n)
    for off, a in ((0, 1.0), (int(0.018 * SR), 0.7)):
        m = int(0.012 * SR)
        x[off:off + m] += (bp(noise(m), 1, 4) * 2 + tone(2400, m) * 0.6) * envexp(m, 300) * a
    return x * amp


def s_tick(amp=0.25, f0=1800):
    n = int(0.03 * SR)
    return (tone(f0, n) * 0.6 + bp(noise(n), 1, 5)) * envexp(n, 160) * amp


def s_blip(f0, f1, dur=0.09, amp=0.3):
    n = int(dur * SR)
    return tone(np.linspace(f0, f1, n), n) * envexp(n, 20) * np.minimum(1, np.arange(n) / 200) * amp


def s_pop(amp=0.7):
    n = int(0.16 * SR)
    return (tone(np.linspace(520, 110, n), n) * envexp(n, 30) + bp(noise(n), 2, 10) * envexp(n, 60) * 1.4) * amp


def s_ding(amp=0.4, f0=1568):
    n = int(1.6 * SR)
    x = np.zeros(n)
    for mult, a, rate in ((1, 1.0, 2.6), (2.0, 0.45, 4.0), (2.76, 0.3, 5.5), (5.4, 0.12, 9)):
        x += tone(f0 * mult, n) * a * envexp(n, rate)
    return x * np.minimum(1, np.arange(n) / 60) * amp


def s_crackle(dur=0.9, amp=0.35):
    n = int(dur * SR)
    x = np.zeros(n)
    for _ in range(90):
        t = int((ARNG.random() ** 1.8) * (n - 800))
        m = int(ARNG.uniform(0.003, 0.009) * SR)
        x[t:t + m] += bp(noise(m), 1, 3) * envexp(m, 400) * ARNG.uniform(0.3, 1)
    return x * amp


def s_printer(dur, amp=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    buzz = np.sign(np.sin(2 * np.pi * 172 * t)) * 0.5 + np.sin(2 * np.pi * 344 * t) * 0.4
    gate = ((t * FPS) % 1.0) < 0.62
    x = lp(buzz, 5) * gate + bp(noise(n), 2, 8) * gate * 0.5
    return x * amp


def s_whir(dur, amp=0.07):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lp(np.sign(np.sin(2 * np.pi * 96 * t)), 12) * (0.7 + 0.3 * np.sin(2 * np.pi * 6 * t))
    return x * amp


def s_whoosh(dur=0.3, amp=0.3):
    n = int(dur * SR)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return bp(noise(n), 3, 26) * 3 * e * amp


def s_sparkle(amp=0.14):
    n = int(0.9 * SR)
    x = np.zeros(n)
    for i, fr in enumerate((2637, 3136, 3951, 4699, 3520)):
        off = int(i * 0.07 * SR)
        m = n - off
        x[off:] += tone(fr, m) * envexp(m, 7) * 0.5
    return x * amp


def build_audio(path):
    total = int((N / FPS + 0.4) * SR)
    mix = np.zeros(total)

    def at(frame, sig):
        i = int(frame / FPS * SR)
        j = min(total, i + len(sig))
        mix[i:j] += sig[:j - i]

    # scene 1 - ATM shuffles in
    for f0, d in ((5, 4), (12, 4), (19, 3)):
        at(f0, s_slide(d / FPS, 0.3))
    for f0 in (9, 16, 21):
        at(f0, s_thud(0.35, 90))
    at(26, s_blip(300, 900, 0.12, 0.25))
    at(28, s_blip(700, 1050, 0.07, 0.2))
    at(32, s_blip(900, 1300, 0.08, 0.22))
    for f0 in range(33, 64, 4):
        at(f0 + 2, s_tick(0.06, 1200))
    # scene 2 - paper footsteps, wobble, insertion
    for f0 in STEP_FRAMES + [62]:
        at(f0, s_tap(0.45))
    at(44, s_slide(0.45, 0.12))
    at(65, s_pop(0.3))
    at(67, s_slide(0.35, 0.1))
    at(72, s_slide(0.85, 0.22))
    at(81.6, s_click(0.8))
    at(82, s_thud(0.5, 120))
    # scene 3 - processing
    at(86, s_pop(0.25))
    at(88, s_whir(40 / FPS, 0.07))
    for f0 in range(88, 128):
        at(f0, s_tick(0.18, 1900 if f0 % 2 else 1400))
    for k, f0 in enumerate((92, 100, 108, 116)):
        at(f0, s_blip(600 + 200 * k, 900 + 200 * k, 0.1, 0.22))
    for f0 in range(94, 128, 3):
        at(f0, s_thud(0.1, 70))
    mix[int(128 / FPS * SR):int(132 / FPS * SR)] *= 0.0      # sudden stop
    # scene 4 - approved
    at(132, s_pop(0.8))
    at(132.6, s_ding(0.42))
    at(133, s_crackle(1.0, 0.4))
    at(136, s_thud(0.25, 100))
    for f0 in (148, 149, 150, 151):
        at(f0, s_thud(0.35, 130))
    at(152, s_pop(0.6))
    at(152.5, s_sparkle(0.12))
    # scene 5 - receipt
    at(168, s_whoosh(0.25, 0.18))
    for f0 in (168, 169, 170, 171):
        at(f0, s_tick(0.15, 900))
    at(172, s_printer(26 / FPS, 0.2))
    at(195, s_whoosh(0.4, 0.2))
    at(203, s_tap(0.4))
    at(205, s_slide(0.35, 0.3))
    at(208, s_whoosh(0.45, 0.25))
    # scene 6 - hero
    at(213, s_thud(0.55, 85))
    at(214, s_sparkle(0.16))
    at(218, s_tap(0.2))

    # small tabletop room reflections
    wet = np.zeros_like(mix)
    for d, g in ((0.023, 0.22), (0.041, 0.15), (0.067, 0.1), (0.101, 0.06)):
        k = int(d * SR)
        wet[k:] += mix[:-k] * g
    mix = mix + lp(wet, 4)
    mix = np.tanh(mix * 1.1)
    mix = mix / (np.abs(mix).max() + 1e-9) * 0.89
    pcm = (mix * 32767).astype(np.int16)
    stereo = np.stack([pcm, pcm], axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())


# ----------------------------------------------------------------------------

def ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    if len(sys.argv) > 2 and sys.argv[1] == "--frames":
        for f in [int(v) for v in sys.argv[2].split(",")]:
            render(f).save(os.path.join(OUT_DIR, f"preview_{f:03d}.png"))
            print("preview", f, flush=True)
        return
    os.makedirs(FRAMES_DIR, exist_ok=True)
    with Pool(os.cpu_count() or 2) as pool:
        for i, _ in enumerate(pool.imap_unordered(render_to_disk, range(N))):
            if i % 20 == 0:
                print(f"rendered {i}/{N}", flush=True)
    wav = os.path.join(FRAMES_DIR, "sfx.wav")
    build_audio(wav)
    cmd = [ffmpeg_exe(), "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(FRAMES_DIR, "f_%04d.png"),
           "-i", wav, "-vf", "fps=24,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "21",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", str(N / FPS), OUT]
    subprocess.run(cmd, check=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
