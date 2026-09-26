// Render the film deterministically, frame by frame, with headless Chromium.
//   node tools/render.mjs stills 1.2 7 12.5 ...   -> out/still_<t>.png
//   node tools/render.mjs video [fps]            -> out/frames piped to ffmpeg
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/index.html?render`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.error('[pageerror]', e));
await page.goto(url);
await page.waitForFunction(() => window.filmReady === true);

const grab = async (t, fmt = 'png') => {
  const b64 = await page.evaluate(([tt, f]) => {
    window.renderAt(tt);
    return document.getElementById('c').toDataURL(f === 'png' ? 'image/png' : 'image/jpeg', 0.93).split(',')[1];
  }, [t, fmt]);
  return Buffer.from(b64, 'base64');
};

const [mode, ...args] = process.argv.slice(2);
if (mode === 'stills') {
  for (const a of args) {
    fs.writeFileSync(path.join(OUT, `still_${a}.png`), await grab(parseFloat(a)));
    console.log('still', a);
  }
} else if (mode === 'video') {
  const fps = parseInt(args[0] || '30', 10);
  const dur = await page.evaluate(() => window.MusaFilm.DURATION);
  const n = Math.round(dur * fps);
  const ff = spawn(FFMPEG, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(OUT, 'video_silent.mp4')],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < n; f++) {
    const buf = await grab(f / fps, 'jpeg');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${n}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
}
await browser.close();
server.close();
