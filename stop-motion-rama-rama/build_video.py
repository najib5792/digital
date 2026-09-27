#!/usr/bin/env python3
"""Build the cut-out puppet stop-motion video from the assets in assets/.

Usage:
    python3 extract_assets.py        # once: cut assets out of the asset sheet
    python3 build_video.py [-o out/rama-rama-stop-motion.mp4] [--sheet] [--scenes 2,9]

10 scenes x 1 s at 12 fps, 1080x1920. Every frame is posed separately: sprites
are placed on a background, moved/rotated/morphed per frame, then each frame
gets hand-made jitter, light flicker, grain and a vignette.
"""

import argparse, math, subprocess, wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
ASSETS = HERE / "assets"
W, H, FPS, N = 1080, 1920, 12, 12   # N = frames per scene
SR = 44100
rng = np.random.default_rng(7)

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
BOLD = str(FONT_DIR / "DejaVuSans-Bold.ttf")
SERIF = str(FONT_DIR / "DejaVuSerif-Bold.ttf")
YELLOW = (255, 196, 32)
INK = (22, 22, 22)

CAPTIONS = [
    "Telur rama-rama muncul di atas daun.",
    "Telur menetas dan ulat kecil keluar.",
    "Ulat kecil mula makan daun.",
    "Ulat membesar dan semakin matang.",
    "Ulat menggantung pada ranting.",
    "Ulat berubah menjadi kepompong.",
    "Kepompong berubah dan corak sayap mula kelihatan.",
    "Rama-rama keluar dari kepompong.",
    "Sayap mengembang sehingga terbuka sepenuhnya.",
    "Rama-rama dewasa terbang dan hinggap di bunga.",
]
END_TITLE = "Dari Telur Menjadi Rama-Rama"

# Positions measured on the extracted assets (asset pixel coordinates).
TWIG_UNDERSIDE_Y = 103        # bg_ranting.png
LEAF_SURFACE_Y = 275          # bg_daun_sisi.png, a point on the leaf surface
FLOWER_CENTRE = (122, 313)    # bg_bunga.png, zinnia centre
BUTTERFLY_BODY_X = 215        # rama_atas.png, body axis
BUTTERFLY_BODY_HALF = 11


# ------------------------------------------------------------------ assets

_cache = {}


def asset(name):
    if name not in _cache:
        _cache[name] = Image.open(ASSETS / f"{name}.png").convert("RGBA")
    return _cache[name]


def butterfly(open_=1.0, curl=0.0):
    """rama_atas with each wing scaled toward the body.

    open_ 0..1 is the flap (wings fold up edge-on), curl 0..1 crumples them
    shorter for the freshly emerged, still-expanding wings.
    """
    img = asset("rama_atas")
    w, h = img.size
    cx, hb = BUTTERFLY_BODY_X, BUTTERFLY_BODY_HALF
    out = Image.new("RGBA", (w, h))
    sx = max(0.08, open_)
    sy = 1.0 - 0.35 * curl
    for box, is_left in (((0, 0, cx, h), True), ((cx, 0, w, h), False)):
        wing = img.crop(box)
        ww, wh = max(2, int(wing.width * sx)), max(2, int(wing.height * sy))
        piece = wing.resize((ww, wh), Image.LANCZOS)
        if sx < 0.95:  # wings darken as they tilt away from the light
            shade = Image.new("RGBA", piece.size, (0, 0, 0, int(90 * (1 - sx))))
            piece = Image.composite(Image.alpha_composite(piece, shade), piece, piece)
        out.alpha_composite(piece, (cx - ww if is_left else cx, int((h - wh) * 0.15)))
    out.alpha_composite(img.crop((cx - hb, 0, cx + hb, h)), (cx - hb, 0))
    return out


# ------------------------------------------------------------- composition

def bg_frame(name, zoom=1.0, focus=None, target=None):
    """Cover-fit a background; zoom so bg point `focus` lands near canvas `target`.

    Returns (image, transform) where transform maps bg coords -> canvas coords.
    """
    img = asset(name).convert("RGB")
    s = max(W / img.width, H / img.height) * zoom
    sw, sh = img.width * s, img.height * s
    fx, fy = focus or (img.width / 2, img.height / 2)
    tx, ty = target or (W / 2, H / 2)
    ox = min(0, max(W - sw, tx - fx * s))
    oy = min(0, max(H - sh, ty - fy * s))
    out = img.transform((W, H), Image.AFFINE, (1 / s, 0, -ox / s, 0, 1 / s, -oy / s), Image.BICUBIC)
    return out.convert("RGBA"), (lambda x, y: (ox + x * s, oy + y * s))


