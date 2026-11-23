import { describe, expect, it } from 'vitest';

import { STOREFRONT_LOCALES, bossPackageToShopProduct, localizedItem, localizeBossProduct } from './boss-upstream';

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
    // zh-Hant: the catalog name is Simplified, so the Traditional sentence stands alone.
    expect(localizedItem(product, 'zh-Hant').description).toBe('下單後即時發放，首次連網生效。');
    expect(localizedItem(product, 'zh-TW').description).toBe('下單後即時發放，首次連網生效。');

    const english = localizedItem(product, 'en');
    // The name is catalog data and stays as Odoo spells it; only our sentence is translated.
    expect(english.description).toBe('Delivered right after purchase — activates on first connection.');
    expect(english.id).toBe(product.id);
    expect(english).not.toBe(product);
    expect(english.variants[0]).not.toBe(product.variants[0]);
    expect(product.description).toBe(`${NAME}。下单后即时发放，首次联网生效。`);
  });

  it('speaks ja / ko / fr / de too, and falls back to English for unknown locales', () => {
    const product = bossPackageToShopProduct(pkg)!;
    const notes: Record<string, string> = {
      ja: 'ご注文後すぐに発行され、初めて接続したときに有効化されます。',
      ko: '결제 후 즉시 발급되며, 첫 연결 시 활성화돼요.',
      fr: 'Livré immédiatement après l’achat — s’active dès la première connexion.',
      de: 'Sofort nach dem Kauf zugestellt — wird bei der ersten Verbindung aktiviert.',
    };
    for (const [locale, note] of Object.entries(notes)) {
      expect(localizedItem(product, locale).description, locale).toBe(note);
    }
    expect(localizedItem(product, 'es').description).toBe(localizedItem(product, 'en').description);
    expect(STOREFRONT_LOCALES).toEqual(['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de']);
    // One language per page: the Chinese catalog name is never prefixed to a translated sentence.
    expect(localizedItem(product, 'ja').description).not.toMatch(/流量包|下单后/);
  });

  it('localizes served BOSS products at read time without touching anything else', () => {
    const product = bossPackageToShopProduct(pkg)!;
    expect(localizeBossProduct(product, 'fr')).toMatchObject({ description: 'Livré immédiatement après l’achat — s’active dès la première connexion.' });
    expect(localizeBossProduct(product, undefined)).toMatchObject({ description: 'Delivered right after purchase — activates on first connection.' });
    expect(localizeBossProduct(product, 'zh-Hant')).toMatchObject({ description: '下單後即時發放，首次連網生效。' });
    // zh-Hans and non-BOSS / malformed items are returned as the same reference.
    expect(localizeBossProduct(product, 'zh-Hans')).toBe(product);
    expect(localizeBossProduct({ id: 'odoo-product-6', description: 'x' }, 'de')).toEqual({ id: 'odoo-product-6', description: 'x' });
    expect(localizeBossProduct({ id: 'boss-CN-1GB-7D' }, 'de')).toEqual({ id: 'boss-CN-1GB-7D' });
    expect(localizeBossProduct(null, 'de')).toBeNull();
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
