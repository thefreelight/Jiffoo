import { fork, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { errorHttpFixture } from '../../api/tests/helpers/error-http-fixture';
import { createTestUser } from '../../api/tests/helpers/auth';
import { getTestPrisma } from '../../api/tests/helpers/db';

let fixture: Awaited<ReturnType<typeof errorHttpFixture>>;
let child: ChildProcess;
let relay: Server;
let shop: string;
let target = '';
let faultCode = 'INTERNAL_SERVER_ERROR';
let profileWrites = 0;
let user: Awaited<ReturnType<typeof createTestUser>>;
let access: string;
const prisma = getTestPrisma();
beforeAll(async () => {
  user = await createTestUser();
  access = jwt.sign({ userId: user.id, sv: 0 }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  fixture = await errorHttpFixture(); fixture.users.add(user.id);
  // The relay directs selected requests to test-only fault routes on the real app.
  // Every response still comes from buildApp's real TCP listener and mapper.
  relay = createServer(async (request, response) => {
    const original = new URL(request.url!, fixture.base);
    if (original.pathname === '/api/v1/account/profile' && request.method === 'PUT') profileWrites++;
    const url = target && original.pathname === target ? new URL(`/api/v1/__fixture/catalog/${faultCode}`, fixture.base) : original;
    let payload = ''; for await (const chunk of request) payload += chunk;
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (value && !['host', 'content-length', 'connection'].includes(name)) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    headers.set('x-forwarded-for', fixture.ip);
    const upstream = await fetch(url, { method: request.method, headers, ...(request.method !== 'GET' && request.method !== 'HEAD' ? { body: payload } : {}) });
    response.writeHead(upstream.status, Object.fromEntries([...upstream.headers].filter(([name]) => !['transfer-encoding', 'connection', 'content-length'].includes(name))));
    response.end(Buffer.from(await upstream.arrayBuffer()));
  });
  await new Promise<void>((resolve) => relay.listen(0, '127.0.0.1', resolve));
  const address = relay.address(); if (!address || typeof address === 'string') throw new Error('Missing HTTP relay');
  child = fork(fileURLToPath(new URL('./helpers/availability-shop-child.mjs', import.meta.url)), [], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, NODE_ENV: 'production', API_SERVICE_URL: `http://127.0.0.1:${address.port}`, STOREFRONT_URL: 'http://127.0.0.1:3003' },
  });
  child.stdout!.on('data', (data) => process.stdout.write(data)); child.stderr!.on('data', (data) => process.stderr.write(data));
  const ready = await Promise.race([once(child, 'message'), once(child, 'exit').then(([code]) => { throw new Error(`Shop exited ${code}`); })]);
  shop = `http://127.0.0.1:${(ready[0] as { port: number }).port}`;
}, 120000);
afterAll(async () => {
  if (child?.connected) { const exited = once(child, 'exit'); child.send('stop'); await exited; }
  if (relay) { relay.closeAllConnections(); await new Promise<void>((resolve) => relay.close(() => resolve())); }
  await fixture?.close(); await prisma.user.deleteMany({ where: { id: user?.id } }); await prisma.$disconnect();
}, 60000);

it('I real Shop refresh failures preserve 500 502 503 504 and never clear cookies or replay the write', async () => {
  const expired = jwt.sign({ userId: user.id, sv: 0 }, process.env.JWT_SECRET!, { expiresIn: -1 });
  const refresh = jwt.sign({ userId: user.id, sv: 0, type: 'refresh' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  target = '/api/v1/auth/refresh';
  try {
    for (const [code, status] of [['INTERNAL_SERVER_ERROR', 500], ['PLUGIN_ERROR', 502], ['DATABASE_UNAVAILABLE', 503], ['PLUGIN_TIMEOUT', 504]] as const) {
      faultCode = code;
      const before = profileWrites;
      const response = await fetch(`${shop}/bff/account/profile`, { method: 'PUT', headers: { Cookie: `shop_access=${expired}; shop_refresh=${refresh}`, Origin: shop, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'No replay' }) });
      expect(response.status).toBe(status); expect(response.headers.get('set-cookie')).toBeNull();
      expect(profileWrites - before).toBe(1);
      const body = await response.json(); expect(body.error.code).toBe(code); expect(JSON.stringify(body)).not.toMatch(/PRIVATE|stack|cause|sql/i);
    }
  } finally { target = ''; }
});

it('I a real refresh authentication rejection clears cookies while dependency errors do not', async () => {
  const expired = jwt.sign({ userId: user.id, sv: 0 }, process.env.JWT_SECRET!, { expiresIn: -1 });
  const expiredRefresh = jwt.sign({ userId: user.id, sv: 0, type: 'refresh' }, process.env.JWT_SECRET!, { expiresIn: -1 });
  const response = await fetch(`${shop}/bff/account/profile`, { headers: { Cookie: `shop_access=${expired}; shop_refresh=${expiredRefresh}` } });
  expect(response.status).toBe(401); expect(response.headers.getSetCookie()).toHaveLength(2);
  for (const cookie of response.headers.getSetCookie()) expect(cookie).toContain('Max-Age=0');
});

it.each(['/api/v1/store/theme', '/api/v1/store/storefront-code', '/api/v1/account/profile', '/api/v1/cart'])('I real SSR %s failures reach the safe production 500 boundary', async (path) => {
  target = path; faultCode = 'INTERNAL_SERVER_ERROR';
  try {
    const response = await fetch(`${shop}/en/products`, { headers: { Cookie: `shop_access=${access}` } });
    expect(response.status).toBe(500);
    expect(new URL(response.url).pathname).toBe('/en/products');
    const body = await response.text(); expect(body).not.toMatch(/PRIVATE_SQL|PRIVATE_SECRET|fixture-password|ALICE_PRIVATE_TOKEN|BOB_PRIVATE_TOKEN/);
    expect(body).not.toContain(access);
  } finally { target = ''; }
});
