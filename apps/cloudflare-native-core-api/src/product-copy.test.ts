import { describe, expect, it } from 'vitest';
import { applyProductCopyOverrides, productCopyPathKind } from './product-copy';

const LIST_PAYLOAD = JSON.stringify({
  success: true,
  data: {
    items: [
      { id: 'odoo-product-6', name: 'Bokmoo Card', description: 'Odoo copy for card' },
      { id: 'odoo-product-7', name: 'Bokmoo Bluetooth Card', description: 'Odoo copy for ble' },
    ],
    page: 1,
  },
});

const DETAIL_PAYLOAD = JSON.stringify({
  success: true,
  data: { id: 'odoo-product-7', name: 'Bokmoo Bluetooth Card', description: 'Odoo copy for ble' },
});

describe('productCopyPathKind', () => {
  it('recognizes the product list and detail paths', () => {
    expect(productCopyPathKind('/api/v1/products')).toBe('list');
    expect(productCopyPathKind('/api/v1/products/odoo-product-7')).toBe('detail');
  });

  it('ignores non-product snapshot reads', () => {
    expect(productCopyPathKind('/api/v1/store/context')).toBeNull();
    expect(productCopyPathKind('/api/v1/products/odoo-product-7/variants')).toBeNull();
    expect(productCopyPathKind('/api/v1/admin/products')).toBeNull();
  });
});

describe('applyProductCopyOverrides', () => {
  it('passes payloads through untouched when no overrides exist', () => {
    const overrides = new Map<string, string>();
    expect(applyProductCopyOverrides(LIST_PAYLOAD, overrides)).toBe(LIST_PAYLOAD);
  });

  it('overrides matching items in the list payload and leaves others intact', () => {
    const result = JSON.parse(applyProductCopyOverrides(LIST_PAYLOAD, new Map([['odoo-product-7', 'Admin copy']])));
    const items = result.data.items as Array<{ id: string; description: string }>;
    expect(items[0].description).toBe('Odoo copy for card');
    expect(items[1].description).toBe('Admin copy');
  });

  it('overrides the detail payload description', () => {
    const result = JSON.parse(applyProductCopyOverrides(DETAIL_PAYLOAD, new Map([['odoo-product-7', '管理员写的中文文案']])));
    expect((result.data as { description: string }).description).toBe('管理员写的中文文案');
  });

  it('fails open on malformed payloads', () => {
    expect(applyProductCopyOverrides('not-json', new Map([['x', 'y']])));
  });

  it('runs the locale mapper only for products without an override', () => {
    const localize = (item: unknown) => {
      const product = item as { id: string; description: string };
      return { ...product, description: `localized:${product.id}` };
    };
    const result = JSON.parse(applyProductCopyOverrides(
      LIST_PAYLOAD,
      new Map([['odoo-product-7', 'Admin copy']]),
      localize,
    ));
    const items = result.data.items as Array<{ id: string; description: string }>;
    expect(items[0].description).toBe('localized:odoo-product-6');
    expect(items[1].description).toBe('Admin copy');

    const detail = JSON.parse(applyProductCopyOverrides(DETAIL_PAYLOAD, new Map(), localize));
    expect(detail.data.description).toBe('localized:odoo-product-7');
    // Without overrides and without a mapper the payload is returned as is.
    expect(applyProductCopyOverrides(DETAIL_PAYLOAD, new Map())).toBe(DETAIL_PAYLOAD);
  });
});
