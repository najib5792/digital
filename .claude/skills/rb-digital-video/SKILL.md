---
name: "rb-digital-video"
description: "Najib's 9:16 short-video studio, 100 distinct styles, two modes: Code-only (HyperFrames + ElevenLabs VO script he generates) or Flow (Flow image prompts + ElevenLabs v3 VO). Use for any \"buat video\", explainer/story/ad short, Flow prompts, VO script, or uploaded images/mp3. ALWAYS ask mode + style first, full 100-style menu as text."
---

# Video Style Studio

Talk to Najib in informal Bahasa Melayu (rojak), concise. Give anything he must copy (prompts, VO script) inside code blocks. After mode + style are chosen, work autonomously — no confirmation pauses between steps.

## Step 0 — Ask MODE + style (mandatory)

If his message doesn't already say both, ask in ONE message: mode, then the FULL style menu (all 100, every category), plus the topic if not given (or offer to pick one). He answers e.g. "A 39". He may also add a size (e.g. "16:9") — default is 9:16.

**How to show it (strict):**
- **Never use AskUserQuestion / button cards / option pickers for the mode or the style.** They only fit 4 options, so he ends up seeing ~5 styles. This has happened — don't repeat it.
- Never shorten, summarise, or "recommend a few" instead of the menu. Paste both code blocks below exactly as written, all 100 styles.
- Put the menu in your final reply text and end the turn there (or send it with SendUserMessage if you must keep working). Text written between tool calls may be summarised and he won't see the list.
- You may add ONE line under the menu with 3–4 suggested numbers for his topic, but the full menu must still be shown.

```
Nak buat mode mana?
 A) CODE ONLY — semua visual aku buat guna code (HyperFrames), tak payah gambar. Aku bagi skrip VO ElevenLabs, kau generate & upload.
 B) FLOW — kau generate gambar kat Google Flow + VO ElevenLabs, aku edit.
```

```
Nak buat style apa? (jawab nombor)

CERITA & DRAMA
  1 Komik/manga    2 Polaroid siasatan    3 Fake chat    4 Dokumentari
  5 Trailer filem    6 Anime opening    7 CCTV/found footage
  8 VHS retro    9 Buku cerita budak   10 Claymation   11 Diari/jurnal
 12 Galeri muzium   13 Kalendar koyak   14 Infinite zoom
 15 Storytime Reddit   16 Film noir   17 Mockumentary
 18 Filem bisu 1920an   19 Siluet senja

FAKTA & EDU
 20 Scrapbook sticker   21 Whiteboard   22 Chalkboard   23 Mind map
 24 Timeline sejarah   25 Peta perjalanan   26 Blueprint
 27 Isometric 3D   28 Kuiz game show   29 Tutorial langkah
 30 Lakaran → warna   31 Mitos vs fakta   32 Stickman   33 Sains makmal
 34 Angkasa kosmik   35 X-ray / imbasan

DATA & PERBANDINGAN
 36 Infografik   37 Resit/bil   38 Split screen VS   39 Countdown/Top 5
 40 Excel animasi   41 Tier list   42 Bracket kejohanan   43 Roda putar
 44 Siaran sukan / scoreboard   45 Ramalan cuaca

HOOK & VIRAL
 46 Kinetic typography   47 Caption viral   48 Podcast audiogram
 49 Photo slideshow beat   50 Kad flip reveal   51 Foto + contengan
 52 Meme format   53 Papan split-flap   54 POV   55 Talking head AI
 56 Street interview   57 TikTok Live   58 Day in my life
 59 Blackout poetry

TECH & MODEN
 60 Skrin phone/Google   61 Terminal hacker   62 Neon cyberpunk
 63 Pixel art 8-bit   64 Flat motion graphic   65 Retro desktop Win95
 66 Y2K chrome   67 Game HUD / quest   68 Video call grid
 69 Low poly 3D

JUALAN & BRAND
 70 Iklan produk/TikTok Shop   71 Testimonial   72 Thread/post sosial
 73 Poster vintage   74 Surat khabar   75 Paper cut parallax
 76 Majalah cover   77 UGC ad   78 Unboxing   79 TVC sinematik
 80 Problem → solution   81 Before & after   82 Macro ASMR produk
 83 Resepi top-down

SENI & KRAF
 84 Stop motion flatlay   85 Sand art   86 Bata mainan
 87 Miniatur tilt-shift   88 Ukiyo-e Jepun   89 Wayang kulit   90 Batik
 91 Pop art   92 Collage surreal   93 One-line art   94 Bauhaus geometri
 95 Groovy 70an   96 Kawaii pastel   97 Stained glass
 98 Kraf felt & kadbod   99 Grafiti dinding  100 Seni Islamik geometri
```
If he says "kau pilih", pick what fits the topic (story → 1/2/3/15, facts → 20/39/31, numbers → 36/37/40, tips → 46/47, product → 70/77/81, horror → 2/7/8, lucu → 52/65/17, journey → 13/25, ranking → 41/42, Islamic/takaful → 100/90) and say which you picked in one line. If he names a style but no mode, still ask the mode (one short line).

**Paper cut parallax (75)** has its own workflow: read and follow `/mnt/skills/plugins/papercut-parallax-video/SKILL.md` instead of this skill. Choosing it here counts as asking for it explicitly. Never code-only.

## Step 1 — Read references

