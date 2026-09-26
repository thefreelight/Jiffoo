import { afterAll, describe, expect, it, vi } from 'vitest';
import { env } from '@/config/env';
import { redisCache } from '@/core/cache/redis';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { buildApp } from '@/server';
import { registerGlobalRateLimiter } from '@/server';
import Fastify from 'fastify';

const original = { ...env };
const originalUrls = { STOREFRONT_URL: process.env.STOREFRONT_URL, ADMIN_URL: process.env.ADMIN_URL };
let app: Awaited<ReturnType<typeof buildApp>> | undefined;

afterAll(async () => {
  Object.assign(env, original);
  if (originalUrls.STOREFRONT_URL === undefined) delete process.env.STOREFRONT_URL;
  else process.env.STOREFRONT_URL = originalUrls.STOREFRONT_URL;
  if (originalUrls.ADMIN_URL === undefined) delete process.env.ADMIN_URL;
  else process.env.ADMIN_URL = originalUrls.ADMIN_URL;
  vi.restoreAllMocks();
  await app?.close();
});

describe('Production app startup', () => {
  it('rejects rate-limiter registration failure in production', async () => {
    const isolatedApp = Fastify();
    try {
      await expect(registerGlobalRateLimiter(isolatedApp, 'production', false, async () => {
        throw new Error('plugin load failed');
      })).rejects.toThrow('rate-limiter registration failed');
    } finally {
      await isolatedApp.close();
    }
  });

  it('rejects an unsafe configuration before connecting to Redis', async () => {
    Object.assign(env, {
      NODE_ENV: 'production',
      JWT_SECRET: 'short',
      RATE_LIMITER_FAIL_CLOSED: true,
      CORS_ORIGIN: 'https://admin.example.com',
      STOREFRONT_URL: 'https://store.example.com',
      ADMIN_URL: 'https://admin.example.com',
    });
    process.env.STOREFRONT_URL = 'https://store.example.com';
    process.env.ADMIN_URL = 'https://admin.example.com';
    const connect = vi.spyOn(redisCache, 'connect');
    await expect(buildApp()).rejects.toThrow('JWT_SECRET must be at least 32 characters');
    expect(connect).not.toHaveBeenCalled();
  });

  it('starts with compliant production configuration and hides documentation', async () => {
    env.JWT_SECRET = 'a-production-test-secret-of-32-characters';
    vi.spyOn(redisCache, 'connect').mockResolvedValue(undefined as never);
    vi.spyOn(pluginPackageStore, 'ensureRoot').mockResolvedValue(undefined as never);
    app = await buildApp();
    await app.ready();
    for (const url of ['/docs', '/swagger', '/openapi.json']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
    }
  });
});
