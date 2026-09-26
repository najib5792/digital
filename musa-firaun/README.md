# Kisah Nabi Musa AS & Firaun — 60 s 2D sticker animation

A 16:9, 60-second, 12-scene educational animation. It is built only from the
supplied sticker sheet (`tools/sticker-sheet.png`), which is cut into
individual sprites and animated with parallax layers and camera moves.

| File | What it is |
| --- | --- |
| `index.html` + `film.js` | Player. It renders the film live on a canvas and speaks the Malay narration with the browser's voice (`ms-MY`, falling back to `id-ID`). |
| `video/kisah-nabi-musa-firaun.mp4` | 1920×1080, 30 fps render with the music and sound effects. It has **no voice-over** (see below). |
| `soundtrack.m4a` | Synthesized score and sound effects, locked to the scene timings. |
| `narration_ms.srt` | Timed Malay narration script, used as a voice-over guide. It is not burned into the video, so there are no subtitles. |
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
1 Mesir 0–5 · 2 Penindasan 5–9.5 · 3 Bayi Musa 9.5–15 · 4 Musa dewasa 15–19.5 ·
5 Semak terbakar 19.5–24.5 · 6 Di hadapan Firaun 24.5–30 · 7 Firaun menolak 30–34 ·
8 Tanda-tanda 34–39 · 9 Keluar dari Mesir 39–43.5 · 10 Dikejar 43.5–48 ·
11 Laut terbelah 48–53.5 · 12 Terselamat, matahari terbit 53.5–60

## Voice-over
The sandbox that built this had no access to a Malay text-to-speech service,
so the MP4 carries only music and sound effects. To add the narration, record
or generate each line of `narration_ms.srt` at its timestamp and mix it over
the MP4. For example:

```sh
ffmpeg -i video/kisah-nabi-musa-firaun.mp4 -i narration.wav \
  -filter_complex "[0:a]volume=0.55[m];[m][1:a]amix=inputs=2:duration=first[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac kisah-nabi-musa-firaun-narasi.mp4
```

## Rebuild
```sh
pip install pillow numpy scipy imageio-ffmpeg
python3 tools/extract_assets.py          # sheet -> assets/*.png
python3 tools/make_audio.py              # -> soundtrack.wav / .m4a  (needs ffmpeg on PATH or $FFMPEG)
node tools/render.mjs video 30           # -> out/video_silent.mp4    (needs playwright + ffmpeg)
ffmpeg -i out/video_silent.mp4 -i soundtrack.m4a -c copy -shortest video/kisah-nabi-musa-firaun.mp4
```
To preview, serve the folder (for example with `npx serve musa-firaun`) and open `index.html`.
