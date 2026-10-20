---
name: "hyperframes-video"
description: "Use when Najib asks for a HyperFrames video (HTML-to-video by HeyGen) — installs the CLI, builds the composition, fixes blocked CDNs, renders MP4."
---

# HyperFrames Video

HyperFrames (npm `hyperframes`, by HeyGen) renders HTML + GSAP compositions to MP4. The workspace resets every chat, so always run Setup first. Reply to Najib in informal Bahasa Melayu (rojak), concise.

## 1. Setup (every new chat, ~1 min)

```bash
W=<scratchpad dir>
cd $W
which hyperframes || npm i -g hyperframes
hyperframes browser ensure        # downloads chrome-headless-shell
hyperframes doctor | tail -20     # FFmpeg + Chrome must be ✓; whisper/Kokoro/Docker optional
```

## 2. Scaffold

```bash
HYPERFRAMES_SKIP_SKILLS=1 hyperframes init <name> --example <example> --resolution portrait --non-interactive
```
- Default resolution for Najib: `portrait` (1080x1920, 9:16). Use `landscape` or `square` only if asked.
- Examples: `blank`, `warm-grain`, `swiss-grid` (run `hyperframes catalog` for more).
- Read the project's `AGENTS.md` / `CLAUDE.md` before editing — it explains composition structure (`index.html` + `compositions/*.html`, `data-*` timing attributes, GSAP timelines).
- `hyperframes docs` shows inline docs.

## 3. Fix blocked CDNs (REQUIRED before render)

The sandbox blocks CDNs (cdn.jsdelivr.net, unpkg, external textures/fonts). A missing GSAP makes render fail with `sub_timeline_script_failure`. After scaffolding AND after writing any new HTML:

```bash
cd <project>
npm i gsap@3.14.2 --no-save --silent
mkdir -p vendor && cp node_modules/gsap/dist/gsap.min.js vendor/
grep -rl "cdn.jsdelivr.net/npm/gsap" --include=*.html . | grep -v node_modules | while read f; do
  rel=$(realpath --relative-to="$(dirname "$f")" vendor/gsap.min.js)
  sed -i "s#https://cdn.jsdelivr.net/npm/gsap@[0-9.]*/dist/gsap.min.js#$rel#g" "$f"
done
```
- Any other external URL (textures, images, Google Fonts): download via npm (e.g. `@fontsource/<font>`) or replace with local files / CSS. Never leave external http(s) URLs in compositions.
- `hyperframes-localize-fonts` can help localize fonts.
- When writing compositions yourself, reference `vendor/gsap.min.js` directly from the start.

## 4. Build the video

- Write the script/scenes from Najib's brief. Keep text big and readable for 9:16 mobile.
- Assets Najib uploads (images, mp3 VO, video) go into the project folder and are referenced by relative path. `init --audio <file>` or `--video <file>` can import media.
- Voiceover: follow Najib's preferences (ask code-only vs Flow mode; code-only uses a free VO option, not ElevenLabs). Report cost + remaining balance for any paid service.
- Validate: `hyperframes lint` then `hyperframes check` (lint + runtime + layout). `hyperframes snapshot` gives PNG frames to eyeball before full render.

## 5. Render

```bash
hyperframes render --output out.mp4            # default quality 'looks' (CRF 16)
hyperframes render --output out.mp4 -q draft   # fast preview
ffprobe -v error -show_entries format=duration:stream=width,height -of csv=p=0 out.mp4
```
- A 10s 1080x1920 clip renders in ~30s. The 'Screenshot capture (slower)' notice is normal here.
- If render fails, read the failure summary: `REQUESTFAILED ... ERR_TUNNEL_CONNECTION_FAILED` = an external URL to localize (step 3).
- Do not use `--docker` (Docker isn't running in this sandbox).

## 6. Deliver

Send the MP4 with SendUserFile and a one-line caption (style, resolution, duration). Offer one concrete tweak as next step.