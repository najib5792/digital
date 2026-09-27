#!/usr/bin/env python3
"""Cut the individual assets out of assets/_ref/asset_sheet_v2.png.

Backgrounds are cropped as-is. Sprites get an alpha mask by flood-filling the
white sheet background from the crop border, so light areas inside the object
(egg, empty chrysalis) stay opaque.
"""

from collections import deque
from pathlib import Path

import numpy as np
from scipy import ndimage
from PIL import Image, ImageFilter

HERE = Path(__file__).parent
SHEET = HERE / "assets" / "_ref" / "asset_sheet_v2.png"
OUT = HERE / "assets"

BACKGROUNDS = {
    "bg_daun_atas": (12, 0, 252, 430),
    "bg_daun_sisi": (265, 0, 506, 430),
    "bg_ranting": (518, 0, 761, 430),
    "bg_bunga": (773, 0, 1014, 430),
}

SPRITES = {
    "telur": (40, 462, 225, 658),
    "telur_pecah_atas": (275, 485, 465, 632),
    "telur_pecah_bawah": (505, 480, 705, 652),
    "ulat_kecil": (730, 520, 995, 622),
    "ulat_besar": (25, 680, 610, 866),
    "ulat_J": (680, 660, 905, 877),
    "kepompong_hijau": (125, 895, 285, 1182),
    "kepompong_lutsinar": (430, 895, 585, 1182),
    "kepompong_kosong": (720, 900, 900, 1178),
    "rama_atas": (5, 1205, 470, 1472),
    "rama_sisi": (500, 1205, 810, 1478),
    "rama_baru_keluar": (805, 1200, 990, 1482),
}


def bg_mask(rgb, tol=28, pockets=False):
    """True where a pixel is sheet background reachable from the border."""
    h, w, _ = rgb.shape
    near_white = (rgb.min(axis=2) > 255 - tol) & (np.ptp(rgb, axis=2) < 16)
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    # enclosed pockets of pure sheet white (e.g. between legs) are background too
    if pockets:
        seen |= (rgb.min(axis=2) > 249) & (np.ptp(rgb, axis=2) < 5)
    # drop stray specks (label fragments): keep blobs >= 3% of the largest
    labels, n = ndimage.label(~seen)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        small = np.isin(labels, 1 + np.flatnonzero(sizes < 0.03 * sizes.max()))
        seen |= small
    return seen


# per-sprite tweaks: looser tolerance eats soft grey shadows, pockets clears
# white gaps fully enclosed by the object
TWEAKS = {
    "ulat_kecil": {"tol": 60},
    "rama_baru_keluar": {"pockets": True},
}


def cut(img, box, **tweaks):
    crop = img.crop(box)
    rgb = np.asarray(crop, dtype=np.int16)
    bg = bg_mask(rgb, **tweaks)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    # soften the edge and eat the 1px white fringe
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = crop.convert("RGBA")
    out.putalpha(alpha)
    return out.crop(out.getbbox())


def main():
    img = Image.open(SHEET).convert("RGB")
    OUT.mkdir(exist_ok=True)
    for name, box in BACKGROUNDS.items():
        img.crop(box).save(OUT / f"{name}.png")
    for name, box in SPRITES.items():
        sprite = cut(img, box, **TWEAKS.get(name, {}))
        sprite.save(OUT / f"{name}.png")
        print(f"{name:20s} {sprite.size}")


if __name__ == "__main__":
    main()
