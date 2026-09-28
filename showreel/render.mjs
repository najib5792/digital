// Renders index.html frame-by-frame through window.seek(t) and pipes to ffmpeg.
//   node render.mjs                 -> showreel.mp4 (muxes soundtrack.wav if present)
//                                      via a CRF-18 master, then a 2-pass ~9 Mbps delivery encode
//   node render.mjs --stills 2,4.5  -> PNG stills in ./stills for quick review
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
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
const out = path.join(dir, 'showreel.mp4');
const master = path.join(dir, 'showreel-master.mp4');

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '?capture=1', { waitUntil: 'networkidle' });
await page.evaluate(async () => { await Promise.all([...document.fonts].map(f => f.load())); await document.fonts.ready; });
const { DUR, FPS } = await page.evaluate(() => ({ DUR: window.DUR, FPS: window.FPS }));

if (stillsArg) {
  mkdirSync(path.join(dir, 'stills'), { recursive: true });
  for (const t of stillsArg.split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: path.join(dir, 'stills', `t${t.toFixed(2)}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const audio = path.join(dir, 'soundtrack.wav');
const ff = spawn(FFMPEG, [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  ...(existsSync(audio) ? ['-i', audio, '-c:a', 'aac', '-b:a', '192k'] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-movflags', '+faststart', '-shortest', master,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(DUR * FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.seek(t), f / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 60 === 0) process.stderr.write(`frame ${f}/${total}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();

// film grain makes the CRF master huge; squeeze it to a shareable size
const run = a => new Promise((res, rej) => spawn(FFMPEG, a, { stdio: 'inherit', cwd: dir }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
const v = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '9M', '-maxrate', '14M', '-bufsize', '20M', '-pix_fmt', 'yuv420p'];
await run(['-y', '-loglevel', 'error', '-i', master, ...v, '-pass', '1', '-an', '-f', 'mp4', '/dev/null']);
await run(['-y', '-loglevel', 'error', '-i', master, ...v, '-pass', '2', '-c:a', 'copy', '-movflags', '+faststart', out]);
console.log('wrote', out);