Always read `references/common.md` (pipeline, Flow prompt rules, ElevenLabs VO rules, rendering limits, audio, fonts). In Mode A, the HyperFrames engine section below overrides common.md wherever they differ (rendering, preview, fonts, muxing).
- Look up the chosen number in the table below. "references/x.md" → read only that file. "recipe below" → the recipe is in "Style recipes" at the end of this file (no reference file yet).
- Numbers run in menu order by category (1–19 Cerita, 20–35 Fakta, 36–45 Data, 46–59 Hook, 60–69 Tech, 70–83 Jualan, 84–100 Seni). Older chats may use the previous numbering — if a number he gives doesn't match the topic he described, confirm by style name. Headings inside the reference files still show the old numbers — ignore them.
- Reference files and recipes describe the LOOK (signature, layout, motion, audio). Their PIL/`common.py` drawing instructions apply to Mode B only; in Mode A translate the same look into HTML/CSS/SVG + GSAP.

| # | Style | Where |
|---|-------|-------|
| 1 | Komik / manga ✅ | references/manga.md |
| 2 | Polaroid siasatan ✅ | references/polaroid.md |
| 3 | Fake chat | references/fakechat.md |
| 4 | Dokumentari | references/documentary.md |
| 5 | Trailer filem | references/trailer.md |
| 6 | Anime opening | references/anime.md |
| 7 | CCTV / found footage | references/cctv.md |
| 8 | VHS retro | references/vhs.md |
| 9 | Buku cerita budak | references/storybook.md |
| 10 | Claymation | references/claymation.md |
| 11 | Diari / jurnal | references/diary.md |
| 12 | Galeri muzium | references/gallery.md |
| 13 | Kalendar koyak | references/calendar.md |
| 14 | Infinite zoom | references/infinitezoom.md |
| 15 | Storytime Reddit | recipe below |
| 16 | Film noir | recipe below |
| 17 | Mockumentary | recipe below |
| 18 | Filem bisu 1920an | recipe below |
| 19 | Siluet senja | recipe below |
| 20 | Scrapbook sticker ✅ | references/scrapbook.md |
| 21 | Whiteboard doodle | references/whiteboard.md |
| 22 | Chalkboard | references/chalkboard.md |
| 23 | Mind map | references/mindmap.md |
| 24 | Timeline sejarah | references/timeline.md |
| 25 | Peta perjalanan | references/map.md |
| 26 | Blueprint | references/blueprint.md |
| 27 | Isometric 3D | references/isometric.md |
| 28 | Kuiz game show | references/quiz.md |
| 29 | Tutorial langkah | references/tutorial.md |
| 30 | Lakaran → warna | references/sketch2color.md |
| 31 | Mitos vs fakta | recipe below |
| 32 | Stickman | recipe below |
| 33 | Sains makmal | recipe below |
| 34 | Angkasa kosmik | recipe below |
| 35 | X-ray / imbasan | recipe below |
| 36 | Infografik | references/infographic.md |
| 37 | Resit / bil | references/receipt.md |
| 38 | Split screen VS | references/splitscreen.md |
| 39 | Countdown / Top 5 | references/countdown.md |
| 40 | Excel animasi | recipe below |
| 41 | Tier list | recipe below |
| 42 | Bracket kejohanan | recipe below |
| 43 | Roda putar | recipe below |
| 44 | Siaran sukan / scoreboard | recipe below |
| 45 | Ramalan cuaca | recipe below |
| 46 | Kinetic typography ✅ | references/kinetic.md |
| 47 | Caption viral | references/viralcaption.md |
| 48 | Podcast audiogram | references/audiogram.md |
| 49 | Photo slideshow beat | references/carousel.md |
| 50 | Kad flip reveal ✅ (Mode A, HyperFrames) | references/cardflip.md |
| 51 | Foto + contengan | references/annotated.md |
| 52 | Meme format | references/meme.md |
| 53 | Papan split-flap | references/splitflap.md |
| 54 | POV | recipe below |
| 55 | Talking head AI | recipe below |
| 56 | Street interview | recipe below |
| 57 | TikTok Live | recipe below |
| 58 | Day in my life | recipe below |
| 59 | Blackout poetry | recipe below |
| 60 | Skrin phone / Google | references/phone.md |
| 61 | Terminal hacker | references/terminal.md |
| 62 | Neon cyberpunk | references/neon.md |
| 63 | Pixel art 8-bit | references/pixel.md |
| 64 | Flat motion graphic | references/flatmotion.md |
| 65 | Retro desktop Win95 | references/win95.md |
| 66 | Y2K chrome | recipe below |
| 67 | Game HUD / quest | recipe below |
| 68 | Video call grid | recipe below |
| 69 | Low poly 3D | recipe below |
| 70 | Iklan produk | references/productad.md |
| 71 | Testimonial | references/testimonial.md |
| 72 | Thread / post sosial | references/threads.md |
| 73 | Poster vintage | references/poster.md |
| 74 | Surat khabar | references/newspaper.md |
| 75 | Paper cut parallax | other skill (papercut-parallax-video) |
| 76 | Majalah cover | references/magazine.md |
| 77 | UGC ad | recipe below |
| 78 | Unboxing | recipe below |
| 79 | TVC sinematik | recipe below |
| 80 | Problem → solution | recipe below |
| 81 | Before & after | recipe below |
| 82 | Macro ASMR produk | recipe below |
| 83 | Resepi top-down | recipe below |
| 84 | Stop motion flatlay | recipe below |
| 85 | Sand art | recipe below |
| 86 | Bata mainan | recipe below |
| 87 | Miniatur tilt-shift | recipe below |
| 88 | Ukiyo-e Jepun | recipe below |
| 89 | Wayang kulit | recipe below |
| 90 | Batik | recipe below |
| 91 | Pop art | recipe below |
| 92 | Collage surreal | recipe below |
| 93 | One-line art | recipe below |
| 94 | Bauhaus geometri | recipe below |
| 95 | Groovy 70an | recipe below |
| 96 | Kawaii pastel | recipe below |
| 97 | Stained glass | recipe below |
| 98 | Kraf felt & kadbod | recipe below |
| 99 | Grafiti dinding | recipe below |
| 100 | Seni Islamik geometri | recipe below |

