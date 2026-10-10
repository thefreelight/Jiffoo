import { beforeAll, afterAll, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { errorHttpFixture } from '../helpers/error-http-fixture';
import { getTestPrisma } from '../helpers/db';
import { createTestUser } from '../helpers/auth';
import { checkErrorSchemas } from '@/utils/error-schemas';
import { ApiClient } from '../../../../packages/shared/api/client';
import { AuthClient } from '../../../../packages/shared/api/auth-client';
import { MemoryStorageAdapter } from '../../../../packages/shared/api/storage-adapters';

const prisma = getTestPrisma();
let fixture: Awaited<ReturnType<typeof errorHttpFixture>>;
let user: Awaited<ReturnType<typeof createTestUser>>;
let token: string;
beforeAll(async () => {
  user = await createTestUser({ emailVerified: false });
  token = jwt.sign({ userId: user.id, sv: 0 }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  fixture = await errorHttpFixture(); fixture.users.add(user.id);
}, 60000);
afterAll(async () => { await fixture?.close(); await prisma.user.deleteMany({ where: { id: user?.id } }); }, 60000);
const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

it.each(['unknown', 'object', 'spoof', 'catalog', 'type', 'init-schema', 'init-unknown'])('A real HTTP %s errors use a fixed sanitized 500 envelope', async (kind) => {
  const response = await fixture.request(`/api/v1/__fixture/fault/${kind}`);
  expect(response.status).toBe(500);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
});

it('A a real non-connection Prisma constraint failure is 500 without SQL or database details', async () => {
  const response = await fixture.request('/api/v1/__fixture/db-unique', json({ email: user.email, username: 'duplicate', password: 'hash', role: 'USER' }));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
});

it('C real schema validation stays 400 and returns only safe field issues', async () => {
  const response = await fixture.request('/api/v1/__fixture/validation', json({ quantity: 'PRIVATE_SECRET', sql: 'PRIVATE_SQL' }));
  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body.error.code).toBe('VALIDATION_ERROR');
  expect(body.error.details.issues.length).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE_SECRET|PRIVATE_SQL|stack|cause/);
  for (const issue of body.error.details.issues) expect(Object.keys(issue).sort()).toEqual(['code', 'message', 'path']);
});

it('C real JWT rejections stay 401 and a valid real user is authenticated', async () => {
  for (const value of ['invalid', jwt.sign({ userId: user.id, sv: 0 }, process.env.JWT_SECRET!, { expiresIn: -1 })]) {
    const response = await fixture.request('/api/v1/__fixture/auth', { headers: { Authorization: `Bearer ${value}` } });
    expect(response.status).toBe(401);
  }
  const response = await fixture.request('/api/v1/__fixture/auth', { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ id: user.id });
});

