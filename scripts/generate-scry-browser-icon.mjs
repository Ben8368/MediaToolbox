import sharp from 'file:///C:/Scry/node_modules/sharp/lib/index.js';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'apps/web/public/static/app/icons/default');
const svgPath = path.join(iconsDir, 'scry-browser.svg');
const maskPath = path.join(iconsDir, 'download-center.png');
const outPath = path.join(iconsDir, 'scry-browser.png');

const eye = await sharp(fs.readFileSync(svgPath)).png().toBuffer();
const refMeta = await sharp(maskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const eyeMeta = await sharp(eye).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const { width, height } = refMeta.info;
const outRGBA = Buffer.alloc(width * height * 4);

for (let i = 0; i < width * height; i++) {
  const o = i * 4;
  outRGBA[o] = eyeMeta.data[o];
  outRGBA[o + 1] = eyeMeta.data[o + 1];
  outRGBA[o + 2] = eyeMeta.data[o + 2];
  outRGBA[o + 3] = refMeta.data[o + 3];
}

await sharp(outRGBA, { raw: { width, height, channels: 4 } }).png().toFile(outPath);
console.log('Wrote', outPath);
