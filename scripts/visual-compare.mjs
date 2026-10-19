import { readdir, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const EDGE_LUMINANCE_THRESHOLD = 12;
export const MAX_CLUSTER_PIXELS = 400;
export const MAX_THIN_CLUSTER_LENGTH = 24;
export const THIN_CLUSTER_WIDTH = 4;
export const MASK_BOX_PADDING = 2;
const SHADOW_REASON = 'same-code dialog shadow rasterization';
const SHADOW_DELTA_LIMIT = 6;
const shadowCaptures = new Set([
  'plugins-upload-choose-light-1440.png', 'plugins-upload-choose-light-390.png',
  'plugins-upload-preview-light-1440.png', 'plugins-upload-preview-light-390.png',
]);
const region = (reason, left, top, right, bottom) =>
  ({ reason, left, top, right, bottom });
const fixedExclusions = {
  'login-1440.png': [region('same-code submit label render timing', 696, 652, 744, 666)],
  'login-390.png': [region('same-code submit label render timing', 171, 632, 219, 646)],
  'products-list-390.png': [
    region('same-code bottom card radius and shadow rasterization', 32, 749, 355, 785),
  ],
};
async function elementExclusions(name, baseline, current) {
  const boxesName = name.replace(/\.png$/, '.boxes.json');
  const load = async (directory) => {
    try { return JSON.parse(await readFile(resolve(directory, boxesName), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  };
  const [before, after] = await Promise.all([load(baseline), load(current)]);
  if (before === undefined && after === undefined) return { areas: [], rings: [] };
  if (before === undefined || after === undefined) throw new Error(`Dynamic exclusion metadata exists on one side only for ${name}`);
  for (const boxes of [before, after]) {
    if (!Array.isArray(boxes) || boxes.some((item) => !item || typeof item.name !== 'string'
      || !item.box || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(item.box[key]))
      || item.box.width < 0 || item.box.height < 0)) throw new Error(`Invalid dynamic exclusion metadata for ${name}`);
    for (const item of boxes) {
      if (item.kind === undefined) {
        if (item.name === SHADOW_REASON) throw new Error(`Shadow exclusion requires ring metadata for ${name}`);
        continue;
      }
      if (item.kind !== 'shadow-ring' || item.name !== SHADOW_REASON || !shadowCaptures.has(name)
        || !item.outerBox || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(item.outerBox[key]))
        || item.outerBox.x > item.box.x || item.outerBox.y > item.box.y
        || item.outerBox.x + item.outerBox.width < item.box.x + item.box.width
        || item.outerBox.y + item.outerBox.height < item.box.y + item.box.height
        || !Number.isFinite(item.radius) || item.radius < 0
        || item.radius > Math.min(item.outerBox.width, item.outerBox.height) / 2) {
        throw new Error(`Invalid or unauthorized shadow ring for ${name}`);
      }
    }
  }
  const names = (boxes) => boxes.map((item) => item.name).sort().join('|');
  if (names(before) !== names(after)) throw new Error(`Dynamic exclusion names differ for ${name}`);
  const rectangle = box => region('', Math.floor(box.x), Math.floor(box.y),
    Math.ceil(box.x + box.width), Math.ceil(box.y + box.height));
  return {
    areas: [...before, ...after].filter(item => item.kind === undefined).map(({ name: reason, box }) => {
      const padding = reason.startsWith('mask: ') ? MASK_BOX_PADDING : 0;
      return region(reason, box.x - padding, box.y - padding,
        box.x + box.width + padding, box.y + box.height + padding);
    }),
    rings: [...before, ...after].filter(item => item.kind === 'shadow-ring').map(item => ({
      inner: rectangle(item.box), outer: rectangle(item.outerBox), radius: item.radius,
    })),
  };
}

function contains(area, x, y) {
  return x >= area.left && x < area.right && y >= area.top && y < area.bottom;
}

function inShadowRing(rings, x, y) {
  // Protect the union of both border boxes, including fractional border pixels.
  if (rings.some(ring => contains(ring.inner, x, y))) return false;
  return rings.some(({ outer, radius }) => {
    if (!contains(outer, x, y)) return false;
    const centerX = Math.max(outer.left + radius, Math.min(x + 0.5, outer.right - radius));
    const centerY = Math.max(outer.top + radius, Math.min(y + 0.5, outer.bottom - radius));
    return Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY) <= radius;
  });
}
export async function compareSets({ root = resolve('e2e/visual-results'), beforeSet = 'baseline', afterSet = 'current', log = console.log } = {}) {
  if (![beforeSet, afterSet].every((set) => ['baseline', 'current', 'noise-1', 'noise-2'].includes(set))) throw new Error('Invalid visual capture set');
  const baseline = resolve(root, beforeSet);
  const current = resolve(root, afterSet);
  const diff = resolve(root, beforeSet === 'noise-1' ? 'noise-diff' : 'diff');
  await mkdir(diff, { recursive: true });
  const results = [];
  const names = [...new Set((await Promise.all([readdir(baseline), readdir(current)])).flat())].filter((file) => file.endsWith('.png')).sort();
  for (const name of names) {
    if (name.startsWith('board-')) {
      results.push({ name, status: 'skipped', reason: 'design reference, not product UI' });
      log(`${name}: skipped (design reference, not product UI)`);
      continue;
    }
    try {
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
      const sizeMismatch = before.info.width !== after.info.width || before.info.height !== after.info.height;
      const { areas, rings } = await elementExclusions(name, baseline, current);
      const exclusions = [...(fixedExclusions[name] ?? []), ...areas];
      let maxShadowDelta = 0;
      const edgeMask = baselineEdgeMask(before.data, before.info.width, before.info.height);
      const over2 = new Uint8Array(width * height);
      const deltas = new Uint8Array(width * height);
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
            // Dimensions are checked independently of exclusions.
          } else {
            let pixelDelta = 0;
            for (let channel = 0; channel < 4; channel++) {
              pixelDelta = Math.max(pixelDelta,
                Math.abs(before.data[b + channel] - after.data[c + channel]));
            }
            maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
            deltas[y * width + x] = pixelDelta;
            const shadowPixel = inShadowRing(rings, x, y);
            if (shadowPixel) {
              maxShadowDelta = Math.max(maxShadowDelta, pixelDelta);
            } else if (edgeMask[y * before.info.width + x]) {
              if (pixelDelta > 2) over2Inside++;
            } else {
              maxOutsideEdgeDelta = Math.max(maxOutsideEdgeDelta, pixelDelta);
              if (pixelDelta > 2) over2Outside++;
            }
            if (pixelDelta > 2 && !shadowPixel) over2[y * width + x] = 1;
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
      log(`${name}: ${(changed / (width * height) * 100).toFixed(4)}% (${changed}/${width * height}), max channel delta: ${maxChannelDelta}, delta>2: ${over2Inside + over2Outside} total / ${over2Inside} inside edge / ${over2Outside} outside edge, max outside edge: ${maxOutsideEdgeDelta}, exclusions: ${[...new Set(exclusions.map((area) => area.reason))].join('; ') || 'none'}${sizeMismatch ? ' (size mismatch)' : ''}`);
      const clusters = clusterRegions(over2, width, height, edgeMask, before.info.width, deltas);
      if (rings.length) log(`${name}: ${SHADOW_REASON}, max channel delta: ${maxShadowDelta}, limit: ${SHADOW_DELTA_LIMIT}${maxShadowDelta > SHADOW_DELTA_LIMIT ? ' (failed)' : ''}`);
      for (const cluster of clusters) log(`${name}: ${cluster.accepted ? 'accepted' : 'failed'} cluster ${JSON.stringify(cluster)}`);
      if (cardDeltas) log('Dashboard cards: ' + JSON.stringify(cardDeltas));
      const status = sizeMismatch || maxShadowDelta > SHADOW_DELTA_LIMIT || clusters.some((cluster) => !cluster.accepted) ? 'failed' : changed ? 'accepted with differences' : 'identical';
      results.push({ name, status, clusters, maxChannelDelta, maxShadowDelta, changed, sizeMismatch });
    } catch (error) {
      results.push({ name, status: 'failed', reason: error.message });
      log(`${name}: failed (${error.message})`);
    }
  }
  const summary = { total: results.length, identical: 0, 'accepted with differences': 0, failed: 0, skipped: 0 };
  for (const result of results) summary[result.status]++;
  log('| Classification | Count | Reason |');
  log('| --- | ---: | --- |');
  for (const [status, count] of Object.entries(summary)) log(`| ${status} | ${count} | ${status === 'skipped' ? 'design reference, not product UI' : ''} |`);
  return { results, summary };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { summary } = await compareSets({ beforeSet: process.argv[2] ?? 'baseline', afterSet: process.argv[3] ?? 'current' });
    if (summary.failed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
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

function clusterRegions(pixels, width, height, edgeMask, baselineWidth, deltas) {
  const regions = [];
  const visited = new Uint8Array(pixels.length);
  for (let start = 0; start < pixels.length; start++) {
    if (!pixels[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    const box = { left: start % width, top: Math.floor(start / width),
      right: start % width, bottom: Math.floor(start / width), pixels: 0, maxDelta: 0, outsideEdge: false };
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head];
      const x = index % width;
      const y = Math.floor(index / width);
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
      box.pixels++;
      box.maxDelta = Math.max(box.maxDelta, deltas[index]);
      if (!edgeMask[y * baselineWidth + x]) box.outsideEdge = true;
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
    const boxWidth = box.right - box.left + 1;
    const boxHeight = box.bottom - box.top + 1;
    box.accepted = !box.outsideEdge && box.pixels <= MAX_CLUSTER_PIXELS
      && !((boxWidth > MAX_THIN_CLUSTER_LENGTH && boxHeight < THIN_CLUSTER_WIDTH)
        || (boxHeight > MAX_THIN_CLUSTER_LENGTH && boxWidth < THIN_CLUSTER_WIDTH));
    regions.push(box);
  }
  return regions;
}
