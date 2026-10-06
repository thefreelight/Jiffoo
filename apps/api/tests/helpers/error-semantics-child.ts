import { buildApp } from '@/server';
import { ApiError, catalogError } from '@/utils/api-errors';
import { authMiddleware } from '@/core/auth/middleware';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { sharedProtection } from '@/infra/shared-protection';
import { EmailVerificationService } from '@/services/email-verification.service';
import { InstallService } from '@/core/install/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { AuthService } from '@/core/auth/service';
import { Prisma } from '@prisma/client';

async function main() {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/jiffoo_core_test') throw new Error('Wrong fixture database');
  const app = await buildApp();
  const refresh = AuthService.refreshSession;
  AuthService.refreshSession = async (...args) => {
    try { return await refresh.apply(AuthService, args); }
    catch (error) {
      const value = error as { code?: string; errorCode?: string; constructor?: { name?: string } };
      process.send?.({ kind: 'observed-error', name: value.constructor?.name, code: value.code, errorCode: value.errorCode });
      throw error;
    }
  };
  app.addHook('onError', async (_request, _reply, error) => {
    process.send?.({ kind: 'observed-error', name: error?.constructor?.name, code: (error as { code?: string }).code, errorCode: (error as { errorCode?: string }).errorCode });
  });
  app.get('/api/v1/__fixture/fault/:kind', async (request) => {
    const { kind } = request.params as { kind: string };
    if (kind === 'object') throw { statusCode: 404, code: 'NOT_FOUND', message: 'PRIVATE_SQL /private/path', details: { secret: 'PRIVATE_SECRET' } };
    if (kind === 'spoof') throw Object.assign(new Error('PRIVATE_SQL /private/path'), { statusCode: 400, code: 'BAD_REQUEST', details: { secret: 'PRIVATE_SECRET' } });
    if (kind === 'catalog') throw Object.assign(new ApiError('INTERNAL_SERVER_ERROR', { secret: 'PRIVATE_SECRET' }), { message: 'PRIVATE_SQL', statusCode: 400 });
    if (kind === 'type') throw new TypeError('PRIVATE_SQL /private/path');
    if (kind === 'init-schema') throw new Prisma.PrismaClientInitializationError('PRIVATE_SCHEMA_ERROR', '6.19.1', 'P1012');
    if (kind === 'init-unknown') throw new Prisma.PrismaClientInitializationError('PRIVATE_ENGINE_ERROR', '6.19.1');
    throw new Error('PRIVATE_SQL /private/path PRIVATE_SECRET');
  });
  app.post('/api/v1/__fixture/validation', { schema: { body: { type: 'object', additionalProperties: false, required: ['quantity'], properties: { quantity: { type: 'integer', minimum: 1 } } } } }, async () => ({ ok: true }));
  app.get('/api/v1/__fixture/auth', { onRequest: authMiddleware, schema: { security: [{ bearerAuth: [] }] } }, async (request) => ({ id: request.user!.id }));
  app.get('/api/v1/__fixture/db', async () => ({ count: await prisma.user.count() }));
  app.post('/api/v1/__fixture/db-unique', async (request) => prisma.user.create({ data: request.body as { email: string; username: string; password: string; role: string } }));
  app.post('/api/v1/__fixture/email', async (request) => {
    const { userId, email } = request.body as { userId: string; email: string };
    return EmailVerificationService.sendVerificationEmail(userId, email, 'Fixture');
  });
  app.post('/api/v1/__fixture/install', async () => InstallService.completeInstallation({ siteName: 'Fixture', adminEmail: 'fixture@example.test', adminPassword: {} as string }));
  app.get('/api/v1/__fixture/contract/:slug/:method', async (request) => {
    const { slug, method } = request.params as { slug: string; method: string };
    return callContract(slug, 'payment', 1, method, { storeCurrency: 'USD', sessionId: 'fixture' });
  });
  app.all('/api/v1/__fixture/catalog/:code', async (request) => { throw catalogError((request.params as { code: string }).code); });
  process.on('message', async (message: { kind: string; id?: string; slug?: string }) => {
    if (message.kind === 'release') { process.emit(`b2a-release-${message.slug}`); process.send?.({ id: message.id, kind: 'done' }); return; }
    if (message.kind === 'disconnect-db') { await prisma.$disconnect(); process.send?.({ id: message.id, kind: 'done' }); return; }
    if (message.kind !== 'stop') return;
    await app.close(); sharedProtection.close(); await prisma.$disconnect(); await redisCache.disconnect(); process.disconnect();
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture listener');
  process.send?.({ kind: 'ready', port: address.port });
}
main().catch((error) => { process.send?.({ kind: 'failed', message: String(error) }); process.exitCode = 1; process.disconnect(); });
