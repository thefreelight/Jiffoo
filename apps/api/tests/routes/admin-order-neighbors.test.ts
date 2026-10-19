import { createNumberedOrder, createNumberedOrders } from '../helpers/numbered-order';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { redisCache } from '@/core/cache/redis';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';

let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, buyer: Awaited<ReturnType<typeof createUserWithToken>>, other: Awaited<ReturnType<typeof createUserWithToken>>;
const prefix = 'neighbors-' + randomUUID(), ids = ['a', 'b', 'c', 'd', 'e'].map(id => prefix + id);
const dates = ['2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z', '2026-10-03T00:00:00Z'];
const amounts = [30, 10, 20, 20, 10];
beforeAll(async () => {
  await redisCache.connect();
  app = await createTestApp({ enableSwagger: true }); admin = await createAdminWithToken(); buyer = await createUserWithToken(); other = await createUserWithToken();
  await createNumberedOrders(prisma, { data: ids.map((id, i) => ({ id, userId: buyer.user.id, status: i === 2 ? 'PENDING' as const : 'PROCESSING' as const, paymentStatus: 'PAID' as const,
    subtotalAmount: amounts[i], totalAmount: amounts[i], createdAt: new Date(dates[i]) })) });
  await createNumberedOrder(prisma, { data: { id: prefix + '-other', userId: other.user.id, subtotalAmount: 10, totalAmount: 10 } });
  await CacheService.incrementOrderVersion();
});
afterAll(async () => {
  await prisma.order.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.user.id, buyer.user.id, other.user.id] } } });
  await CacheService.incrementOrderVersion();
  await app.close();
  await redisCache.disconnect();
});
const headers = () => ({ authorization: 'Bearer ' + admin.token });
const neighbors = (id: string, query: Record<string, string> = {}) => app.inject({ method: 'GET', url: '/api/v1/admin/orders/' + id + '/neighbors?' + new URLSearchParams({ customerId: buyer.user.id, ...query }), headers: headers() });
it('filters both list and export by exact customer id without sharing cached lists', async () => {
  for (const [customer, expected] of [[buyer, ids], [other, [prefix + '-other']]] as const) {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders?customerId=' + customer.user.id, headers: headers() });
    expect(response.statusCode).toBe(200); expect(response.json().data.items.map((item: any) => item.id).sort()).toEqual([...expected].sort());
    const cached = await CacheService.getOrderList(1, 20, { paymentStatus: null, paymentReview: null, sortBy: 'createdAt', sortOrder: 'desc', customerId: customer.user.id });
    expect(cached?.items.map((item: any) => item.id).sort()).toEqual([...expected].sort());
    const csv = await app.inject({ method: 'POST', url: '/api/v1/admin/orders/export', headers: headers(), payload: { selection: { mode: 'filter', filter: { customerId: customer.user.id } } } });
    expect(csv.statusCode).toBe(200);
    const numbered = new Map((await prisma.order.findMany({ where: { id: { in: [...ids, prefix + '-other'] } }, select: { id: true, orderNumber: true } })).map(order => [order.id, order.orderNumber]));
    for (const id of [...ids, prefix + '-other']) expect(csv.body.includes(numbered.get(id)! + ',')).toBe(expected.includes(id as never));
  }
});
it('numbers customer orders by creation then id and returns the customer total', async () => {
  for (const [index, id] of ids.entries()) {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders/' + id, headers: headers() });
    expect(response.statusCode).toBe(200); expect(response.json().data).toMatchObject({ customerOrderNumber: index + 1, customerOrderCount: 5 });
  }
});
it.each(['createdAt', 'totalAmount'])('finds first/middle/last neighbours for %s in both directions including ties', async sortBy => {
  for (const sortOrder of ['asc', 'desc']) {
    const ascending = sortBy === 'createdAt' ? ids : [ids[1], ids[4], ids[2], ids[3], ids[0]];
    const expected = sortOrder === 'asc' ? ascending : [...ascending].reverse();
    for (const [index, id] of expected.entries()) {
      const response = await neighbors(id, { sortBy, sortOrder }); expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ position: index + 1, total: 5, previousId: expected[index - 1] ?? null, nextId: expected[index + 1] ?? null });
    }
  }
});
it.each(['createdAt', 'totalAmount'])('finds the closest matching orders around a filtered-out anchor for %s', async sortBy => {
  for (const sortOrder of ['asc', 'desc']) {
    const response = await neighbors(ids[2], { sortBy, sortOrder, status: 'PROCESSING', paymentStatus: 'PAID', search: prefix, createdFrom: dates[0], createdTo: '2026-10-04T00:00:00Z' });
    const before = sortBy === 'createdAt' ? ids[1] : ids[4];
    expect(response.statusCode).toBe(200); expect(response.json().data).toEqual({ position: null, total: 4, previousId: sortOrder === 'asc' ? before : ids[3], nextId: sortOrder === 'asc' ? ids[3] : before });
  }
  expect((await neighbors(ids[2], { customerId: admin.user.id })).json().data).toEqual({ position: null, total: 0, previousId: null, nextId: null });
});
it('uses the same invalid range error, returns 404 and requires an administrator', async () => {
  const invalid = await neighbors(ids[0], { createdFrom: dates[4], createdTo: dates[0] });
  expect(invalid.statusCode).toBe(400); expect(invalid.json().error.code).toBe('INVALID_TIME_RANGE');
  const missing = await neighbors('missing-order'); expect(missing.statusCode).toBe(404); expect(missing.json().error.code).toBe('NOT_FOUND');
  for (const token of [undefined, buyer.token]) {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders/' + ids[0] + '/neighbors', headers: token ? { authorization: 'Bearer ' + token } : {} });
    expect(response.statusCode).toBe(token ? 403 : 401);
  }
  const spec = app.swagger().paths['/api/v1/admin/orders/{id}/neighbors'].get;
  expect(spec.parameters.map((parameter: any) => parameter.name)).toEqual(expect.arrayContaining(['customerId', 'status', 'paymentStatus', 'paymentReview', 'search', 'createdFrom', 'createdTo', 'sortBy', 'sortOrder']));
  for (const status of ['200', '400', '401', '403', '404']) expect(spec.responses[status]).toBeDefined();
});
