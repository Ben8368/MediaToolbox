import sharp from 'file:///C:/Scry/node_modules/sharp/lib/index.js';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'apps/web/public/static/app/icons/default');
const sourcePath = path.join(iconsDir, 'ps-photoshop-raw.png');
const outPath = path.join(iconsDir, 'ps-photoshop.png');

const TARGET_SIZE = 224;
const BG = { r: 0, g: 30, b: 54 };

await sharp(fs.readFileSync(sourcePath))
  .trim({ threshold: 12 })
  .resize(TARGET_SIZE, TARGET_SIZE, {
    fit: 'contain',
    background: { ...BG, alpha: 1 },
  })
  .flatten({ background: BG })
  .png()
  .toFile(outPath);

console.log('Wrote', outPath, '(official Ps tile, all transparency flattened to #001E36)');
