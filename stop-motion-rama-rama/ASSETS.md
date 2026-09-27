# Senarai asset: Proses Kejadian Rama-Rama

Pendekatan: **cut-out puppet berlayer**. Setiap watak diletak atas background dan
digerakkan dengan kod (kibas sayap, ulat merayap, goyang, morph).

Letak semua fail dalam `stop-motion-rama-rama/assets/` dengan nama tepat seperti di bawah.

## Spesifikasi

- **Watak/prop:** PNG ≥2000px, **latar putih kosong** (atau lutsinar), satu objek sahaja,
  objek penuh dalam frame (tak terpotong), tiada bayang di lantai, tiada teks.
- **Background:** 9:16 (1080×1920 atau lebih besar), **tanpa** rama-rama/ulat/telur.
- Semua prompt kongsi gaya yang sama supaya asset nampak serasi. Kalau tool kau
  ada "style reference", guna `bg_daun_atas.png` sebagai rujukan untuk yang lain.

**Gaya (dah termasuk dalam setiap prompt):**
`ultra-detailed macro nature photography, monarch butterfly species, soft warm natural sunlight from upper left, fresh saturated colours, crisp focus`

## Yang aku buat sendiri (tak perlu asset)

Lubang daun dimakan, titik embun berkilau, retakan telur, morph ulat → kepompong,
jalur benang sutera, debu cahaya, kapsyen, tajuk, muzik & bunyi klik.

---

## A. Background (4) — wajib

| Fail | Babak | Prompt |
|---|---|---|
| `bg_daun_atas.png` | 1 | Vertical 9:16 top-down macro photo of a single large fresh green milkweed leaf filling the frame, visible veins, tiny dew drops, soft green bokeh at the edges, ultra-detailed macro nature photography, soft warm natural sunlight from upper left, fresh saturated colours. Empty leaf, no insects, no eggs, no text. |
| `bg_daun_sisi.png` | 2–4 | Vertical 9:16 low-angle side view macro photo of a broad green leaf surface running horizontally across the lower middle of the frame, leaf edge visible, dreamy green bokeh background above, ultra-detailed macro nature photography, soft warm natural sunlight from upper left, fresh saturated colours. Empty leaf, no insects, no text. |
| `bg_ranting.png` | 5–9 | Vertical 9:16 macro photo of a thin brown textured twig crossing horizontally near the top quarter of the frame, large empty space below it, soft blurred green and golden bokeh garden background, ultra-detailed macro nature photography, soft warm natural sunlight from upper left. Nothing hanging from the twig, no insects, no text. |
| `bg_bunga.png` | 10 | Vertical 9:16 photo of a sunlit garden at golden hour, one vivid pink zinnia flower with a yellow-orange centre in the lower middle of the frame facing the camera slightly from above, more pink flowers softly blurred behind, warm glowing bokeh, empty sky space in the upper half, ultra-detailed macro nature photography. No butterfly, no insects, no text. |

## B. Telur & ulat (6)

| Fail | Wajib? | Prompt |
|---|---|---|
| `telur.png` | wajib | A single monarch butterfly egg, pale cream, ribbed vertical ridges, slightly translucent, pointed dome shape, three-quarter side view, isolated on a plain pure white background, ultra-detailed macro nature photography, soft warm natural sunlight from upper left. No shadow, no text. |
| `telur_pecah_atas.png` | wajib | The small broken-off top cap of a pale cream ribbed monarch butterfly egg, thin translucent shell fragment with jagged edge, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No shadow, no text. |
| `telur_pecah_bawah.png` | wajib | The empty bottom half of a hatched pale cream ribbed monarch butterfly egg, jagged broken rim, translucent thin shell, three-quarter side view, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No shadow, no text. |
| `ulat_kecil.png` | wajib | A tiny newly hatched monarch caterpillar, pale translucent yellow-green body with fine hairs and a shiny black head, side view, body lying straight horizontally facing right, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No shadow, no text. |
| `ulat_besar.png` | wajib | A fully grown plump monarch caterpillar with bold yellow, black and white stripes and black tentacles at both ends, side view, body perfectly straight and horizontal facing right, all legs visible, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No shadow, no text. |
| `ulat_J.png` | wajib | A mature striped yellow black and white monarch caterpillar hanging upside down curled in a J shape, tail at the top as if attached to a twig, side view, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No twig, no shadow, no text. |

## C. Kepompong (3) — wajib

| Fail | Prompt |
|---|---|
| `kepompong_hijau.png` | A smooth jade green monarch butterfly chrysalis with a thin band of gold dots near the top and a few gold dots below, short black stem at the top, hanging vertically, front view, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No twig, no shadow, no text. |
| `kepompong_lutsinar.png` | A mature monarch butterfly chrysalis just before hatching, completely transparent shell, folded orange and black monarch wings with white dots clearly visible inside, gold dot band near the top, short black stem at the top, hanging vertically, front view, same size and shape as a jade green chrysalis, isolated on a plain pure white background, ultra-detailed macro photography. No twig, no shadow, no text. |
| `kepompong_kosong.png` | An empty monarch butterfly chrysalis shell after hatching, clear crinkled transparent papery skin split open at the bottom, short black stem at the top, hanging vertically, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No butterfly, no twig, no shadow, no text. |

## D. Rama-rama (3) — untuk puppet berlayer

| Fail | Wajib? | Prompt |
|---|---|---|
| `rama_atas.png` | **wajib (paling penting)** | A monarch butterfly photographed perfectly from directly above, wings fully spread flat and perfectly symmetrical, forewings and hindwings clearly separated with a small gap, bright orange with black veins and white-dotted black borders, body straight vertical in the exact centre, both antennae visible, legs tucked, isolated on a plain pure white background, ultra-detailed macro photography, even soft light. No shadow, no text. |
| `rama_sisi.png` | wajib | A monarch butterfly in side view with wings closed together pointing upward, showing the pale orange underside of the wings with black veins and white dots, body horizontal facing right, six legs and antennae visible, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No shadow, no text. |
| `rama_baru_keluar.png` | pilihan | A freshly emerged monarch butterfly hanging upside down from its legs, swollen body, small crumpled wet wings hanging down, side view, isolated on a plain pure white background, ultra-detailed macro photography, soft warm light from upper left. No chrysalis, no twig, no shadow, no text. |

Aku akan potong `rama_atas.png` jadi 6 layer (sayap kiri atas/bawah, sayap kanan
atas/bawah, badan, antena) untuk kibasan sayap. Kalau tool kau boleh hasilkan
layer berasingan, lagi bagus, tapi tak wajib.

**Jumlah: 16 asset (15 wajib, 1 pilihan).**
