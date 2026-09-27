// Renders index.html frame by frame to video.mp4 (silent) and writes cues.json for the audio.
// Usage: node render.mjs [--stills 0.5,2.9,...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const stillsArg = process.argv.indexOf('--stills');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
await page.evaluate(() => window.READY);
const { duration, cues } = await page.evaluate(() => ({ duration: window.DURATION, cues: window.CUES }));
writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ duration, cues }, null, 1));

if (stillsArg > 0) {
  for (const t of process.argv[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate((t) => window.seekTo(t), t);
    await page.screenshot({ path: path.join(dir, `still-${t}.png`) });
  }
} else {
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(dir, 'video_silent.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(duration * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seekTo(t), f / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${frames}`);
  }
  enc.stdin.end();
  await new Promise((r) => enc.on('close', r));
}
await browser.close();
