import { describe, expect, it } from 'vitest';
import { getProductImage } from '../../lib/product-image';

describe('a product\u2019s picture', () => {
  it('is the first image, as an address or as an object carrying one', () => {
    expect(getProductImage({ images: ['/media/a.webp', '/media/b.webp'] })).toBe('/media/a.webp');
    expect(getProductImage({ images: [{ url: '/media/a.webp' }] })).toBe('/media/a.webp');
  });

  it('is nothing when the product has none, or only a blank one', () => {
    expect(getProductImage({ images: [] })).toBeNull();
    expect(getProductImage({ images: ['   '] })).toBeNull();
    expect(getProductImage({ images: [null] })).toBeNull();
    expect(getProductImage({ images: [{} as { url?: string }] })).toBeNull();
    expect(getProductImage({})).toBeNull();
  });
});
