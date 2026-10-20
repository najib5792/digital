---
name: "video-ajar-zoom"
description: "Use when Najib wants a tutorial/teaching video in Zoom-class style (screen-share slides, chat questions, VO Bangjib) built from a PDF, slides or topic."
---

# Video Ajar Zoom

Tukar PDF / slaid / topik jadi video tutorial yang nampak macam rakaman kelas Zoom: trainer kongsi skrin slaid, terang SATU-SATU, ejen tanya kat chat, VO suara Bangjib (ElevenLabs). Code-only, render dengan HyperFrames. Cakap dengan Najib dalam BM rojak, ringkas.

## Default (jangan tanya lagi, terus guna)
- 16:9, 1920x1080, HyperFrames (HTML + GSAP).
- UI Zoom: top bar (tajuk kelas, "<Trainer> sedang berkongsi skrin", peserta 4, REC + timer), slaid kongsi skrin kiri (1440x810), panel kanan: tile trainer KAMERA TUTUP (bulatan inisial "BJ" + cincin hijau berdenyut ikut suara + border hijau bila bercakap), 3 tile ejen (Amir, Siti, Farah), panel chat, kapsyen bawah slaid, toolbar Zoom + butang Tamat.
- TIADA talking head / muka kartun (Najib kata kelakar).
- Trainer = "Bangjib". VO = ElevenLabs suara **Bangjib**, model **eleven_v3**, BM santai, audio tags `[calm] [serious] [cheerful] [confident]` + `[pause]` antara ayat.
- 1 take setiap slaid (`generations_count: 1`) supaya jimat kredit.
- Muzik lofi perlahan (gain ~0.08) bawah VO + pop bila poin muncul + ding bila chat masuk.
- Render TEST 1 slaid dulu (biasanya slaid 2), hantar, tunggu Najib OK, baru render penuh.

## Aliran kerja
1. **Baca sumber.** PDF: baca halaman berkaitan (Read dengan `pages`). Ambil fakta & angka dari dokumen SAHAJA. Kalau dokumen ada contoh kiraan (cth. pelanggan "Imran"), guna dan semak aritmetik.
2. **Rancang & tunjuk** dalam SATU mesej: senarai slaid (8–11) + skrip VO setiap slaid. Struktur biasa: Pengenalan/agenda → Apa itu → ciri-ciri → manfaat (satu slaid setiap satu) → perlindungan/syarat → nilai tambah → Rumusan untuk ejen (+ T&C / "tidak dijamin"). Letak 2–3 soalan ejen di chat yang dijawab trainer. Lepas tunjuk, terus buat (jangan tunggu).
3. **Setup** (scratchpad, folder `zoomclass/`):
```bash
which hyperframes || npm i -g hyperframes; hyperframes browser ensure
HYPERFRAMES_SKIP_SKILLS=1 hyperframes init proj --example blank --resolution landscape --non-interactive
cd proj && npm i gsap@3.14.2 --no-save --silent && mkdir -p vendor assets && cp node_modules/gsap/dist/gsap.min.js vendor/ && cd ..
mkdir -p dl
```
Tulis `spec.py`, `sync.py`, `build.py` (di bawah) ke dalam `zoomclass/`.
4. **VO ElevenLabs** (load tools dengan ToolSearch: `creative_list_voices, creative_create_flow, creative_generate_speech, creative_get_flow_run_status`):
   - `creative_list_voices(search="Bangjib")` → ambil voice_id (jangan hafal).
   - `creative_create_flow` sekali, guna flow_id sama untuk semua slaid.
   - Untuk setiap slaid: prompt = tag mood + ayat-ayat slaid disambung dengan ` [pause] `. Akronim tulis berhuruf (`P.I.A`, `H.U.P.K`), nombor besar boleh tulis dalam perkataan jika sebutan pelik. Mula-mula `estimate_only: true` untuk semua slaid, report jumlah kredit, kemudian generate (`generations_count: 1`). JANGAN panggil generate dua kali untuk retry.
   - Poll `creative_get_flow_run_status` sampai `all_completed`, kemudian `curl -sS -o dl/vo_<id>.mp3 "<content_url>"` (storage.googleapis.com boleh diakses).
5. **Sync**: `python3 sync.py` → kesan jeda setiap mp3, padankan ayat ke segmen, tulis `timeline.json` + `proj/assets/mix.wav`. Semak output: bilangan segmen = bilangan ayat setiap slaid. Kalau tak padan, betulkan `SPLIT` override dalam spec atau ubah `MIN_GAP`.
6. **Build**: `python3 build.py` → `proj/index.html`. Test: `ONLY=b python3 sync.py && ONLY=b python3 build.py` (satu slaid sahaja).
7. **Semak**: `cd proj && npx hyperframes lint` (0 error) → `npx hyperframes snapshot --at <1 masa setiap slaid, hujung slaid> --no-end -o snaps` → BACA contact sheet. Betulkan overlap / teks terpotong / chat penuh.
8. **Render**: `npx hyperframes render --output <nama>.mp4`. Video > 1 minit → jalankan Bash dengan `run_in_background: true` (render ~3–5 s setiap 1 s video). Sahkan dengan ffprobe, ambil 1 frame tengah untuk semak, SendUserFile.
9. **Report**: ringkas (3–5 bullet), kos ElevenLabs (kredit + anggaran USD) dan baki (kalau connector tak tunjuk baki, cakap terus suruh semak di ElevenLabs), tanya saat mana timing lari.

