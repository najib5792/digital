"""Cut the sticker sheet into individual transparent PNG sprites.

Each sprite: flood-fill the white sheet background from the crop edges,
keep the main connected component(s), then re-bake a clean white sticker
border. Musa sprites additionally get their face side fully covered by
head-cloth (his face must never be visible).
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets')
sheet = np.asarray(Image.open(os.path.join(HERE, 'sticker-sheet.png')).convert('RGB')).astype(np.int16)

# name: (x0, y0, x1, y1, keep)   keep = 'main' (largest blob) | 'all'
ASSETS = {
    'musa_stand':   (5, 3, 172, 278, 'main'),
    'musa_walk':    (175, 3, 347, 278, 'main'),
    'musa_rock':    (538, 3, 757, 302, 'main'),
    'musa_lead':    (288, 292, 416, 510, 'main'),
    'crowd':        (8, 278, 302, 452, 'main'),
    'guard_a':      (413, 284, 507, 470, 'main'),
    'guard_b':      (512, 298, 610, 470, 'main'),
    'guard_c':      (614, 298, 722, 470, 'main'),
    'workers':      (8, 458, 262, 578, 'main'),
    'rocks_flat':   (255, 470, 548, 570, 'main'),
    'frog':         (686, 430, 800, 522, 'main'),
    'cobra':        (770, 440, 884, 568, 'main'),
    'locust_green': (865, 450, 975, 510, 'main'),
    'locusts':      (970, 448, 1140, 552, 'all'),
    'sea_parted':   (1140, 370, 1536, 558, 'main'),
    'pharaoh_basket': (768, 3, 968, 192, 'main'),
    'pharaoh_throne': (972, 3, 1162, 247, 'main'),
    'pharaoh_bust':   (1153, 3, 1300, 178, 'main'),
    'mother_baby':    (1437, 3, 1536, 198, 'main'),
    'soldier':      (750, 198, 852, 420, 'main'),
    'chariot':      (836, 205, 1162, 450, 'main'),
    'pharaoh_point': (1141, 192, 1327, 382, 'main'),
    'women_back':   (1308, 212, 1522, 377, 'main'),
    'pyramids_tent': (18, 575, 402, 688, 'main'),
    'palace_nile':  (405, 585, 755, 695, 'main'),
    'temple':       (765, 583, 968, 692, 'main'),
    'swarm_dark':   (935, 574, 1122, 666, 'all'),
    'swarm_dust':   (1135, 572, 1318, 666, 'all'),
    'wave':         (1305, 555, 1525, 668, 'main'),
    'dry_land':     (922, 655, 1283, 757, 'main'),
    'dry_mountain': (1280, 655, 1522, 752, 'main'),
    'boat':         (8, 685, 232, 852, 'main'),
    'palms_pair':   (172, 688, 268, 818, 'main'),
    'well':         (236, 695, 452, 872, 'main'),
    'cave':         (398, 632, 762, 862, 'main'),
    'burning_bush': (765, 695, 932, 862, 'main'),
    'sandstorm':    (918, 762, 1092, 962, 'main'),
    'cloud_dark':   (1088, 762, 1258, 862, 'main'),
    'ruins':        (1148, 755, 1528, 902, 'main'),
    'sun':          (3, 855, 132, 992, 'main'),
    'night_moon':   (128, 862, 338, 1008, 'main'),
    'cloud_white':  (328, 872, 478, 990, 'main'),
    'cloud_grey':   (436, 860, 602, 992, 'main'),
    'storm':        (588, 855, 738, 998, 'main'),
    'smoke_city':   (728, 858, 918, 992, 'main'),
    'reeds':        (912, 900, 1028, 992, 'main'),
    'fire':         (1030, 855, 1168, 1002, 'main'),
    'rocks':        (1162, 900, 1372, 998, 'main'),
    'palms_bush':   (1366, 890, 1528, 1002, 'main'),
}

# Face-side cover polygons (sheet coords) for every Musa sprite. On the
# sheet a thin strip of hair/beard/cheek shows beside the head-cloth; it is
# repainted as head-cloth so that his face can never be seen.
MUSA_COVER = {
    'musa_stand': [(97, 31), (115, 29), (118, 62), (113, 70), (99, 70), (94, 50)],
    'musa_walk':  [(267, 43), (287, 41), (290, 80), (270, 82), (265, 60)],
    'musa_rock':  [(669, 41), (689, 39), (692, 80), (671, 82), (667, 60)],
    'musa_lead':  [(376, 319), (397, 317), (399, 354), (378, 356), (374, 336)],
}
CLOTH = np.array([232, 214, 180])
CLOTH_SHADE = np.array([206, 184, 146])
OUTLINE = np.array([70, 48, 30])


def cut(name, x0, y0, x1, y1, keep):
    rgb = sheet[y0:y1, x0:x1].copy()
    mx, mn = rgb.max(2), rgb.min(2)
    whiteish = (mn > 222) & (mx - mn < 22)
    # background = whiteish connected to the crop border
    lab, _ = ndi.label(whiteish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)
    lab2, n = ndi.label(fg)
    if n:
        sizes = ndi.sum(fg, lab2, range(1, n + 1))
        if keep == 'main':
            fg = lab2 == (np.argmax(sizes) + 1)
        else:
            fg = np.isin(lab2, [i + 1 for i, s in enumerate(sizes) if s >= 4])
    fg = ndi.binary_fill_holes(fg) if keep == 'main' else fg

    if name in MUSA_COVER:
        from PIL import ImageDraw
        pm = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(pm).polygon([(x - x0, y - y0) for x, y in MUSA_COVER[name]], fill=1)
        poly = np.asarray(pm).astype(bool)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        lum = 0.3 * r + 0.59 * g + 0.11 * b
        skin = (r > 120) & (r > g + 15) & (g > b) & (lum < 225)
        silhouette = fg & ~ndi.binary_erosion(fg, iterations=2)
        m = poly & fg & (skin | (lum < 130)) & ~silhouette
        yy = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]][0]
        t = np.clip((yy - (MUSA_COVER[name][0][1] - y0)) / 40.0, 0, 1)[..., None] * 0.45
        rgb[m] = (CLOTH * (1 - t) + CLOTH_SHADE * t)[m].astype(np.int16)
        # soften the patch edge into the surrounding cloth
        soft = ndi.binary_dilation(m, iterations=2) & fg & ~silhouette
        blurred = np.stack([ndi.uniform_filter(rgb[..., k].astype(float), 3) for k in range(3)], -1)
        rgb[soft] = blurred[soft].astype(np.int16)

    if name == 'mother_baby':
        cover_baby(rgb, fg, x0, y0)
    if name == 'musa_stand':
        split_staff(rgb, fg, x0, y0)
    return finish(name, rgb, fg)


def finish(name, rgb, fg, trim=True):
    # compose with a baked white sticker border + faint grey rim
    pad = 8
    H, W = fg.shape
    alpha = np.zeros((H + 2 * pad, W + 2 * pad), bool)
    alpha[pad:pad + H, pad:pad + W] = fg
    border_m = ndi.binary_dilation(alpha, iterations=4)
    rim = ndi.binary_dilation(border_m, iterations=1) & ~border_m
    out = np.zeros((H + 2 * pad, W + 2 * pad, 4), np.uint8)
    out[border_m] = [255, 255, 255, 255]
    out[rim] = [205, 200, 195, 150]
    inner = np.zeros_like(out[..., :3]); inner[pad:pad + H, pad:pad + W] = np.clip(rgb, 0, 255)
    out[alpha, :3] = inner[alpha]; out[alpha, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    # trim
    if trim:
        img = img.crop(img.getbbox())
    img.save(os.path.join(OUT, name + '.png'), optimize=True)
    return img.size


def cover_baby(rgb, fg, x0, y0):
    """Baby Musa: wrap the whole head in the white swaddling blanket."""
    yy, xx = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]]
    cx, cy, rx, ry = 1506 - x0, 92 - y0, 18.5, 17.5
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    hood = (d <= 1) & fg
    t = np.clip((xx - cx) / rx * 0.5 + 0.5, 0, 1)[..., None] * 0.22
    white = np.array([250, 248, 242]) * (1 - t) + np.array([214, 208, 200]) * t
    rgb[hood] = white[hood].astype(np.int16)
    fold = hood & (np.abs(d - 0.45) < 0.05) & (xx > cx)
    rgb[fold] = [200, 194, 186]
    rgb[hood & (d > 0.86)] = OUTLINE


def split_staff(rgb, fg, x0, y0):
    """Split Musa's staff off musa_stand so it can be raised on its own."""
    sx0, sx1 = 146 - x0, 164 - x0
    hy0, hy1 = 91 - y0, 118 - y0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    skin = (r > 150) & (r > g + 25) & (g > b + 10) & (lum > 120)
    cols = np.zeros(fg.shape, bool); cols[:, sx0:sx1] = True
    staff = cols & fg & (lum < 150) & ~skin
    hand = np.zeros(fg.shape, bool); hand[hy0:hy1, sx0 - 8:sx1] = True
    body_fg = fg & ~(staff & ~hand)
    body_fg = ndi.binary_opening(body_fg, iterations=1) | (fg & hand)
    lab, n = ndi.label(body_fg)
    body_fg = lab == (np.argmax(ndi.sum(body_fg, lab, range(1, n + 1))) + 1)
    finish('musa_stand_body', rgb.copy(), body_fg, trim=False)
    # staff: fill the stretch hidden by the hand with wood colour
    srgb = rgb.copy()
    row = hy1 + 4
    xs = np.where(staff[row])[0]
    if len(xs):
        a, b2 = xs.min(), xs.max()
        staff[hy0 - 3:hy1 + 3, :] = False
        staff[hy0 - 3:hy1 + 3, a:b2 + 1] = True
        srgb[hy0 - 3:hy1 + 3, a:b2 + 1] = srgb[row, a:b2 + 1]
    lab, n = ndi.label(staff)
    staff = lab == (np.argmax(ndi.sum(staff, lab, range(1, n + 1))) + 1)
    finish('staff', srgb, staff, trim=False)
    ys = np.where(staff.any(1))[0]
    print('staff hand pivot (fraction of staff height):', ((hy0 + hy1) / 2 - ys.min()) / (ys.max() - ys.min()))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for k, v in ASSETS.items():
        meta[k] = cut(k, *v)
    print(json.dumps(meta))
