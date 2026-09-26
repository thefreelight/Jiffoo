import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMinimalTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';
import { installRoutes } from '@/core/install/routes';

describe('Install re-submission', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;
  let ownerId: string | undefined;

  beforeAll(async () => {
    app = await createMinimalTestApp();
    await app.register(installRoutes, { prefix: '/api/v1/install' });
  });

  afterAll(async () => {
    await prisma.systemSettings.deleteMany({ where: { id: 'system', installedBy: ownerId } });
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } });
    await app.close();
  });

  it('rejects a second completion without creating another administrator', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/install/complete',
      payload: {
        siteName: 'Installation Test',
        adminEmail: 'install-resubmission@example.com',
        adminUsername: 'install-resubmission',
        adminPassword: 'InstallationPassword123!',
      },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().success).toBe(true);
    ownerId = (await prisma.user.findUniqueOrThrow({
      where: { email: 'install-resubmission@example.com' },
    })).id;
    const usersBefore = await prisma.user.count();
    const adminsBefore = await prisma.user.count({ where: { role: 'ADMIN' } });
    expect((await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).installedBy).toBe(ownerId);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/install/complete',
      payload: {
        siteName: 'Second Installation',
        adminEmail: 'another-install@example.com',
        adminUsername: 'another-install',
        adminPassword: 'InstallationPassword123!',
      },
    });
    expect(second.statusCode).toBe(400);
    expect(second.json()).toMatchObject({ success: false, error: 'System is already installed' });
    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(adminsBefore);
  });
});
