import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomInt, randomUUID } from 'node:crypto';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { createTestOrder, createTestOrderItem } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { prisma } from '@/config/database';
import { resolveProductCode, withProductCodeRetry } from '@/core/admin/product-management/codes';
import { CacheService } from '@/core/cache/service';

vi.mock('node:crypto', async original => {
  const crypto = await original<typeof import('node:crypto')>();
  return { ...crypto, randomInt: vi.fn(crypto.randomInt) };
});

let app: FastifyInstance;
let headers: { authorization: string };
const db = getTestPrisma();
beforeAll(async () => {
  app = await createTestApp();
  headers = { authorization: 'Bearer ' + (await createAdminWithToken()).token };
});
afterAll(async () => { await app.close(); });
const payload = (extra = {}) => ({ name: 'Code product ' + randomUUID(), variants: [{ name: 'Standard', salePrice: 12, stock: 3 }], ...extra });
const create = (extra = {}) => app.inject({ method: 'POST', url: '/api/v1/admin/products', headers, payload: payload(extra) });
const update = (id: string, data: unknown) => app.inject({ method: 'PUT', url: '/api/v1/admin/products/' + id, headers, payload: data });

it('uses the new DTO cache namespace when pre-upgrade product entries exist', async () => {
  const product = (await create()).json().data;
  const oldDetailKey = 'product:' + product.id;
  const version = await CacheService.getProductVersion();
  const filters = Buffer.from(JSON.stringify({ search: product.spuCode })).toString('base64');
  const oldListKey = `product:list:v${version}:1:10:${filters}:flat`;
  try {
    await CacheService.deleteProduct(product.id);
    await CacheService.set(oldDetailKey, { id: product.id, name: 'Old cached shape' });
    await CacheService.set(oldListKey, { items: [{ id: product.id, name: 'Old cached shape' }], page: 1, limit: 10, total: 1, totalPages: 1 });
    const detail = await app.inject({ method: 'GET', url: '/api/v1/admin/products/' + product.id, headers });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.spuCode).toBe(product.spuCode);
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/products?search=' + product.spuCode, headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items[0].spuCode).toBe(product.spuCode);
  } finally { await CacheService.delete(oldDetailKey); await CacheService.delete(oldListKey); }
});

it('keeps namespaces separate, treats underscores literally and generates untruncated positions above 99', async () => {
  const prefix = ('POSITION-' + randomUUID()).toUpperCase();
  const occupied = await create({ spuCode: prefix + 'A', variants: Array.from({ length: 99 }, (_, index) => ({
    name: String(index + 1), stock: 1, salePrice: 12, skuCode: prefix + '-' + String(index + 1).padStart(2, '0'),
  })) });
  expect(occupied.statusCode).toBe(201);
  const response = await create({ spuCode: prefix.toLowerCase() });
  expect(response.statusCode).toBe(201);
  expect(response.json().data.variants[0].skuCode).toBe(prefix + '-100');
  const literal = 'LITERAL-' + randomUUID();
  expect((await create({ spuCode: literal + '_', variants: [{ name: 'A', stock: 1, salePrice: 12, skuCode: literal + '_' }] })).statusCode).toBe(201);
  expect((await create({ spuCode: literal + 'X', variants: [{ name: 'B', stock: 1, salePrice: 12, skuCode: literal + 'X' }] })).statusCode).toBe(201);
});