## spec.py (format)
```python
TITLE = "Kelas Produk · <Nama Produk>"
TRAINER = "Bangjib"; TRAINER_INI = "BJ"
FOOTER = "<Syarikat> · <Produk>"
EJEN = [("Amir","AM","#3B6FD8"), ("Siti","SI","#13A08F"), ("Farah","FA","#9B51E0")]
MOOD = {}   # optional: {"b":"[calm]"} tag ElevenLabs setiap slaid (default [calm])
def L(text, say=None, **c): return dict(text=text, say=say, **c)
# line keys: text (kapsyen), say (teks untuk TTS, optional), show=[ids muncul], hl=id diserlah,
#            chat=(index_ejen, "soalan") -> mesej masuk sebelum ayat ini dijawab
SLIDES = [
 dict(id="b", kick="BAHAGIAN 1", title="Apa itu <em>Produk?</em>", html='''
<div class="defn it" id="b1">Pelan <b>...</b> yang menggabungkan ...</div>
<div class="accs">
 <div class="acc it" id="b2"><div class="accic" style="background:#FDE4E1">ICON:wallet:#D42A20</div><div><h4>PIA</h4><p>Akaun Individu Peserta</p><small>...</small></div></div>
 <div class="arrow it" id="b4">ICON:arrow:#F07A22<span>Ganjaran tahunan</span></div>
 <div class="acc it" id="b3"><div class="accic" style="background:#E3E6FF">ICON:chart:#232C77</div><div><h4>PUA</h4><p>...</p></div></div>
</div>''',
  lines=[
   L("Okey, mula-mula ...", show=["b1"], hl="b1"),
   L("Pertama, ... atau PIA.", "Pertama, ... atau P.I.A.", show=["b2"], hl="b2"),
   L("Siti tanya ... Jawapan ...", show=["b4"], hl="b4", chat=(1, "Soalan ejen?")),
  ]),
]
```
- Setiap elemen yang nak muncul/diserlah: class `it` + id unik (prefix id slaid). Elemen tanpa `show` nampak dari awal slaid.
- Ikon: `ICON:<nama>:#hex` dalam html. Ada: wallet arrow chart nodoc check alert gift shield pin plane bus mosque plus mic cam share chat people rec hand. Tambah ikon baru dalam `ICONS` di build.py (viewBox 100, stroke 7).
- `<em>` dalam title = warna merah. `class="red"` untuk teks merah.

### Komponen slaid (CSS sedia ada dalam build.py)
- Agenda: `.agenda > .ag.it` (`<b>1</b>teks`) + `.tagline`.
- Definisi: `.defn` · Dua akaun/flow: `.accs > .acc` + `.arrow` · Pill senarai: `.funds > span`.
- Hero besar: `.hero > .heroic + div(.big .bigsub)` · Pill kelebihan: `.pros > span` · Amaran: `.warn` (ICON:alert + div).
- Jadual: `.tbl > .tr.th` + `.tr.it` (div grid 4 lajur; lajur akhir merah).
- Syiling: `.yrs > .yr > .coin` · Kiraan: `.calc` (`.cl` label, `.eq` persamaan), `.calc.res` (hasil) · `.pill` (ikon + teks).
- Bar menegak: `.flow` (tajuk) + `.vbars > .vb.it > .fill(style height:% ;background)` + `.val(style="bottom:calc(<h>% + 8px);color:..")` + `.xl` label. `.side` untuk kad di kanan carta.
- Bar mendatar: `.hbars > .hb.it > .hl2 + .track>.fill(style width:%) + .hv` · `.row2` untuk kad bawah bar.
- Dua lajur: `.cols > .colc` (`.ctag`, h4, p, `.opt`, `.or`, `.plusrow`).
- Senarai baris ikon + nilai: `.sub2` + `.acc3 > .ac > .aci + .acl + .acv`.
- Tiga tile: `.tiles3 > .tl3 > .tic + h4 + p` · Rumusan: `.pts > .pt > b + div` · Penafian: `.disc`.
- Bar/track `.fill` tumbuh sendiri bila parent di-`show`.
- Kawasan isi slaid: 1312x534 px (top 210, bottom 66). Muat 3–5 kad. Kapsyen maks ~2 baris (≈25 patah perkataan satu ayat); pecahkan ayat panjang.

