# Proses Kejadian Rama-Rama: video stop motion

Video 10 saat, 9:16 (1080×1920), 12 fps, dibina daripada `storyboard.png`.

## Cara guna

```bash
pip install pillow numpy imageio-ffmpeg

# 1. Jana 40 keyframe (10 babak × 4 pose) melalui OpenRouter
OPENROUTER_API_KEY=sk-or-... python3 generate_frames.py
#    jana semula babak tertentu:   --scenes 3,7 --force

# 2. Bina video
python3 build_video.py            # -> out/rama-rama-stop-motion.mp4
```

Kalau ada keyframe yang belum dijana, `build_video.py` guna panel storyboard sebagai
ganti (mod preview), supaya pipeline boleh diuji dahulu.

## Fail

| Fail | Fungsi |
|---|---|
| `scenes.json` | Kapsyen, gaya gerakan kamera dan prompt 4 pose untuk setiap babak |
| `generate_frames.py` | Jana keyframe; pose 1 guna panel storyboard sebagai rujukan, pose 2 hingga 4 guna pose sebelumnya |
| `build_video.py` | Jitter, light flicker, grain, vignette, kapsyen, tajuk akhir, muzik music-box dan bunyi klik, dan encode MP4 |
| `storyboard.py` | Potong panel 1 hingga 10 daripada storyboard |
| `generate_image.py` | Klien OpenRouter (stdlib sahaja) |
