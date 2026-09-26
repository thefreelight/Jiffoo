import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { createMinimalTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';
import { installRoutes } from '@/core/install/routes';

describe('AUTH-1 installation atomicity', () => {
  let app: FastifyInstance;
  const db = getTestPrisma();
  const marker = randomUUID();
  const emails = [`install-a-${marker}@example.com`, `install-b-${marker}@example.com`];
  let original: Awaited<ReturnType<typeof db.systemSettings.findUnique>>;

  beforeAll(async () => {
    app = await createMinimalTestApp();
    await app.register(installRoutes, { prefix: '/api/v1/install' });
    original = await db.systemSettings.findUnique({ where: { id: 'system' } });
  });
  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    if (original) {
      await db.systemSettings.update({
        where: { id: 'system' },
        data: {
          isInstalled: original.isInstalled, installedAt: original.installedAt,
          installedBy: original.installedBy, siteDescription: original.siteDescription,
          settings: original.settings === null ? Prisma.JsonNull : original.settings as Prisma.InputJsonValue,
          version: original.version,
        },
      });
    } else {
      await db.systemSettings.deleteMany({ where: { installedBy: { in: users.map((user) => user.id) } } });
    }
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('G concurrent completion creates exactly one recorded install administrator', async () => {
    expect(original?.isInstalled ?? false).toBe(false);
    const responses = await Promise.all(emails.map((adminEmail, index) => app.inject({
      method: 'POST', url: '/api/v1/install/complete',
      payload: {
        siteName: 'Concurrent install',
        adminEmail,
        adminUsername: `install-${index}-${marker.slice(0, 8)}`,
        adminPassword: 'InstallationPassword123!',
      },
    })));
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400]);
    expect(responses.filter((response) => response.json().success)).toHaveLength(1);
    const admins = await db.user.findMany({ where: { email: { in: emails } } });
    expect(admins).toHaveLength(1);
    expect(admins[0].role).toBe('ADMIN');
    const settings = await db.systemSettings.findUniqueOrThrow({ where: { id: 'system' } });
    expect(settings.isInstalled).toBe(true);
    expect(settings.installedBy).toBe(admins[0].id);
  });
});
