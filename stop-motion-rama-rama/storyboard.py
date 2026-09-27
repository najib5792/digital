"""Crop the numbered panels out of storyboard.png (1024x1536 source)."""

from pathlib import Path

from PIL import Image

SRC = Path(__file__).parent / "storyboard.png"

# (top, bottom) of each row's picture area, above the caption bar.
ROWS = [(196, 326), (416, 547), (640, 792), (886, 1048), (1140, 1314)]
COLS = [(12, 505), (520, 1013)]


def panel(scene_id):
    row, col = divmod(scene_id - 1, 2)
    (y0, y1), (x0, x1) = ROWS[row], COLS[col]
    return Image.open(SRC).convert("RGB").crop((x0, y0, x1, y1))