def place(canvas, sprite, pos, anchor=(0.5, 0.5), scale=1.0, rot=0.0, sx=1.0, sy=1.0,
          alpha=1.0, jitter=True, flip=False):
    """Paste sprite so its `anchor` (fractions of its size) lands at canvas `pos`."""
    if alpha <= 0.01:
        return
    img = sprite.transpose(Image.FLIP_TOP_BOTTOM) if flip else sprite
    w = max(1, int(img.width * scale * sx))
    h = max(1, int(img.height * scale * sy))
    img = img.resize((w, h), Image.LANCZOS)
    if jitter:  # hand-posed puppets never land in exactly the same spot
        rot += rng.uniform(-0.6, 0.6)
        pos = (pos[0] + rng.uniform(-2, 2), pos[1] + rng.uniform(-2, 2))
    px, py = anchor[0] * w - w / 2, anchor[1] * h - h / 2
    if rot:
        img = img.rotate(rot, resample=Image.BICUBIC, expand=True)
        a = math.radians(rot)
        px, py = math.cos(a) * px + math.sin(a) * py, -math.sin(a) * px + math.cos(a) * py
    if alpha < 1:
        img.putalpha(img.getchannel("A").point(lambda v: int(v * alpha)))
    x = int(round(pos[0] - img.width / 2 - px))
    y = int(round(pos[1] - img.height / 2 - py))
    layer = Image.new("RGBA", canvas.size)
    layer.paste(img, (x, y))
    canvas.alpha_composite(layer)


def crawl(sprite, phase, amp=0.035):
    """Caterpillar crawl: a travelling wave humps the body column by column."""
    a = np.asarray(sprite)
    h, w = a.shape[:2]
    pad = int(h * amp * 2) + 2
    out = np.zeros((h + pad, w, 4), np.uint8)
    for x in range(w):
        dy = int(pad / 2 - h * amp * math.sin(2 * math.pi * (x / w * 1.5) - phase))
        out[dy:dy + h, x] = a[:, x]
    return Image.fromarray(out)


def reveal_top(sprite, frac):
    """Keep only the top `frac` of a sprite (something emerging downward)."""
    out = sprite.copy()
    ImageDraw.Draw(out).rectangle((0, int(sprite.height * frac), sprite.width, sprite.height), fill=(0, 0, 0, 0))
    return out


def cracked(egg, amount):
    """Draw a zig-zag crack around the top third of the egg."""
    out = egg.copy()
    w, h = out.size
    n = 9
    pts = [(w * (0.12 + 0.76 * i / (n - 1)), h * 0.34 + (h * 0.04 if i % 2 else -h * 0.03)) for i in range(n)]
    pts = pts[: max(2, int(n * amount))]
    ImageDraw.Draw(out).line(pts, fill=(95, 70, 40, 255), width=max(2, w // 60), joint="curve")
    return out


def bite_holes(canvas, centre, count, r=70):
    """Irregular holes chewed into the leaf, darker bokeh showing through."""
    d = ImageDraw.Draw(canvas)
    spots = [(0, 0), (150, 70), (40, 170), (210, 210)]
    local = np.random.default_rng(3)
    for i in range(min(count, len(spots))):
        cx, cy = centre[0] + spots[i][0], centre[1] + spots[i][1]
        rr = r * (0.8 + 0.12 * i)
        poly = [(cx + rr * (0.8 + 0.3 * local.random()) * math.cos(t),
                 cy + rr * 0.7 * (0.8 + 0.3 * local.random()) * math.sin(t))
                for t in np.linspace(0, 2 * math.pi, 14, endpoint=False)]
        d.polygon(poly, fill=(170, 200, 110, 255))
        d.polygon([(cx + (x - cx) * 0.86, cy + (y - cy) * 0.86) for x, y in poly], fill=(38, 62, 30, 255))


def sparkles(canvas, centre, t, spread=160, n=7, seed=0):
    layer = Image.new("RGBA", canvas.size)
    d = ImageDraw.Draw(layer)
    local = np.random.default_rng(seed)
    for _ in range(n):
        x = centre[0] + local.uniform(-spread, spread)
        y = centre[1] + local.uniform(-spread, spread) - 40 * t
        r = local.uniform(3, 8) * (1 - abs(0.5 - t))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 245, 200, int(220 * (1 - t))))
    canvas.alpha_composite(layer)


