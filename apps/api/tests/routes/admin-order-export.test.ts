import { createNumberedOrders } from '../helpers/numbered-order';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { csvCell } from '@/utils/csv';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';

let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, buyer: Awaited<ReturnType<typeof createUserWithToken>>;
const prefix = 'list-export-' + randomUUID(), ids = [0, 1, 2, 3].map(i => prefix + '-' + i);
const orderNumbers: Record<string, string> = {};
const first = '2026-10-01T00:00:00.000Z', last = '2026-10-02T00:00:00.000Z';
beforeAll(async () => {
  app = await createTestApp({ enableSwagger: true }); admin = await createAdminWithToken(); buyer = await createUserWithToken({ username: '=SUM(1,2)\nBuyer' });
  await createNumberedOrders(prisma, { data: ids.map((id, i) => ({ id, userId: buyer.user.id, status: 'PROCESSING', paymentStatus: 'PAID', subtotalAmount: i < 2 ? 10 : 20, totalAmount: i < 2 ? 10 : 20, currency: 'USD', createdAt: i < 3 ? first : last })) });
  Object.assign(orderNumbers, Object.fromEntries((await prisma.order.findMany({ where: { id: { in: ids } } })).map(order => [order.id, order.orderNumber])));
  await prisma.orderShippingAddress.create({ data: { orderId: ids[0], firstName: 'Test', lastName: 'Buyer', addressLine1: '=1+1', addressLine2: 'A,"B"\nC', city: 'City', country: 'US' } });
  await CacheService.incrementOrderVersion();
});
afterAll(async () => {
  await prisma.order.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.user.id, buyer.user.id] } } });
  await app.close();
});
const headers = () => ({ authorization: `Bearer ${admin.token}` });
const list = async (query: Record<string, string>) => app.inject({ method: 'GET', url: '/api/v1/admin/orders?' + new URLSearchParams({ search: prefix, ...query }), headers: headers() });
const csv = async (selection: unknown, extra = {}, locale = 'en') => app.inject({ method: 'POST', url: '/api/v1/admin/orders/export', headers: { ...headers(), 'accept-language': locale }, payload: { selection, ...extra } });

it('documents CSV success and typed errors along with list filter and sort inputs', () => {
  const spec = app.swagger();
  const exported = spec.paths['/api/v1/admin/orders/export'].post;
  expect(exported.responses['200'].content['text/csv'].schema).toMatchObject({ type: 'string' });
  for (const status of ['400', '401', '403']) expect(exported.responses[status].content['application/json'].schema).toHaveProperty('properties');
  const inputs = spec.paths['/api/v1/admin/orders/'].get.parameters.map((input: any) => input.name);
  expect(inputs).toEqual(expect.arrayContaining(['sortBy', 'sortOrder', 'createdFrom', 'createdTo']));
});

