import { readdir, mkdir, readFile } from 'node:fs/promises';
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
const EDGE_LUMINANCE_THRESHOLD = 12;
const region = (reason, left, top, right, bottom) =>
  ({ reason, left, top, right, bottom });
const fixedExclusions = {
  'login-1440.png': [region('same-code submit label render timing', 696, 652, 744, 666)],
  'login-390.png': [region('same-code submit label render timing', 171, 632, 219, 646)],
  'products-list-390.png': [
    region('same-code bottom card radius and shadow rasterization', 32, 749, 355, 785),
  ],
};
async function elementExclusions(name) {
  const boxesName = name.replace(/\.png$/, '.boxes.json');
  const before = JSON.parse(await readFile(resolve(baseline, boxesName), 'utf8'));
  const after = JSON.parse(await readFile(resolve(current, boxesName), 'utf8'));
  const names = (boxes) => boxes.map((item) => item.name).sort().join('|');
  if (names(before) !== names(after)) throw new Error(`Dynamic exclusion names differ for ${name}`);
  return [...before, ...after].map(({ name: reason, box }) =>
    region(reason, box.x, box.y, box.x + box.width, box.y + box.height));
}
await mkdir(diff, { recursive: true });
let violations = 0;
for (const name of (await readdir(baseline)).filter((file) => file.endsWith('.png')).sort()) {
  const before = await sharp(resolve(baseline, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(resolve(current, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = Math.max(before.info.width, after.info.width);
  const height = Math.max(before.info.height, after.info.height);
  const pixels = Buffer.alloc(width * height * 4);
  let changed = 0;
  let maxChannelDelta = 0;
  let maxOutsideEdgeDelta = 0;
  let over2Inside = 0;
  let over2Outside = 0;
  let sizeMismatch = false;
  const exclusions = [...(fixedExclusions[name] ?? []), ...await elementExclusions(name)];
  const edgeMask = baselineEdgeMask(before.data, before.info.width, before.info.height);
  const over2 = new Uint8Array(width * height);
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
        if (edgeMask[y * before.info.width + x]) {
          if (pixelDelta > 2) over2Inside++;
        } else {
          maxOutsideEdgeDelta = Math.max(maxOutsideEdgeDelta, pixelDelta);
          if (pixelDelta > 2) over2Outside++;
        }
        if (pixelDelta > 2) over2[y * width + x] = 1;
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
  console.log(`${name}: ${(changed / (width * height) * 100).toFixed(4)}% (${changed}/${width * height}), max channel delta: ${maxChannelDelta}, delta>2: ${over2Inside + over2Outside} total / ${over2Inside} inside edge / ${over2Outside} outside edge, max outside edge: ${maxOutsideEdgeDelta}, exclusions: ${[...new Set(exclusions.map((area) => area.reason))].join('; ') || 'none'}${sizeMismatch ? ' (size mismatch)' : ''}`);
  if (over2Inside + over2Outside) {
    console.log('Over-limit regions:', JSON.stringify(clusterRegions(over2, width, height)));
  }
  if (cardDeltas) console.log('Dashboard cards:', JSON.stringify(cardDeltas));
  if (sizeMismatch || maxChannelDelta > 2) violations++;
}
if (violations) {
  console.error(`${violations} visual capture(s) exceed the channel delta limit of 2 outside named exclusions.`);
  process.exitCode = 1;
}

function pixelsDiffer(a, i, b, j) {
  return a[i] !== b[j] || a[i + 1] !== b[j + 1] || a[i + 2] !== b[j + 2] || a[i + 3] !== b[j + 3];
}

function baselineEdgeMask(data, width, height) {
  const luminance = new Float32Array(width * height);
  const edges = new Uint8Array(width * height);
  const dilated = new Uint8Array(width * height);
  for (let i = 0; i < luminance.length; i++) {
    const offset = i * 4;
    luminance[i] = 0.2126 * data[offset] + 0.7152 * data[offset + 1] +
      0.0722 * data[offset + 2];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      for (let dy = -1; dy <= 1 && !edges[index]; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (Math.abs(luminance[index] - luminance[ny * width + nx]) >
            EDGE_LUMINANCE_THRESHOLD) {
            edges[index] = 1;
            break;
          }
        }
      }
      if (edges[index]) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
              dilated[(y + dy) * width + x + dx] = 1;
            }
          }
        }
      }
    }
  }
  return dilated;
}

function clusterRegions(pixels, width, height) {
  const regions = [];
  const visited = new Uint8Array(pixels.length);
  for (let start = 0; start < pixels.length; start++) {
    if (!pixels[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    const box = { left: start % width, top: Math.floor(start / width),
      right: start % width, bottom: Math.floor(start / width), pixels: 0 };
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head];
      const x = index % width;
      const y = Math.floor(index / width);
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
      box.pixels++;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (pixels[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    regions.push(box);
  }
  return regions;
}
