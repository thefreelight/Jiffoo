import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { redisCache } from '@/core/cache/redis';
import { systemSettingsService } from '@/core/settings/service';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken } from '../helpers/auth';
import { createTestProduct, createTestOrder, createTestOrderItem } from '../helpers/fixtures';

let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, buyer: Awaited<ReturnType<typeof createUserWithToken>>;
const prefix = 'a2-' + randomUUID(), owned: string[] = [];
let categoryId: string, childId: string;
const sorted: { id: string; price: number; stock: number; name: string; updatedAt: string; createdAt: string }[] = [];
const redisClient = redisCache.getRawClient();
const redisEvidence: Array<Record<string, unknown>> = [];
let restoreRedisDiagnostics = () => {};
function recordRedisState(event: string, details: Record<string, unknown> = {}) {
  const state = { event, at: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString(), pid: process.pid,
    status: redisClient.status, connected: redisCache.getConnectionStatus(), ...details };
  redisEvidence.push(state);
  console.info('Product bulk Redis diagnostic', JSON.stringify(state));
}
function assertRedisReady() {
  expect(redisCache.getConnectionStatus(), JSON.stringify(redisEvidence)).toBe(true);
  expect(redisClient.status, JSON.stringify(redisEvidence)).toBe('ready');
}
beforeAll(async () => {
  const diagnosticClient = redisClient as unknown as { stream?: Socket; connector: { disconnect(): void } };
  const socketCleanups: Array<() => void> = [];
  const observedSockets = new WeakSet<Socket>();
  let nextSocketId = 0;
  const observeSocket = () => {
    const socket = diagnosticClient.stream;
    if (!socket || observedSockets.has(socket)) return;
    observedSockets.add(socket);
    const socketId = ++nextSocketId;
    const recordSocket = (event: string, details: Record<string, unknown> = {}) => recordRedisState(event, {
      socketId, localAddress: socket.localAddress, localPort: socket.localPort,
      remoteAddress: socket.remoteAddress, remotePort: socket.remotePort,
      bytesRead: socket.bytesRead, bytesWritten: socket.bytesWritten,
      destroyed: socket.destroyed, readableEnded: socket.readableEnded, writableEnded: socket.writableEnded,
      ...details,
    });
    const listeners = ['end', 'close', 'error', 'timeout', 'finish'].map(event => {
      const listener = (value?: unknown) => recordSocket('socket-' + event, {
        ...(event === 'close' ? { hadError: value } : {}),
        ...(event === 'error' ? { errorCode: (value as NodeJS.ErrnoException)?.code } : {}),
      });
      socket.on(event, listener);
      return { event, listener };
    });
    const end = socket.end;
    const endSpy = vi.spyOn(socket, 'end').mockImplementation(function (this: Socket, ...args: Parameters<Socket['end']>) {
      recordSocket('socket-end-call', { stack: new Error('Redis socket end caller').stack });
      return Reflect.apply(end, this, args);
    });
    const destroy = socket.destroy;
    const destroySpy = vi.spyOn(socket, 'destroy').mockImplementation(function (this: Socket, ...args: Parameters<Socket['destroy']>) {
      recordSocket('socket-destroy-call', { stack: new Error('Redis socket destroy caller').stack });
      return Reflect.apply(destroy, this, args);
    });
    socketCleanups.push(() => {
      for (const { event, listener } of listeners) socket.off(event, listener);
      destroySpy.mockRestore();
      endSpy.mockRestore();
    });
    recordSocket('socket-observed');
  };
  const connector = diagnosticClient.connector;
  const connectorDisconnect = connector.disconnect;
  const connectorSpy = vi.spyOn(connector, 'disconnect').mockImplementation(function (this: typeof connector, ...args: Parameters<typeof connectorDisconnect>) {
    recordRedisState('connector-disconnect-call', { stack: new Error('Redis connector disconnect caller').stack });
    return Reflect.apply(connectorDisconnect, this, args);
  });
  const disconnect = redisClient.disconnect.bind(redisClient);
  const disconnectSpy = vi.spyOn(redisClient, 'disconnect').mockImplementation((reconnect) => {
    recordRedisState('disconnect-call', { stack: new Error('Redis disconnect caller').stack });
    return disconnect(reconnect);
  });
  const quitSpy = vi.spyOn(redisClient, 'quit');
  const observers = ['connect', 'ready', 'close', 'reconnecting', 'end', 'error'].map(event => {
    const listener = (value?: unknown) => {
      if (event === 'connect') observeSocket();
      recordRedisState(event, {
        quitCalls: quitSpy.mock.calls.length,
        ...(event === 'error' ? { errorCode: (value as NodeJS.ErrnoException)?.code, errorName: (value as Error)?.name } : {}),
      });
    };
    redisClient.on(event, listener);
    return { event, listener };
  });
  restoreRedisDiagnostics = () => {
    for (const { event, listener } of observers) redisClient.off(event, listener);
    for (const cleanup of socketCleanups.reverse()) cleanup();
    connectorSpy.mockRestore();
    quitSpy.mockRestore();
    disconnectSpy.mockRestore();
  };
  recordRedisState('before-connect');
  await redisCache.connect();
  recordRedisState('after-connect');
  expect(await redisCache.ping(), JSON.stringify(redisEvidence)).toBe(true);
  observeSocket();
  recordRedisState('before-create-test-app');
  app = await createTestApp({ enableSwagger: true });
  recordRedisState('after-create-test-app');
  recordRedisState('before-admin-auth');
  admin = await createAdminWithToken();
  recordRedisState('after-admin-auth');
  recordRedisState('before-buyer-auth');
  buyer = await createUserWithToken();
  recordRedisState('after-buyer-auth');
  recordRedisState('after-app-bootstrap');
  categoryId = (await prisma.category.create({ data: { name: prefix, slug: prefix } })).id;
  childId = (await prisma.category.create({ data: { name: prefix + '-child', slug: prefix + '-child', parentId: categoryId } })).id;
  for (let index = 0; index < 4; index++) {
    const product = await createTestProduct({ name: prefix + '-sort', price: index < 2 ? 10 : 20, stock: index < 2 ? 2 : 5 }); owned.push(product.id);
    const at = index < 2 ? '2026-10-01T00:00:00.000Z' : '2026-10-02T00:00:00.000Z';
    await prisma.product.update({ where: { id: product.id }, data: { categoryId, createdAt: at, updatedAt: at } });
    sorted.push({ id: product.id, name: product.name, price: index < 2 ? 10 : 20, stock: index < 2 ? 2 : 5, updatedAt: at, createdAt: at });
  }
  await CacheService.incrementProductVersion();
});
afterAll(async () => {
  recordRedisState('before-suite-cleanup');
  restoreRedisDiagnostics();
  await prisma.eventDelivery.deleteMany({ where: { event: { aggregateId: { in: owned } } } });
  await prisma.eventRecord.deleteMany({ where: { aggregateId: { in: owned } } });
  await prisma.orderItem.deleteMany({ where: { productId: { in: owned } } });
  await prisma.order.deleteMany({ where: { userId: buyer.user.id } });
  await prisma.product.deleteMany({ where: { OR: [{ id: { in: owned } }, { id: { startsWith: prefix } }] } });
  await prisma.category.delete({ where: { id: childId } }); await prisma.category.delete({ where: { id: categoryId } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.user.id, buyer.user.id] } } }); await app.close(); await redisCache.disconnect();
});
const headers = () => ({ authorization: 'Bearer ' + admin.token });
const selection = (ids: string[]) => ({ mode: 'ids', ids });
const post = (path: string, payload: unknown, locale = 'en') => app.inject({ method: 'POST', url: '/api/v1/admin/products/' + path, headers: { ...headers(), 'accept-language': locale }, payload });

