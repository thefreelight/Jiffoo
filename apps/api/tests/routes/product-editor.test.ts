import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { redisCache } from '@/core/cache/redis';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { createTestProduct, createTestOrder, createTestOrderItem } from '../helpers/fixtures';

let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, buyer: Awaited<ReturnType<typeof createUserWithToken>>, categoryId: string;
const prefix = 'editor-' + randomUUID(), owned: string[] = [], orders: string[] = [];
const rows: { id: string; name: string; price: number; stock: number; createdAt: number; updatedAt: number; variantId: string }[] = [];
beforeAll(async () => {
  await redisCache.connect(); app = await createTestApp({ enableSwagger: true }); admin = await createAdminWithToken(); buyer = await createUserWithToken();
  categoryId = (await prisma.category.create({ data: { name: prefix, slug: prefix } })).id;
  for (const [index, name] of ['Zebra', 'Alpha', 'Alpha', 'Beta'].entries()) {
    const price = [30, 10, 10, 20][index], stock = [8, 4, 4, 1][index];
    const product = await createTestProduct({ name: prefix + ' ' + name, price, stock }); owned.push(product.id);
    const createdAt = new Date('2026-10-0' + [2, 1, 1, 3][index] + 'T00:00:00Z'), updatedAt = new Date('2026-10-0' + [1, 3, 3, 2][index] + 'T00:00:00Z');
    await prisma.product.update({ where: { id: product.id }, data: { categoryId: index === 1 ? null : categoryId, createdAt, updatedAt } });
    rows.push({ id: product.id, name: product.name, price: index === 0 ? 1 : price, stock: index === 0 ? 28 : stock, createdAt: +createdAt, updatedAt: +updatedAt, variantId: product.variants[0].id });
  }
  await prisma.productVariant.create({ data: { productId: rows[0].id, name: 'Inactive', salePrice: 1, stock: 20, isActive: false, skuCode: prefix + '-hidden' } });
  await CacheService.incrementProductVersion();
});
afterAll(async () => {
  await prisma.order.deleteMany({ where: { id: { in: orders } } });
  await prisma.eventDelivery.deleteMany({ where: { event: { aggregateId: { in: owned } } } });
  await prisma.eventRecord.deleteMany({ where: { aggregateId: { in: owned } } });
  await prisma.product.deleteMany({ where: { id: { in: owned } } }); await prisma.category.delete({ where: { id: categoryId } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.user.id, buyer.user.id] } } }); await CacheService.incrementProductVersion(); await app.close(); await redisCache.disconnect();
});
const headers = () => ({ authorization: 'Bearer ' + admin.token });
const neighbors = (id: string, query: Record<string, string>) => app.inject({ method: 'GET', url: '/api/v1/admin/products/' + id + '/neighbors?' + new URLSearchParams({ search: prefix, ...query }), headers: headers() });
it.each(['name', 'price', 'stock', 'createdAt', 'updatedAt'] as const)('matches SQL list order for %s in both directions, with ties and filtered-out anchors', async sortBy => {
  for (const sortOrder of ['asc', 'desc']) {
    const sorted = [...rows].sort((a, b) => (a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : a.id < b.id ? -1 : 1) * (sortOrder === 'asc' ? 1 : -1));
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/products?' + new URLSearchParams({ search: prefix, sortBy, sortOrder }), headers: headers() });
    expect(list.statusCode).toBe(200); expect(list.json().data.items.map((item: any) => item.id)).toEqual(sorted.map(item => item.id));
    for (const [index, product] of sorted.entries()) {
      const response = await neighbors(product.id, { sortBy, sortOrder }); expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ position: index + 1, total: 4, previousId: sorted[index - 1]?.id ?? null, nextId: sorted[index + 1]?.id ?? null });
    }
    const index = sorted.findIndex(product => product.id === rows[1].id);
    const outside = await neighbors(rows[1].id, { sortBy, sortOrder, categoryId, status: 'active' });
    expect(outside.statusCode).toBe(200); expect(outside.json().data).toEqual({ position: null, total: 3, previousId: sorted[index - 1]?.id ?? null, nextId: sorted[index + 1]?.id ?? null });
  }
});
it('returns fresh per-variant order protection even after the product projection is cached', async () => {
  const read = () => app.inject({ method: 'GET', url: '/api/v1/admin/products/' + rows[0].id, headers: headers() });
  const before = await read(); expect(before.statusCode).toBe(200); expect(before.json().data).toHaveProperty('slug'); expect(before.json().data.currency).toMatch(/^[A-Z]{3}$/);
  expect(before.json().data.variants.every((variant: any) => variant.hasOrders === false)).toBe(true);
  const order = await createTestOrder({ userId: buyer.user.id, total: 30 }); orders.push(order.id);
  await createTestOrderItem({ orderId: order.id, productId: rows[0].id, variantId: rows[0].variantId, quantity: 1, price: 30 });
  await prisma.productVariant.update({ where: { id: rows[0].variantId }, data: { stock: 5 } });
  try {
    const after = await read(); expect(after.json().data.variants.find((variant: any) => variant.id === rows[0].variantId)).toMatchObject({ hasOrders: true, stock: 5 });
  } finally { await prisma.productVariant.update({ where: { id: rows[0].variantId }, data: { stock: 8 } }); }
  const removed = await app.inject({ method: 'PUT', url: '/api/v1/admin/products/' + rows[0].id, headers: headers(), payload: { variants: [{ name: 'Replacement', stock: 1, salePrice: 1 }] } });
  expect(removed.statusCode).toBe(409); expect(removed.json().error.code).toBe('PRODUCT_HAS_ORDERS');
});
it('creates an inactive prefilled product with new generated codes and a real storefront slug', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/v1/admin/products', headers: headers(), payload: { name: prefix + '-copy', isActive: false, categoryId, spuCode: '', variants: [{ name: 'Standard', salePrice: 9, stock: 1, skuCode: '', attributes: { color: 'Blue' } }] } });
  expect(response.statusCode).toBe(201); const data = response.json().data; owned.push(data.id);
  expect(data.isActive).toBe(false); expect(data.spuCode).toMatch(/^[A-Z0-9]{8}$/); expect(data.slug).toBeTruthy(); expect(data.categoryId).toBe(categoryId);
  expect(data.variants[0]).toMatchObject({ hasOrders: false, isActive: true, attributes: { color: 'Blue' } }); expect(data.variants[0].skuCode).toBeTruthy();
});
it('returns typed errors and requires an administrator for neighbors', async () => {
  const missing = await neighbors('missing', {}); expect(missing.statusCode).toBe(404); expect(missing.json().error.code).toBe('NOT_FOUND');
  expect((await neighbors(rows[0].id, { sortBy: 'bad' })).statusCode).toBe(400);
  for (const token of [undefined, buyer.token]) expect((await app.inject({ method: 'GET', url: '/api/v1/admin/products/' + rows[0].id + '/neighbors', headers: token ? { authorization: 'Bearer ' + token } : {} })).statusCode).toBe(token ? 403 : 401);
  const spec = app.swagger().paths['/api/v1/admin/products/{id}/neighbors'].get;
  for (const status of ['200', '400', '401', '403', '404']) expect(spec.responses[status]).toBeDefined();
});
