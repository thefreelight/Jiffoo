import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMinimalTestApp } from '../helpers/create-test-app';
import { installRoutes } from '@/core/install/routes';
import { InstallService } from '@/core/install/service';

/**
 * The install endpoints answer with the success envelope, like every other
 * business endpoint of the platform. The install flow is reachable before the
 * platform is installed, so none of these routes requires an installed state.
 */
describe('Install success envelope', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createMinimalTestApp();
    await app.register(installRoutes, { prefix: '/api/v1/install' });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('answers the installation status with the success envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/install/status' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.isInstalled).toBe('boolean');
  });

  it('answers the database check with the success envelope', async () => {
    const status = vi.spyOn(InstallService, 'checkInstallationStatus').mockResolvedValueOnce({ isInstalled: false });
    const check = vi.spyOn(InstallService, 'checkDatabaseConnection').mockResolvedValueOnce({ connected: true });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/install/check-database' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, data: { connected: true } });
    } finally {
      status.mockRestore();
      check.mockRestore();
    }
  });

  it('answers the completion with the success envelope', async () => {
    const status = vi.spyOn(InstallService, 'checkInstallationStatus').mockResolvedValueOnce({ isInstalled: false });
    const completion = vi.spyOn(InstallService, 'completeInstallation').mockResolvedValueOnce({
      success: true, siteName: 'Envelope Store', adminUsername: 'owner', adminEmail: 'owner@example.com', timezone: 'UTC',
    });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/install/complete',
        payload: { siteName: 'Envelope Store', adminEmail: 'owner@example.com', adminPassword: 'InstallationPassword123!' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: { success: true, siteName: 'Envelope Store', adminUsername: 'owner', adminEmail: 'owner@example.com', timezone: 'UTC' },
      });
    } finally {
      status.mockRestore();
      completion.mockRestore();
    }
  });
});
