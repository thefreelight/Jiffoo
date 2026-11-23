import { describe, expect, it } from 'vitest';

import { bossPackageToShopProduct, localizedItem } from './boss-upstream';

const pkg = {
  odooId: 69,
  name: '中国大陆流量包 1GB/7天（中国大陆（国际漫游出口））',
  defaultCode: 'CN-1GB-7D',
  listPrice: 4.9,
  qtyAvailable: 9999,
  whetherActive: true,
};

const NAME = pkg.name;

describe('BOSS catalog customer-facing copy', () => {
  it('keeps the vendor, the ERP and a second language out of the description', () => {
    const product = bossPackageToShopProduct(pkg);
    expect(product?.description).toBe(`${NAME}。下单后即时发放，首次联网生效。`);
    // "GB" in the name is the only Latin text allowed; no English sentence tail.
    expect(product?.description).not.toMatch(/[A-Za-z]{4,}/);
  });

  it('speaks the storefront language for the description without touching the shared product', () => {
    const product = bossPackageToShopProduct(pkg)!;
    expect(localizedItem(product, 'zh-Hans').description).toBe(product.description);
    expect(localizedItem(product, 'zh-Hant').description).toBe(product.description);

    const english = localizedItem(product, 'en');
    // The name is catalog data and stays as Odoo spells it; only our sentence is translated.
    expect(english.description).toBe(`${NAME}. Delivered right after purchase — activates on first connection.`);
    expect(english.id).toBe(product.id);
    expect(english).not.toBe(product);
    expect(english.variants[0]).not.toBe(product.variants[0]);
    expect(product.description).toBe(`${NAME}。下单后即时发放，首次联网生效。`);
  });

  it('strips the SKU prefix from the names it shows customers', () => {
    const prefixed = bossPackageToShopProduct({ ...pkg, name: '[CN-1GB-7D] ' + NAME });
    expect(prefixed?.name).toBe(NAME);
    expect(prefixed?.variants[0].name).toBe(NAME);
    // The SKU stays available as the machine key.
    expect(prefixed?.typeData.esim.defaultCode).toBe('CN-1GB-7D');
    expect(bossPackageToShopProduct({ ...pkg, name: NAME })?.name).toBe(NAME);
  });
});
