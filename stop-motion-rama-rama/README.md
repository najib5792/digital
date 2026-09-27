# Proses Kejadian Rama-Rama: video stop motion

Video 10 saat, 9:16 (1080×1920), 12 fps, animasi **cut-out puppet** berdasarkan
`storyboard.png`. Senarai asset dan prompt ada dalam `ASSETS.md`.

## Cara guna

```bash
pip install pillow numpy scipy imageio-ffmpeg

python3 extract_assets.py   # potong 16 asset daripada assets/_ref/asset_sheet_v2.png
python3 build_video.py      # -> out/rama-rama-stop-motion.mp4
#   --sheet          simpan contact sheet untuk semakan
#   --scenes 2,9     render babak tertentu sahaja (tanpa audio)
```

Kalau ada asset baru dengan resolusi lebih tinggi, simpan terus dalam `assets/`
dengan nama yang sama. Kalau tukar asset, kemas kini juga koordinat dalam
`build_video.py` (`TWIG_UNDERSIDE_Y`, `FLOWER_CENTRE`, `BUTTERFLY_BODY_X`, ...).

## Apa yang digerakkan dengan kod

| Babak | Gerakan |
|---|---|
| 1 | Telur muncul satu demi satu (squash & settle) dengan kilauan |
| 2 | Telur bergoyang, retak, penutup tercampak, ulat menjenguk lalu merayap keluar |
| 3 | Ulat merayap (gelombang badan), kepala mengunyah, lubang daun bertambah, serpihan daun |
| 4 | Ulat kecil morph jadi ulat berjalur sambil membesar |
| 5 | Ulat merayap bawah ranting, lalu tergantung bentuk J dan berayun |
| 6 | Ulat J mengecut, bertukar jadi kepompong hijau |
| 7 | Kepompong jadi lutsinar, corak sayap kelihatan |
| 8 | Kepompong bergegar, rama-rama keluar sedikit demi sedikit |
| 9 | Sayap berkedut mengembang, lalu terbuka penuh (sayap kiri & kanan layer berasingan) |
| 10 | Rama-rama terbang ikut laluan melengkung sambil mengibas sayap, lalu hinggap di bunga |

Setiap frame juga dapat jitter puppet, gegaran kamera, light flicker, grain dan vignette,
dengan muzik music-box, bunyi klik shutter dan kilauan bunyi.
