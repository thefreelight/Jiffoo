import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { SharedProtection } from '@/infra/shared-protection';
import { protectionApp } from '../helpers/protection-app';
import { getTestPrisma } from '../helpers/db';
import { JwtUtils } from '@/utils/jwt';
import { env } from '@/config/env';
import { ApiTokenService } from '@/core/auth/api-token';
import { redisCache } from '@/core/cache/redis';
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
    for (let i = 0; i < 20; i++) expect((await value.inject({ method: 'POST', url: '/api/v1/auth/login' })).statusCode).toBe(200);
    const rejected = await value.inject({ method: 'POST', url: '/api/v1/auth/login' });
    expect(rejected.statusCode).toBe(429); expect(rejected.json().error.code).toBe('RATE_LIMITED');
    expect((await value.inject({ method: 'POST', url: '/api/v1/auth/register' })).statusCode).toBe(200);
  });
  it('E2: forgot-password uses the unified 100-per-minute auth policy and counts each request once', async () => {
    const prefix = `${namespace}:forgot`;
    const value = Fastify();
    let calls = 0;
    await value.register(rateLimiter, { store: protection, global: { windowMs: 60000, maxRequests: 1000, keyPrefix: prefix } });
    value.post('/api/v1/auth/forgot-password', async () => ({ calls: ++calls }));
    try {
      for (let i = 0; i < 100; i++) expect((await value.inject({ method: 'POST', url: '/api/v1/auth/forgot-password' })).statusCode).toBe(200);
      const rejected = await value.inject({ method: 'POST', url: '/api/v1/auth/forgot-password' });
      expect(rejected.statusCode).toBe(429);
      expect(rejected.json().error.code).toBe('RATE_LIMITED');
      expect(calls).toBe(100);
      expect(await redis.zcard(`${prefix}:/api/v1/auth/forgot-password:ip:127.0.0.1`)).toBe(100);
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
});