✅ = tested. Scrapbook/manga/polaroid have working Mode B examples in `examples/` (scrapbook also uses `scripts/scrapbook_engine.py`); kinetic was tested code-only in the old PIL engine. Kad flip reveal (50) was tested in Mode A HyperFrames: tarot cards with CSS 3D `rotationY` flip (`.card` with `transform-style: preserve-3d`, `.back`/`.face` with `backface-visibility: hidden`, face pre-rotated 180°, `transformPerspective: 1800`), others drop away while the chosen card goes big on the left and its text panel enters on the right, then it returns face-up to the row. Python examples are for Mode B; in Mode A use them only as a guide to layout, timing and look. After the first successful Mode A video in a style, offer to save its `index.html` into `examples/hyperframes/<style>/` and repackage the skill (keep the same name).

**Fonts note (Mode B / PIL):** github raw may be blocked in the sandbox (get_font then saves a JSON error file → "OSError: broken file"). Fallback: `npm pack @fontsource/<font>` (e.g. anton, bebas-neue, bangers, permanent-marker, special-elite, caveat, oswald) and use `files/<font>-latin-400-normal.woff` — PIL loads .woff fine. Poppins is local. Mode A fonts: see the HyperFrames engine section.

Mode A → follow "Mode A". Mode B → follow "Mode B".

**No two styles may look the same.** When building, respect each style's signature (the "Signature" line in the recipe or reference). If a topic pushes two styles together, keep the chosen style's signature elements and drop the other's.

---

## Mode A — CODE ONLY (no images from Najib) — HyperFrames engine

Every code-only video is built and rendered with **HyperFrames** (npm `hyperframes`, by HeyGen): the video is an HTML page (HTML + CSS + inline SVG) animated with a GSAP timeline, and HyperFrames captures it frame by frame in headless Chrome into an MP4. Do NOT draw Mode A frames with PIL / `common.py`. Everything on screen is HTML/CSS/SVG: shapes, icons, charts, UI mockups, text, backgrounds, particles, transitions. In the style recipe, ignore the Flow prompt / asset-cutting parts and replace every image slot with drawn SVG/CSS elements. Najib uploads nothing except the VO mp3 he generates on ElevenLabs (and his own music if he wants).

### A1. Setup (every new chat — the workspace resets, ~1 min)
```bash
W=<scratchpad dir>; cd $W
which hyperframes || npm i -g hyperframes
hyperframes browser ensure        # chrome-headless-shell
HYPERFRAMES_SKIP_SKILLS=1 hyperframes init <slug> --example blank --resolution portrait --non-interactive
cd <slug>
npm i gsap@3.14.2 --no-save --silent && mkdir -p vendor assets && cp node_modules/gsap/dist/gsap.min.js vendor/
```
- Default 1080x1920 portrait (`--resolution portrait`). If he asks 16:9 use `--resolution landscape` (1920x1080) and lay scenes out wide (e.g. visual left, text panel right); 1:1 → `square`. Read the project's `AGENTS.md` once for framework rules.
- **Sandbox blocks CDNs** (jsdelivr, unpkg, Google Fonts, external images). Reference `vendor/gsap.min.js`, never a CDN URL. A missing GSAP fails the render with `sub_timeline_script_failure`. Never leave any external http(s) URL in the HTML.
- Extra JS libs (e.g. a path morph helper) → install from npm and copy into `vendor/`.

### A2. Composition rules (HyperFrames)
- Root: `<div id="root" data-composition-id="main" data-start="0" data-duration="<total s>" data-width="1080" data-height="1920">` (swap width/height for landscape).
- Each scene: `<div id="sN" class="clip" data-start="<s>" data-duration="<s>" data-track-index="0">`; scenes fill the frame (`position:absolute; inset:0`). Persistent layers (background, grain, HUD, a row of cards that lives across scenes) sit outside scenes without timing and are animated by the timeline.
- Audio: `<audio src="assets/mix.wav" data-start="0" data-duration="<total>" data-track-index="9"></audio>` (one pre-mixed music+SFX track), plus a separate `<audio src="assets/vo.mp3" … data-track-index="8">` once he uploads the VO.
- One paused root GSAP timeline: `window.__timelines = window.__timelines || {}; const tl = gsap.timeline({paused:true}); ... window.__timelines["main"] = tl; tl.seek(0);`
- Deterministic only: no `Math.random()`, `Date.now()`, network fetches. For particles/jitter use a seeded PRNG (mulberry32 with seed from the video title) and generate the elements in script before building the timeline.
- Animate transforms and opacity (x, y, scale, rotation, rotationY, opacity), not layout props (letterSpacing, width, top, font-size) — lint rejects them. For a letter-spread effect split into per-letter spans and animate x.
- `fromTo` tweens on overlays that start later need `immediateRender: false`, otherwise the start value shows from frame 0 (e.g. a white flash covering the opening).
- Long videos (>~25 s or many scenes): split scenes into `compositions/*.html` mounted with `data-composition-src` to keep files manageable (the `timeline_track_too_dense` / `nested_structure` lint warnings are fine to ignore for short videos).
- Useful docs offline: `hyperframes docs gsap|data-attributes|compositions|rendering|troubleshooting`.

