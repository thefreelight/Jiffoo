import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { compareSets } from './visual-compare.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'jiffoo-visual-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(['baseline', 'current'].map(set => mkdir(join(root, set))));
  const width = 128, height = 48;
  const before = Buffer.alloc(width * height * 4, 255);
  const after = Buffer.from(before);
  const paint = (data, x, y, w, h, value) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const offset = (row * width + col) * 4;
      data.fill(value, offset, offset + 3);
    }
  };
  const run = async ({ name = 'product.png', boxes, metadata, afterMetadata = metadata, afterWidth = width } = {}) => {
    await sharp(before, { raw: { width, height, channels: 4 } }).png().toFile(join(root, 'baseline', name));
    let image = sharp(after, { raw: { width, height, channels: 4 } });
    if (afterWidth !== width) image = image.resize(afterWidth, height);
    await image.png().toFile(join(root, 'current', name));
    if (boxes) await writeFile(join(root, 'baseline', name.replace('.png', '.boxes.json')), '[]');
    if (metadata) for (const set of ['baseline', 'current']) {
      await writeFile(join(root, set, name.replace('.png', '.boxes.json')), JSON.stringify(set === 'baseline' ? metadata : afterMetadata));
    }
    const logs = [];
    const result = await compareSets({ root, log: line => logs.push(line) });
    return { ...result, logs };
  };
  return { before, after, paint, run };
}

test('identical PNGs without metadata pass', async t => {
  const { run } = await fixture(t);
  const { summary } = await run();
  assert.equal(summary.identical, 1);
  assert.equal(summary.failed, 0);
});

test('one-sided metadata fails and comparison continues to the next pair', async t => {
  const { run } = await fixture(t);
  await run({ name: 'a.png', boxes: true });
  const { results, summary } = await run({ name: 'z.png' });
  assert.equal(summary.failed, 1);
  assert.equal(summary.identical, 1);
  assert.match(results[0].reason, /one side only/);
});

test('a one-level change everywhere is accepted', async t => {
  const { after, paint, run } = await fixture(t);
  paint(after, 0, 0, 128, 48, 254);
  const { summary } = await run();
  assert.equal(summary['accepted with differences'], 1);
  assert.equal(summary.failed, 0);
});

test('a 20x20 flat-fill change above two levels fails', async t => {
  const { after, paint, run } = await fixture(t);
  paint(after, 20, 12, 20, 20, 252);
  const { summary, results } = await run();
  assert.equal(summary.failed, 1);
  assert.equal(results[0].clusters[0].outsideEdge, true);
});

test('a recoloured 100px border inside the edge mask fails', async t => {
  const { before, after, paint, run } = await fixture(t);
  paint(before, 10, 10, 100, 1, 100);
  paint(after, 10, 10, 100, 1, 108);
  const { summary, results } = await run();
  assert.equal(summary.failed, 1);
  assert.equal(results[0].clusters[0].outsideEdge, false);
  assert.equal(results[0].clusters[0].pixels, 100);
});

test('an eight-level corner antialiasing cluster passes and is reported', async t => {
  const { before, after, paint, run } = await fixture(t);
  paint(before, 10, 10, 20, 20, 100);
  before.copy(after);
  paint(after, 9, 9, 2, 2, 247);
  // Keep the dark corner's delta at eight as well.
  paint(after, 10, 10, 1, 1, 108);
  const { summary, results, logs } = await run();
  assert.equal(summary.failed, 0);
  assert.equal(summary['accepted with differences'], 1);
  assert.equal(results[0].clusters[0].maxDelta, 8);
  assert.ok(logs.some(line => /accepted cluster.*"left":9.*"maxDelta":8/.test(line)));
});

test('size mismatch fails', async t => {
  const { run } = await fixture(t);
  const { summary, results } = await run({ afterWidth: 127 });
  assert.equal(summary.failed, 1);
  assert.equal(results[0].sizeMismatch, true);
});

test('board reference PNGs are skipped with their reason', async t => {
  const { run } = await fixture(t);
  const { summary, results } = await run({ name: 'board-example.png', boxes: true, afterWidth: 127 });
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 0);
  assert.equal(results[0].reason, 'design reference, not product UI');
});

const shadowMetadata = [{
  name: 'same-code dialog shadow rasterization', kind: 'shadow-ring',
  box: { x: 40, y: 12, width: 40, height: 24 },
  outerBox: { x: 32, y: 4, width: 56, height: 40 }, radius: 0,
}];

for (const scenario of [
  { label: 'three-level ring difference passes', x: 39, value: 252, failed: 0 },
  { label: 'three-level difference one pixel inside the dialog fails', x: 41, value: 252, failed: 1 },
  { label: 'ten-level ring difference fails', x: 39, value: 245, failed: 1 },
]) {
  test(scenario.label, async t => {
    const { after, paint, run } = await fixture(t);
    paint(after, scenario.x, 22, 1, 1, scenario.value);
    const { summary, results, logs } = await run({ name: 'plugins-upload-choose-light-1440.png', metadata: shadowMetadata });
    assert.equal(summary.failed, scenario.failed);
    assert.equal(results[0].maxShadowDelta, scenario.x < 40 ? 255 - scenario.value : 0);
    assert.ok(logs.some(line => /same-code dialog shadow rasterization, max channel delta:/.test(line)));
  });
}

test('dialog shadow metadata cannot exempt another capture family', async t => {
  const { after, paint, run } = await fixture(t);
  paint(after, 39, 22, 1, 1, 252);
  const { summary, results } = await run({ name: 'plugins-installed-light-1440.png', metadata: shadowMetadata });
  assert.equal(summary.failed, 1);
  assert.match(results[0].reason, /unauthorized shadow ring/);
});

const maskBefore = [{ name: 'mask: store time 1', box: { x: 40, y: 12, width: 10, height: 24 } }];
const maskAfter = [{ name: 'mask: store time 1', box: { x: 40, y: 12, width: 12, height: 24 } }];

test('different mask widths and a shifted edge pass within the padded union', async t => {
  const { before, after, paint, run } = await fixture(t);
  paint(before, 40, 12, 10, 24, 0);
  paint(after, 40, 12, 12, 24, 0);
  paint(after, 53, 22, 1, 1, 252);
  const { summary } = await run({ metadata: maskBefore, afterMetadata: maskAfter });
  assert.equal(summary.failed, 0);
  assert.equal(summary.identical, 1);
});

test('a difference three pixels outside the padded mask union fails', async t => {
  const { before, after, paint, run } = await fixture(t);
  paint(before, 40, 12, 10, 24, 0);
  paint(after, 40, 12, 12, 24, 0);
  paint(after, 53, 22, 1, 1, 252);
  paint(after, 57, 22, 1, 1, 252);
  const { summary, results } = await run({ metadata: maskBefore, afterMetadata: maskAfter });
  assert.equal(summary.failed, 1);
  assert.equal(results[0].clusters[0].outsideEdge, true);
  assert.equal(results[0].clusters[0].left, 57);
});

test('a missing or extra masked element fails name-set validation', async t => {
  const { run } = await fixture(t);
  const { summary, results } = await run({
    metadata: maskBefore,
    afterMetadata: [...maskAfter, { name: 'mask: store time 2', box: { x: 80, y: 12, width: 10, height: 24 } }],
  });
  assert.equal(summary.failed, 1);
  assert.match(results[0].reason, /names differ/);
});
