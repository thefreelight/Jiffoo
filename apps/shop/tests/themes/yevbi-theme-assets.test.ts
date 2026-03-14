import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getFirstImageUrl,
  YEVBI_CTA_VISUAL,
  YEVBI_HERO_VISUAL,
  YEVBI_PRODUCT_FALLBACK_VISUAL,
  YEVBI_SEARCH_FALLBACK_VISUAL,
  YEVBI_TESTIMONIAL_AVATARS,
} from '@shop-themes/yevbi/src/lib/theme-assets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yevbiHomePagePath = path.resolve(
  __dirname,
  '../../../../packages/shop-themes/yevbi/src/app/[locale]/page.tsx',
);
const yevbiSearchPagePath = path.resolve(
  __dirname,
  '../../../../packages/shop-themes/yevbi/src/app/[locale]/search/page.tsx',
);
const yevbiProductDetailPath = path.resolve(
  __dirname,
  '../../../../packages/shop-themes/yevbi/src/app/[locale]/products/[id]/page.tsx',
);

describe('Yevbi theme asset delivery', () => {
  it('ships local inline visuals for storefront hero and fallback imagery', () => {
    expect(YEVBI_HERO_VISUAL.startsWith('data:image/svg+xml')).toBe(true);
    expect(YEVBI_CTA_VISUAL.startsWith('data:image/svg+xml')).toBe(true);
    expect(YEVBI_PRODUCT_FALLBACK_VISUAL.startsWith('data:image/svg+xml')).toBe(true);
    expect(YEVBI_SEARCH_FALLBACK_VISUAL.startsWith('data:image/svg+xml')).toBe(true);
    expect(YEVBI_TESTIMONIAL_AVATARS.sarah.startsWith('data:image/svg+xml')).toBe(true);
    expect(YEVBI_TESTIMONIAL_AVATARS.michael.startsWith('data:image/svg+xml')).toBe(true);
    expect(YEVBI_TESTIMONIAL_AVATARS.alicia.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('resolves product images from both string and object image shapes', () => {
    expect(getFirstImageUrl(['https://cdn.example.com/plan.jpg'], YEVBI_PRODUCT_FALLBACK_VISUAL)).toBe(
      'https://cdn.example.com/plan.jpg',
    );
    expect(getFirstImageUrl([{ url: 'https://cdn.example.com/object.jpg' }], YEVBI_PRODUCT_FALLBACK_VISUAL)).toBe(
      'https://cdn.example.com/object.jpg',
    );
    expect(getFirstImageUrl([{ src: 'https://cdn.example.com/src.jpg' }], YEVBI_PRODUCT_FALLBACK_VISUAL)).toBe(
      'https://cdn.example.com/src.jpg',
    );
    expect(getFirstImageUrl([], YEVBI_PRODUCT_FALLBACK_VISUAL)).toBe(YEVBI_PRODUCT_FALLBACK_VISUAL);
  });

  it('does not hardcode remote image hosts in primary storefront surfaces', () => {
    const combinedSource = [
      readFileSync(yevbiHomePagePath, 'utf8'),
      readFileSync(yevbiSearchPagePath, 'utf8'),
      readFileSync(yevbiProductDetailPath, 'utf8'),
    ].join('\n');

    expect(combinedSource).not.toContain('images.unsplash.com');
    expect(combinedSource).not.toContain('randomuser.me');
  });
});
