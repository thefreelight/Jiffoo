import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getTestPrisma } from '../helpers/db';
import { CatalogReadService } from '@/core/product/catalog-read-service';
import { registerFulfillmentPolicy, clearFulfillmentPolicies } from '@/core/shared/fulfillment-policy';

const db = getTestPrisma();
const prefix = randomUUID();
const type = `untracked-${prefix}`;
const ids: string[] = [];
describe('Plugin catalogue owning projection', () => {
  beforeAll(async () => {
    registerFulfillmentPolicy(type, { tracksInventory: false, requiresShippingAddress: false, requiresShippingQuote: false });
    for (const [name, isActive, productType] of [['live', true, type], ['hidden', false, type], ['physical', true, 'physical']] as const) {
      const product = await db.product.create({ data: { name, spuCode: `${prefix}-${name}`, slug: `${prefix}-${name}`, isActive, productType,
        translations: { create: { locale: 'zh-Hans', name: '本地化商品' } },
        variants: { create: [{ name: 'visible', skuCode: `${prefix}-${name}-v`, salePrice: '12.34' },
          { name: 'inactive', skuCode: `${prefix}-${name}-i`, salePrice: '1', isActive: false },
          { name: 'negative', skuCode: `${prefix}-${name}-n`, salePrice: '-1' }] } }, include: { variants: true } });
      ids.push(...product.variants.map(item => item.id));
    }
  });
  afterAll(async () => {
    await db.product.deleteMany({ where: { slug: { startsWith: prefix } } });
    clearFulfillmentPolicies();
  });
  it('filters inactive and invalid prices, localizes, and applies inventory policy', async () => {
    const result = await CatalogReadService.purchasableVariants(ids, 'zh-Hans');
    expect(result.items).toHaveLength(2);
    expect(result.items.every(item => item.title === '本地化商品' && item.price === '12.34')).toBe(true);
    expect(result.items.map(item => item.availability).sort()).toEqual(['available', 'out_of_stock']);
    expect(result.items.every(item => ids.includes(item.variantId))).toBe(true);
  });
});
