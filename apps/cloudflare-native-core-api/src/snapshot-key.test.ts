import { describe, expect, it } from 'vitest';
import { snapshotFallbackKey, snapshotKey } from './snapshot-key';

describe('snapshotKey', () => {
  it('treats target=shop as the default active theme snapshot', () => {
    expect(snapshotKey(new URL('https://example.com/api/v1/themes/active?target=shop')))
      .toBe('core:snapshot:/api/v1/themes/active');
  });

  it('keeps other theme targets isolated', () => {
    expect(snapshotKey(new URL('https://example.com/api/v1/themes/active?target=admin')))
      .toBe('core:snapshot:/api/v1/themes/active?target=admin');
  });

  it('preserves other query parameters when normalizing the shop target', () => {
    expect(snapshotKey(new URL('https://example.com/api/v1/themes/active?target=shop&preview=1')))
      .toBe('core:snapshot:/api/v1/themes/active?preview=1');
  });

  it('keeps product snapshot queries unchanged', () => {
    expect(snapshotKey(new URL('https://example.com/api/v1/products?page=1&limit=12')))
      .toBe('core:snapshot:/api/v1/products?page=1&limit=12');
  });

  it('falls back to the canonical product list for query variants', () => {
    expect(snapshotFallbackKey(new URL('https://example.com/api/v1/products?page=1&limit=12&locale=en')))
      .toBe('core:snapshot:/api/v1/products');
    expect(snapshotFallbackKey(new URL('https://example.com/api/v1/products'))).toBeNull();
    expect(snapshotFallbackKey(new URL('https://example.com/api/v1/products/product-1?locale=en'))).toBeNull();
  });
});
