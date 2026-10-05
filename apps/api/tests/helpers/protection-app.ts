import Fastify from 'fastify';
import rateLimiter from '@/plugins/rate-limiter';
import { optionalAuthMiddleware, authMiddleware, dualAuthMiddleware } from '@/core/auth/middleware';
import { SharedProtection } from '@/infra/shared-protection';

export async function protectionApp(protection: SharedProtection, namespace: string, trustProxy: string[] = []) {
  const app = Fastify({ trustProxy });
  await app.register(rateLimiter, { store: protection, global: { windowMs: 60000, maxRequests: 3, keyPrefix: namespace } });
  app.addHook('onRequest', optionalAuthMiddleware);
  app.get('/read', async (request) => ({ user: request.user?.id ?? null }));
  app.get('/protected', { onRequest: authMiddleware }, async (request) => ({ user: request.user!.id }));
  app.get('/token', { onRequest: dualAuthMiddleware('catalog:read') }, async (request) => ({ user: request.user!.id }));
  for (const name of ['login', 'register', 'forgot-password']) app.post(`/api/v1/auth/${name}`, async () => ({ ok: true }));
  app.get('/health/live', async () => ({ ok: true }));
  app.get('/health-not-exempt', async () => ({ ok: true }));
  await app.ready();
  return app;
}
