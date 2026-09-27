# Motion Video

Remotion project that adds TikTok-bold motion graphics and animated text to `public/input.mp4` (10s, 9:16).

- Edit text/timing: `src/MotionVideo.tsx` (`BEATS` holds the frame ranges for each text beat)
- Preview: `npm run studio`
- Render: `npm run render` → `out/motion-video.mp4`
  (in environments without Remotion's own Chrome, set `REMOTION_CHROME` to a headless Chromium binary)

Latest render: `render/motion-video.mp4` (1080×1920, 24fps, original audio).
