// Bundles src/ (three.js included) into one self-contained index.html.
//   npm install && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const body = readFileSync(join(here, 'src/template.html'), 'utf8').replace('/*__BUNDLE__*/', () => js);

// Full standalone document for the repo / any static host
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${body.split('<canvas id="scene"')[0]}</head>
<body>
<canvas id="scene"${body.split('<canvas id="scene"')[1]}</body>
</html>
`;
writeFileSync(join(here, 'index.html'), doc);

// Optional fragment (no <html>/<head>/<body>) for hosts that wrap the page themselves
if (process.argv[2]) {
  mkdirSync(dirname(process.argv[2]), { recursive: true });
  writeFileSync(process.argv[2], body);
}
console.log(`index.html: ${(doc.length / 1024).toFixed(0)} KB`);
