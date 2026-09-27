#!/usr/bin/env python3
"""generate_image.py — Generate images via OpenRouter. Stdlib only.

Usage:
    OPENROUTER_API_KEY=sk-or-... python generate_image.py "prompt" [-m MODEL] [-a 4:5] [-i ref.jpg] [-n 3] [-o outdir]
"""

import argparse, base64, json, mimetypes, os, re, sys, time
import urllib.error, urllib.request
from pathlib import Path

API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "google/gemini-2.5-flash-image"
ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]


def encode_image(path):
    p = Path(path)
    if not p.is_file():
        sys.exit(f"Input image not found: {path}")
    mime = mimetypes.guess_type(p.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"


def build_payload(prompt, model, aspect, images):
    if images:
        content = [{"type": "text", "text": prompt}]
        content += [{"type": "image_url", "image_url": {"url": encode_image(i)}} for i in images]
    else:
        content = prompt
    payload = {"model": model, "messages": [{"role": "user", "content": content}], "modalities": ["image", "text"]}
    if aspect:
        payload["image_config"] = {"aspect_ratio": aspect}
    return payload


def call_api(payload, api_key, timeout=180):
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "X-Title": "generate_image.py"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} from OpenRouter:\n{e.read().decode(errors='replace')}")
    except urllib.error.URLError as e:
        sys.exit(f"Network error: {e.reason}")


def extract_images(resp):
    if "error" in resp:
        sys.exit(f"API error: {json.dumps(resp['error'], indent=2)}")
    try:
        msg = resp["choices"][0]["message"]
    except (KeyError, IndexError):
        sys.exit(f"Unexpected response:\n{json.dumps(resp, indent=2)[:2000]}")
    out = []
    for img in msg.get("images") or []:
        url = (img.get("image_url") or {}).get("url", "")
        m = re.match(r"data:image/[\w.+-]+;base64,(.+)", url, re.S)
        if m:
            out.append(base64.b64decode(m.group(1)))
        elif url.startswith("http"):
            with urllib.request.urlopen(url, timeout=60) as r:
                out.append(r.read())
    return out, msg.get("content") or ""


def ext_for(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return "png"


def slugify(text, n=40):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return s[:n].rstrip("-") or "image"


def main():
    ap = argparse.ArgumentParser(description="Generate images via OpenRouter")
    ap.add_argument("prompt")
    ap.add_argument("-m", "--model", default=os.getenv("OPENROUTER_IMAGE_MODEL", DEFAULT_MODEL))
    ap.add_argument("-a", "--aspect", choices=ASPECT_RATIOS)
    ap.add_argument("-i", "--image", action="append", default=[])
    ap.add_argument("-n", "--count", type=int, default=1)
    ap.add_argument("-o", "--outdir", default="generated")
    args = ap.parse_args()

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        sys.exit("OPENROUTER_API_KEY not set.")

    prompt = args.prompt
    if prompt.endswith(".txt") and Path(prompt).is_file():
        prompt = Path(prompt).read_text(encoding="utf-8").strip()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    base = f"{time.strftime('%Y%m%d-%H%M%S')}_{slugify(prompt)}"
    payload = build_payload(prompt, args.model, args.aspect, args.image)
    saved, total_cost = [], 0.0

    for run in range(1, args.count + 1):
        print(f"[{run}/{args.count}] {args.model} ...", flush=True)
        resp = call_api(payload, api_key)
        images, text = extract_images(resp)
        if not images:
            print(f"  No image returned. Model said: {text[:500] or '(nothing)'}")
            continue
        for k, data in enumerate(images, 1):
            suffix = (f"_{run}" if args.count > 1 else "") + (f"-{k}" if len(images) > 1 else "")
            path = outdir / f"{base}{suffix}.{ext_for(data)}"
            path.write_bytes(data)
            saved.append(path)
            print(f"  Saved {path} ({len(data)//1024} KB)")
        cost = (resp.get("usage") or {}).get("cost")
        if cost is not None:
            total_cost += float(cost)

    if saved:
        (outdir / f"{base}.prompt.txt").write_text(
            f"model: {args.model}\naspect: {args.aspect}\ninputs: {args.image}\n\n{prompt}\n", encoding="utf-8")
    print(f"\nDone. {len(saved)} image(s), total cost ${total_cost:.4f}")


if __name__ == "__main__":
    main()
