import { expect, it } from 'vitest';
import Fastify from 'fastify';
import Redis from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import { SharedProtection } from '@/infra/shared-protection';
import rateLimiter from '@/plugins/rate-limiter';
import { authRoutes } from '@/core/auth/routes';
import { declareErrorSchemas } from '@/utils/error-schemas';
import { sendMappedError } from '@/utils/api-errors';
import { prisma } from '@/config/database';
import { createTestUser } from '../helpers/auth';

it('two independent Redis clients share IP and normalized email budgets without disclosing account existence', async () => {
  expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  const namespace = `test:forgot:${randomUUID()}`;
  const redis = new Redis(process.env.REDIS_URL!);
  const clients = [new SharedProtection(process.env.REDIS_URL!), new SharedProtection(process.env.REDIS_URL!)];
  const apps = clients.map(() => Fastify());
  let userId: string | undefined;
  const forgot = async (index: number, email: string, ip: string) => {
    const started = performance.now();
    const response = await apps[index].inject({ method: 'POST', url: '/api/v1/auth/forgot-password', remoteAddress: ip, payload: { email } });
    return { response, duration: performance.now() - started };
  };
  try {
    for (const [index, app] of apps.entries()) {
      declareErrorSchemas(app);
      app.setErrorHandler((error, _request, reply) => sendMappedError(reply, error));
      await app.register(rateLimiter, { store: clients[index], global: { windowMs: 60000, maxRequests: 1000, keyPrefix: namespace } });
      await app.register(authRoutes, { prefix: '/api/v1/auth' });
      await app.ready();
    }
    const user = await createTestUser({ email: `forgot-${randomUUID()}@example.test` });
    userId = user.id;
    const unknown = `unknown-${randomUUID()}@example.test`;
    const knownResult = await forgot(0, user.email, '192.0.2.1');
    const unknownResult = await forgot(1, unknown, '192.0.2.2');
    expect(knownResult.response.statusCode).toBe(200);
    expect(unknownResult.response.statusCode).toBe(200);
    expect(knownResult.response.body).toBe(unknownResult.response.body);
    for (const result of [knownResult, unknownResult]) {
      expect(result.duration).toBeGreaterThanOrEqual(480);
      expect(result.duration).toBeLessThan(1500);
    }
    expect(await prisma.notification.count({ where: { recipientUserId: userId, type: 'password_reset' } })).toBe(1);

    for (const target of [user.email, unknown]) {
      for (const index of [1, 0]) expect((await forgot(index, target.toUpperCase(), `192.0.2.${10 + index}`)).response.statusCode).toBe(200);
      const limited = (await forgot(1, target, '192.0.2.20')).response;
      expect(limited.statusCode).toBe(429);
      expect(limited.json().error.code).toBe('RATE_LIMITED');
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(3500);
      const digest = createHash('sha256').update(target).digest('hex');
      const key = `${namespace}:forgot-password-email:email:${digest}`;
      expect(await redis.zcard(key)).toBe(3);
      expect(await redis.pttl(key)).toBeGreaterThan(3500_000);
    }
    const ip = '192.0.2.30';
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => forgot(index % 2, `ip-${index}-${randomUUID()}@example.test`, ip)));
    expect(concurrent.filter(value => value.response.statusCode === 200)).toHaveLength(5);
    const rejected = concurrent.filter(value => value.response.statusCode === 429);
    expect(rejected).toHaveLength(3);
    for (const value of rejected) expect(Number(value.response.headers['retry-after'])).toBeGreaterThan(850);
    expect(await redis.zcard(`${namespace}:/api/v1/auth/forgot-password:ip:${ip}`)).toBe(5);
    expect(await redis.pttl(`${namespace}:/api/v1/auth/forgot-password:ip:${ip}`)).toBeGreaterThan(850_000);
  } finally {
    try { await Promise.all(apps.map(app => app.close())); }
    finally {
      for (const client of clients) client.close();
      try {
        const keys = await redis.keys(`${namespace}:*`);
        if (keys.length) await redis.del(...keys);
        if (userId) {
          await prisma.notification.deleteMany({ where: { recipientUserId: userId } });
          await prisma.authToken.deleteMany({ where: { userId } });
          await prisma.user.deleteMany({ where: { id: userId } });
        }
      } finally { redis.disconnect(); await prisma.$disconnect(); }
    }
  }
}, 30_000);
