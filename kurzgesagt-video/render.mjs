// Eksport animasi index.html ke MP4 (1280x720, 30fps) bingkai demi bingkai.
// Guna: node render.mjs [halaman.html] [output.mp4]
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FPS = 30;
const dir = path.dirname(fileURLToPath(import.meta.url));
const html = process.argv[2] || 'index.html';
const out = process.argv[3] || path.join(dir, html === 'index.html' ? 'lubang-hitam.mp4' : html.replace(/\.html$/, '.mp4'));
const ffmpeg = process.env.FFMPEG ||
  execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file://' + path.join(dir, html) + '?capture');
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * FPS);
const booms = await page.evaluate(() => window.BOOMS || []);

// Bunyi latar ambien + dentuman pada saat-saat dalam window.BOOMS, disintesis oleh ffmpeg.
const audio = `aevalsrc='0.10*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.2*t))+0.07*sin(2*PI*164.8*t)+0.05*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.13*t))+0.03*sin(2*PI*329.6*t)*(0.5+0.5*sin(2*PI*0.31*t))${booms.map(b => `+if(gte(t,${b}),0.6*sin(2*PI*48*t)*exp(-(t-${b})*1.3),0)`).join('')}':s=44100:d=${duration}`;
const ff = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-f', 'lavfi', '-i', audio,
  '-af', `afade=t=in:d=1.5,afade=t=out:st=${duration - 2}:d=2`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out,
], { stdio: ['pipe', 'ignore', 'inherit'] });

for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate(t => { window.render(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, i / FPS);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) process.stdout.write(`\rbingkai ${i}/${frames}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\nSiap: ${out}`);