### A3. Fonts & assets
- Local system fonts work directly in CSS: Poppins, Inter (`font-family: "Poppins"`).
- Other fonts: `npm pack @fontsource/<font>` → copy the `.woff2` into `assets/fonts/` and declare `@font-face` with a relative URL (tested: cinzel for tarot/elegant titles). `hyperframes-localize-fonts` can also help.
- Icons: write inline SVG yourself (person, phone, money, house, clock, tick, cross, chart, pin, flag…). Keep a consistent stroke width and corner radius per video. Avoid emoji/special glyphs (may be missing) — draw them in SVG.
- Textures (grain, paper, halftone, scanlines): CSS gradients, `repeating-linear-gradient`, or inline SVG `feTurbulence` filters — never external images.

### Style fit
- Strong fit (suggest these if he picks A but no style): 3, 13, 23, 24, 25, 26, 28, 31, 32, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 50, 53, 57, 59, 60, 61, 62, 63, 64, 65, 67, 68, 72, 74, 80, 81, 93, 94, 95, 100.
- OK with simplification (flat vector characters/props instead of illustrations — warn in one line): 4, 5, 7, 8, 9, 14, 15, 19, 20, 21, 22, 27, 29, 34, 52, 66, 69, 70, 71, 73, 76, 90, 96, 97.
- Needs real images, not code-only: 1, 2, 6, 10, 11, 12, 16, 17, 18, 30, 33, 35, 49, 51, 54, 55, 56, 58, 75, 77, 78, 79, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 98, 99 → suggest mode B or the closest code-only style.

### Visual rules
- Motion-graphic quality: one palette (3–4 colours + neutral) as CSS variables, one display font + one body font, consistent corner radius and stroke width.
- Use what HTML does well: gradients, `filter: blur()` glow orbs, box-shadow depth, backdrop blur, SVG strokes with `stroke-dashoffset` draw-on, CSS 3D flips, flexbox layout with auto text wrap (set `white-space: nowrap` where a line must not break).
- Every scene moves: elements enter with back/expo eases, slide, scale, stagger; numbers count up (tween a proxy object and write `textContent` in `onUpdate`); bars grow (scaleY/scaleX with transform-origin); lines draw on; slow camera drift or layer parallax; a transition on every scene cut (wipe, zoom, whip, flash).
- Charts and numbers animate from 0, are clearly labelled, and uncertain figures are hedged ("±", "lebih kurang").
- Safe zone (9:16): text inside x 90–990, y 250–1700. 16:9: keep ~80 px margins. Big, mobile-readable type (body ≥ 40px, headlines 90–150px).

### VO — ElevenLabs script for Najib to generate
In Mode A Claude does NOT call ElevenLabs or any paid TTS. Instead, always give Najib a ready-to-paste **ElevenLabs v3 VO script** and he generates the mp3 himself.

- Write it exactly like Mode B (see VO in common.md): one code block, one short paragraph per scene in scene order, Malay, ElevenLabs v3 audio tags in brackets (`[excited] [curious] [serious] [calm] [dramatic] [whispers] [pause]` …), 90–120 words for ~45 s (≈ 2.3 words/s; scale to the video length). Factual, hedged numbers. Under the block, one line: model **Eleven v3**, a Malay-capable voice, export mp3 and upload here.
- Save the same text as `vo.txt` in the project.
- **Don't wait for the mp3.** Build and render a complete first version right away: big on-screen text + synthesized music + SFX, scenes self-timed from the script (~0.43 s per word + holds), so he already has a usable video and can see the timing.
- **When he uploads the mp3:** put it in `assets/vo.mp3`, get pauses with `python <skill>/scripts/vo_segments.py assets/vo.mp3 -32 0.35` (paragraph breaks, then `-32 0.18` for phrases), map paragraphs to scenes by order, update every scene's `data-start`/`data-duration` and the timeline times (keep all scene times as variables at the top of the script so re-timing is one edit), regenerate `mix.wav` with music at gain 0.3–0.35 under VO and SFX moved to the new times, add the VO `<audio>`, set the total duration to VO length + 1–2 s outro, lint, snapshot, re-render. Tell him timing came from pauses, not a transcript.
- If he wants a free voice instead, offer edge-tts on his laptop (`pip install edge-tts`; Malay voices `ms-MY-OsmanNeural` / `ms-MY-YasminNeural`) or CapCut TTS — the cloud sandbox usually can't reach the edge-tts server.
- If he says "tak payah VO" → captions + music + SFX only, no script.

Music and SFX stay synthesized offline with `Mix` in `scripts/common.py` (free) unless he uploads his own: render one `assets/mix.wav` with music + SFX placed at the scene/beat times from your plan, and reference it with a single `<audio>`. Music is seeded per video (`seed="<video title>"`), so every video gets a different track — see Audio in common.md. `hyperframes beats` / `hyperframes audio` can detect beats/onsets in an uploaded track to sync cuts.

### A4. Check, preview, render
```bash
hyperframes lint                                   # must be 0 errors
hyperframes snapshot --at 1.5,5,9,14,20 --no-end -o snaps   # one time per scene
```
- **Read `snaps/contact-sheet.jpg` and LOOK at it** before the full render: overlaps, wrapped lines, text outside safe zone, overlays covering the frame, empty scenes. Fix and re-snapshot.
- Render: `hyperframes render --output <slug>.mp4` (default quality `looks`; `-q draft` for a quick test). ~3–6 s of render per 1 s of video in this sandbox; the "Screenshot capture (slower)" notice is normal. Don't use `--docker`.
- Verify: `ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of csv=p=0 <slug>.mp4` (right size, has audio, right duration).
- Render fails with `REQUESTFAILED … ERR_TUNNEL_CONNECTION_FAILED` → an external URL is still in the HTML; localize it.

