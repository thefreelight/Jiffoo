import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { SharedProtection } from '@/infra/shared-protection';
import { RateLimitPresets } from '@shared/security';
import { env } from '@/config/env';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import rateLimiterPlugin from '../src/plugins/rate-limiter';
import { parseTrustedProxies } from 'shared/trusted-proxies';

function appWithTrust(value: string) {
  const app = Fastify({ trustProxy: parseTrustedProxies(value) });
  const protection = new SharedProtection(env.REDIS_URL);
  const namespace = `test:trusted:${randomUUID()}`;
  app.register(rateLimiterPlugin, { enabled: true, store: protection, global: { ...RateLimitPresets.default, keyPrefix: namespace } });
  app.addHook('onClose', async () => {
    protection.close();
    const client = new Redis(env.REDIS_URL);
    try { const keys = await client.keys(`${namespace}:*`); if (keys.length) await client.del(...keys); }
    finally { client.disconnect(); }
  });
  app.post('/api/v1/auth/login', async () => ({ ok: true }));
  return app;
}

describe('trusted proxy rate limit', () => {
  it('A isolates login buckets for two clients behind the same trusted peer', async () => {
    const app = appWithTrust('192.0.2.1');
    try {
      for (let i = 0; i < 20; i += 1) {
        const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '192.0.2.1', headers: { 'x-forwarded-for': '198.51.100.11' } });
        expect(response.statusCode).toBe(200);
      }
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '192.0.2.1', headers: { 'x-forwarded-for': '198.51.100.11' } })).statusCode).toBe(429);
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '192.0.2.1', headers: { 'x-forwarded-for': '198.51.100.12' } })).statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it('B ignores spoofed forwarding headers from an untrusted peer', async () => {
    const app = appWithTrust('192.0.2.1');
    try {
      for (let i = 0; i < 20; i += 1) {
        expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '203.0.113.50', headers: { 'x-forwarded-for': `198.51.100.${i + 1}` } })).statusCode).toBe(200);
      }
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '203.0.113.50', headers: { 'x-forwarded-for': '198.51.100.100' } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it('C trusts nothing when TRUSTED_PROXIES is empty', async () => {
    const app = appWithTrust('');
    try {
      for (let i = 0; i < 20; i += 1) {
        expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '192.0.2.1', headers: { 'x-forwarded-for': `198.51.100.${i + 1}` } })).statusCode).toBe(200);
      }
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '192.0.2.1', headers: { 'x-forwarded-for': '198.51.100.100' } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it('D rejects an invalid TRUSTED_PROXIES entry with its value', () => {
    expect(() => appWithTrust('127.0.0.1,not-an-ip')).toThrow('Invalid TRUSTED_PROXIES entry: not-an-ip');
  });
});
