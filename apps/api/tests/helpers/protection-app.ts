import Fastify from 'fastify';
import rateLimiter from '@/plugins/rate-limiter';
import { optionalAuthMiddleware, authMiddleware, dualAuthMiddleware } from '@/core/auth/middleware';
import { SharedProtection } from '@/infra/shared-protection';

export async function protectionApp(
  protection: SharedProtection,
  namespace: string,
  trustProxy: string[] = [],
  health?: { windowMs: number; maxRequests: number },
) {
  const app = Fastify({ trustProxy });
  await app.register(rateLimiter, { store: protection, global: { windowMs: 60000, maxRequests: 3, keyPrefix: namespace }, health });
  app.addHook('onRequest', optionalAuthMiddleware);
  app.get('/read', async (request) => ({ user: request.user?.id ?? null }));
  app.get('/protected', { onRequest: authMiddleware }, async (request) => ({ user: request.user!.id }));
  app.get('/token', { onRequest: dualAuthMiddleware('catalog:read') }, async (request) => ({ user: request.user!.id }));
  for (const name of ['login', 'register', 'forgot-password']) app.post(`/api/v1/auth/${name}`, async () => ({ ok: true }));
  app.post('/api/v1/auth/resend-verification', async () => ({ ok: true }));
  for (const route of [
    '/api/v1/admin/orders/export',
    '/api/v1/admin/users/export',
    '/api/v1/admin/products/export',
    '/api/v1/admin/products/upload-image',
    '/api/v1/account/avatar',
    '/api/v1/extensions/marketplace/install',
    '/api/v1/extensions/marketplace/preview',
  ]) app.post(route, async () => ({ ok: true }));
  app.get('/health', async () => ({ ok: true }));
  app.get('/health/live', async () => ({ ok: true }));
  app.get('/health/ready', async () => ({ ok: true }));
  app.get('/health-not-exempt', async () => ({ ok: true }));
  await app.ready();
  return app;
}
