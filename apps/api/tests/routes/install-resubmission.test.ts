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
        adminUsername: 'existing-install',
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
    expect(response.json()).toEqual({ success: true, data: { connected: false } });
    expect(response.body).not.toContain('password');
    check.mockRestore();
  });

  it.each(['a', 'a'.repeat(65), 'has space', 'owner@store', '店主'])('rejects invalid owner login name %s', async adminUsername => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/install/complete', payload: {
      siteName: 'Validation', adminUsername, adminEmail: 'validation@example.com', adminPassword: 'Password123!',
    } });
    expect(response.statusCode).toBe(400); expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['ordinary@x.io', 'ordinary'],
    ['a+b@x.io', 'a-b'],
    ['x@y.io', 'owner'],
  ])('derives a valid owner login name when omitted for %s', async (adminEmail, username) => {
    try {
      const response = await app.inject({ method: 'POST', url: '/api/v1/install/complete', payload: {
        siteName: 'Optional Username', adminEmail, adminPassword: 'Password123!',
      } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, data: { success: true, siteName: 'Optional Username', adminUsername: username, adminEmail, timezone: 'UTC' } });
      const owner = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
      expect(owner.username).toBe(username);
      expect(owner.role).toBe('ADMIN');
    } finally {
      const owner = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (owner) {
        await prisma.systemSettings.deleteMany({ where: { id: 'system', installedBy: owner.id } });
        await prisma.user.delete({ where: { id: owner.id } });
      }
    }
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
    expect(first.json()).toMatchObject({ success: true, data: { siteName: 'Installation Test', adminUsername: 'install-resubmission', adminEmail: 'install-resubmission@example.com', timezone: 'UTC' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'install-resubmission@example.com', password: 'InstallationPassword123!', surface: 'admin' },
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