### Mode A flow
Short plan message (title + scene list: VO line + what gets drawn), then build immediately with no waiting: setup → write VO script (`vo.txt`) → self-timing → write `index.html` → mix audio → lint → snapshot contact sheet, view, fix → render → copy to `/mnt/user-data/outputs/` (if that folder exists) and send the file with SendUserFile → reply with: short summary (3–5 bullets, music line, cost RM0 unless a paid service was used), the **ElevenLabs v3 VO script in a code block** + one line on how to generate it, then "upload mp3, aku sync timing" and "kalau ada timing lari, bagitahu saat berapa".

---

## Mode B — FLOW images + ElevenLabs

### Plan reply (no files yet)
One message with: title + scene list (on-screen text, VO line, visual, asset codes), Flow prompts in code blocks (see common.md for sheet rules — few prompts, combined sheets), and the ElevenLabs v3 VO script with mood tags in one code block. Ask him to upload everything together.

### Build when uploads arrive
Identify files → cut/crop assets → VO timing (`scripts/vo_segments.py`) → write the style script → **contact sheet preview and look at it** → fix overlaps → render in chunks → mix audio → mux → send the file → short summary (what's in it, timing synced from pauses, ask which second is off).

---

## Style recipes (styles without a reference file)

Each: **Signature** (what makes it unique — never drop it) · **Flow** (assets to ask for in mode B, as few sheets as possible) · **Build** · **Audio**. All 9:16, rules from common.md apply. In Mode A, build the same signature in HTML/CSS/SVG + GSAP (e.g. "grayscale filter" → CSS `filter: grayscale(1)`, "mask reveal" → CSS `clip-path` or SVG mask tween, "Voronoi/Delaunay" → precompute polygons in script with a seeded PRNG).

**15 Storytime Reddit** — Signature: top half = Reddit-style post card (avatar circle, username, upvotes, text revealed line by line), bottom half = satisfying loop gameplay-like background (parkour, kinetic sand, slime). Flow: 1 vertical satisfying-loop background (or 2x2 frames to cycle). Code-only: draw a procedural satisfying loop (rolling marbles, colour waves). Build: post card highlights the line being read, comment replies pop in at the end. Audio: VO is the core; lofi bed, notif on new comment.

**16 Film noir** — Signature: black & white high contrast, venetian-blind light stripes, rain, smoky detective narrator, typewriter captions. Flow: 2x2 noir film stills (detective in trench coat, rainy street lamp, office with blinds, shadowy figure) — "black and white, 1940s film noir". Build: B/W grade, animated blind-shadow overlay, rain streaks, grain heavy, iris transitions. Audio: drone + slow jazz-like lofi, rain (filtered noise), typing.

**17 Mockumentary** — Signature: The-Office-style confessional: character sits facing camera, awkward slow zoom, lower-third name + job title, cut-aways with deadpan "look at camera" pauses. Flow: 2x2 of the same character in a confessional seat with 4 expressions + 2x2 workplace cut-aways. Build: slow zoom 1.0→1.12, sudden snap-zoom on punchline, freeze-frame + record scratch. Audio: minimal music, awkward silence (mute), record scratch SFX.

**18 Filem bisu 1920an** — Signature: silent movie — sepia/B&W, heavy flicker + scratches + dust, 4:3 frame with rounded vignette, ornate intertitle cards with the dialogue (no lip text), sped-up comedic motion. Flow: 2x2 1920s silent-film stills. Build: flicker brightness per frame, vertical scratch lines, intertitle cards between shots, 16 fps stepped motion. Audio: ragtime-like piano (pluck fast cheerful), projector clatter (rapid knock).

**19 Siluet senja** — Signature: everything as solid black silhouettes against huge gradient sunset/sunrise skies, cinematic and emotional, large thin captions. Flow: 2x2 silhouette scenes ("pure black silhouettes against vivid sunset gradient sky"). Code-only: gradient sky + simple silhouette shapes. Build: slow parallax of silhouette layers, sun glow pulse, fade transitions. Audio: emotional pad, drone soft.

**31 Mitos vs fakta** — Signature: each claim card gets stamped "MITOS" (red rubber stamp, rotates in, ink splat) then flips to "FAKTA" (green) with the truth. Flow: optional 4x4 icon sheet for claims. Build: card flip (x-scale 1→0→1), stamp slam with shake, counter "MITOS #1/5". Audio: slam per stamp, ding on fakta.

**32 Stickman** — Signature: black stick figures on white/off-white, simple line physics (fall, run, bounce), hand-drawn wobble lines (boil effect: redraw with tiny random jitter every 3 frames). Flow: none needed (code). Build: skeleton joints animated with lerp poses, props as simple lines, labels in marker font. Audio: comedy music, pop/knock for impacts.

**33 Sains makmal** — Signature: lab aesthetic — microscope circle view (round vignette mask with crosshair), molecules/atoms orbiting, beakers bubbling, labelled diagram callouts. Flow: 2x2 microscope-view macro images (cells, crystals, bacteria, fibres) + 4x4 lab icon sheet. Build: circular mask zoom, focus-pull blur→sharp, orbiting dots, callout lines draw on. Audio: lofi, bubble pops, ding.

**34 Angkasa kosmik** — Signature: deep space — starfield parallax, glowing planets, nebula clouds, orbit lines, HUD-light labels, epic scale. Code-only: starfield + gradient planets + nebula noise. Flow: 2x2 space vistas. Build: flying-through-stars parallax, planet slow rotate (texture scroll), orbit dots. Audio: drone + riser, boom on reveals.

**35 X-ray / imbasan** — Signature: scanner view — a scan bar sweeps across an object revealing its inside (X-ray blue-white negative), measurement labels and callouts, "SCANNING…" UI. Flow: 2x2 pairs: object normal + matching X-ray version (same angle). Build: mask reveal follows scan bar, glow line, callouts with numbers. Audio: scanner beep, hum (drone), ding on result.

**40 Excel animasi** — Signature: a spreadsheet UI — gridlines, cell selection box moving, formulas typed into the formula bar, numbers filling down, conditional-format colours, a chart generated at the end. Code-only. Build: cursor jumps cell to cell, typing() SFX, SUM result count-up, chart bars grow. Audio: typing, click pops, lofi.

**41 Tier list** — Signature: S/A/B/C/D tier rows (coloured labels left), item tiles dragged from a pool at the bottom into rows one by one, with a short reason caption. Flow: optional 4x4 item icon sheet. Code-only fine. Build: tile drag path with ease and drop bounce, row highlight on drop. Audio: whoosh on drag, pop on drop, slam for S tier.

**42 Bracket kejohanan** — Signature: tournament bracket (8 → 4 → 2 → 1) — two items face off, winner advances along bracket lines that draw on, final champion crown. Flow: optional 4x4 item sheet. Code-only fine. Build: zoom camera onto each matchup, VS flash, line draw-on to next round, trophy at end. Audio: slam per VS, crowd swell at champion.

**43 Roda putar** — Signature: spinning prize wheel with segments — spins, decelerates, ticks past segments, lands on a choice which then gets explained; repeat. Code-only. Build: wheel angle with ease_out over 3 s, pointer flick on each segment pass, winner segment glow. Audio: tick per segment (knock short), ding on land.

**44 Siaran sukan / scoreboard** — Signature: live sports broadcast — scoreboard bug top-left, play-by-play commentary captions, replay wipe with logo, "GOL!" / stats overlays comparing two sides. Flow: optional 2x2 action stills. Code-only fine. Build: score increments with slam, replay star-wipe, stat bars compare. Audio: crowd roar (filtered noise swell), whistle (sine 2.5 kHz trill), slam.

**45 Ramalan cuaca** — Signature: TV weather report — map of Malaysia (simple shapes) with animated weather icons, but forecasting a topic (e.g. "ramalan ekonomi minggu ni"), temperature-style big numbers, scrolling ticker at bottom. Flow: optional presenter 2x2. Code-only: map + icons drawn. Build: icons bob, numbers count, ticker scroll, presenter-style lower third. Audio: upbeat newsy music, whoosh per region.

**54 POV** — Signature: first-person viewpoint — hands/feet in frame, "POV: …" text pinned top in TikTok style, the world reacts to the viewer. Flow: 2x2 of first-person shots (hands holding phone, walking into a shop, opening a door, someone talking to the camera). Build: subtle walking bob (sin y offset), POV caption pinned, reaction subtitles of the other person. Audio: ambient room tone (static low) + music.

**55 Talking head AI** — Signature: one presenter character centred chest-up, jump-cut punch-ins (1.0 → 1.15) on every sentence, big captions with key word highlight, b-roll pop-up cards. No lip sync (say so) — use subtle breathing scale and eye-level framing. Flow: 2x2 of the same presenter (identical description) in 4 expressions/gestures + 1 room background. Build: swap expressions on beats, punch-in cuts, emoji/icon pop-ups beside head. Audio: VO-driven, light music, pop on b-roll.

**56 Street interview** — Signature: handheld mic with a coloured mic flag (topic name), interviewer question as top text, different "passers-by" answering, lower-third name tag ("Aiman, 24"). Flow: 2x2 of 4 different passers-by in a Malaysian street (mall, pasar, LRT, kedai mamak) facing camera, mic visible + 1 mic flag close-up blank. Build: fast cuts per answer, handheld shake, name tags slide in, crowd-noise. Audio: static() as street ambience, comedy music.

**57 TikTok Live** — Signature: livestream UI — LIVE badge + viewer count rising, comments scrolling bottom-left, gift animations flying, host speaking, "pin" product card. Flow: 1–2 host images (same person) in a live-selling setup. Code-only: host as stylised avatar. Build: comments stream (relevant questions answered by VO), viewer counter, hearts float up, product card pops. Audio: notif, hearts pops, lofi.

**58 Day in my life** — Signature: vlog timeline — big timestamps ("6:30 AM") in clean font before each clip, cosy aesthetic grade, quick montage of routine. Flow: 2x2 + 2x2 first-person/cosy routine shots of the same person/day. Build: timestamp flip-in per clip, soft warm grade, gentle zooms. Audio: lofi, clock tick on timestamps.

**59 Blackout poetry** — Signature: a page of dense printed text; words get blacked out with marker strokes until only a few remaining words form the message, which then highlight. Code-only. Build: typeset paragraph (typewriter/serif), marker strokes animate across lines (rounded rect growing), remaining words glow/highlight, camera slowly zooms. Audio: marker scribble, slam on final message, calm music.

**66 Y2K chrome** — Signature: liquid chrome 3D text, glossy bubbles, butterflies/stars sparkles, holographic iridescent gradient, early-2000s UI windows. Flow: 1 iridescent Y2K background + 4x4 sheet of chrome/glossy stickers (butterfly, star, heart, flip phone, CD, sparkle). Code-only: gradient chrome text via vertical colour bands + highlight. Build: floaty bob, lens-flare sweep, sparkle twinkle. Audio: cheerful music pitched up, sparkle pops.

**67 Game HUD / quest** — Signature: life as a video game — health/XP bars, quest log ("QUEST: …"), "+50 XP" popups, achievement unlocked toast, level-up flash. Flow: optional 2x2 character scenes. Code-only: full HUD drawn. Build: XP bar fills on each tip, achievement toast slides from top, level-up flash + particles. Audio: 8-bit-like blips (sweeps), level-up arpeggio, ding.

**68 Video call grid** — Signature: meeting app grid (2x2 or 3x3 tiles) with name labels, mute icons, speaking-tile green border, chat sidebar messages, "You're on mute" gag. Flow: 2x2 of 4 different people at home desks facing webcam. Code-only: avatar circles with initials. Build: active speaker border switches with VO, tiles zoom to fullscreen on key points. Audio: notif sounds, join chime.

**69 Low poly 3D** — Signature: faceted low-poly worlds (triangles, flat-shaded), camera glides over a tiny low-poly landscape, pastel/gem colours. Flow: 2x2 low-poly 3D scenes. Code-only: triangulated backgrounds (random points + Delaunay via scipy) with flat shading. Build: slow camera pan, triangles shimmer, objects pop in scale. Audio: calm ambient, soft pops.

**77 UGC ad** — Signature: handheld selfie-creator feel — slight constant handheld shake, phone-camera framing, creator holding product, casual hook text in TikTok-native white bold with black outline, jump cuts every 1.5–2 s. Flow: 2x2 sheet of the same creator (describe identically) in 4 selfie poses with the product (hold up, point, use, smile at camera), plus product shot. Build: Ken-burns punch-in on each jump cut, shake via shake_offset low amp continuous, word-by-word captions bottom-middle, "link kat beg kuning" sticker at end. Audio: lofi/cheerful low, pop per caption.

**78 Unboxing** — Signature: top-down box opening sequence: closed box → flaps open → items lift out one by one → flat-lay reveal. Flow: 2x2 sheet: closed box top-down, open box, items inside, all items laid out (same box, same table). Build: crossfade + scale between stages, each item gets a pop label with name/feature, sparkle particles on reveal. Audio: paper/rustle (paper()), pop per item, ding at reveal.

**79 TVC sinematik** — Signature: cinematic letterbox bars (2.39:1 band inside 9:16), slow push-ins, elegant serif/thin titles fading, warm grade, end packshot with tagline. Flow: 2x2 sheet of 4 cinematic film stills (golden hour, shallow depth of field) + 1 product packshot on clean backdrop. Build: slow 1.0→1.08 zoom per shot, letterbox bars, fade-through-black cuts, light leak overlay. Audio: emotional pad (drone low + cheerful slow), riser into packshot, boom on logo.

**80 Problem → solution** — Signature: two halves of the video graded differently: problem part desaturated grey + red crosses + slow; solution part bursts into full colour + green ticks + faster pace, with a "colour wipe" transition at the pivot. Flow: 2x2: person frustrated, mess/problem object, person happy, product hero. Build: grayscale filter (ImageOps) for part 1, radial colour wipe at the pivot, tick/cross icons drawn. Audio: tense → cheerful switch at the pivot, whoosh + flash.

**81 Before & after** — Signature: draggable slider wipe — a vertical divider line with a round handle sweeps across the SAME framing, "SEBELUM" / "SELEPAS" tags. Flow: 2x2 of 2 matching before/after pairs (identical camera angle and composition, only the subject changes). Build: compose both, mask by x of handle, handle eases back and forth then completes; repeat per pair. Audio: whoosh per sweep, ding on final reveal.

**82 Macro ASMR produk** — Signature: extreme close-up textures — slow, satisfying, shallow depth of field, slow-motion pour/squeeze/slice, minimal tiny text. Flow: 2x2 macro shots of the product (texture, drop, pour, detail). Build: very slow zoom/pan 1.0→1.15, focus-pull blur, soft fades, 1–3 word captions. Audio: no music or very soft, ASMR SFX (crisp clicks, pour noise filtered).

**83 Resepi top-down** — Signature: overhead cooking (Tasty style) — ingredients drop into the bowl/pan from top, quantities pop as labels, sped-up steps, final hero dish. Flow: 2x2 top-down cooking steps (same pan/bowl, same table) + 4x4 ingredient cut-outs. Build: ingredients drop with bounce into frame, step numbers, fast-forward feel. Audio: cheerful, pop per ingredient, sizzle (filtered noise).

**84 Stop motion flatlay** — Signature: real objects on a table shot from top, moving in choppy 8–12 fps steps (hold each pose 2–3 frames), hand-made feel. Flow: 4x4 sheet of everyday objects (cut out) + 1 top-down table texture. Build: positions quantised to 8 fps, slight random rotation per step, objects slide/assemble into shapes or words. Audio: paper/knock per step, ukulele-ish cheerful.

**85 Sand art** — Signature: sand drawing on a lit glass table — warm amber light, images "brushed" in and wiped away by hand sweeps, morphing scene to scene. Flow: 2x2 sand-art images on backlit glass (same warm palette). Build: reveal with noisy brush-mask, wipe-out with directional smear mask, morph by dissolve with noise. Audio: soft sand hiss (filtered noise), calm music.

**86 Bata mainan** — Signature: everything built from toy building bricks (studs visible), characters as minifigure-like toys, brick-by-brick build-up animation. No real brand names/logos. Flow: 2x2 toy-brick dioramas + 4x4 brick character/prop sheet ("generic toy bricks, no logos"). Build: bricks drop in with bounce, stepped stop-motion moves. Audio: plastic click (short knock high), cheerful.

**87 Miniatur tilt-shift** — Signature: real scenes that look like tiny models — strong top+bottom blur band, saturated colours, sped-up motion feel. Flow: 2x2 high-angle photos of Malaysian scenes (pasar, traffic, KLCC area, kampung) "tilt-shift miniature effect". Build: apply blur bands (Gaussian on top/bottom with gradient mask), boost saturation, small elements (cars) moving fast, pans. Audio: playful music sped up, tiny pops.

**88 Ukiyo-e Jepun** — Signature: Japanese woodblock print look — flat colours, bold outlines, wave patterns, washi paper texture, vertical red seal stamps for captions. Flow: 2x2 ukiyo-e prints of the scenes + 1 washi paper texture. Build: layer parallax of print elements, captions on vertical red banners, wave pattern wipes. Audio: koto-like pluck (_pluck with pentatonic notes), calm.

**89 Wayang kulit** — Signature: Malaysian shadow puppetry — intricate leather puppets as shadows on a glowing off-white screen, flickering oil-lamp light, puppets move on rods with pivot limbs. Flow: 4x4 sheet of wayang kulit puppet silhouettes (characters, trees/gunungan, props) on plain grey. Build: puppets as dark silhouettes with soft blur halo, flicker brightness, limb rotation at joints, gunungan wipe between scenes. Audio: gamelan-like plucks (pentatonic), drum (knock).

**90 Batik** — Signature: Malaysian batik art — canting wax lines draw on first, then colour floods in the outlines, floral/leaf motifs frame the text. Flow: 2x2 batik-style illustrations (crisp outlines) + 1 batik pattern border. Code-only: procedural floral motifs with spline lines. Build: line draw-on (reveal mask along path), colour flood fill dissolve, motif borders rotating slowly. Audio: calm traditional-flavoured plucks.

**91 Pop art** — Signature: 1960s pop art — Ben-Day halftone dots, bold primaries (red/yellow/blue), thick black outlines, repeated panels of the same image in different colourways (Warhol grid). Flow: 2x2 pop-art portraits/objects. Build: halftone overlay, 2x2 colour-swap grid moments, "WOW!" explosion bursts drawn. Audio: retro surf/cheerful, slam on bursts.

**92 Collage surreal** — Signature: Monty-Python-style cut-out collage — vintage photo cut-outs with jagged edges, oversized heads, objects flying in from odd angles, surreal mash-ups. Flow: 4x4 sheet of vintage engraving/photo cut-outs (hand, eye, head, clock, bird, machine, cloud…). Build: hinge rotations at cut edges, sudden pop-ins, sky backdrop with paper texture. Audio: comedy, boing/pop.

**93 One-line art** — Signature: a single continuous black line draws every image without lifting the pen, morphing from one drawing into the next, minimal cream background, small serif captions. Code-only: draw paths as polylines and reveal progressively; morph by interpolating resampled point lists. Flow: optional 2x2 one-line drawings to trace. Audio: soft pen scribble, piano-like calm.

**94 Bauhaus geometri** — Signature: Swiss/Bauhaus graphic design — circles, squares, triangles in red/blue/yellow/black on off-white, strict grid, bold sans text, shapes snap and rotate into compositions. Code-only. Build: shapes slide on grid lines, rotate 90° snaps, text aligned to grid. Audio: minimal electronic beat (cheerful bass only), click pops.

**95 Groovy 70an** — Signature: 1970s psychedelic — wavy warped text, orange/brown/mustard/teal palette, concentric rainbow stripes, flower power, lava-lamp blobs. Code-only possible (sin warp on text rows). Flow: 1 groovy background + 4x4 retro stickers. Build: text warp waves, rotating sunburst stripes, blob morph. Audio: funky comedy music, wah-like sweeps.

**96 Kawaii pastel** — Signature: cute chibi characters with blush cheeks, pastel palette, bouncy squash-and-stretch, sparkles and hearts, rounded bubbly font. Flow: 4x4 sheet of chibi characters/props (same mascot in many poses). Build: squash/stretch scale on every entry, hearts float, soft bounce idle. Audio: cheerful pitched up, pop/boing.

**97 Stained glass** — Signature: images made of coloured glass panes with thick dark lead lines, light shining through (glow), panes light up piece by piece. Code-only: Voronoi panes (scipy) coloured from a palette/mask. Flow: 2x2 stained-glass illustrations. Build: pane-by-pane light-up, light rays sweep, glass shimmer. Audio: choir-like pad (drone high), chimes (ding).

**98 Kraf felt & kadbod** — Signature: handmade craft world — felt fabric and corrugated cardboard textures, stitched edges, googly eyes, wobbly stop-motion moves. Flow: 2x2 felt/cardboard dioramas + 4x4 felt character/prop sheet. Build: 10 fps stepped motion, slight random wobble, characters hop. Audio: cheerful ukulele-ish, soft felt thumps.

**99 Grafiti dinding** — Signature: street art — brick/concrete wall, spray-paint reveals (spray noise mask) of bold graffiti text and characters, drips, paint can rattle. Flow: 2x2 graffiti murals on walls + 1 blank wall. Build: spray reveal along path with noisy soft brush, drips grow down, camera pans along wall. Audio: spray hiss (noise), can rattle (rapid knock), hip-hop-ish beat (lofi faster).

**100 Seni Islamik geometri** — Signature: Islamic geometric art — star/rosette tessellation lines that grow from the centre, gold on deep emerald/navy, arabesque borders, calm and elegant (great for takaful / Ramadan / nilai). Code-only: generate 8-fold star patterns with rotated polygons, reveal lines progressively. Flow: optional 1 ornamental background. Build: pattern grows outward, gold shimmer sweep, text inside a mihrab-arch frame. Audio: calm pad, soft chimes; no instruments if he prefers (VO + ambience only — ask once if topic is religious).