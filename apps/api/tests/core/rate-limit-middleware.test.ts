import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { SharedProtection } from '@/infra/shared-protection';
import { protectionApp } from '../helpers/protection-app';
import { getTestPrisma } from '../helpers/db';
import { JwtUtils } from '@/utils/jwt';
import { env } from '@/config/env';
import { ApiTokenService } from '@/core/auth/api-token';
import { redisCache } from '@/core/cache/redis';
import { LoggerService } from '@/core/logger/unified-logger';
import Fastify from 'fastify';
import rateLimiter from '@/plugins/rate-limiter';

describe('shared request protection', () => {
  const namespace = `test:protection:${randomUUID()}`;
  const protection = new SharedProtection(env.REDIS_URL);
  const redis = new Redis(env.REDIS_URL);
  const prisma = getTestPrisma();
  const userIds: string[] = [];
  const apps: Awaited<ReturnType<typeof protectionApp>>[] = [];
  let index = 0;
  async function app() { const value = await protectionApp(protection, `${namespace}:${index++}`); apps.push(value); return value; }
  async function user() {
    const id = randomUUID();
    const row = await prisma.user.create({ data: { id, email: `${id}@protection.example`, username: id, password: 'unused', role: 'CUSTOMER' } });
    userIds.push(id);
    return JwtUtils.sign({ userId: id, sv: row.sessionVersion });
  }
  async function admin() {
    const id = randomUUID();
    const row = await prisma.user.create({ data: { id, email: `${id}@protection.example`, username: id, password: 'unused', role: 'ADMIN' } });
    userIds.push(id);
    return JwtUtils.sign({ userId: id, sv: row.sessionVersion });
  }
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((value) => value.close()));
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
    const keys = await redis.keys(`${namespace}:*`);
    if (keys.length) await redis.del(...keys);
  });
  afterAll(() => { protection.close(); redis.disconnect(); });
  it('A: anonymous clients use independent trusted IP buckets', async () => {
    const value = await app();
    for (let i = 0; i < 3; i++) expect((await value.inject({ url: '/read', remoteAddress: '192.0.2.1' })).statusCode).toBe(200);
    expect((await value.inject({ url: '/read', remoteAddress: '192.0.2.1' })).statusCode).toBe(429);
    expect((await value.inject({ url: '/read', remoteAddress: '192.0.2.2' })).statusCode).toBe(200);
  });
  it('B: authenticated users sharing an egress IP have separate user budgets', async () => {
    const value = await app(); const first = await user(); const second = await user();
    for (let i = 0; i < 3; i++) expect((await value.inject({ url: '/protected', headers: { authorization: `Bearer ${first}` } })).statusCode).toBe(200);
    expect((await value.inject({ url: '/protected', headers: { authorization: `Bearer ${first}` } })).statusCode).toBe(429);
    expect((await value.inject({ url: '/protected', headers: { authorization: `Bearer ${second}` } })).statusCode).toBe(200);
  });
  it('C: changing IP does not replenish a verified user budget and invalid tokens do not create identity', async () => {
    const value = await app(); const token = await user();
    for (let i = 0; i < 3; i++) await value.inject({ url: '/protected', remoteAddress: `192.0.2.${i + 1}`, headers: { authorization: `Bearer ${token}` } });
    expect((await value.inject({ url: '/protected', remoteAddress: '192.0.2.9', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(429);
    expect((await value.inject({ url: '/protected', headers: { authorization: 'Bearer invalid' } })).statusCode).toBe(401);
    expect((await value.inject({ url: '/read', headers: { authorization: 'Bearer invalid' } })).json().user).toBeNull();
  });
  it('D: API token identity precedes post-auth limits without bypassing scope authorization', async () => {
    await redisCache.connect();
    await prisma.systemSettings.upsert({ where: { id: 'system' }, create: { id: 'system' }, update: {} });
    const token = await ApiTokenService.createToken(`protection-${randomUUID()}`, ['catalog:read']);
    const denied = await ApiTokenService.createToken(`protection-denied-${randomUUID()}`, ['orders:read']);
    const value = await app();
    try {
      expect((await value.inject({ url: '/token', headers: { authorization: `Bearer ${denied.token}` } })).statusCode).toBe(403);
      for (let i = 0; i < 3; i++) expect((await value.inject({ url: '/token', headers: { authorization: `Bearer ${token.token}` } })).json().user).toBe(`api:${token.record.id}`);
      expect((await value.inject({ url: '/token', headers: { authorization: `Bearer ${token.token}` } })).statusCode).toBe(429);
    } finally { await ApiTokenService.revokeToken(token.record.id); await ApiTokenService.revokeToken(denied.record.id); }
  });
  it('E: login and registration policies count once and remain isolated', async () => {
    const value = await app();
    for (let i = 0; i < 20; i++) expect((await value.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { surface: i % 2 ? 'admin' : 'storefront' } })).statusCode).toBe(200);
    const rejected = await value.inject({ method: 'POST', url: '/api/v1/auth/login' });
    expect(rejected.statusCode).toBe(429); expect(rejected.json().error.code).toBe('RATE_LIMITED');
    expect((await value.inject({ method: 'POST', url: '/api/v1/auth/register' })).statusCode).toBe(200);
  });
  it('E2: forgot-password allows five requests per fifteen minutes and counts each request once', async () => {
    const prefix = `${namespace}:forgot`;
    const value = Fastify();
    let calls = 0;
    await value.register(rateLimiter, { store: protection, global: { windowMs: 60000, maxRequests: 1000, keyPrefix: prefix } });
    value.post('/api/v1/auth/forgot-password', async () => ({ calls: ++calls }));
    try {
      for (let i = 0; i < 5; i++) expect((await value.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: `target-${i}@example.test` } })).statusCode).toBe(200);
      const rejected = await value.inject({ method: 'POST', url: '/api/v1/auth/forgot-password' });
      expect(rejected.statusCode).toBe(429);
      expect(rejected.json().error.code).toBe('RATE_LIMITED');
      expect(calls).toBe(5);
      expect(await redis.zcard(`${prefix}:/api/v1/auth/forgot-password:ip:127.0.0.1`)).toBe(5);
      expect(await redis.pttl(`${prefix}:/api/v1/auth/forgot-password:ip:127.0.0.1`)).toBeGreaterThan(14 * 60000);
      expect(await redis.exists(`${prefix}:anonymous:ip:127.0.0.1`)).toBe(0);
    } finally { await value.close(); }
  });
  it('F: concurrent permits are atomic with unique members and bounded TTL', async () => {
    const key = `${namespace}:atomic`;
    const results = await Promise.all(Array.from({ length: 30 }, () => protection.rate(key, 60000, 7)));
    expect(results.filter((value) => value.allowed)).toHaveLength(7);
    expect(await redis.zcard(key)).toBe(7); expect(await redis.pttl(key)).toBeGreaterThan(0);
    expect(results.filter((value) => !value.allowed).every((value) => value.retryAfter > 0)).toBe(true);
  });
  it('Q: exact health routes remain available during Redis failure with stable 503 headers', async () => {
    const failed = new SharedProtection('redis://127.0.0.1:1');
    const value = await protectionApp(failed, `${namespace}:failed`);
    try {
      expect((await value.inject('/health/live')).statusCode).toBe(200);
      const response = await value.inject('/health-not-exempt');
      expect(response.statusCode).toBe(503); expect(response.json().error.code).toBe('SHARED_PROTECTION_UNAVAILABLE');
      expect(response.headers['retry-after']).toBe('5'); expect(response.headers['cache-control']).toBe('no-store');
      expect((await value.inject({ method: 'POST', url: '/health/live' })).statusCode).toBe(503);
    } finally { await value.close(); failed.close(); }
  });
  it('A: the pre-auth abuse ceiling is ten times the normal policy', async () => {
    const value = await app();
    for (let i = 0; i < 30; i++) await value.inject('/read');
    const response = await value.inject('/read');
    expect(response.statusCode).toBe(429); expect(response.headers['x-ratelimit-limit']).toBe('30');
  });
  it('F: expired accepted members are pruned without extending a rejected window', async () => {
    const key = `${namespace}:expired`;
    await redis.zadd(key, 0, 'old-request');
    expect((await protection.rate(key, 60000, 1)).allowed).toBe(true);
    const ttl = await redis.pttl(key);
    expect((await protection.rate(key, 60000, 1)).allowed).toBe(false);
    expect(await redis.pttl(key)).toBeLessThanOrEqual(ttl);
    expect(await redis.zcard(key)).toBe(1);
  });
  it('Q: a closed protection connection is rebuilt without losing the Redis budget', async () => {
    const key = `${namespace}:reopen`;
    expect((await protection.rate(key, 60000, 1)).allowed).toBe(true);
    protection.close();
    expect((await protection.rate(key, 60000, 1)).allowed).toBe(false);
  });
  it('G: the admin export budget belongs to the administrator, not to the address', async () => {
    const value = await app();
    const token = await admin();
    for (let i = 0; i < 20; i++) {
      const response = await value.inject({ method: 'POST', url: '/api/v1/admin/orders/export', remoteAddress: '198.51.100.10', headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(200);
    }
    // Another address does not buy the administrator a new budget.
    const rejected = await value.inject({ method: 'POST', url: '/api/v1/admin/orders/export', remoteAddress: '198.51.100.11', headers: { authorization: `Bearer ${token}` } });
    expect(rejected.statusCode).toBe(429);
    expect(rejected.json().error.code).toBe('RATE_LIMITED');
    // Another administrator keeps its own budget.
    const other = await admin();
    const allowed = await value.inject({ method: 'POST', url: '/api/v1/admin/orders/export', remoteAddress: '198.51.100.12', headers: { authorization: `Bearer ${other}` } });
    expect(allowed.statusCode).toBe(200);
  });
  it('H: the media, avatar and marketplace budgets are counted per identity', async () => {
    const value = await app();
    const token = await admin();
    for (let i = 0; i < 30; i++) {
      const response = await value.inject({ method: 'POST', url: '/api/v1/admin/products/upload-image', remoteAddress: '203.0.113.10', headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(200);
    }
    const rejectedUpload = await value.inject({ method: 'POST', url: '/api/v1/admin/products/upload-image', remoteAddress: '203.0.113.11', headers: { authorization: `Bearer ${token}` } });
    expect(rejectedUpload.statusCode).toBe(429);
    for (let i = 0; i < 10; i++) {
      const response = await value.inject({ method: 'POST', url: '/api/v1/extensions/marketplace/install', remoteAddress: '203.0.113.20', headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(200);
    }
    const rejectedInstall = await value.inject({ method: 'POST', url: '/api/v1/extensions/marketplace/install', remoteAddress: '203.0.113.21', headers: { authorization: `Bearer ${token}` } });
    expect(rejectedInstall.statusCode).toBe(429);
  });
  it('I: a successful login never consumes the account budget', async () => {
    const value = await app();
    // A legitimate account is never locked out by its own sign-ins: far more
    // sign-ins than the previous attempt budget are all answered.
    for (let i = 0; i < 130; i++) {
      const response = await value.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: `198.51.100.${i + 1}`, payload: { identifier: 'target@example.test', password: 'secret' } });
      expect(response.statusCode).toBe(200);
    }
    // The account is still not locked after its own successful sign-ins.
    const allowed = await value.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '198.51.100.200', payload: { identifier: 'target@example.test', password: 'secret' } });
    expect(allowed.statusCode).toBe(200);
    // The bucket only ever holds the hash of the identifier.
    const keys = await redis.keys(`${namespace}:*`);
    expect(keys.some((key) => key.includes('target@example.test'))).toBe(false);
    expect(keys.some((key) => key.includes(':login-account:'))).toBe(true);
  });
  it('J: repeated failed logins lock the account and only that account', async () => {
    const value = await app();
    const spy = vi.spyOn(LoggerService, 'logSecurity');
    try {
      for (let i = 0; i < 10; i++) {
        const response = await value.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: `203.0.113.${i + 1}`, payload: { identifier: 'target@example.test', password: 'wrong-password' } });
        expect(response.statusCode).toBe(401);
      }
      // The account is locked after its failed attempts, whatever the address.
      const locked = await value.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '203.0.113.50', payload: { identifier: 'target@example.test', password: 'secret' } });
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error.code).toBe('RATE_LIMITED');
      // Another account keeps its own budget.
      const other = await value.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '203.0.113.51', payload: { identifier: 'other@example.test', password: 'secret' } });
      expect(other.statusCode).toBe(200);
      // The record of the lock names the policy and the subject, and never the
      // identifier itself.
      const call = spy.mock.calls.find(([event, details]) => event === 'RATE_LIMITED' && (details as { subjectType?: string })?.subjectType === 'account');
      expect(call).toBeDefined();
      const details = call![1] as Record<string, unknown>;
      expect(details.policy).toBe('login-account');
      expect(String(details.subject)).toMatch(/^account:[0-9a-f]{12}$/);
      expect(JSON.stringify(details)).not.toContain('target@example.test');
    } finally { spy.mockRestore(); }
  });
  it('K: a limit hit is recorded with a structured record', async () => {
    const value = await app();
    const token = await admin();
    const spy = vi.spyOn(LoggerService, 'logSecurity');
    try {
      for (let i = 0; i < 21; i++) {
        await value.inject({ method: 'POST', url: '/api/v1/admin/orders/export', remoteAddress: '192.0.2.50', headers: { authorization: `Bearer ${token}` } });
      }
      const call = spy.mock.calls.find(([event]) => event === 'RATE_LIMITED');
      expect(call).toBeDefined();
      const details = call![1] as Record<string, unknown>;
      expect(details.policy).toBe('/api/v1/admin/orders/export');
      expect(details.subjectType).toBe('user');
      expect(details.path).toBe('/api/v1/admin/orders/export');
      expect(Number(details.retryAfter)).toBeGreaterThan(0);
    } finally { spy.mockRestore(); }
  });
  it('J: the health budget survives the probe rate of a node with several replicas', async () => {
    const value = await protectionApp(protection, `${namespace}:health-node`);
    apps.push(value);
    // Several replicas of one node probe from the same address every ten
    // seconds: the shared budget must not be exhausted by them.
    for (let i = 0; i < 60; i++) {
      const response = await value.inject('/health/ready');
      expect(response.statusCode).toBe(200);
    }
    // The liveness probe always answers and never draws the health budget.
    expect((await value.inject('/health/live')).statusCode).toBe(200);
    expect((await value.inject('/health/ready')).statusCode).toBe(200);
  });
  it('K: a probe flood beyond the budget is refused while the liveness probe stays exempt', async () => {
    const value = await protectionApp(protection, `${namespace}:health-flood`, [], { windowMs: 60000, maxRequests: 2 });
    apps.push(value);
    expect((await value.inject('/health/ready')).statusCode).toBe(200);
    expect((await value.inject('/health/ready')).statusCode).toBe(200);
    const rejected = await value.inject('/health/ready');
    expect(rejected.statusCode).toBe(429);
    expect(rejected.json().error.code).toBe('RATE_LIMITED');
    // The liveness probe never consumes the health budget.
    expect((await value.inject('/health/live')).statusCode).toBe(200);
    expect((await value.inject('/health/ready')).statusCode).toBe(429);
  });
  it('L: the health probes answer from their own probes when the shared protection is unavailable', async () => {
    const failed = new SharedProtection('redis://127.0.0.1:1');
    const value = await protectionApp(failed, `${namespace}:health-down`);
    apps.push(value);
    try {
      expect((await value.inject('/health/live')).statusCode).toBe(200);
      // The probe answers with its own result instead of the protection error.
      const ready = await value.inject('/health/ready');
      expect(ready.statusCode).toBe(200);
      // The general routes stay fail-closed.
      const denied = await value.inject('/health-not-exempt');
      expect(denied.statusCode).toBe(503);
      expect(denied.json().error.code).toBe('SHARED_PROTECTION_UNAVAILABLE');
    } finally { failed.close(); }
  });
});