## sync.py
```python
import json, os, sys, glob, subprocess
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import SLIDES
SR = 44100; LEAD, TAILS, END = 0.9, 0.9, 2.2
THR_DB, MIN_GAP = -32, 0.35
ONLY = os.environ.get("ONLY")
slides = [s for s in SLIDES if not ONLY or s["id"] in ONLY.split(",")]

def load(p):
    w = p[:-4] + ".wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", p, "-ac", "1", "-ar", str(SR), w], check=True)
    x, _ = sf.read(w); return x.astype(np.float32)

def speech_segments(x):
    hop = int(SR * 0.01); n = len(x) // hop
    rms = np.array([np.sqrt((x[i*hop:(i+1)*hop] ** 2).mean() + 1e-12) for i in range(n)])
    on = 20 * np.log10(rms + 1e-9) > THR_DB
    segs, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]: j += 1
            segs.append([i * .01, j * .01]); i = j
        else: i += 1
    out = []
    for a, b in segs:
        if out and a - out[-1][1] < MIN_GAP: out[-1][1] = b
        else: out.append([a, b])
    return [s for s in out if s[1] - s[0] > 0.2]

def group(segs, k, words):
    # pilih k-1 jeda terbesar sebagai sempadan ayat
    if len(segs) < k: raise SystemExit(f"segmen {len(segs)} < ayat {k}: turunkan MIN_GAP")
    gaps = sorted(range(len(segs) - 1), key=lambda i: segs[i+1][0] - segs[i][1], reverse=True)[:k-1]
    cuts = sorted(gaps); res, st = [], 0
    for c in cuts + [len(segs) - 1]:
        res.append((segs[st][0], segs[c][1])); st = c + 1
    return res

chunks, t, out = [np.zeros(int(0.6 * SR), np.float32)], 0.6, {"slides": []}
for s in slides:
    x = load(f"dl/vo_{s['id']}.mp3")
    segs = speech_segments(x)
    spans = group(segs, len(s["lines"]), [len(l["text"].split()) for l in s["lines"]])
    so = {"id": s["id"], "start": round(t, 3), "lines": []}
    base = t + LEAD; prev_end = 0
    for ln, (a, b) in zip(s["lines"], spans):
        d = {k: v for k, v in ln.items() if k != "say"}
        d["start"], d["end"] = round(base + a, 3), round(base + b, 3)
        if d.get("chat"): d["pre"] = round(max(0.6, min(1.6, a - prev_end - 0.1)), 2)
        so["lines"].append(d); prev_end = b
    chunks.append(np.zeros(int(LEAD * SR), np.float32)); chunks.append(x)
    chunks.append(np.zeros(int(TAILS * SR), np.float32))
    t = base + len(x) / SR + TAILS; so["end"] = round(t, 3)
    out["slides"].append(so)
    print(s["id"], f"{so['start']:.1f}-{so['end']:.1f}", [(round(a,1), round(b,1)) for a, b in spans])
chunks.append(np.zeros(int(END * SR), np.float32)); t += END
out["duration"] = round(t, 2)
a = np.concatenate(chunks); sf.write("vo_all.wav", a, SR)
hop = SR // 30; env = np.array([np.sqrt((a[i*hop:i*hop+int(SR*.045)] ** 2).mean()) if i*hop < len(a) else 0 for i in range(int(len(a)/hop) + 1)])
ref = np.percentile(env[env > .01], 90) if (env > .01).any() else 1
env = np.clip((env - .012) / (ref - .012), 0, 1)
out["env"] = "".join(str(min(9, int(v * 9.99))) for v in env)
json.dump(out, open("timeline.json", "w"), ensure_ascii=False)
# audio mix (Mix dari skill rb-digital-video)
cp = (glob.glob("/root/.claude/skills/**/rb-digital-video/scripts/common.py", recursive=True) + glob.glob("/mnt/skills/**/rb-digital-video/scripts/common.py", recursive=True))
sys.path.insert(0, os.path.dirname(cp[0]))
from common import Mix
m = Mix(out["duration"], seed=5)
m.music("lofi", 0.08, seed=os.environ.get("SEED", "Kelas Zoom"))
m.vo("vo_all.wav", 0, 1.0)
for s in out["slides"]:
    m.whoosh(s["start"] + .05, .15)
    for l in s["lines"]:
        for k, _ in enumerate(l.get("show") or []): m.word_pop(l["start"] + k * .25, .10)
        if l.get("chat"): m.ding(l["start"] - l["pre"] + .1, .16)
m.write("proj/assets/mix.wav")
print("total", out["duration"])
```