def ease(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ----------------------------------------------------------------- scenes
# Each scene(i) returns the RGBA frame for local frame i in 0..N-1.

def scene1(i):
    """Eggs pop up one by one on the leaf (top view)."""
    c, _ = bg_frame("bg_daun_atas", zoom=1.0 + 0.004 * i)
    eggs = [(330, 760), (600, 690), (800, 900), (520, 1060)]
    for k, (x, y) in enumerate(eggs):
        age = i - k * 3
        if age < 0:
            continue
        pop = {0: 0.55, 1: 1.18}.get(age, 1.0)  # squash-and-settle pop
        place(c, asset("telur"), (x, y), anchor=(0.5, 1.0), scale=1.2 * pop, sy=0.92 if age == 1 else 1.0)
    if i % 3 == 0:
        k = i // 3
        sparkles(c, (eggs[k][0], eggs[k][1] - 90), 0.3, spread=90, n=5, seed=k)
    return c


def scene2(i):
    """The egg rocks, cracks, the cap pops off and the caterpillar crawls out."""
    c, _ = bg_frame("bg_daun_sisi", zoom=1.15, focus=(120, LEAF_SURFACE_Y), target=(540, 1230))
    base = (500, 1230)
    egg_scale = 1.9
    egg_h = asset("telur").height * egg_scale
    shell_scale = asset("telur").width * egg_scale / asset("telur_pecah_bawah").width
    if i < 6:
        egg = asset("telur") if i < 3 else cracked(asset("telur"), (i - 2) / 3)
        place(c, egg, base, anchor=(0.5, 1.0), scale=egg_scale, rot=[0, 4, -4][i % 3] if i else 0)
        return c
    rim_y = base[1] - asset("telur_pecah_bawah").height * shell_scale * 0.9
    cap_rest = (base[0] - 230, base[1] - 20)
    if i < 9:
        # cap flies off, caterpillar head rises out of the shell (drawn behind it)
        k = i - 6
        ulat = asset("ulat_kecil")
        peek = [0.25, 0.5, 0.75][k]
        place(c, ulat, (base[0] + 10 * k, rim_y + ulat.width * (1 - peek)),
              anchor=(1.0, 0.5), rot=80 - 12 * k)
        place(c, asset("telur_pecah_bawah"), base, anchor=(0.5, 1.0), scale=shell_scale)
        cap_pos = [(base[0] + 10, base[1] - egg_h * 0.78), (base[0] - 90, base[1] - egg_h * 0.95), cap_rest][k]
        place(c, asset("telur_pecah_atas"), cap_pos, anchor=(0.5, 1.0), scale=shell_scale, rot=[12, 40, 170][k])
    else:
        k = i - 9
        place(c, asset("telur_pecah_atas"), cap_rest, anchor=(0.5, 1.0), scale=shell_scale, rot=170)
        place(c, asset("telur_pecah_bawah"), base, anchor=(0.5, 1.0), scale=shell_scale)
        place(c, crawl(asset("ulat_kecil"), k * 2.1), (base[0] + 250 + 45 * k, base[1] + 5),
              anchor=(0.5, 1.0), scale=1.35)
    return c


def scene3(i):
    """The small caterpillar chews holes into the leaf and grows a little."""
    c, _ = bg_frame("bg_daun_sisi", zoom=1.35, focus=(120, LEAF_SURFACE_Y), target=(540, 1260))
    step = i // 3
    bite_holes(c, (800, 1330), step)
    x = 330 + 25 * step
    place(c, crawl(asset("ulat_kecil"), i * 1.3), (x, 1262 + [0, -6, 3][i % 3]), anchor=(0.5, 1.0),
          scale=2.4 + 0.08 * step, rot=[0, 2, -1][i % 3])
    if i % 3 == 1:  # leaf crumbs
        d = ImageDraw.Draw(c)
        for _ in range(5):
            px, py = x + 330 + rng.uniform(-30, 40), 1240 + rng.uniform(-40, 30)
            d.ellipse((px, py, px + 7, py + 5), fill=(120, 170, 60, 255))
    return c


def scene4(i):
    """Growth: the small caterpillar morphs into the big striped one while crawling."""
    c, _ = bg_frame("bg_daun_sisi", zoom=1.2 + 0.01 * i, focus=(120, LEAF_SURFACE_Y), target=(540, 1250))
    t = [0.0, 0.35, 0.7, 1.0][i // 3]
    width = lerp(asset("ulat_kecil").width * 2.7, asset("ulat_besar").width * 1.7, t)
    x = 520 + 8 * i
    small = crawl(asset("ulat_kecil"), i * 1.6)
    big = crawl(asset("ulat_besar"), i * 1.6)
    place(c, small, (x, 1255), anchor=(0.5, 1.0), scale=width / small.width, alpha=1 - t)
    place(c, big, (x, 1255), anchor=(0.5, 1.0), scale=width / big.width, alpha=min(1, t * 1.4))
    return c


def twig_scene(zoom=1.0):
    c, tf = bg_frame("bg_ranting", zoom=zoom, focus=(120, TWIG_UNDERSIDE_Y), target=(540, 430))
    return c, tf(120, TWIG_UNDERSIDE_Y)[1] - 6


def scene5(i):
    """The caterpillar crawls under the twig, then hangs down in a J."""
    c, twig_y = twig_scene()
    if i < 6:
        place(c, crawl(asset("ulat_besar"), i * 1.7), (380 + 30 * i, twig_y - 4), anchor=(0.5, 0.0),
              scale=1.15, flip=True, alpha=0.5 if i == 5 else 1.0)
    if i >= 5:
        k = i - 5
        place(c, asset("ulat_J"), (600, twig_y), anchor=(0.34, 0.0), scale=1.9,
              sy=min(1.0, 0.45 + 0.2 * k), rot=5 * math.sin(k * 1.2) * (1 - k / 8),
              alpha=0.5 if i == 5 else 1.0)
    return c


def scene6(i):
    """J-hanging caterpillar shrivels into the jade chrysalis."""
    c, twig_y = twig_scene(zoom=1.04)
    t = [0.0, 0.35, 0.7, 1.0][i // 3]
    place(c, asset("ulat_J"), (600, twig_y), anchor=(0.34, 0.0), scale=1.9 * (1 - 0.25 * t),
          rot=[3, -3, 0][i % 3] * (1 - t), alpha=1 - t)
    place(c, asset("kepompong_hijau"), (600, twig_y), anchor=(0.5, 0.0), scale=1.9, sy=0.8 + 0.2 * t,
          alpha=min(1, t * 1.3))
    return c


def scene7(i):
    """The chrysalis turns clear and the wing pattern shows through."""
    c, twig_y = twig_scene(zoom=1.08 + 0.006 * i)
    t = [0.0, 0.35, 0.7, 1.0][i // 3]
    place(c, asset("kepompong_hijau"), (600, twig_y), anchor=(0.5, 0.0), scale=1.9)
    place(c, asset("kepompong_lutsinar"), (600, twig_y), anchor=(0.5, 0.0), scale=1.9, alpha=t)
    if i >= 9:
        sparkles(c, (600, twig_y + 280), (i - 9) / 3, spread=180, seed=i)
    return c


def scene8(i):
    """The chrysalis shakes, splits and the butterfly climbs out beneath it."""
    c, twig_y = twig_scene(zoom=1.08)
    step = i // 3
    if step == 0:
        place(c, asset("kepompong_lutsinar"), (600, twig_y), anchor=(0.5, 0.0), scale=1.9, rot=[3, -3, 2][i % 3])
        return c
    shell_h = asset("kepompong_kosong").height * 1.9
    place(c, asset("kepompong_kosong"), (600, twig_y), anchor=(0.5, 0.0), scale=1.9)
    place(c, reveal_top(asset("rama_baru_keluar"), [0.0, 0.4, 0.72, 1.0][step]),
          (655, twig_y + shell_h * 0.72), anchor=(0.72, 0.0), scale=1.9)
    return c


def scene9(i):
    """Crumpled wings pump up and open fully."""
    c, twig_y = twig_scene(zoom=1.08)
    hang = (655, twig_y + asset("kepompong_kosong").height * 1.9 * 0.72)
    place(c, asset("kepompong_kosong"), (600, twig_y), anchor=(0.5, 0.0), scale=1.9)
    if i < 5:
        s = 1 + 0.06 * i
        place(c, asset("rama_baru_keluar"), hang, anchor=(0.72, 0.0), scale=1.9, sx=s, sy=s)
        return c
    k = i - 5  # 0..6
    open_ = [0.15, 0.3, 0.5, 0.7, 0.9, 1.0, 1.0][k]
    curl = [0.8, 0.6, 0.4, 0.2, 0.05, 0, 0][k]
    place(c, butterfly(open_, curl), (hang[0] - 40, hang[1] - 10),
          anchor=(BUTTERFLY_BODY_X / asset("rama_atas").width, 0.1), scale=1.75, alpha=0.55 if k == 0 else 1.0)
    if k == 0:
        place(c, asset("rama_baru_keluar"), hang, anchor=(0.72, 0.0), scale=1.9 * 1.25, alpha=0.5)
    return c


def scene10(i):
    """Hero shot: the butterfly flutters in and lands on the zinnia."""
    c, tf = bg_frame("bg_bunga", zoom=1.3, focus=FLOWER_CENTRE, target=(540, 1180))
    fx, fy = tf(*FLOWER_CENTRE)
    land = (fx, fy - 60)
    ax = BUTTERFLY_BODY_X / asset("rama_atas").width
    if i < 8:
        t = ease(i / 7)
        # curved flight path from the upper left, bobbing on each wing beat
        x = lerp(160, land[0], t) + 140 * math.sin(math.pi * t)
        y = lerp(700, land[1], t) - 60 * math.sin(math.pi * t) + [0, 14, 22, 10][i % 4]
        place(c, butterfly([1.0, 0.55, 0.12, 0.55][i % 4]), (x, y), anchor=(ax, 0.5),
              scale=lerp(0.9, 1.3, t), rot=lerp(-25, 0, t))
    else:
        place(c, butterfly([0.85, 1.0, 0.9, 1.0][i - 8]), land, anchor=(ax, 0.5), scale=1.3)
        sparkles(c, land, (i - 8) / 4, spread=220, seed=i)
    return c


SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8, scene9, scene10]


# ----------------------------------------------------------------- overlays

def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, fnt, max_w):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    return lines + [cur]


def overlay_scene(n, caption):
    """Static RGBA overlay for a scene: number badge, time pill, caption bar."""
    ov = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle((70, 82, 330, 170), radius=44, fill=(15, 15, 15, 200), outline=(255, 255, 255, 230), width=3)
    d.text((230, 126), f"{n - 1}–{n}s", font=font(BOLD, 44), fill="white", anchor="mm")
    d.ellipse((48, 70, 160, 182), fill=YELLOW, outline=INK, width=5)
    d.text((104, 128), str(n), font=font(BOLD, 60 if n < 10 else 50), fill=INK, anchor="mm")
    f = font(BOLD, 52)
    lines = wrap(d, caption, f, W - 160)
    lh = 68
    bh = lh * len(lines) + 70
    y0 = H - 250 - bh
    d.rounded_rectangle((50, y0, W - 50, y0 + bh), radius=30, fill=(10, 10, 10, 185), outline=(255, 255, 255, 200), width=3)
    for j, line in enumerate(lines):
        d.text((W / 2, y0 + 35 + lh * j + lh / 2), line, font=f, fill="white", anchor="mm")
    return ov


def end_title(text, i):
    """Pop-in title on the last scene; i = frames since it appeared."""
    ov = Image.new("RGBA", (W, H))
    if i < 0:
        return ov
    d = ImageDraw.Draw(ov)
    scale = [0.6, 1.12, 1.0][min(i, 2)]
    f = font(SERIF, int(84 * scale))
    words = text.split()
    for j, line in enumerate([" ".join(words[:2]), " ".join(words[2:])]):
        y = 330 + j * int(110 * scale)
        d.text((W / 2 + 4, y + 4), line, font=f, fill=(0, 0, 0, 160), anchor="mm")
        d.text((W / 2, y), line, font=f, fill="white", anchor="mm", stroke_width=3, stroke_fill=(120, 60, 0))
    y = 330 + int(110 * scale) + int(75 * scale)
    d.line((W / 2 - 220 * scale, y, W / 2 + 220 * scale, y - 10), fill=YELLOW, width=int(14 * scale))
    return ov


# ------------------------------------------------------------------ texture

def vignette():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    return np.clip(1.0 - 0.28 * np.clip(r - 0.55, 0, None) ** 1.5 / 0.6, 0.6, 1.0)[..., None]


def camera_shake(img):
    """Whole-frame nudge, like the camera being bumped between exposures."""
    dx, dy = rng.uniform(-3, 3), rng.uniform(-3, 3)
    z = 1.02
    cw, ch = W / z, H / z
    x0, y0 = (W - cw) / 2 - dx, (H - ch) / 2 - dy
    img = img.rotate(rng.uniform(-0.25, 0.25), resample=Image.BICUBIC)
    return img.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BICUBIC)


def texture(img, vig):
    a = np.asarray(img, dtype=np.float32)
    a *= rng.uniform(0.965, 1.035)                                              # light flicker
    a += rng.normal(0, 4.0, (H // 2, W // 2, 1)).repeat(2, 0).repeat(2, 1)      # grain
    a *= vig
    return np.clip(a, 0, 255).astype(np.uint8)


# -------------------------------------------------------------------- audio

def tone(freq, dur, amp, decay):
    t = np.arange(int(SR * dur)) / SR
    return amp * np.sin(2 * np.pi * freq * t) * np.exp(-t * decay) * np.minimum(1, t * 200)


def soundtrack(total):
    out = np.zeros(int(SR * (total + 1)))

    def add(sig, at):
        s = int(at * SR)
        out[s:s + len(sig)] += sig[: len(out) - s]

    # soft pad, one chord every 2.5 s (C - Am - F - G)
    chords = [(261.6, 329.6, 392.0), (220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (196.0, 246.9, 293.7)]
    for c, notes in enumerate(chords):
        for f in notes:
            add(tone(f, 2.9, 0.05, 0.6), c * 2.5)
            add(tone(f * 2, 2.9, 0.015, 1.2), c * 2.5)
    # music-box melody with a tiny shutter click every 1/4 s
    scale = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5]
    melody = [0, 2, 4, 3, 1, 2, 4, 5]
    for j in range(int(total / 0.25)):
        f = scale[melody[j % len(melody)]]
        add(tone(f, 0.6, 0.09, 7), j * 0.25)
        add(tone(f * 3, 0.3, 0.02, 14), j * 0.25)
        n = int(SR * 0.012)
        add(rng.normal(0, 1, n) * np.exp(-np.arange(n) / 90) * 0.05, j * 0.25)
    # hatch pop, chrysalis split, sparkle on landing
    for at in (1.5, 7.25, 9.6):
        for q, f in enumerate((1318.5, 1568.0, 2093.0)):
            add(tone(f, 0.8, 0.06, 5), at + q * 0.06)
    out = out[: int(SR * total)]
    fade = int(SR * 0.4)
    out[-fade:] *= np.linspace(1, 0, fade)
    return (out / max(1e-6, np.abs(out).max()) * 0.8 * 32767).astype(np.int16)


def write_wav(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(samples.tobytes())


# --------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=str(HERE / "out" / "rama-rama-stop-motion.mp4"))
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--sheet", action="store_true", help="also save a contact sheet of every 3rd frame")
    ap.add_argument("--scenes", help="comma-separated scene numbers to render (silent preview)")
    args = ap.parse_args()

    wanted = [int(s) for s in args.scenes.split(",")] if args.scenes else list(range(1, 11))
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    wav = out.with_suffix(".wav")
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if not args.no_audio and not args.scenes:
        write_wav(wav, soundtrack(len(wanted) * N / FPS))
        cmd += ["-i", str(wav), "-c:a", "aac", "-b:a", "160k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(out)]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    vig = vignette()
    stills = []
    for n in wanted:
        ov = overlay_scene(n, CAPTIONS[n - 1])
        for i in range(N):
            frame = camera_shake(SCENES[n - 1](i))
            frame.alpha_composite(ov)
            if n == 10:
                frame.alpha_composite(end_title(END_TITLE, i - 3))
            arr = texture(frame.convert("RGB"), vig)
            ff.stdin.write(arr.tobytes())
            if args.sheet and i % 3 == 2:
                stills.append(Image.fromarray(arr))
    ff.stdin.close()
    if ff.wait():
        raise SystemExit("ffmpeg failed")
    wav.unlink(missing_ok=True)
    print(f"Saved {out}")

    if stills:
        cols = 8
        tw, th = W // 6, H // 6
        rows = math.ceil(len(stills) / cols)
        sheet = Image.new("RGB", (tw * cols, th * rows))
        for j, s in enumerate(stills):
            sheet.paste(s.resize((tw, th)), ((j % cols) * tw, (j // cols) * th))
        sheet.save(out.with_name(out.stem + "_sheet.jpg"), quality=85)


if __name__ == "__main__":
    main()
