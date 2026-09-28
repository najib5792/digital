# GETQUOTE — Apps Developer Showreel

20-second, 1080p60 motion-graphics showreel for the GETQUOTE Takaful quote app, with its own synced soundtrack.

- `showreel.mp4`: the rendered video
- `index.html`: the composition. Open it in a browser to watch it live, and click **Play with sound**.
- `soundtrack.py`: synthesizes the 120 BPM soundtrack with numpy, timed to the scene hits
- `render.mjs`: renders every frame through `window.seek(t)` in headless Chromium and pipes the frames to ffmpeg

| Time | Chapter |
| --- | --- |
| 0–2s | Boot: terminal build and deploy |
| 2–4s | Brand: logo slam, then the kinetic type sequence |
| 4–8s | Routing: `getquote.my/<agent>` re-themes the storefront live |
| 8–12s | Quote engine: form, 5 Hibah plan cards and add-on riders |
| 12–15.5s | Lead pipeline: WhatsApp message, Apps Script and the dashboard |
| 15.5–18s | Stack: stats and tech marquee |
| 18–20s | Credits |

## Re-render

```sh
pip install numpy imageio-ffmpeg
python3 soundtrack.py
FFMPEG=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())") node render.mjs
node render.mjs --stills 2.3,5.3,11.5   # quick PNG checks in ./stills
```

The on-screen name is set in `#endName` in `index.html`. Prices and dashboard numbers are demo figures.
