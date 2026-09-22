import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';
import { CacheService } from '@/core/cache/service';

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
          supportedCurrencies: ['USD'],
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

  it('excludes stored manifests that cannot provide a payment v1 contract runtime', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/payments/available-methods' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((method: { pluginSlug: string }) => method.pluginSlug)).not.toContain(validSlug);
    expect(response.json().data.map((method: { pluginSlug: string }) => method.pluginSlug)).not.toContain(invalidSlug);
  });
});
