// Render index.html to MP4 (1080x1920, 30fps) using Playwright + ffmpeg.
//   node render.mjs                 -> psai-salesmanager-9x16.mp4
//   node render.mjs --stills 1,4,7  -> PNG stills at those seconds
// Needs: playwright (npm i -g playwright) and ffmpeg (on PATH or FFMPEG=/path/to/ffmpeg)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const dir = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const stillsArg = process.argv.indexOf('--stills');

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '?render=1');
await page.evaluate(() => window.ready);
const DUR = await page.evaluate(() => window.DUR);

const grab = (t, type) => page.evaluate(([t, type]) => {
  window.renderFrame(t);
  return document.getElementById('c').toDataURL(type, 0.95).split(',')[1];
}, [t, type]);

if (stillsArg > -1) {
  for (const s of process.argv[stillsArg + 1].split(',').map(Number)) {
    const out = path.join(dir, `still-${s}.png`);
    writeFileSync(out, Buffer.from(await grab(s, 'image/png'), 'base64'));
    console.log('wrote', out);
  }
} else {
  const out = path.join(dir, 'psai-salesmanager-9x16.mp4');
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(DUR * FPS);
  for (let i = 0; i < frames; i++) {
    const buf = Buffer.from(await grab(i / FPS, 'image/jpeg'), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
