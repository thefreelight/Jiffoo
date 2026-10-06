import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMinimalTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';
import { installRoutes } from '@/core/install/routes';
import { authRoutes } from '@/core/auth/routes';
import { createTestUser } from '../helpers/auth';
import { InstallService } from '@/core/install/service';

describe('Install re-submission', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;
  let ownerId: string | undefined;
  const existingIds: string[] = [];

  beforeAll(async () => {
    app = await createMinimalTestApp();
    await app.register(installRoutes, { prefix: '/api/v1/install' });
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
  });

  afterAll(async () => {
    await prisma.systemSettings.deleteMany({ where: { id: 'system', installedBy: ownerId } });
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: existingIds } } });
    await app.close();
  });

  it.each(['USER', 'ADMIN'] as const)('rejects an existing %s email with a stable conflict code before install', async (role) => {
    const existing = await createTestUser({ email: `existing-${role.toLowerCase()}-install@example.com`, role });
    existingIds.push(existing.id);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/install/complete',
      payload: {
        siteName: 'Installation Test',
        adminEmail: existing.email,
        adminPassword: 'SubmittedPassword123!',
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ success: false, error: { code: 'INSTALL_EMAIL_IN_USE' } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).role).toBe(role);
  });

  it('returns only a generic database failure before installation', async () => {
    const check = vi.spyOn(InstallService, 'checkDatabaseConnection').mockResolvedValueOnce({ connected: false });
    const response = await app.inject({ method: 'GET', url: '/api/v1/install/check-database' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ connected: false });
    expect(response.body).not.toContain('password');
    check.mockRestore();
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
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'install-resubmission@example.com', password: 'InstallationPassword123!' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().data.user.role).toBe('ADMIN');
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
    expect(second.json()).toMatchObject({ success: false, error: { code: 'INSTALL_ALREADY_COMPLETED', message: 'System is already installed' } });
    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(adminsBefore);
  });

  it('hides the database check after installation', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/install/check-database' });
    expect(response.statusCode).toBe(404);
  });
});