it.each(['price', 'stock', 'name', 'updatedAt', 'createdAt'] as const)('sorts %s in SQL in both directions, including id ties and combined filters', async sortBy => {
  for (const sortOrder of ['asc', 'desc']) {
    const query = new URLSearchParams({ search: prefix + '-sort', categoryId, status: 'active', sortBy, sortOrder, limit: '2', page: '2' });
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/products?' + query, headers: headers() });
    expect(response.statusCode).toBe(200);
    const expected = [...sorted].sort((a, b) => {
      const value = a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : a.id.localeCompare(b.id);
      return sortOrder === 'asc' ? value : -value;
    }).slice(2).map(product => product.id);
    expect(response.json().data.items.map((product: any) => product.id)).toEqual(expected);
    expect(response.json().data.items.every((product: any) => typeof product.updatedAt === 'string' && product.hasOrders === false)).toBe(true);
  }
});
it('combines each sort with SPU/SKU search, uncategorized and inactive/out-of-stock status', async () => {
  const product = await createTestProduct({ name: prefix + '-empty', stock: 0 }); owned.push(product.id);
  for (const sortBy of ['price', 'stock', 'updatedAt']) for (const search of [product.spuCode, product.variants[0].skuCode]) {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/products?' + new URLSearchParams({ search, categoryId: 'none', status: 'outOfStock', sortBy }), headers: headers() });
    expect(response.json().data.items.map((row: any) => row.id)).toEqual([product.id]);
  }
  expect((await post('bulk', { action: 'deactivate', selection: selection([product.id]) })).statusCode).toBe(200);
  const response = await app.inject({ method: 'GET', url: '/api/v1/admin/products?' + new URLSearchParams({ search: product.spuCode, status: 'inactive', sortBy: 'stock' }), headers: headers() });
  expect(response.json().data.items.map((row: any) => row.id)).toEqual([product.id]);
});
it.each(['activate', 'deactivate', 'setCategory', 'delete'])('dry-runs and executes %s with the single-operation side effects', async action => {
  const product = await createTestProduct({ name: prefix + '-action-' + action }); owned.push(product.id);
  if (action === 'activate') await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
  const before = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  assertRedisReady();
  const version = await CacheService.getProductVersion();
  const body = { action, selection: selection([product.id]), ...(action === 'setCategory' ? { categoryId } : {}) };
  const dry = await post('bulk', { ...body, dryRun: true }); expect(dry.statusCode).toBe(200);
  expect(dry.json().data).toMatchObject({ matched: 1, processed: 1, skippedCount: 0, processedPreview: [{ id: product.id, name: product.name }] });
  expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toEqual(before);
  expect(await CacheService.getProductVersion()).toBe(version);
  const result = await post('bulk', body); expect(result.statusCode).toBe(200);
  expect(result.json().data).toMatchObject({ matched: 1, processed: 1, skippedCount: 0 });
  assertRedisReady();
  expect(await CacheService.getProductVersion(), JSON.stringify(redisEvidence)).toBe(version + 1);
  const after = await prisma.product.findUnique({ where: { id: product.id } });
  if (action === 'delete') expect(after).toBeNull();
  else {
    expect(after).toMatchObject(action === 'setCategory' ? { categoryId } : { isActive: action === 'activate' });
    expect(await prisma.eventRecord.count({ where: { aggregateId: product.id, type: 'product.updated' } })).toBe(1);
  }
});
it('emits identical snapshots and invalidates the same cache entries as a single update', async () => {
  const product = await createTestProduct({ name: prefix + '-events' }); owned.push(product.id);
  const spy = vi.spyOn(CacheService, 'deleteProduct');
  try {
    const single = await app.inject({ method: 'PUT', url: '/api/v1/admin/products/' + product.id, headers: headers(), payload: { isActive: false } }); expect(single.statusCode).toBe(200);
    const first = await prisma.eventRecord.findFirstOrThrow({ where: { aggregateId: product.id, type: 'product.updated' } });
    await prisma.product.update({ where: { id: product.id }, data: { isActive: true } });
    expect((await post('bulk', { action: 'deactivate', selection: selection([product.id]) })).statusCode).toBe(200);
    const events = await prisma.eventRecord.findMany({ where: { aggregateId: product.id, type: 'product.updated' } });
    expect(events).toHaveLength(2); expect(events.every(event => JSON.stringify(event.data) === JSON.stringify(first.data))).toBe(true);
    expect(spy.mock.calls.filter(([id]) => id === product.id)).toHaveLength(2);
  } finally { spy.mockRestore(); }
});
it('skips sold products, caps the detail list at twenty and honors filter exclusions', async () => {
  const order = await createTestOrder({ userId: buyer.user.id });
  const ids: string[] = [];
  for (let index = 0; index < 23; index++) {
    const product = await createTestProduct({ name: prefix + '-delete-' + index }); owned.push(product.id); ids.push(product.id);
    await createTestOrderItem({ orderId: order.id, productId: product.id, variantId: product.variants[0].id });
  }
  const free = await createTestProduct({ name: prefix + '-delete-free' }); owned.push(free.id);
  const dry = await post('bulk', { action: 'delete', dryRun: true, selection: selection([...ids, free.id]) });
  expect(dry.json().data).toMatchObject({ matched: 24, processed: 1, skippedCount: 23 }); expect(dry.json().data.skipped).toHaveLength(20);
  expect(dry.json().data.skipped.every((row: any) => row.reason === 'HAS_ORDERS')).toBe(true);
  const result = await post('bulk', { action: 'delete', selection: { mode: 'filter', filter: { search: prefix + '-delete-' }, excludeIds: [ids[0]] } });
  expect(result.json().data).toMatchObject({ matched: 23, processed: 1, skippedCount: 22 }); expect(result.json().data.skipped).toHaveLength(20);
  expect(await prisma.product.findUnique({ where: { id: free.id } })).toBeNull(); expect(await prisma.product.count({ where: { id: { in: ids } } })).toBe(23);
});
it('enforces the 5000 filter limit and validates category assignment and missing ids', async () => {
  await prisma.product.createMany({ data: Array.from({ length: 5001 }, (_, index) => ({ id: prefix + '-limit-' + index, name: prefix + '-limit', slug: prefix + '-limit-' + index, spuCode: prefix + '-limit-' + index })) });
  const response = await post('bulk', { action: 'deactivate', dryRun: true, selection: { mode: 'filter', filter: { search: prefix + '-limit' } } });
  expect(response.statusCode).toBe(400); expect(response.json().error).toMatchObject({ code: 'VALIDATION_ERROR', details: { limit: 5000, matched: 5001 } });
  for (const extra of [{}, { categoryId: 'missing' }]) {
    const invalid = await post('bulk', { action: 'setCategory', selection: selection([sorted[0].id]), ...extra }); expect(invalid.statusCode).toBe('categoryId' in extra ? 404 : 400);
  }
  expect((await post('bulk', { action: 'setCategory', categoryId: null, selection: selection([sorted[0].id]) })).statusCode).toBe(200);
  const missing = await post('bulk', { action: 'activate', selection: selection(['missing']) }); expect(missing.json().data).toMatchObject({ matched: 1, processed: 0, skippedCount: 1, skipped: [{ id: 'missing', reason: 'NOT_FOUND' }] });
});
it('exports all variant columns with BOM, localized labels, quoting, formula guards and store-local seconds', async () => {
  const product = await createTestProduct({ name: '=Name,"quoted"\nsecond', price: 12.35 }); owned.push(product.id);
  await prisma.product.update({ where: { id: product.id }, data: { categoryId, updatedAt: '2026-10-13T20:02:03Z' } });
  await prisma.productVariant.update({ where: { id: product.variants[0].id }, data: { name: '=Variant,\nline' } });
  const timezone = vi.spyOn(systemSettingsService, 'getTimezone').mockResolvedValue('Asia/Shanghai');
  try {
    for (const [locale, first] of [['en', 'SPU,Product name,Product status'], ['zh-Hans', 'SPU,商品名称,商品状态'], ['zh-Hant', 'SPU,商品名稱,商品狀態']]) {
      const response = await post('export', { selection: selection([product.id, 'missing']) }, locale);
      expect(response.statusCode).toBe(200); expect(response.rawPayload.subarray(0, 3)).toEqual(Buffer.from([239, 187, 191]));
      expect(response.body).toContain('\uFEFF' + first); expect(response.body.split('\r\n')[0].split(',')).toHaveLength(13);
      expect(response.body).toContain('"\'=Name,""quoted""\nsecond"'); expect(response.body).toContain('"\'=Variant,\nline"');
      expect(response.body).toContain('2026-10-14 04:02:03,Asia/Shanghai'); expect(response.body).toContain(',12.35,');
      expect(response.headers['content-disposition']).toMatch(/products-\d{8}-\d{4}\.csv/);
      expect(response.headers['x-product-count']).toBe('1'); expect(response.headers['x-product-skipped']).toBe('1');
    }
  } finally { timezone.mockRestore(); }
});
it('exports more than 500 products in bounded batches and filters exclusions', async () => {
  const ids = Array.from({ length: 503 }, (_, index) => prefix + '-csv-' + String(index).padStart(4, '0'));
  await prisma.product.createMany({ data: ids.map(id => ({ id, name: id, spuCode: id, slug: id })) });
  await prisma.productVariant.createMany({ data: ids.map(id => ({ productId: id, name: 'Variant', skuCode: id + '-sku', salePrice: 1, stock: 1 })) });
  const response = await post('export', { selection: { mode: 'filter', filter: { search: prefix + '-csv-' }, excludeIds: [ids[0]] }, sortBy: 'name', sortOrder: 'asc' });
  expect(response.statusCode).toBe(200);
  for (const id of ids.slice(1)) expect(response.body).toContain(',' + id + ','); expect(response.body).not.toContain(ids[0]);
});
it('returns direct product and child counts and documents typed admin-only routes', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/admin/products/categories?limit=100', headers: headers() });
  const category = response.json().data.items.find((row: any) => row.id === categoryId); expect(category.childCount).toBe(1);
  expect(category.productCount).toBe(await prisma.product.count({ where: { categoryId } }));
  for (const route of ['bulk', 'export']) {
    const operation = app.swagger().paths['/api/v1/admin/products/' + route].post;
    for (const code of ['400', '401', '403', '404']) expect(operation.responses[code].content['application/json'].schema).toHaveProperty('properties');
    for (const token of [undefined, buyer.token]) {
      const denied = await app.inject({ method: 'POST', url: '/api/v1/admin/products/' + route, headers: token ? { authorization: 'Bearer ' + token } : {}, payload: {} }); expect(denied.statusCode).toBe(token ? 403 : 401);
    }
  }
});
