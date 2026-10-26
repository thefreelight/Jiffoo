import { laneConfig, validateDatabaseUrl } from '../../src/config/test-lane';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';
import { CacheService } from '@/core/cache/service';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';

describe('stored payment manifests', () => {
  const prisma = getTestPrisma();
  const suffix = Date.now().toString(36);
  const validSlug = `payment-valid-${suffix}`.slice(0, 30);
  const invalidSlug = `payment-invalid-${suffix}`.slice(0, 30);
  let app: FastifyInstance;

  beforeAll(async () => {
    await prisma.pluginInstall.create({
      data: {
        slug: validSlug,
        name: 'Valid payment plugin',
        version: '1.0.0',
        category: 'payment',
        runtimeType: 'internal-fastify',
        source: 'local-zip',
        manifestJson: {
          schemaVersion: 1,
          slug: validSlug,
          name: 'Valid payment plugin',
          version: '1.0.0',
          description: 'A valid payment manifest',
          runtimeType: 'internal-fastify',
          hostProtocol: 'internal-fastify-v1',
          entryModule: 'server/index.js',
          permissions: [],
          category: 'payment', contracts: [{ name: 'payment', version: 1 }], subscriptions: [],
        },
      },
    });
    await prisma.pluginInstall.create({
      data: {
        slug: invalidSlug,
        name: 'Invalid payment plugin',
        version: '1.0.0',
        category: 'payment',
        runtimeType: 'internal-fastify',
        source: 'local-zip',
        manifestJson: {},
      },
    });
    await prisma.pluginInstallation.createMany({
      data: [
        { pluginSlug: validSlug, instanceKey: 'default', enabled: true },
        { pluginSlug: invalidSlug, instanceKey: 'default', enabled: true },
      ],
    });
    await CacheService.incrementPluginVersion();
    app = await createTestApp({ disableFileSystem: false });
  });

  afterAll(async () => {
    await app.close();
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: { in: [validSlug, invalidSlug] } } });
    await prisma.pluginInstall.deleteMany({ where: { slug: { in: [validSlug, invalidSlug] } } });
  });

  it('excludes stored payment v1 and invalid manifests from payment v2 methods', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/payments/available-methods' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((method: { pluginSlug: string }) => method.pluginSlug)).not.toContain(validSlug);
    expect(response.json().data.map((method: { pluginSlug: string }) => method.pluginSlug)).not.toContain(invalidSlug);
  });

  it('rejects payment v1 session creation before loading its package or reserving any payment', async () => {
    expect(validateDatabaseUrl(process.env.DATABASE_URL_TEST!).pathname).toBe('/' + laneConfig().databaseName);
    const before = await prisma.payment.count();
    const started = performance.now();
    await expect(callContract(validSlug, 'payment', 1, 'createSession', {})).rejects.toMatchObject({
      code: 'CONTRACT_CALL_FAILED', message: 'Unsupported contract payment v1/createSession',
    });
    expect(performance.now() - started).toBeLessThan(500);
    expect(await prisma.payment.count()).toBe(before);
  });
});
