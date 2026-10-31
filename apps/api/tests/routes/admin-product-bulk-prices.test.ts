import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { systemSettingsService } from '@/core/settings/service';
import { CacheService } from '@/core/cache/service';

/**
 * The admin bulk price edit.
 *
 * The operator changes the sale price and the compare-at price of many
 * products in one action. The prices are computed in the minor units of the
 * store currency, so the percentage is exact and a price the currency cannot
 * hold is refused instead of being rounded.
 */
describe('POST /api/v1/admin/products/bulk-prices', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  const prefix = 'bp-' + randomUUID();
  const owned: string[] = [];
  let currencyBefore: string;

  const prisma = () => getTestPrisma();
  const headers = () => ({ authorization: 'Bearer ' + adminToken });
  const selection = (ids: string[]) => ({ mode: 'ids', ids });
  const post = (payload: unknown) => app.inject({
    method: 'POST',
    url: '/api/v1/admin/products/bulk-prices',
    headers: headers(),
    payload,
  });
  const storedVariant = async (id: string) => prisma().productVariant.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    app = await createTestApp({ enableSwagger: true });
    adminToken = (await createAdminWithToken()).token;
    userToken = (await createUserWithToken()).token;
    currencyBefore = await systemSettingsService.getShopCurrency();
  });

  afterAll(async () => {
    await systemSettingsService.setSetting('localization.currency', currencyBefore);
    await prisma().product.deleteMany({ where: { id: { in: owned } } });
    await deleteAllTestUsers();
    await app.close();
  });

  it('sets the sale price of every variant of the selected products with an absolute amount', async () => {
    const first = await createTestProduct({ name: prefix + '-amount-a', price: 50 });
    const second = await createTestProduct({ name: prefix + '-amount-b', price: 60 });
    owned.push(first.id, second.id);

    const response = await post({ selection: selection([first.id, second.id]), salePrice: { mode: 'amount', value: '19.90' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ matched: 2, processed: 2, skippedCount: 0, variantsProcessed: 2, variantsSkippedCount: 0 });
    for (const product of [first, second]) {
      expect(Number((await storedVariant(product.variants[0].id)).salePrice)).toBe(19.9);
    }
  });

  it('scales the current price exactly with a percentage', async () => {
    const exact = await createTestProduct({ name: prefix + '-pct-exact', price: 100 });
    const odd = await createTestProduct({ name: prefix + '-pct-odd', price: 99.99 });
    owned.push(exact.id, odd.id);

    const up = await post({ selection: selection([exact.id]), salePrice: { mode: 'percentage', value: '10' } });
    expect(up.statusCode).toBe(200);
    expect(Number((await storedVariant(exact.variants[0].id)).salePrice)).toBe(110);

    const down = await post({ selection: selection([odd.id]), salePrice: { mode: 'percentage', value: '-10' } });
    expect(down.statusCode).toBe(200);
    // The minor-unit arithmetic is exact: 89.99 and never 89.991.
    expect(Number((await storedVariant(odd.variants[0].id)).salePrice)).toBe(89.99);
  });

  it('sets the compare-at price by amount and scales it by percentage', async () => {
    const product = await createTestProduct({ name: prefix + '-compare', price: 20 });
    owned.push(product.id);

    const set = await post({ selection: selection([product.id]), compareAtPrice: { mode: 'amount', value: '24.99' } });
    expect(set.statusCode).toBe(200);
    const stored = await storedVariant(product.variants[0].id);
    expect(Number(stored.salePrice)).toBe(20);
    expect(Number(stored.compareAtPrice)).toBe(24.99);

    const scaled = await post({ selection: selection([product.id]), compareAtPrice: { mode: 'percentage', value: '-10' } });
    expect(scaled.statusCode).toBe(200);
    expect(Number((await storedVariant(product.variants[0].id)).compareAtPrice)).toBe(22.49);
  });

  it('clears the compare-at price', async () => {
    const product = await createTestProduct({ name: prefix + '-clear', price: 20 });
    owned.push(product.id);
    await prisma().productVariant.update({ where: { id: product.variants[0].id }, data: { compareAtPrice: 25 } });

    const response = await post({ selection: selection([product.id]), clearCompareAtPrice: true });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ variantsProcessed: 1, variantsSkippedCount: 0 });
    expect((await storedVariant(product.variants[0].id)).compareAtPrice).toBeNull();
  });

  it('skips a variant whose compare-at price would fall below the new sale price and writes the other variants', async () => {
    const product = await createTestProduct({ name: prefix + '-below', price: 10 });
    owned.push(product.id);
    const second = await prisma().productVariant.create({
      data: { productId: product.id, name: 'Second', skuCode: prefix + '-below-02', salePrice: 10, stock: 1, sortOrder: 1 },
    });
    await prisma().productVariant.update({ where: { id: product.variants[0].id }, data: { compareAtPrice: 12 } });

    const response = await post({ selection: selection([product.id]), salePrice: { mode: 'amount', value: '20' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ processed: 1, variantsProcessed: 1, variantsSkippedCount: 1 });
    expect(response.json().data.variantsSkipped[0]).toMatchObject({ variantId: product.variants[0].id, productId: product.id, reason: 'COMPARE_AT_BELOW_SALE' });
    // The skipped variant keeps both of its prices: a variant is never half applied.
    const skipped = await storedVariant(product.variants[0].id);
    expect(Number(skipped.salePrice)).toBe(10);
    expect(Number(skipped.compareAtPrice)).toBe(12);
    // The other variant of the same product is written.
    expect(Number((await storedVariant(second.id)).salePrice)).toBe(20);
  });

  it('skips a variant without a compare-at price when a percentage is applied to it', async () => {
    const product = await createTestProduct({ name: prefix + '-missing', price: 10 });
    owned.push(product.id);

    const response = await post({ selection: selection([product.id]), compareAtPrice: { mode: 'percentage', value: '10' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ variantsProcessed: 0, variantsSkippedCount: 1 });
    expect(response.json().data.variantsSkipped[0]).toMatchObject({ variantId: product.variants[0].id, reason: 'COMPARE_AT_MISSING' });
    expect(Number((await storedVariant(product.variants[0].id)).salePrice)).toBe(10);
  });

  it('refuses a price the currency of the store cannot represent', async () => {
    await systemSettingsService.setSetting('localization.currency', 'JPY');
    try {
      const product = await createTestProduct({ name: prefix + '-jpy', price: 100 });
      owned.push(product.id);

      const response = await post({ selection: selection([product.id]), salePrice: { mode: 'amount', value: '10.50' } });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      // The refused write leaves the stored price alone.
      expect(Number((await storedVariant(product.variants[0].id)).salePrice)).toBe(100);
    } finally {
      await systemSettingsService.setSetting('localization.currency', currencyBefore);
    }
  });

  it('reports what would change without writing anything in a dry run', async () => {
    const product = await createTestProduct({ name: prefix + '-dry', price: 10 });
    owned.push(product.id);
    const version = await CacheService.getProductVersion();

    const response = await post({ selection: selection([product.id]), salePrice: { mode: 'amount', value: '30' }, dryRun: true });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ matched: 1, processed: 1, variantsProcessed: 1, variantsSkippedCount: 0 });
    expect(response.json().data.changes[0]).toMatchObject({ variantId: product.variants[0].id, previousSalePrice: 10, salePrice: 30 });
    // Nothing was written and the product cache version was not bumped.
    expect(Number((await storedVariant(product.variants[0].id)).salePrice)).toBe(10);
    expect(await CacheService.getProductVersion()).toBe(version);
  });

  it('works with a filter selection and skips a product that does not exist', async () => {
    const product = await createTestProduct({ name: prefix + '-filter' });
    owned.push(product.id);

    const response = await post({
      selection: { mode: 'filter', filter: { search: prefix + '-filter' } },
      salePrice: { mode: 'amount', value: '12.34' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ matched: 1, processed: 1, variantsProcessed: 1 });
    expect(Number((await storedVariant(product.variants[0].id)).salePrice)).toBe(12.34);

    const missing = await post({ selection: selection(['missing-product']), salePrice: { mode: 'amount', value: '12.34' } });
    expect(missing.statusCode).toBe(200);
    expect(missing.json().data).toMatchObject({ matched: 1, processed: 0, skippedCount: 1, skipped: [{ id: 'missing-product', reason: 'NOT_FOUND' }] });
  });

  it('refuses an invalid bulk price request', async () => {
    const product = await createTestProduct({ name: prefix + '-invalid', price: 10 });
    owned.push(product.id);
    const target = selection([product.id]);

    // No price edit at all.
    expect((await post({ selection: target })).statusCode).toBe(400);
    // The compare-at price cannot be changed and cleared at once.
    expect((await post({ selection: target, compareAtPrice: { mode: 'amount', value: '12' }, clearCompareAtPrice: true })).statusCode).toBe(400);
    // A percentage below minus one hundred is refused.
    expect((await post({ selection: target, salePrice: { mode: 'percentage', value: '-100.01' } })).statusCode).toBe(400);
    // A percentage accepts at most two decimal places.
    expect((await post({ selection: target, salePrice: { mode: 'percentage', value: '12.345' } })).statusCode).toBe(400);
    // A negative price is refused per variant, not as a crash.
    const negative = await post({ selection: target, salePrice: { mode: 'amount', value: '-5' } });
    expect(negative.statusCode).toBe(200);
    expect(negative.json().data).toMatchObject({ variantsProcessed: 0, variantsSkippedCount: 1 });
    expect(negative.json().data.variantsSkipped[0].reason).toBe('NEGATIVE_PRICE');
    expect(Number((await storedVariant(product.variants[0].id)).salePrice)).toBe(10);
  });

  it('answers with the documented envelope and refuses a request without an admin token', async () => {
    const product = await createTestProduct({ name: prefix + '-shape', price: 10 });
    owned.push(product.id);

    const response = await post({ selection: selection([product.id]), salePrice: { mode: 'amount', value: '11.11' } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(Object.keys(body.data).sort()).toEqual([
      'changes', 'matched', 'processed', 'skipped', 'skippedCount',
      'variantsProcessed', 'variantsSkipped', 'variantsSkippedCount',
    ]);
    expect(body.data.changes[0]).toMatchObject({
      variantId: product.variants[0].id,
      productId: product.id,
      previousSalePrice: 10,
      salePrice: 11.11,
      previousCompareAtPrice: null,
      compareAtPrice: null,
    });

    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/products/bulk-prices',
      headers: { authorization: 'Bearer ' + userToken },
      payload: {},
    });
    expect(denied.statusCode).toBe(403);
    const anonymous = await app.inject({ method: 'POST', url: '/api/v1/admin/products/bulk-prices', payload: {} });
    expect(anonymous.statusCode).toBe(401);
  });

  it('documents the endpoint with a typed success envelope', () => {
    const operation = app.swagger().paths['/api/v1/admin/products/bulk-prices'].post;
    const success = operation.responses['200'].content['application/json'].schema;
    expect(success.required).toEqual(expect.arrayContaining(['success', 'data']));
    expect(success.properties.success).toEqual({ type: 'boolean', enum: [true] });
    expect(success.properties.data.type).toBe('object');
    expect(success.properties.data.required).toEqual(expect.arrayContaining(['matched', 'processed', 'skippedCount', 'skipped', 'variantsProcessed', 'variantsSkippedCount', 'variantsSkipped', 'changes']));
  });
});