it('D a real PostgreSQL relay outage is 503 DATABASE_UNAVAILABLE and recovery retains the user', async () => {
  expect((await fixture.request('/api/v1/__fixture/db')).status).toBe(200);
  fixture.db.drop();
  try {
    for (const path of ['/api/v1/__fixture/db', '/api/v1/__fixture/auth', '/api/v1/products']) {
      const response = await fixture.request(path, { headers: { Authorization: `Bearer ${token}` } });
      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('5'); expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect((await response.json()).error.code).toBe('DATABASE_UNAVAILABLE');
    }
    expect(fixture.observed.some((error) => error.name?.startsWith('PrismaClient') && ['P1001', 'P1002', 'P1017', 'P2024'].includes(error.code ?? error.errorCode ?? ''))).toBe(true);
  } finally { fixture.db.recover(); await fixture.send({ kind: 'disconnect-db' }); }
  expect((await fixture.request('/api/v1/__fixture/auth', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
}, 120000);

it('E a real Redis relay outage stays retryable 503 for GET and POST and recovers without replay', async () => {
  fixture.redis.drop();
  try {
    for (const init of [{}, json({ quantity: 1 })]) {
      const response = await fixture.request('method' in init ? '/api/v1/__fixture/validation' : '/api/v1/__fixture/db', init);
      expect(response.status).toBe(503); expect(response.headers.get('Retry-After')).toBe('5');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect((await response.json()).error.code).toBe('SHARED_PROTECTION_UNAVAILABLE');
    }
  } finally { fixture.redis.recover(); }
  expect((await fixture.request('/api/v1/__fixture/validation', json({ quantity: 1 }))).status).toBe(200);
}, 60000);

it('G real OpenAPI declares the statuses produced by every registered Core hook', async () => {
  const response = await fixture.request('/openapi.json'); expect(response.status).toBe(200);
  const document = await response.json(); expect(checkErrorSchemas(document)).toEqual([]);
  for (const path of ['/api/v1/admin/users/', '/api/v1/account/profile']) {
    const operation = document.paths[path]?.get;
    expect(operation).toBeDefined();
    for (const status of ['401', '403', '429', '503', '500']) expect(operation.responses[status]).toBeDefined();
  }
  for (const [path, method] of [
    ['/api/v1/payments/create-session', 'post'], ['/api/v1/payments/webhook/{provider}', 'post'],
    ['/api/v1/payments/verify/{paymentId}', 'get'], ['/api/v1/checkout/quote', 'post'],
    ['/api/v1/orders/', 'post'], ['/api/v1/admin/orders/{id}', 'get'],
    ['/api/v1/admin/orders/{id}/record-manual-payment', 'post'],
    ['/api/v1/extensions/plugin/{slug}/health', 'get'], ['/api/v1/extensions/plugin/{slug}/manifest', 'get'],
  ]) {
    const operation = document.paths[path]?.[method];
    expect(operation).toBeDefined();
    for (const status of ['404', '502', '504']) expect(operation.responses[status]).toBeDefined();
  }
  expect(document.paths['/api/v1/checkout/quote'].post.responses['409']).toBeDefined();
  const missing = structuredClone(document);
  delete missing.paths['/api/v1/payments/create-session'].post.responses['504'];
  expect(checkErrorSchemas(missing)).toContain('POST /api/v1/payments/create-session: missing 504');
});

it('G real NotFound returns the Core envelope without echoing a URL or query secret', async () => {
  const response = await fixture.request('/private-missing-route?token=PRIVATE_SECRET');
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
});

it('J EmailVerificationService propagates a real transactional foreign-key failure as sanitized 500', async () => {
  const beforeTokens = await prisma.authToken.count();
  const beforeNotifications = await prisma.notification.count();
  const failure = new Promise<void>((resolve) => {
    const receive = (message: { kind?: string; code?: string }) => {
      if (message.kind === 'observed-error' && message.code === 'P2003') { fixture.child.off('message', receive); resolve(); }
    };
    fixture.child.on('message', receive);
  });
  const response = await fixture.request('/api/v1/__fixture/email', json({ userId: `missing-${randomUUID()}`, email: user.email }));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  await failure;
  expect(await prisma.authToken.count()).toBe(beforeTokens);
  expect(await prisma.notification.count()).toBe(beforeNotifications);
});

it('J InstallService propagates an unexpected bcrypt argument failure as sanitized 500', async () => {
  const before = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
  const response = await fixture.request('/api/v1/__fixture/install', json({}));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  expect(await prisma.systemSettings.findUnique({ where: { id: 'system' } })).toEqual(before);
});

it('H the real shared HTTP client preserves the Core status and code', async () => {
  const client = new ApiClient({ baseURL: `${fixture.base}/api/v1`, defaultHeaders: { 'x-forwarded-for': fixture.ip } }, new MemoryStorageAdapter());
  const response = await client.get('/__fixture/fault/unknown');
  expect(response.httpStatus).toBe(500);
  expect(response.error).toEqual({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
});

it('H a real profile dependency outage does not clear authenticated client state', async () => {
  const storage = new MemoryStorageAdapter();
  const client = new AuthClient({ baseURL: `${fixture.base}/api/v1`, defaultHeaders: { 'x-forwarded-for': fixture.ip } }, storage);
  client.setToken(token);
  fixture.db.drop();
  try {
    const response = await client.validateAuth();
    expect(response.success).toBe(false); expect(response.httpStatus).toBe(503);
    expect(response.error?.code).toBe('DATABASE_UNAVAILABLE');
    expect(client.getToken()).toBe(token);
  } finally { fixture.db.recover(); await fixture.send({ kind: 'disconnect-db' }); }
}, 60000);

it('H a real refresh dependency outage propagates 503 without null or original 401', async () => {
  const storage = new MemoryStorageAdapter();
  const client = new AuthClient({ baseURL: `${fixture.base}/api/v1`, defaultHeaders: { 'x-forwarded-for': fixture.ip } }, storage);
  const expired = jwt.sign({ userId: user.id, sv: 0 }, process.env.JWT_SECRET!, { expiresIn: -1 });
  const refresh = jwt.sign({ userId: user.id, sv: 0, type: 'refresh' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  client.setToken(expired); storage.setItem('refresh_token', refresh);
  fixture.db.drop();
  try {
    const response = await client.getProfile();
    console.info('Refresh dependency evidence', { status: response.httpStatus, code: response.error?.code, observed: fixture.observed.slice(-4) });
    expect(response.httpStatus).toBe(503); expect(response.error?.code).toBe('DATABASE_UNAVAILABLE');
    expect(client.getToken()).toBe(expired); expect(client.getRefreshToken()).toBe(refresh);
  } finally { fixture.db.recover(); await fixture.send({ kind: 'disconnect-db' }); }
}, 60000);
