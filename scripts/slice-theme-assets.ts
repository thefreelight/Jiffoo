/**
 * Slice design sources into shop theme image assets (WebP).
 *
 * Sources:
 *   docs/design/product-sheet.png      4x2 grid of HD product photos —
 *                                      categories & product cards come from here.
 *   docs/design/shop-home-default.png  full-page mockup (1024x1536) — hero-glass,
 *                                      lifestyle-banner.
 *   docs/design/shop-home-serene.png   full-page mockup (917x1716) — hero-vase.
 *
 * Output: apps/shop/public/theme-assets/default/*.webp
 *
 * Product-sheet cells are on a 384x512 grid with ~20px white gutters; boxes
 * inset past the gutters. Mockup crops avoid the UI baked into the designs
 * (copy, play button, floating delivery card) since the themes render those
 * in HTML.
 *
 * NOTE: the deployed hero/banner assets were additionally super-resolved 4x
 * with realesrgan-ncnn-vulkan (realesrgan-x4plus) before WebP encoding,
 * because the mockups are low-res. Pass --mockups to re-slice them here
 * (Lanczos 2x only) and repeat the ESRGAN step for equal quality.
 *
 * Run from repo root: pnpm tsx scripts/slice-theme-assets.ts [--mockups]
 */
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '..');
const SHEET = path.join(ROOT, 'docs/design/product-sheet.png');
const D4 = path.join(ROOT, 'docs/design/shop-home-default.png');
const D5 = path.join(ROOT, 'docs/design/shop-home-serene.png');
const OUT = path.join(ROOT, 'apps/shop/public/theme-assets/default');

type Box = [left: number, top: number, width: number, height: number];

// Product sheet: cell (col 0-3, row 0-1) → inset crop box past the gutters.
function cell(col: number, row: number): Box {
  const left = col * 384 + (col === 0 ? 4 : 14);
  const right = (col + 1) * 384 - (col === 3 ? 4 : 14);
  const top = row * 512 + (row === 0 ? 4 : 14);
  const bottom = (row + 1) * 512 - (row === 1 ? 4 : 14);
  return [left, top, right - left, bottom - top];
}

const sheetSlices: Array<{ name: string; box: Box }> = [
  { name: 'category-home-living', box: cell(0, 0) }, // glass vase with branch
  { name: 'category-bags', box: cell(1, 0) }, // handbag
  { name: 'category-watches', box: cell(2, 0) }, // watch on strap
  { name: 'product-watch', box: cell(2, 0) }, // same photo serves the product card
  { name: 'product-candle', box: cell(3, 0) }, // scented candle
  { name: 'product-headphones', box: cell(0, 1) }, // spare — not referenced yet
  { name: 'product-vase', box: cell(1, 1) }, // matte vase
  { name: 'product-cardholder', box: cell(2, 1) }, // cardholder
  { name: 'category-lifestyle', box: cell(3, 1) }, // notebook & pen
  { name: 'product-notebook', box: cell(3, 1) }, // spare — not referenced yet
];

const mockupSlices: Array<{ src: string; name: string; box: Box; cap: number }> = [
  { src: D4, name: 'hero-glass', box: [570, 55, 450, 400], cap: 1400 },
  { src: D5, name: 'hero-vase', box: [445, 65, 295, 510], cap: 900 },
  { src: D4, name: 'lifestyle-banner', box: [412, 1216, 528, 120], cap: 1800 },
];

async function run() {
  for (const { name, box } of sheetSlices) {
    const [left, top, width, height] = box;
    await sharp(SHEET)
      .extract({ left, top, width, height })
      .webp({ quality: 88 })
      .toFile(path.join(OUT, `${name}.webp`));
    console.log(`${name}.webp  ${width}x${height}  (sheet @ ${box.join(',')})`);
  }

  if (process.argv.includes('--mockups')) {
    for (const { src, name, box, cap } of mockupSlices) {
      const [left, top, width, height] = box;
      const scale = Math.min(2, cap / width);
      await sharp(src)
        .extract({ left, top, width, height })
        .resize(Math.round(width * scale), Math.round(height * scale), { kernel: 'lanczos3' })
        .webp({ quality: 88 })
        .toFile(path.join(OUT, `${name}.webp`));
      console.log(`${name}.webp  (mockup @ ${box.join(',')}, needs ESRGAN pass — see note)`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
