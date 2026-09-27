#!/usr/bin/env python3
"""Assemble the stop-motion video from keyframes/sNN_pK.png.

Usage:
    python3 build_video.py [-o out/rama-rama-stop-motion.mp4] [--no-audio]

10 scenes x 1 s at 12 fps, 1080x1920. Each scene holds 4 poses for 3 frames
each; every frame gets its own hand-made jitter, light flicker and grain so it
reads as stop motion. Missing keyframes fall back to the storyboard panels
(preview mode) so the pipeline can be checked before generating anything.
"""

import argparse, json, math, subprocess, wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from storyboard import panel

HERE = Path(__file__).parent
W, H, FPS = 1080, 1920, 12
FRAMES_PER_SCENE, POSES = 12, 4
HOLD = FRAMES_PER_SCENE // POSES
SR = 44100
rng = np.random.default_rng(7)

FONT_DIR = Path("/usr/share/fonts/truetype")
BOLD = str(FONT_DIR / "dejavu/DejaVuSans-Bold.ttf")
SERIF_BI = str(FONT_DIR / "dejavu/DejaVuSerif-Bold.ttf")

YELLOW = (255, 196, 32)
INK = (22, 22, 22)


# ---------------------------------------------------------------- keyframes

def cover(img, w=W, h=H):
    scale = max(w / img.width, h / img.height)
    img = img.resize((math.ceil(img.width * scale), math.ceil(img.height * scale)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def placeholder(scene_id, k):
    """9:16 frame from a storyboard panel: blurred backdrop + the panel, stepping in per pose."""
    p = panel(scene_id)
    bg = cover(p).filter(ImageFilter.GaussianBlur(40))
    bg = ImageEnhance.Brightness(bg).enhance(0.8)
    # zoom a little into the panel each pose so the preview still "moves"
    z = 1 + 0.06 * (k - 1)
    cw, ch = p.width / z, p.height / z
    p = p.crop(((p.width - cw) / 2, (p.height - ch) / 2, (p.width + cw) / 2, (p.height + ch) / 2))
    fg_h = int(H * 0.30)
    fg = cover(p.resize((int(p.width * fg_h / p.height), fg_h), Image.LANCZOS), W, fg_h)
    bg.paste(fg, (0, (H - fg_h) // 2 - 80))
    return bg


def load_keyframes(scenes):
    frames, missing = {}, 0
    for sc in scenes:
        for k in range(1, POSES + 1):
            path = HERE / "keyframes" / f"s{sc['id']:02d}_p{k}.png"
            if path.exists():
                frames[sc["id"], k] = cover(Image.open(path).convert("RGB"))
            else:
                frames[sc["id"], k] = placeholder(sc["id"], k)
                missing += 1
    return frames, missing


# ------------------------------------------------------------------- motion

def camera(motion, i):
    """(zoom, dx, dy, angle) for frame i of a scene; stepped like hand-moved rigs."""
    step = (i // HOLD) / (POSES - 1)  # 0 .. 1 in pose-sized steps
    t = i / (FRAMES_PER_SCENE - 1)
    if motion == "popup":
        return 1.0 + (0.035 if i % HOLD == 0 and i else 0.0), 0, 0, 0
    if motion == "push":
        return 1.0 + 0.08 * t, 0, 0, 0
    if motion == "pan":
        return 1.08, -40 + 80 * t, 0, 0
    if motion == "grow":
        return 1.0 + 0.06 * step, 0, 10 * step, 0
    if motion == "sway":
        return 1.04, 0, 0, 1.6 * math.sin(i * 1.1)
    if motion == "hero":
        return 1.12 - 0.12 * t, 0, -20 * t, 0
    return 1.0, 0, 0, 0


def transform(img, zoom, dx, dy, angle):
    # hand-made jitter on top of the planned move
    dx += rng.uniform(-3, 3)
    dy += rng.uniform(-3, 3)
    angle += rng.uniform(-0.3, 0.3)
    zoom += 0.02  # headroom so jitter/rotation never shows edges
    cw, ch = W / zoom, H / zoom
    x0, y0 = (W - cw) / 2 - dx / zoom, (H - ch) / 2 - dy / zoom
    out = img.rotate(angle, resample=Image.BICUBIC, center=(W / 2, H / 2)) if angle else img
    return out.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BICUBIC)


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


def overlay_scene(sc):
    """Static RGBA overlay for a scene: number badge, time pill, caption bar."""
    ov = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(ov)
    n = sc["id"]
    # time pill + number badge
    d.rounded_rectangle((70, 82, 330, 170), radius=44, fill=(15, 15, 15, 200), outline=(255, 255, 255, 230), width=3)
    d.text((230, 126), f"{n - 1}–{n}s", font=font(BOLD, 44), fill="white", anchor="mm")
    d.ellipse((48, 70, 160, 182), fill=YELLOW, outline=INK, width=5)
    d.text((104, 128), str(n), font=font(BOLD, 60 if n < 10 else 50), fill=INK, anchor="mm")
    # caption bar
    f = font(BOLD, 52)
    lines = wrap(d, sc["caption"], f, W - 160)
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
    f = font(SERIF_BI, int(84 * scale))
    words = text.split()
    lines = [" ".join(words[:2]), " ".join(words[2:])]
    for j, line in enumerate(lines):
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


def texture(img, vig):
    a = np.asarray(img, dtype=np.float32)
    a *= rng.uniform(0.965, 1.035)                      # light flicker
    a += rng.normal(0, 4.0, (H // 2, W // 2, 1)).repeat(2, 0).repeat(2, 1)  # grain
    a *= vig
    return np.clip(a, 0, 255).astype(np.uint8)


# -------------------------------------------------------------------- audio

def tone(freq, dur, amp, decay):
    t = np.arange(int(SR * dur)) / SR
    return amp * np.sin(2 * np.pi * freq * t) * np.exp(-t * decay) * np.minimum(1, t * 200)


def soundtrack(n_scenes):
    total = n_scenes * FRAMES_PER_SCENE / FPS
    out = np.zeros(int(SR * (total + 0.5)))

    def add(sig, at):
        s = int(at * SR)
        out[s:s + len(sig)] += sig[: len(out) - s]

    # soft pad, one chord every 2.5 s (C - Am - F - G)
    chords = [(261.6, 329.6, 392.0), (220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (196.0, 246.9, 293.7)]
    for c, notes in enumerate(chords):
        seg = sum(tone(f, 2.9, 0.05, 0.6) + tone(f * 2, 2.9, 0.015, 1.2) for f in notes)
        add(seg, c * 2.5)
    # music-box melody, one note per pose change
    scale = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5]
    melody = [0, 2, 4, 3, 1, 2, 4, 5]
    step = HOLD / FPS
    for j in range(int(total / step)):
        f = scale[melody[j % len(melody)]]
        add(tone(f, 0.6, 0.09, 7), j * step)
        add(tone(f * 3, 0.3, 0.02, 14), j * step)
        # tiny shutter/snap click
        click = rng.normal(0, 1, int(SR * 0.012)) * np.exp(-np.arange(int(SR * 0.012)) / 90) * 0.05
        add(click, j * step)
    # sparkle when the butterfly appears and on the end title
    for at in (7.0, 9.25):
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
    ap.add_argument("--stills", action="store_true", help="also save a contact sheet of frames")
    args = ap.parse_args()

    cfg = json.loads((HERE / "scenes.json").read_text(encoding="utf-8"))
    scenes = cfg["scenes"]
    keyframes, missing = load_keyframes(scenes)
    if missing:
        print(f"PREVIEW MODE: {missing} keyframe(s) missing, using storyboard panels instead.")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    wav = out.with_suffix(".wav")
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if not args.no_audio:
        write_wav(wav, soundtrack(len(scenes)))
        cmd += ["-i", str(wav), "-c:a", "aac", "-b:a", "160k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(out)]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    vig = vignette()
    stills, prev = [], None
    for sc in scenes:
        ov = overlay_scene(sc)
        for i in range(FRAMES_PER_SCENE):
            img = transform(keyframes[sc["id"], i // HOLD + 1], *camera(sc["motion"], i))
            if i == 0 and prev is not None:        # one-frame morph between scenes
                img = Image.blend(prev, img, 0.5)
            prev = img
            frame = img.convert("RGBA")
            frame.alpha_composite(ov)
            if sc["id"] == scenes[-1]["id"]:
                frame.alpha_composite(end_title(cfg["end_title"], i - 3))
            arr = texture(frame.convert("RGB"), vig)
            ff.stdin.write(arr.tobytes())
            if args.stills and i == FRAMES_PER_SCENE - 1:
                stills.append(Image.fromarray(arr))
    ff.stdin.close()
    if ff.wait():
        raise SystemExit("ffmpeg failed")
    wav.unlink(missing_ok=True)
    print(f"Saved {out}")

    if stills:
        tw, th = W // 5, H // 5
        sheet = Image.new("RGB", (tw * 5, th * 2))
        for j, s in enumerate(stills):
            sheet.paste(s.resize((tw, th)), ((j % 5) * tw, (j // 5) * th))
        sheet.save(out.with_name(out.stem + "_sheet.jpg"), quality=88)


if __name__ == "__main__":
    main()
