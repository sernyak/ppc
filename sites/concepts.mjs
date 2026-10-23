// Turns the design concepts of the canvas «Зразки сайтів ПродавAI · концепти» (claude.ai/artifact/54ho5k3nEkUQRAfhymeFbr)
// into plain pages of ppcmarketing.pro: sites/concepts/<id>/index.html, shown on /sites/.
// Each artboard is a static, responsive page (the phone artboards hold the same markup), so a page is its <helmet>
// (fonts and styles) as the head and the rest of <x-dc> as the body; the canvas's /_blob/<asset> photos point to
// sites/concepts/img/<asset>.jpg.
//
//   node sites/concepts.mjs <canvas folder with project/*.dc.html>
//
// The photos are downloaded from the canvas one by one (Artifact read with the asset id) and shrunk to 1400 px, q70.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'concepts');
const src = process.argv[2];
if (!src) throw new Error('usage: node sites/concepts.mjs <canvas folder>');

// the canvas's desktop artboards; the first one is the canvas entry, Main.dc.html
const BOARDS = {
  'velvet-a': 'Main.dc.html',
  'velvet-b': 'velvet-b.dc.html',
  'velvet-c': 'velvet-c.dc.html',
  'lumi-a': 'lumi-a.dc.html',
  'lumi-b': 'lumi-b.dc.html',
  'lumi-c': 'lumi-c.dc.html',
  'garage-a': 'garage-a.dc.html',
  'garage-b': 'garage-b.dc.html',
  'garage-c': 'garage-c.dc.html',
  'strike-a': 'strike-a.dc.html',
  'strike-b': 'strike-b.dc.html',
  'strike-c': 'strike-c.dc.html',
};

const between = (s, a, b) => {
  const i = s.indexOf(a);
  const j = s.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`no ${a}…${b}`);
  return s.slice(i + a.length, j);
};

for (const [id, file] of Object.entries(BOARDS)) {
  const dc = readFileSync(join(src, 'project', file), 'utf8');
  if (/\{\{|<sc-|<dc-import|x-import/.test(dc)) throw new Error(`${file}: has canvas logic, not a static page`);
  const title = between(dc, '<title>', '</title>');
  const xdc = between(dc, '<x-dc>', '</x-dc>');
  const head = between(xdc, '<helmet>', '</helmet>').trim();
  const body = xdc.slice(xdc.indexOf('</helmet>') + '</helmet>'.length).trim();
  const photos = (s) =>
    s.replace(/\/_blob\/([0-9a-f]{32})/g, (_, asset) => {
      if (!existsSync(join(out, 'img', `${asset}.jpg`))) throw new Error(`${file}: photo ${asset} is not downloaded`);
      return `/sites/concepts/img/${asset}.jpg`;
    });
  const html = `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} - концепт</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${photos(head)}
</head>
<body>
${photos(body)}
</body>
</html>
`;
  mkdirSync(join(out, id), { recursive: true });
  writeFileSync(join(out, id, 'index.html'), html);
  console.log(`${id}: ${title}`);
}
