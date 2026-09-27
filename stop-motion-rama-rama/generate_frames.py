#!/usr/bin/env python3
"""Generate the 40 keyframes (10 scenes x 4 poses) via OpenRouter.

Usage:
    OPENROUTER_API_KEY=sk-or-... python3 generate_frames.py [--scenes 1,2] [--force]

Pose 1 of each scene uses the matching storyboard panel as a reference; poses
2-4 use the previous pose so the set, camera and subject stay consistent.
Existing keyframes are skipped, so the script can be re-run after a failure.
"""

import argparse, io, json, os, sys, tempfile
from pathlib import Path

from PIL import Image

import generate_image as gi
from storyboard import panel

HERE = Path(__file__).parent
OUT = HERE / "keyframes"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenes", help="comma-separated scene ids (default: all)")
    ap.add_argument("--force", action="store_true", help="regenerate existing keyframes")
    ap.add_argument("-m", "--model", default=os.getenv("OPENROUTER_IMAGE_MODEL", gi.DEFAULT_MODEL))
    args = ap.parse_args()

    api_key = os.getenv("OPENROUTER_API_KEY") or sys.exit("OPENROUTER_API_KEY not set.")
    cfg = json.loads((HERE / "scenes.json").read_text(encoding="utf-8"))
    wanted = {int(s) for s in args.scenes.split(",")} if args.scenes else None
    OUT.mkdir(exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    total_cost = 0.0

    for sc in cfg["scenes"]:
        if wanted and sc["id"] not in wanted:
            continue
        ref = tmp / f"panel{sc['id']}.png"
        panel(sc["id"]).save(ref)
        for k, pose in enumerate(sc["poses"], 1):
            path = OUT / f"s{sc['id']:02d}_p{k}.png"
            if path.exists() and not args.force:
                ref = path
                continue
            if k == 1:
                prompt = (f"{cfg['style']}\n\nScene: {sc['base']} {pose}\n\n"
                          "Use the reference image only as a loose guide for subject and composition; "
                          "recompose it as a vertical 9:16 frame.")
            else:
                prompt = f"{cfg['consistency']}\n\n{cfg['style']}\n\nScene: {sc['base']}\nNow: {pose}"
            print(f"scene {sc['id']} pose {k} ...", flush=True)
            resp = gi.call_api(gi.build_payload(prompt, args.model, "9:16", [str(ref)]), api_key)
            images, text = gi.extract_images(resp)
            if not images:
                sys.exit(f"No image for scene {sc['id']} pose {k}: {text[:300]}")
            Image.open(io.BytesIO(images[0])).convert("RGB").save(path)
            total_cost += float((resp.get("usage") or {}).get("cost") or 0)
            print(f"  saved {path.name}")
            ref = path

    print(f"Done. Total cost ${total_cost:.4f}")


if __name__ == "__main__":
    main()