it.each(['createdAt', 'totalAmount'])('sorts %s both ways with deterministic id tie breaks', async sortBy => {
  for (const sortOrder of ['asc', 'desc']) {
    const response = await list({ sortBy, sortOrder }); expect(response.statusCode).toBe(200);
    expect(response.json().data.items.map((row: any) => row.id)).toEqual(sortOrder === 'asc' ? ids : [...ids].reverse());
  }
});
it('uses half-open UTC bounds together with status, payment and search', async () => {
  const response = await list({ createdFrom: first, createdTo: last, status: 'PROCESSING', paymentStatus: 'PAID' });
  expect(response.statusCode).toBe(200); expect(response.json().data.items.map((row: any) => row.id)).toEqual(ids.slice(0, 3).reverse());
  expect((await list({ createdFrom: first, createdTo: first })).json().data.total).toBe(0);
  expect((await list({ createdFrom: last })).json().data.items.map((row: any) => row.id)).toEqual([ids[3]]);
  expect((await list({ createdTo: first })).json().data.total).toBe(0);
  expect((await list({ status: 'PENDING' })).json().data.total).toBe(0);
  const invalid = await list({ createdFrom: last, createdTo: first });
  expect(invalid.statusCode).toBe(400); expect(invalid.json().error.code).toBe('INVALID_TIME_RANGE');
  expect((await list({ sortBy: 'id' })).statusCode).toBe(400);
});
it('requires admin authentication before export validation', async () => {
  for (const token of [undefined, buyer.token]) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/orders/export', headers: token ? { authorization: `Bearer ${token}` } : {}, payload: {} });
    expect(response.statusCode).toBe(token ? 403 : 401);
  }
});
it('exports ids exactly, ignores unknown ids, localizes headers and protects cells', async () => {
  const spy = vi.spyOn(systemSettingsService, 'getTimezone').mockResolvedValue('Asia/Shanghai');
  try {
    for (const [locale, header] of [['en', 'Order number,Placed at'], ['zh-Hans', '订单编号,下单时间'], ['zh-Hant', '訂單編號,下單時間']]) {
      const response = await csv({ mode: 'ids', ids: [ids[0], ids[0], 'missing'] }, {}, locale);
      expect(response.statusCode).toBe(200); expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="orders-\d{8}-\d{4}\.csv"/);
      expect(response.rawPayload.subarray(0, 3)).toEqual(Buffer.from([239, 187, 191]));
      expect(response.body).toContain('\uFEFF' + header); expect(response.body).toContain('2026-10-01 08:00:00,Asia/Shanghai');
      expect(response.body).toContain('"\'=SUM(1,2)\nBuyer"'); expect(response.body).toContain("'=1+1");
      expect(response.body).toContain('"A,""B""\nC"'); expect(response.body).toContain(',10.00,');
      expect(response.body).not.toContain(orderNumbers[ids[1]]); expect(response.body).not.toContain('missing');
    }
  } finally { spy.mockRestore(); }
});
it('exports filters minus exclusions in requested order and validates limits', async () => {
  const response = await csv({ mode: 'filter', filter: { search: prefix, status: 'PROCESSING', paymentStatus: 'PAID', createdFrom: first, createdTo: last }, excludeIds: [ids[1]] }, { sortBy: 'totalAmount', sortOrder: 'asc' });
  expect(response.statusCode).toBe(200); expect(response.body.indexOf(orderNumbers[ids[0]])).toBeLessThan(response.body.indexOf(orderNumbers[ids[2]]));
  expect(response.body).not.toContain(orderNumbers[ids[1]]); expect(response.body).not.toContain(orderNumbers[ids[3]]);
  for (const selection of [{ mode: 'ids', ids: [] }, { mode: 'ids', ids: Array.from({ length: 101 }, (_, i) => String(i)) }, { mode: 'filter', filter: {}, excludeIds: Array.from({ length: 101 }, (_, i) => String(i)) }]) expect((await csv(selection)).statusCode).toBe(400);
  const invalid = await csv({ mode: 'filter', filter: { createdFrom: last, createdTo: first } });
  expect(invalid.statusCode).toBe(400); expect(invalid.json().error.code).toBe('INVALID_TIME_RANGE');
});
it('streams more than one bounded batch without missing or duplicating tied rows', async () => {
  const batchIds = Array.from({ length: 503 }, (_, i) => prefix + '-batch-' + String(i).padStart(4, '0'));
  await createNumberedOrders(prisma, { data: batchIds.map(id => ({ id, userId: buyer.user.id, subtotalAmount: 1, totalAmount: 1, createdAt: first })) });
  for (const sortBy of ['createdAt', 'totalAmount']) {
    const response = await csv({ mode: 'filter', filter: { search: prefix + '-batch-' } }, { sortBy, sortOrder: 'asc' });
    expect(response.statusCode).toBe(200);
    const numbers = await prisma.order.findMany({ where: { id: { in: batchIds } }, orderBy: { id: 'asc' }, select: { orderNumber: true } });
    const idsInCsv = response.body.replace(/^\uFEFF/, '').trim().split('\r\n').slice(1).map(row => row.split(',')[0]);
    expect(idsInCsv).toEqual(numbers.map(order => order.orderNumber));
  }
});
it.each(['=1', '+1', '-1', '@a', '\ttext', '\rtext'])('protects formula prefix %j', value => expect(csvCell(value)).toContain("'" + value));
