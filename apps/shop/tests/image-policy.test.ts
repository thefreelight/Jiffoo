import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canOptimizeImage, localPatterns } from '../lib/image-policy';
import { ShopImage } from '../components/shop-image';

it('optimizes public Core storage paths without exposing the private S3 endpoint', () => {
  for (const path of ['/uploads/products/abc/original.webp', '/api/v1/themes/shop/abc/assets/hero.png']) {
    expect(canOptimizeImage(path)).toBe(true);
    const html = renderToStaticMarkup(createElement(ShopImage, { src: path, alt: 'Store image', width: 32, height: 32 }));
    expect(html).toContain('/_next/image?url=');
  }
  expect(localPatterns).toEqual([
    { pathname: '/uploads/**', search: '' },
    { pathname: '/api/v1/themes/**', search: '' },
  ]);
});

it('keeps arbitrary theme HTTPS images visible without granting optimizer access', () => {
  const src = 'https://merchant.example/banner.png';
  expect(canOptimizeImage(src)).toBe(false);
  const html = renderToStaticMarkup(createElement(ShopImage, { src, alt: 'Merchant banner', width: 32, height: 32 }));
  expect(html).toContain(`src="${src}"`);
  expect(html).not.toContain('/_next/image');
});

it.each([
  '//evil.example/uploads/image.png', 'https://evil.example/uploads/image.png',
  'http://localhost:3001/uploads/image.png', '/uploads/../bff/account/profile',
  '/uploads/%2e%2e/bff/account/profile', '/uploads/image.png?url=https://evil.example',
  '/uploads/image.png#fragment', '/uploads/\\evil.example/image.png', '/bff/account/profile',
])('does not optimize an untrusted or ambiguous source: %s', (source) => {
  expect(canOptimizeImage(source)).toBe(false);
});
