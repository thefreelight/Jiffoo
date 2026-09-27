import { readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve('e2e/visual-results');
const beforeSet = process.argv[2] ?? 'baseline';
const afterSet = process.argv[3] ?? 'current';
if (!['baseline', 'current', 'noise-1', 'noise-2'].includes(beforeSet)
  || !['baseline', 'current', 'noise-1', 'noise-2'].includes(afterSet)) {
  throw new Error('Invalid visual capture set');
}
const baseline = resolve(root, beforeSet);
const current = resolve(root, afterSet);
const diff = resolve(root, beforeSet === 'noise-1' ? 'noise-diff' : 'diff');
const region = (reason, left, top, right, bottom) =>
  ({ reason, left, top, right, bottom });
const dynamicExclusions = {
  'login-1440.png': [region('initial form hydration changes submit disabled state', 525, 635, 916, 689)],
  'login-390.png': [region('initial form hydration changes submit disabled state', 48, 615, 342, 665)],
  'dashboard-1440.png': [0, 1, 2, 3].flatMap((row) => [
    region(`recent order ${row + 1} generated ID`, 285, 605 + row * 53, 352, 630 + row * 53),
    region(`recent order ${row + 1} created time`, 758, 605 + row * 53, 798, 630 + row * 53),
  ]),
  'customers-list-1440.png': [
    region('first customer generated ID', 340, 801, 425, 821),
    region('second customer generated ID', 340, 884, 425, 904),
  ],
  'customer-detail-1440.png': [region('customer generated ID', 370, 38, 430, 56)],
  'customer-detail-390.png': [
    region('customer generated ID', 60, 75, 140, 94),
    region('generated ID shifts compact profile heading', 60, 15, 143, 87),
    region('generated ID shifts reset-link button', 143, 32, 294, 87),
    region('generated ID shifts edit button', 294, 32, 390, 87),
  ],
  'products-list-390.png': [
    region('unstable card shadow at bottom rounded edge between identical captures', 32, 748, 358, 787),
  ],
  'order-detail-1440.png': [
    region('order generated ID in heading', 480, 47, 660, 64),
    region('order item generated reference', 490, 264, 635, 291),
    region('customer generated internal ID', 1110, 303, 1240, 322),
    region('order activity created time', 1245, 886, 1360, 905),
  ],
  'order-detail-390.png': [
    region('order generated ID in heading', 58, 49, 255, 65),
    region('generated ID shifts compact order heading', 58, 15, 205, 48),
    region('order item generated reference', 188, 245, 283, 305),
  ],
  'health-1440.png': [region('API uptime seconds', 1323, 135, 1415, 155)],
  'health-390.png': [region('API uptime seconds', 275, 135, 365, 155)],
  'notifications-1440.png': [
    region('created-time width shifts table headings', 555, 94, 1010, 122),
    region('created-time width shifts status heading', 1158, 94, 1222, 122),
    ...Array.from({ length: 15 }, (_, row) => [
      region(`notification ${row + 1} created time`, 266, 145 + row * 53, 440, 173 + row * 53),
      region(`notification ${row + 1} time-driven type offset`, 559, 145 + row * 53, 710, 173 + row * 53),
      region(`notification ${row + 1} time-driven recipient offset`, 810, 145 + row * 53, 1030, 173 + row * 53),
      region(`notification ${row + 1} time-driven status offset`, 1160, 145 + row * 53, 1220, 173 + row * 53),
    ]).flat(),
  ],
  'notifications-390.png': Array.from({ length: 8 }, (_, row) =>
    region(`notification ${row + 1} created time`, 36, 210 + row * 93, 115, 235 + row * 93)),
};
await mkdir(diff, { recursive: true });
for (const name of (await readdir(baseline)).filter((file) => file.endsWith('.png')).sort()) {
  const before = await sharp(resolve(baseline, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(resolve(current, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = Math.max(before.info.width, after.info.width);
  const height = Math.max(before.info.height, after.info.height);
  const pixels = Buffer.alloc(width * height * 4);
  let changed = 0;
  let maxChannelDelta = 0;
  let sizeMismatch = false;
  const exclusions = dynamicExclusions[name] ?? [];
  const cardDeltas = name === 'dashboard-1440.png'
    ? [0, 1, 2, 3].map(() => ({ delta1: 0, delta2: 0, max: 0 })) : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = (y * width + x) * 4;
      const b = (y * before.info.width + x) * 4;
      const c = (y * after.info.width + x) * 4;
      if (exclusions.some((area) => x >= area.left && x < area.right &&
          y >= area.top && y < area.bottom)) continue;
      const different = x >= before.info.width || y >= before.info.height ||
        x >= after.info.width || y >= after.info.height ||
        pixelsDiffer(before.data, b, after.data, c);
      if (x >= before.info.width || y >= before.info.height ||
          x >= after.info.width || y >= after.info.height) {
        sizeMismatch = true;
      } else {
        let pixelDelta = 0;
        for (let channel = 0; channel < 4; channel++) {
          pixelDelta = Math.max(pixelDelta,
            Math.abs(before.data[b + channel] - after.data[c + channel]));
        }
        maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
        if (cardDeltas && y >= 97 && y < 471) {
          const card = [[254, 527], [550, 824], [847, 1120], [1143, 1417]]
            .findIndex(([left, right]) => x >= left && x < right);
          if (card !== -1) {
            cardDeltas[card].delta1 += pixelDelta === 1 ? 1 : 0;
            cardDeltas[card].delta2 += pixelDelta === 2 ? 1 : 0;
            cardDeltas[card].max = Math.max(cardDeltas[card].max, pixelDelta);
          }
        }
      }
      if (different) {
        changed++;
        pixels[a] = 255;
        pixels[a + 3] = 255;
      }
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toFile(resolve(diff, name));
  console.log(`${name}: ${(changed / (width * height) * 100).toFixed(4)}% (${changed}/${width * height}), max channel delta: ${maxChannelDelta}, exclusions: ${exclusions.map((area) => area.reason).join('; ') || 'none'}${sizeMismatch ? ' (size mismatch)' : ''}`);
  if (cardDeltas) console.log('Dashboard cards:', JSON.stringify(cardDeltas));
}

function pixelsDiffer(a, i, b, j) {
  return a[i] !== b[j] || a[i + 1] !== b[j + 1] || a[i + 2] !== b[j + 2] || a[i + 3] !== b[j + 3];
}
