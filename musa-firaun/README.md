# Kisah Nabi Musa AS & Firaun — 60 s 2D sticker animation

A 16:9, 60-second, 12-scene educational animation. It is built only from the
supplied sticker sheet (`tools/sticker-sheet.png`), which is cut into
individual sprites and animated with parallax layers and camera moves.

| File | What it is |
| --- | --- |
| `index.html` + `film.js` | Player. It renders the film live on a canvas, in sync with `soundtrack.m4a`. |
| `video/kisah-nabi-musa-firaun.mp4` | 1920×1080, 30 fps render with the Malay voice-over, music and sound effects. |
| `soundtrack.m4a` | Voice-over, score and sound effects, locked to the scene timings. |
| `narration/` | The 12 raw voice-over lines (`01.wav` to `12.wav`). |
| `narration_ms.srt` | Exact timing of each voice-over line. It is not burned into the video, so there are no subtitles. |
| `assets/` | Individual transparent stickers cut from the sheet. |
| `tools/` | Scripts that rebuild everything above. |

## Character rules applied
- **Nabi Musa AS never shows his face.** Only the back and back-three-quarter
  stickers are used, and none is ever mirrored or turned toward the camera.
  On the sheet a thin strip of hair, beard and cheek is visible beside the
  head-cloth, so `extract_assets.py` repaints that strip as head-cloth. The
  swaddled baby's head is fully wrapped in the blanket, and in the Nile scene
  a covered basket is drawn instead of the sheet's basket.
- Allah is never depicted in any form. Scene 5 shows only the burning bush and its light. Scene 11 shows only sky light.
- Nothing is graphic. The labour scene shows work, not violence. In the ending, Pharaoh's army is shown
  halted on the far shore while the sea closes in the distance.
- No text, logos or watermarks appear in the frames. The palace friezes use patterns only.

## Scenes (seconds)
1 Mesir 0–5 · 2 Penindasan 5–9.8 · 3 Bayi Musa 9.8–15.3 · 4 Musa dewasa 15.3–19.8 ·
5 Semak terbakar 19.8–24.8 · 6 Di hadapan Firaun 24.8–30.3 · 7 Firaun menolak 30.3–34.3 ·
8 Tanda-tanda 34.3–38.5 · 9 Keluar dari Mesir 38.5–43 · 10 Dikejar 43–47.2 ·
11 Laut terbelah 47.2–52.7 · 12 Terselamat, matahari terbit 52.7–60

## Voice-over
The voice-over uses the `paan` voice from
[`@revolab/revolab-edge`](https://www.npmjs.com/package/@revolab/revolab-edge),
an on-device Malay text-to-speech package. `tools/make_narration.mjs` writes
`narration/NN.wav`. `tools/make_audio.py` then slows each line with ffmpeg's
pitch-preserving `atempo` (by up to 1.22x) so it fills its scene, lowers the
music and effects under the voice, and writes `narration_ms.srt`.

**Licence:** revolab-edge is proprietary ("UNLICENSED, © Revolab"). Check its
terms before publishing the video, or replace `narration/*.wav` with your own
recording (same file names) and rerun `make_audio.py`.

## Rebuild
```sh
pip install pillow numpy scipy imageio-ffmpeg
python3 tools/extract_assets.py          # sheet -> assets/*.png
npm pack @revolab/revolab-edge && tar xzf revolab-edge-*.tgz
REVOLAB_EDGE_DIR=./package node tools/make_narration.mjs   # -> narration/*.wav
python3 tools/make_audio.py              # -> soundtrack.wav / .m4a + narration_ms.srt  (needs ffmpeg on PATH or $FFMPEG)
node tools/render.mjs video 30           # -> out/video_silent.mp4    (needs playwright + ffmpeg)
ffmpeg -i out/video_silent.mp4 -i soundtrack.m4a -c copy -shortest video/kisah-nabi-musa-firaun.mp4
```
To preview, serve the folder (for example with `npx serve musa-firaun`) and open `index.html`.