it('generates uppercase codes on blank create/update and searches SPU and all SKUs', async () => {
  const response = await create({ spuCode: '  ', variants: [{ name: 'A', stock: 1, salePrice: 12, skuCode: '' }, { name: 'B', stock: 1, salePrice: 12, skuCode: ' ' }] });
  expect(response.statusCode).toBe(201);
  const product = response.json().data;
  expect(product.spuCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
  expect(product.variants.map((v: any) => v.skuCode)).toEqual([product.spuCode + '-01', product.spuCode + '-02']);
  for (const search of [product.spuCode.toLowerCase(), product.variants[1].skuCode.toLowerCase()]) {
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/products?search=' + search, headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: product.id, spuCode: product.spuCode })]));
  }
  const changed = await update(product.id, { spuCode: '', variants: product.variants.map((v: any) => ({ ...v, skuCode: '' })) });
  expect(changed.statusCode).toBe(200);
  expect(changed.json().data.spuCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
  expect(changed.json().data.spuCode).not.toBe(product.spuCode);
});

it.each(['spuCode', 'skuCode'])('rejects a case-insensitive %s conflict across products with its owner name', async field => {
  const value = 'CUSTOM-' + randomUUID();
  const first = await create(field === 'spuCode' ? { spuCode: value } : { variants: [{ name: 'Standard', salePrice: 12, stock: 1, skuCode: value }] });
  expect(first.statusCode).toBe(201);
  const data = first.json().data;
  const second = await create(field === 'spuCode' ? { spuCode: value.toLowerCase() } : { variants: [{ name: 'Other', salePrice: 12, stock: 1, skuCode: value.toLowerCase() }] });
  expect(second.statusCode).toBe(409);
  expect(second.json().error).toMatchObject({ code: field === 'spuCode' ? 'SPU_CODE_TAKEN' : 'SKU_CODE_TAKEN', details: { name: data.name, field } });
  const other = (await create()).json().data;
  const edited = await update(other.id, field === 'spuCode' ? { spuCode: value.toLowerCase() } : { variants: [{ ...other.variants[0], skuCode: value.toLowerCase() }] });
  expect(edited.statusCode).toBe(409);
  expect(edited.json().error.details.name).toBe(data.name);
});

it.each(['bad code', 'A/B', 'A'.repeat(65)])('returns INVALID_PRODUCT_CODE for new invalid values: %s', async value => {
  for (const extra of [{ spuCode: value }, { variants: [{ name: 'Standard', stock: 1, salePrice: 12, skuCode: value }] }]) {
    const response = await create(extra);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_PRODUCT_CODE');
  }
});

it('preserves unchanged legacy SKU formats and immutable sold item snapshots', async () => {
  const product = (await create()).json().data;
  const variant = product.variants[0];
  const legacy = 'Legacy SKU ' + randomUUID() + '-'.repeat(65);
  await db.productVariant.update({ where: { id: variant.id }, data: { skuCode: legacy } });
  const { user } = await createUserWithToken();
  const order = await createTestOrder({ userId: user.id });
  await createTestOrderItem({ orderId: order.id, productId: product.id, variantId: variant.id });
  const before = await db.$queryRaw`SELECT "catalogSnapshot"::text AS snapshot FROM order_items WHERE "orderId" = ${order.id}`;
  expect((await update(product.id, { variants: [{ ...variant, skuCode: legacy, name: 'Changed name' }] })).statusCode).toBe(200);
  const changed = await update(product.id, { variants: [{ ...variant, skuCode: 'NEW-' + randomUUID() }] });
  expect(changed.statusCode).toBe(200);
  expect(await db.$queryRaw`SELECT "catalogSnapshot"::text AS snapshot FROM order_items WHERE "orderId" = ${order.id}`).toEqual(before);
});

it('allows real concurrent blank creates and resolves unique-index races with typed conflicts', async () => {
  const blank = await Promise.all([create({ spuCode: '' }), create({ spuCode: '' })]);
  expect(blank.map(response => response.statusCode)).toEqual([201, 201]);
  expect(new Set(blank.map(response => response.json().data.spuCode)).size).toBe(2);
  const shared = 'RACE-' + randomUUID();
  const raced = await Promise.all([create({ spuCode: shared }), create({ spuCode: shared.toLowerCase() })]);
  expect(raced.map(response => response.statusCode).sort()).toEqual([201, 409]);
  const winner = raced.find(response => response.statusCode === 201)!.json().data;
  expect(raced.find(response => response.statusCode === 409)!.json().error).toMatchObject({ code: 'SPU_CODE_TAKEN', details: { name: winner.name } });
  const sku = 'SKU-RACE-' + randomUUID();
  const skuRace = await Promise.all([create({ variants: [{ name: 'A', salePrice: 12, stock: 1, skuCode: sku }] }), create({ variants: [{ name: 'B', salePrice: 12, stock: 1, skuCode: sku.toLowerCase() }] })]);
  expect(skuRace.map(response => response.statusCode).sort()).toEqual([201, 409]);
  expect(skuRace.find(response => response.statusCode === 409)!.json().error.code).toBe('SKU_CODE_TAKEN');
});

it('bounds random collision retries and returns an SPU conflict rather than 500', async () => {
  const occupied = (await create({ spuCode: '22222222' })).json().data;
  const spy = vi.mocked(randomInt).mockReturnValue(0);
  spy.mockClear();
  try {
    const response = await create();
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'SPU_CODE_TAKEN', details: { name: occupied.name } });
    expect(spy).toHaveBeenCalledTimes(80);
  } finally { spy.mockRestore(); }
});

it.each(['spuCode', 'skuCode'] as const)('retries a forced generated %s collision in real concurrent transactions', async field => {
  const product = (await create()).json().data;
  const random = vi.mocked(randomInt);
  let character = 0;
  if (field === 'spuCode') random.mockImplementation((() => character++ < 16 ? 2 : 3) as typeof randomInt);
  let arrivals = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const operation = () => withProductCodeRetry(context => prisma.$transaction(async tx => {
    const code = await resolveProductCode(tx, context, { field, spuCode: product.spuCode, name: product.name });
    if (++arrivals <= 2) { if (arrivals === 2) release(); await barrier; }
    if (field === 'spuCode') await tx.product.create({ data: { name: 'Collision probe', slug: randomUUID(), spuCode: code } });
    else await tx.productVariant.create({ data: { productId: product.id, name: 'Collision probe', skuCode: code } });
    return code;
  }));
  const work = [operation(), operation()];
  try {
    const results = await Promise.all(work);
    expect(new Set(results).size).toBe(2);
    expect(arrivals).toBe(3);
  } finally { release(); await Promise.allSettled(work); random.mockRestore(); }
});