## build.py
```python
import json, re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import SLIDES, TITLE, TRAINER, EJEN
import spec
TRAINER_INI = getattr(spec, "TRAINER_INI", "BJ"); FOOTER = getattr(spec, "FOOTER", TITLE)
TL = json.load(open("timeline.json"))
_ids = [x["id"] for x in TL["slides"]]
ALL_N = len(SLIDES); POS = {s["id"]: i + 1 for i, s in enumerate(SLIDES)}
SLIDES = [x for x in SLIDES if x["id"] in _ids]
DUR = TL["duration"]

ICONS = {
 "wallet": '<rect x="12" y="26" width="76" height="56" rx="10" fill="C" fill-opacity=".15" stroke="C"/><path d="M12 40h76" stroke="C"/><circle cx="70" cy="58" r="6" fill="C" stroke="none"/><path d="M22 26 60 14l6 12" fill="none" stroke="C"/>',
 "arrow": '<path d="M10 50h70M60 28l22 22-22 22" fill="none" stroke="C"/>',
 "chart": '<rect x="16" y="56" width="16" height="28" rx="3" fill="C" stroke="none"/><rect x="42" y="40" width="16" height="44" rx="3" fill="C" stroke="none"/><rect x="68" y="22" width="16" height="62" rx="3" fill="C" stroke="none"/><path d="M14 40 40 24l16 8 30-20" fill="none" stroke="C"/>',
 "nodoc": '<rect x="26" y="12" width="48" height="66" rx="8" fill="C" fill-opacity=".1" stroke="C"/><path d="M37 32h26M37 46h26M37 60h16" stroke="C"/><circle cx="70" cy="72" r="20" fill="#fff" stroke="C"/><path d="m61 63 18 18m0-18-18 18" stroke="C"/>',
 "check": '<path d="m20 52 18 18 42-42" fill="none" stroke="C" stroke-width="12"/>',
 "alert": '<path d="M50 12 92 86H8Z" fill="C" fill-opacity=".15" stroke="C"/><path d="M50 40v20" stroke="C"/><circle cx="50" cy="72" r="5" fill="C" stroke="none"/>',
 "gift": '<rect x="16" y="40" width="68" height="46" rx="6" fill="C" fill-opacity=".15" stroke="C"/><rect x="12" y="28" width="76" height="14" rx="4" fill="none" stroke="C"/><path d="M50 28v58" stroke="C"/><path d="M50 28c-8-16-26-14-20-2 3 5 12 2 20 2Zm0 0c8-16 26-14 20-2-3 5-12 2-20 2Z" fill="none" stroke="C"/>',
 "shield": '<path d="M50 8 86 22v28c0 22-15 36-36 44C29 86 14 72 14 50V22Z" fill="C" fill-opacity=".15" stroke="C"/><path d="m34 50 11 11 21-22" fill="none" stroke="C"/>',
 "pin": '<path d="M50 90S20 58 20 38a30 30 0 0 1 60 0c0 20-30 52-30 52Z" fill="C" fill-opacity=".15" stroke="C"/><circle cx="50" cy="38" r="11" fill="none" stroke="C"/>',
 "plane": '<path d="M50 10c5 0 7 6 7 12v18l30 16v10l-30-8v18l10 8v8l-17-5-17 5v-8l10-8V58l-30 8V56l30-16V22c0-6 2-12 7-12Z" fill="C" fill-opacity=".15" stroke="C"/>',
 "bus": '<rect x="18" y="12" width="64" height="66" rx="12" fill="C" fill-opacity=".15" stroke="C"/><path d="M18 48h64M30 12v36M70 12v36" stroke="C"/><circle cx="32" cy="62" r="5" fill="C" stroke="none"/><circle cx="68" cy="62" r="5" fill="C" stroke="none"/><path d="M28 78v10M72 78v10" stroke="C"/>',
 "mosque": '<path d="M28 84V56c0-14 22-18 22-34 0 16 22 20 22 34v28Z" fill="C" fill-opacity=".15" stroke="C"/><path d="M12 84V42m0 0 4-8 4 8v42M80 84V42m0 0 4-8 4 8v42M8 84h84M44 84V70a6 6 0 0 1 12 0v14" fill="none" stroke="C"/>',
 "plus": '<rect x="12" y="12" width="76" height="76" rx="18" fill="C" fill-opacity=".12" stroke="C"/><path d="M34 50h32M50 34v32" stroke="C"/>',
 "mic": '<rect x="36" y="10" width="28" height="48" rx="14" fill="none" stroke="C"/><path d="M22 46c0 16 12 26 28 26s28-10 28-26M50 72v16M36 88h28" fill="none" stroke="C"/>',
 "cam": '<rect x="10" y="28" width="58" height="44" rx="10" fill="none" stroke="C"/><path d="m68 44 22-12v36L68 56" fill="none" stroke="C"/>',
 "share": '<rect x="10" y="18" width="80" height="56" rx="8" fill="none" stroke="C"/><path d="M50 62V34M38 46l12-12 12 12M34 86h32" fill="none" stroke="C"/>',
 "chat": '<path d="M14 20h72v48H44L26 84V68H14Z" fill="none" stroke="C"/>',
 "people": '<circle cx="36" cy="34" r="14" fill="none" stroke="C"/><path d="M10 84c0-16 12-26 26-26s26 10 26 26" fill="none" stroke="C"/><circle cx="68" cy="30" r="11" fill="none" stroke="C"/><path d="M66 54c14 0 24 10 24 24" fill="none" stroke="C"/>',
 "rec": '<circle cx="50" cy="50" r="36" fill="none" stroke="C"/><circle cx="50" cy="50" r="18" fill="C" stroke="none"/>',
 "hand": '<path d="M30 54V24a6 6 0 0 1 12 0v24V16a6 6 0 0 1 12 0v32V20a6 6 0 0 1 12 0v32-20a6 6 0 0 1 12 0v34c0 18-12 30-28 30-12 0-20-6-26-16L16 60a6 6 0 0 1 10-7Z" fill="C" fill-opacity=".25" stroke="C"/>',
}
def icon(name, col, cls="ic"):
    return f'<svg class="{cls}" viewBox="0 0 100 100" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">{ICONS[name].replace(chr(34)+"C"+chr(34), chr(34)+col+chr(34))}</svg>'
def icons_in(html):
    return re.sub(r"ICON:(\w+):(#[0-9A-Fa-f]{6})", lambda m: icon(m.group(1), m.group(2)), html)

slides_html = []
for s, st in zip(SLIDES, TL["slides"]):
    d = st["end"] - st["start"]
    slides_html.append(f'''<div id="sl_{s["id"]}" class="clip slide" data-start="{st["start"]:.3f}" data-duration="{d:.3f}" data-track-index="0"><div class="sin">
<div class="shead"><span class="kick">{s["kick"]}</span><h2>{s["title"]}</h2></div>
<div class="sbody">{icons_in(s["html"])}</div>
<div class="sfoot"><span><i class="gdot"></i>{FOOTER}</span><span>{POS[s["id"]]} / {ALL_N}</span></div></div></div>''')
chats = []
for st in TL["slides"]:
    for ln in st["lines"]:
        if ln.get("chat"):
            who, msg = ln["chat"]
            chats.append(dict(who=who, msg=msg, t=round(ln["start"] - (ln.get("pre") or 1.2) + 0.1, 2), end=ln["end"]))
chat_html = "".join(f'<div class="msg" id="m{i}"><div class="mav" style="background:{EJEN[c["who"]][2]}">{EJEN[c["who"]][1]}</div><div><div class="mn">Ejen {EJEN[c["who"]][0]} <span>kepada Semua</span></div><div class="mt">{c["msg"]}</div></div></div>' for i, c in enumerate(chats))
ejen_html = "".join(f'<div class="ej" id="ej{i}"><div class="ejav" style="background:{c}">{ini}</div><div class="ejn">{icon("mic", "#ff5b5b", "mute")}Ejen {nm}</div><div class="raise">{icon("hand", "#FFC23C")}</div><i class="ejb"></i></div>' for i, (nm, ini, c) in enumerate(EJEN))
lines = [dict(t=ln["text"], s=ln["start"], e=ln["end"]) for st in TL["slides"] for ln in st["lines"]]

CSS = '''
:root{--red:#D42A20;--navy:#232C77;--orange:#F07A22;--teal:#13A08F;--ink:#1B1E3A;--muted:#6B6F86;--app:#141518;--panel:#1F2024;--tile:#2A2C31}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:var(--app)}
#root{position:relative;width:1920px;height:1080px;overflow:hidden;background:var(--app);font-family:"Poppins",sans-serif;color:#fff}
svg.ic{width:1em;height:1em;display:inline-block;vertical-align:-.15em}
#top{position:absolute;left:0;right:0;top:0;height:60px;display:flex;align-items:center;padding:0 24px;gap:18px;font-size:19px;color:#C9CBD3}
#top .tt{font-weight:600;color:#fff}
#top .shr{margin-left:auto;margin-right:auto;background:#1C7A3E;color:#fff;font-size:16px;font-weight:600;padding:6px 18px;border-radius:8px;display:flex;gap:8px;align-items:center}
#rec{display:flex;align-items:center;gap:8px;font-weight:600;color:#fff;background:#2A2C31;padding:6px 14px;border-radius:8px}
#rec i{width:12px;height:12px;border-radius:50%;background:#FF3B30}
#ppl{display:flex;gap:8px;align-items:center}
#screen{position:absolute;left:24px;top:68px;width:1440px;height:810px;border-radius:12px;overflow:hidden;background:#FFF6EE;outline:3px solid #2EA44F}
.slide{position:absolute;left:24px;top:68px;width:1440px;height:810px;border-radius:12px;overflow:hidden}
.sin{position:absolute;inset:0;background:#FFF8F1;color:var(--ink)}
.sin:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(35,44,119,.07) 2px,transparent 2.5px);background-size:40px 40px}
.sin:after{content:"";position:absolute;right:-180px;top:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(#FFD9CC,transparent 70%)}
.shead{position:absolute;left:64px;top:44px;right:64px;z-index:2}
.kick{display:inline-block;font-size:18px;font-weight:700;letter-spacing:.14em;color:#fff;background:var(--navy);padding:6px 16px;border-radius:30px}
.shead h2{font-size:56px;font-weight:800;letter-spacing:-.02em;margin-top:12px;line-height:1.08}
em{font-style:normal;color:var(--red)} .red{color:var(--red)}
.sbody{position:absolute;left:64px;right:64px;top:210px;bottom:66px;z-index:2}
.sfoot{position:absolute;left:0;right:0;bottom:0;height:46px;background:#fff;border-top:2px solid #F1E3D6;display:flex;justify-content:space-between;align-items:center;padding:0 64px;font-size:16px;color:var(--muted);font-weight:500;z-index:2}
.gdot{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--red);margin-right:10px}
.it{position:relative}
.hl{position:absolute;inset:-9px;border:5px solid #FFB020;border-radius:20px;opacity:0;pointer-events:none;box-shadow:0 0 0 6px rgba(255,176,32,.18)}
.calc,.warn,.pill,.defn,.acc,.hero,.ag,.colc,.ac,.tl3,.pt,.disc{background:#fff;border-radius:22px;box-shadow:0 10px 30px rgba(60,30,10,.08),0 2px 6px rgba(60,30,10,.05)}
.agenda{display:grid;grid-template-columns:1fr 1fr;gap:22px 30px;width:1100px}
.ag{font-size:32px;font-weight:600;padding:22px 28px;display:flex;align-items:center;gap:20px}
.ag b{width:54px;height:54px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;flex:none}
.tagline{position:absolute;left:0;bottom:20px;font-size:24px;color:var(--muted);font-weight:500}
.defn{font-size:32px;line-height:1.4;padding:26px 34px;width:1180px}
.accs{display:flex;align-items:center;gap:30px;margin-top:34px}
.acc{display:flex;align-items:center;gap:24px;padding:26px 30px;width:520px}
.accic,.heroic,.aci,.tic{width:100px;height:100px;border-radius:26px;display:flex;align-items:center;justify-content:center;flex:none;font-size:60px}
.acc h4{font-size:46px;font-weight:800;line-height:1} .acc p{font-size:24px;font-weight:600;margin-top:6px} .acc small{font-size:20px;color:var(--muted)}
.arrow{display:flex;flex-direction:column;align-items:center;font-size:80px;color:var(--orange);width:150px}
.arrow span{font-size:20px;font-weight:600;color:var(--muted);margin-top:-8px;white-space:nowrap}
.funds{display:flex;gap:16px;margin-top:34px}
.funds span{background:var(--navy);color:#fff;font-size:24px;font-weight:600;padding:12px 24px;border-radius:40px}
.hero{display:flex;align-items:center;gap:34px;padding:30px 40px;width:900px}
.heroic{width:140px;height:140px;background:#FDE4E1;font-size:90px}
.big{font-size:100px;font-weight:800;line-height:1;letter-spacing:-.02em} .bigsub{font-size:30px;font-weight:600;margin-top:6px}
.pros{display:flex;gap:22px;margin-top:30px}
.pros span{background:#E2F4F1;color:#0E6E62;font-size:26px;font-weight:600;padding:14px 26px;border-radius:40px}
.warn{display:flex;gap:22px;align-items:center;background:#FFF4DB;padding:22px 30px;font-size:26px;line-height:1.35;margin-top:30px;box-shadow:none;border:2px solid #F6D58A}
.warn>svg{font-size:52px;flex:none}
.tbl{background:#fff;border-radius:22px;box-shadow:0 10px 30px rgba(60,30,10,.08);padding:14px 26px;width:1310px}
.tr{display:grid;grid-template-columns:1.2fr 1fr 1fr 1.2fr;font-size:30px;padding:14px 18px;border-radius:14px}
.tr+.tr{border-top:2px solid #F3EAE1}
.tr.th{font-size:22px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.tr div:last-child{font-weight:700;color:var(--red)}
.yrs{display:flex;align-items:center;gap:40px}
.yr{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:24px}
.coin{width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFE59A,#F2A71B 70%);border:6px solid #D98A0B;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:800;color:#7A4A00}
.yrnote{font-size:28px;color:var(--muted)}
.calc{padding:18px 30px;display:inline-block;margin-top:24px;margin-right:16px}
.calc .cl{font-size:20px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.calc .eq{font-size:38px;font-weight:600} .calc .eq b{font-weight:800} .calc small{font-size:22px;color:var(--muted)} .calc.res{background:#FFF0EE}
.pill{display:inline-flex;gap:14px;align-items:center;font-size:24px;padding:14px 26px;margin-top:24px;border-radius:40px} .pill>svg{font-size:34px}
.flow{font-size:32px;font-weight:800;color:var(--navy);display:flex;align-items:center;gap:14px} .flow svg{font-size:44px} .flow small{font-size:22px;font-weight:500;color:var(--muted);margin-left:14px}
.vbars{position:absolute;left:0;top:130px;width:760px;height:330px;display:flex;align-items:flex-end;gap:30px;border-bottom:4px solid #D9CFC5}
.vb{flex:1;height:100%;display:flex;align-items:flex-end;position:relative}
.vb .fill{width:100%;border-radius:16px 16px 0 0;transform-origin:50% 100%}
.vb .val{position:absolute;left:0;right:0;text-align:center;font-size:40px;font-weight:800}
.vb .xl{position:absolute;left:-10px;right:-10px;bottom:-44px;text-align:center;font-size:22px;font-weight:600;color:var(--muted)}
.side{position:absolute;left:830px;top:110px;width:450px} .side .calc{display:block;margin:0} .side .calc .eq{font-size:60px} .side .warn{font-size:24px}
.hbars{width:1300px;display:flex;flex-direction:column;gap:14px}
.hb{display:grid;grid-template-columns:200px 1fr 110px;align-items:center;gap:20px;padding:6px 10px;border-radius:14px}
.hl2{font-size:26px;font-weight:700}
.track{height:34px;border-radius:17px;background:#F3EAE1;overflow:hidden}
.hb .fill{height:100%;border-radius:17px;transform-origin:0 50%}
.hv{font-size:32px;font-weight:800;color:var(--navy);text-align:right}
.row2{display:flex;gap:20px;align-items:stretch;margin-top:10px} .row2 .calc{margin:12px 0 0} .row2 .warn{margin-top:12px;flex:1;font-size:23px}
.cols{display:flex;gap:28px} .colc{padding:24px 30px;flex:1} .colc:first-child{flex:.75}
.ctag{display:inline-block;font-size:18px;font-weight:700;color:#fff;background:var(--orange);padding:5px 14px;border-radius:20px;letter-spacing:.04em} .ctag.red{background:var(--red)}
.colc h4{font-size:32px;font-weight:800;margin:12px 0 8px} .colc p{font-size:24px;line-height:1.4}
.opt{background:#F7F2EC;border-radius:16px;padding:12px 20px;font-size:26px;font-weight:700} .opt small{display:block;font-size:20px;font-weight:500;color:var(--muted)}
.or{font-size:18px;font-weight:800;color:var(--red);margin:6px 0 6px 20px}
.plusrow{margin-top:12px;font-size:26px;font-weight:800;color:var(--teal);padding:8px 20px;border-radius:14px}
.sub2{font-size:28px;color:var(--muted)}
.acc3{display:flex;flex-direction:column;gap:18px;margin-top:20px;width:1150px}
.ac{display:flex;align-items:center;gap:26px;padding:16px 26px} .aci{width:80px;height:80px;font-size:48px;border-radius:20px}
.acl{font-size:30px;font-weight:700;flex:1} .acl small{display:block;font-size:20px;color:var(--muted);font-weight:500} .acv{font-size:54px;font-weight:800}
.tiles3{display:flex;gap:26px} .tl3{flex:1;padding:28px 30px} .tic{width:96px;height:96px;font-size:58px}
.tl3 h4{font-size:36px;font-weight:800;margin:18px 0 8px} .tl3 p{font-size:23px;line-height:1.5}
.pts{display:flex;flex-direction:column;gap:18px;width:1200px}
.pt{display:flex;align-items:center;gap:24px;font-size:30px;font-weight:600;padding:18px 28px}
.pt b{width:56px;height:56px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;flex:none}
.disc{margin-top:22px;font-size:21px;color:var(--muted);padding:14px 24px;background:#F7F2EC;box-shadow:none;width:1200px;line-height:1.4}
#cap{position:absolute;left:24px;top:890px;width:1440px;height:96px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 40px}
#capt{background:rgba(0,0,0,.72);border-radius:12px;padding:10px 26px;font-size:30px;font-weight:600;line-height:1.3;color:#fff}
#ptile{position:absolute;left:1488px;top:68px;width:408px;height:230px;border-radius:12px;overflow:hidden;background:#2A2C31;display:flex;align-items:center;justify-content:center}
.pav{width:110px;height:110px;border-radius:50%;background:#D42A20;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;position:relative;margin-top:-20px}
#pring{position:absolute;inset:-10px;border-radius:50%;border:5px solid #2EA44F;opacity:0}
#pbord{position:absolute;inset:0;border:4px solid #2EA44F;border-radius:12px;opacity:0}
.nm{position:absolute;left:10px;bottom:10px;background:rgba(0,0,0,.6);border-radius:8px;padding:5px 12px;font-size:16px;font-weight:600;display:flex;gap:8px;align-items:center} .nm svg{width:18px;height:18px}
#ejen{position:absolute;left:1488px;top:310px;width:408px;height:120px;display:flex;gap:10px}
.ej{flex:1;background:var(--tile);border-radius:12px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.ejav{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;margin-top:-18px}
.ejn{position:absolute;left:6px;bottom:6px;font-size:13px;font-weight:600;display:flex;gap:4px;align-items:center;white-space:nowrap}
svg.mute{width:14px;height:14px}
.raise{position:absolute;right:6px;top:6px;font-size:28px;opacity:0}
.ejb{position:absolute;inset:0;border:3px solid #FFC23C;border-radius:12px;opacity:0}
#chat{position:absolute;left:1488px;top:442px;width:408px;height:544px;background:var(--panel);border-radius:12px;overflow:hidden}
#chat .ch{height:48px;border-bottom:1px solid #33353B;display:flex;align-items:center;padding:0 18px;font-size:18px;font-weight:600}
#msgs{position:absolute;left:0;right:0;top:56px;padding:0 14px;display:flex;flex-direction:column;gap:8px}
.msg{display:flex;gap:10px;background:#2A2C31;border-radius:10px;padding:8px 12px;opacity:0}
.mav{width:32px;height:32px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700}
.mn{font-size:15px;font-weight:700} .mn span{font-weight:400;color:#9DA0AA;font-size:13px}
.mt{font-size:16px;color:#E7E8EC;margin-top:2px;line-height:1.3}
#chat .inp{position:absolute;left:14px;right:14px;bottom:14px;height:40px;border-radius:10px;border:1px solid #3A3D44;color:#7E818B;font-size:16px;display:flex;align-items:center;padding:0 14px}
#bar{position:absolute;left:0;right:0;bottom:0;height:84px;background:#1A1B1F;display:flex;align-items:center;justify-content:center;gap:46px}
.tb{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:14px;color:#C9CBD3} .tb svg{width:30px;height:30px}
#leave{position:absolute;right:28px;background:#E5332A;color:#fff;font-weight:700;font-size:17px;padding:10px 22px;border-radius:10px}
'''

JS = '''
document.querySelectorAll('.it').forEach(e=>e.insertAdjacentHTML('beforeend','<i class="hl"></i>'));
window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
const cap=document.getElementById('capt'), rect=document.getElementById('rect'), ring=document.getElementById('pring');
let lastCap=-2, lastSec=-1; const prox={t:0};
tl.to(prox,{t:TL.dur,duration:TL.dur,ease:'none',onUpdate:()=>{
  const t=prox.t; const v=+(ENV[Math.min(ENV.length-1,Math.floor(t*30))]||0)/9;
  ring.style.transform='scale('+(1+v*0.18).toFixed(3)+')'; ring.style.opacity=(v>0.05?0.35+0.65*v:0).toFixed(2);
  const sec=Math.floor(t); if(sec!==lastSec){lastSec=sec;rect.textContent='REC '+String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
  let ci=-1; for(let i=0;i<LINES.length;i++){ if(t>=LINES[i].s-0.05 && t<=LINES[i].e+0.35){ci=i;break;} }
  if(ci!==lastCap){lastCap=ci; cap.textContent=ci>=0?LINES[ci].t:''; cap.style.opacity=ci>=0?1:0;}
}},0);
LINES.forEach(l=>{ tl.to('#pbord',{opacity:1,duration:.15},l.s); tl.to('#pbord',{opacity:0,duration:.25},l.e+.1); });
TL.slides.forEach(s=>{
  const el='#sl_'+s.id+' .sin';
  tl.fromTo(el,{opacity:0,x:50},{opacity:1,x:0,duration:.55,ease:'power3.out'},s.start);
  tl.to(el,{opacity:0,x:-40,duration:.4,ease:'power2.in'},s.end-.4);
  tl.from('#sl_'+s.id+' .shead',{y:24,opacity:0,duration:.5,ease:'power3.out'},s.start+.2);
  let prevHl=null;
  s.lines.forEach(l=>{
    (l.show||[]).forEach((id,k)=>{
      const at=l.start+k*.25;
      tl.fromTo('#'+id,{opacity:0,y:26},{opacity:1,y:0,duration:.5,ease:'back.out(1.6)'},at);
      document.querySelectorAll('#'+id+' .vb>.fill, #'+id+'>.fill').forEach(f=>tl.fromTo(f,{scaleY:0},{scaleY:1,duration:.8,ease:'back.out(1.3)'},at+.1));
      document.querySelectorAll('#'+id+' .track>.fill').forEach(f=>tl.fromTo(f,{scaleX:0},{scaleX:1,duration:.9,ease:'power3.out'},at+.1));
    });
    if(l.hl){ const h='#'+l.hl+' > .hl'; if(prevHl) tl.to(prevHl,{opacity:0,duration:.3},l.start);
      tl.fromTo(h,{opacity:0,scale:1.04},{opacity:1,scale:1,duration:.35,ease:'power2.out'},l.start+.15); prevHl=h; }
  });
});
CHATS.forEach((c,i)=>{
  tl.fromTo('#m'+i,{opacity:0,y:20},{opacity:1,y:0,duration:.4,ease:'back.out(1.6)'},c.t);
  const ej='#ej'+c.who;
  tl.fromTo(ej+' .raise',{opacity:0,scale:.4},{opacity:1,scale:1,duration:.3,ease:'back.out(2)'},c.t);
  tl.fromTo(ej+' .ejb',{opacity:0},{opacity:1,duration:.2},c.t);
  tl.to([ej+' .raise',ej+' .ejb'],{opacity:0,duration:.3},c.end+.2);
});
tl.to('#root',{opacity:0,duration:.8},TL.dur-.8);
window.__timelines["main"]=tl; tl.seek(0);
'''

html = f'''<!doctype html><html lang="ms" data-resolution="landscape"><head><meta charset="UTF-8"/><meta name="viewport" content="width=1920, height=1080"/>
<script src="vendor/gsap.min.js"></script><style>{CSS}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1920" data-height="1080">
 <div id="top"><span class="tt">{TITLE}</span><span class="shr">{icon("share", "#ffffff")} {TRAINER} sedang berkongsi skrin</span><span id="ppl">{icon("people", "#C9CBD3")} {len(EJEN)+1}</span><span id="rec"><i></i><span id="rect">REC 00:00</span></span></div>
 <div id="screen"></div>
 {"".join(slides_html)}
 <div id="cap"><div id="capt"></div></div>
 <div id="ptile"><div class="pav"><i id="pring"></i>{TRAINER_INI}</div><div class="nm">{icon("mic", "#2EA44F")} {TRAINER} · Trainer</div><i id="pbord"></i></div>
 <div id="ejen">{ejen_html}</div>
 <div id="chat"><div class="ch">Chat mesyuarat</div><div id="msgs">{chat_html}</div><div class="inp">Taip mesej di sini…</div></div>
 <div id="bar"><div class="tb">{icon("mic", "#ffffff")}Mikrofon</div><div class="tb">{icon("cam", "#ffffff")}Video</div><div class="tb">{icon("people", "#ffffff")}Peserta</div><div class="tb">{icon("chat", "#ffffff")}Chat</div><div class="tb">{icon("share", "#2EA44F")}Kongsi Skrin</div><div class="tb">{icon("rec", "#FF3B30")}Rakam</div><div id="leave">Tamat</div></div>
 <audio id="mix" src="assets/mix.wav" data-start="0" data-duration="{DUR}" data-track-index="9"></audio>
</div>
<script>
const TL={json.dumps({"slides": TL["slides"], "dur": DUR}, ensure_ascii=False)};
const LINES={json.dumps(lines, ensure_ascii=False)};
const CHATS={json.dumps(chats, ensure_ascii=False)};
const ENV="{TL["env"]}";
{JS}
</script></body></html>'''
open("proj/index.html", "w").write(html)
print("ok", DUR, len(lines), "lines", len(chats), "chats")
```

## Peraturan & tips
- Kandungan: hanya fakta dari sumber. Angka anggaran → "lebih kurang". Produk pelaburan → slaid akhir ada "tidak dijamin" + "tertakluk pada terma & syarat".
- Setiap ayat VO ≈ 1 idea, dan kebanyakan ayat ada `show`/`hl` supaya skrin sentiasa bergerak.
- Soalan chat: ayat jawapan bermula dengan "<Nama> tanya, ..." supaya penonton faham.
- Chat maks 5 mesej untuk keseluruhan video (panel muat ~5). Lebih → buang yang lama atau kecilkan `.msg`.
- Lint: tiada CSS `transform` pada elemen yang GSAP animate (guna `fromTo`); `<audio>` mesti ada `id`; tiada URL CDN (GSAP dari `vendor/`).
- Jangan guna emoji dalam HTML (font mungkin tiada) — lukis ikon SVG.
- Kalau Najib minta suara lain / format lain (9:16, ada talking head), ikut permintaan dia untuk video itu sahaja.
- Kalau ElevenLabs connector tiada: beri skrip VO (satu perenggan setiap slaid, tags v3) untuk dia generate & upload `vo_<id>.mp3` ke `dl/`, kemudian teruskan dari langkah Sync.