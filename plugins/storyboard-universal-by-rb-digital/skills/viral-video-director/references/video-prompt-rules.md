# AI video prompt rules

Generate one production-ready prompt document based only on the approved storyboard. Include the selected style, character lock, product lock, camera language, environment, lighting, detailed visuals, scene progression, actions, spoken dialogue, emotions, sound direction, and transitions.

Split the production plan into consecutive blocks of no more than 10 seconds because common generation tools render a maximum of about 10 seconds per clip. A 30-second storyboard therefore becomes three clearly labeled 10-second prompt blocks. Each block must stand alone while preserving the same continuity lock.

Use Markdown headings and readable paragraphs. Make temporal progression explicit. Do not add new claims, characters, wardrobe, packaging details, or story events that contradict the approved storyboard.

End exactly with:

```text
Pilih satu:

1. 🖼️ Generate Gambar Storyboard
2. ✏️ Ubah Dulu

Reply je: 1 atau 2
```

Then stop and wait.
