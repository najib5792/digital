// Renders index.html frame-by-frame through window.seek(t), synthesizes the soundtrack from the
// page's own sound cues, and muxes both into an MP4.
//   node render.mjs                  -> app-showcase.mp4
//   node render.mjs --stills 1.5,9   -> PNG stills in ./stills for quick review
import { createRequire } from 'module';
import { spawn, execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright'))); }

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '?capture=1', { waitUntil: 'networkidle' });
const cfg = await page.evaluate(async () => {
  await Promise.all([...document.fonts].map(f => f.load())); await document.fonts.ready;
  return { W, H, FPS, DUR, BPM, CUES, OUT };
});
await page.setViewportSize({ width: cfg.W, height: cfg.H });

if (stillsArg) {
  mkdirSync(path.join(dir, 'stills'), { recursive: true });
  for (const t of stillsArg.split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: path.join(dir, 'stills', `t${t.toFixed(2)}.png`) });
  }
  await browser.close();
  process.exit(0);
}

writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ dur: cfg.DUR, bpm: cfg.BPM, cues: cfg.CUES }, null, 1));
execFileSync('python3', ['soundtrack.py'], { cwd: dir, stdio: 'inherit' });

const ff = spawn(FFMPEG, [
  '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(cfg.FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', path.join(dir, 'soundtrack.wav'), '-c:a', 'aac', '-b:a', '192k',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-t', String(cfg.DUR), '-movflags', '+faststart', path.join(dir, cfg.OUT),
], { stdio: ['pipe', 'inherit', 'inherit'] });
const total = Math.round(cfg.DUR * cfg.FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.seek(t), f / cfg.FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 300 === 0) process.stderr.write(`frame ${f}/${total}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('wrote', cfg.OUT);
