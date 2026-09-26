// Generate the Malay voice-over with @revolab/revolab-edge (on-device TTS).
//   npm pack @revolab/revolab-edge && tar xzf revolab-edge-*.tgz
//   REVOLAB_EDGE_DIR=./package node tools/make_narration.mjs
// Writes narration/NN.wav (22.05 kHz mono), one file per scene line.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = path.resolve(process.env.REVOLAB_EDGE_DIR || 'package');
const VOICE = process.env.VOICE || 'paan';
// paan speaks quickly; slow it to an unhurried storytelling pace
const LENGTH_SCALE = [1.45, 1.45, 1.45, 1.45, 1.45, 1.45, 1.45, 1.45, 1.45, 1.45, 1.45, 1.35];

const server = http.createServer((req, res) => fs.readFile(path.join(PKG, req.url.split('?')[0]), (err, data) => {
  if (err) { res.writeHead(404); res.end(); } else res.end(data);
}));
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

globalThis.window = globalThis;
await import(path.join(ROOT, 'film.js'));
const lines = globalThis.MusaFilm.SCENES.map((s) => s.text);
const { RevolabEdge } = await import(path.join(PKG, 'revovoice.js'));
const tts = await RevolabEdge.load({ assetBase: base });

function wav(samples, sr) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  return b;
}

fs.mkdirSync(path.join(ROOT, 'narration'), { recursive: true });
for (let i = 0; i < lines.length; i++) {
  const r = await tts.synthesize(lines[i], { voice: VOICE, voiceBase: base, lengthScale: LENGTH_SCALE[i], quantized: false });
  const f = path.join(ROOT, 'narration', String(i + 1).padStart(2, '0') + '.wav');
  fs.writeFileSync(f, wav(r.samples, r.sampleRate));
  console.log(path.basename(f), (r.samples.length / r.sampleRate).toFixed(2) + 's', lines[i]);
}
server.close();
