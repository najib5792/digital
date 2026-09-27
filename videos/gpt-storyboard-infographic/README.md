# GPT Storyboard – infographic video (1080×1920, 15 s)

`gpt-storyboard-infographic.mp4` is the final video. Everything in it is generated from code:

- `index.html` – the poster (SVG + HTML) and the GSAP timeline that moves the camera over it. Open it in a browser to preview.
- `render.mjs` – seeks the timeline frame by frame (30 fps) with Playwright and encodes the frames with ffmpeg. It also writes `cues.json`, the sound cue times.
- `audio.py` – synthesises all effects and the 120 bpm music bed with numpy. It reads `cues.json` and writes `audio.wav`.

To rebuild: `npm i && npm run render` (needs Python with numpy and ffmpeg on the PATH).

Fonts: Plus Jakarta Sans (OFL-1.1), vendored in `vendor/`. GSAP is also in `vendor/`.
