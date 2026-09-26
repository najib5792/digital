# Video animasi gaya Kurzgesagt

Animasi flat-vector dilukis dengan Canvas (dipacu masa, deterministik) dan dieksport ke MP4 bingkai demi bingkai.

| Video | Sumber | Isi |
|---|---|---|
| `faraid-rumah.mp4` (67s) | `faraid-rumah.html` | Beli rumah bersama pasangan — persepsi vs realiti bila suami meninggal (faraid) |
| `lubang-hitam.mp4` (26s) | `index.html` | Apa itu lubang hitam? |

Buka mana-mana fail `.html` dalam pelayar untuk pratonton langsung.

## Render semula

```bash
npm i playwright && pip install imageio-ffmpeg   # sekali sahaja
node render.mjs faraid-rumah.html                # -> faraid-rumah.mp4
node render.mjs                                  # -> lubang-hitam.mp4
```

Sari kata ada dalam panggilan `caption(...)` di hujung fungsi `render(t)` setiap fail. Font: Nunito (SIL Open Font License).
