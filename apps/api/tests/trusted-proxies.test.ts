import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { MemoryRateLimitStore } from '@shared/security';
import rateLimiterPlugin from '../src/plugins/rate-limiter';
import { parseTrustedProxies } from 'shared/trusted-proxies';

function appWithTrust(value: string) {
  const app = Fastify({ trustProxy: parseTrustedProxies(value) });
  app.register(rateLimiterPlugin, { enabled: true, store: new MemoryRateLimitStore() });
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
