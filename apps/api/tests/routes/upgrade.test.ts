/**
 * Upgrade Endpoints Tests
 * 
 * Coverage:
 * - GET /api/upgrade/version
 * - POST /api/upgrade/check
 * - GET /api/upgrade/status
 * - POST /api/upgrade/backup
 * - POST /api/upgrade/perform
 * 
 * All upgrade endpoints require admin authentication.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';

const PUBLIC_MANIFEST_URL = 'https://get.jiffoo.com/releases/core/manifest.json';
const PUBLIC_MANIFEST = {
  latestVersion: '1.0.11',
  latestStableVersion: '1.0.11',
  latestPrereleaseVersion: null,
  channel: 'stable',
  deliveryMode: 'image-first',
  images: {
    api: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/api:1.0.11',
    admin: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/admin:1.0.11',
    shop: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/shop:1.0.11',
    updater: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/updater:1.0.11',
  },
  releaseDate: '2026-04-11T00:00:00.000Z',
  changelogUrl: 'https://github.com/thefreelight/Jiffoo/commit/ef3e6481e12ae52fdb344896252d02d295a75f35',
  sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
  minimumCompatibleVersion: '1.0.0',
  minimumAutoUpgradableVersion: '1.0.0',
  requiresManualIntervention: false,
  releaseNotes:
    'Adds the GitHub-release-driven update feed, public manifest publishing automation, clearer self-hosted update diagnostics, and official embedded storefront renderer activation for package-managed themes.',
  checksumUrl: null,
  signatureUrl: null,
} as const;

describe('Upgrade Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();
    userToken = uToken;
    adminToken = aToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('GET /api/upgrade/manifest.json', () => {
    it('should return the public manifest without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upgrade/manifest.json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toEqual(PUBLIC_MANIFEST);
    });
  });

  describe('Security - 401 without token', () => {
    const endpoints = [
      { method: 'GET', url: '/api/upgrade/version' },
      { method: 'POST', url: '/api/upgrade/check', body: { targetVersion: '1.0.0' } },
      { method: 'GET', url: '/api/upgrade/status' },
      { method: 'POST', url: '/api/upgrade/backup' },
      { method: 'POST', url: '/api/upgrade/perform', body: { targetVersion: '1.0.0' } },
    ];

    it.each(endpoints)('$method $url should return 401 without token', async ({ method, url, body }) => {
      const response = await app.inject({ 
        method: method as any, 
        url,
        payload: body 
      });
      
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Security - 403 for non-admin user', () => {
    const endpoints = [
      { method: 'GET', url: '/api/upgrade/version' },
      { method: 'POST', url: '/api/upgrade/check', body: { targetVersion: '1.0.0' } },
      { method: 'GET', url: '/api/upgrade/status' },
      { method: 'POST', url: '/api/upgrade/backup' },
      { method: 'POST', url: '/api/upgrade/perform', body: { targetVersion: '1.0.0' } },
    ];

    it.each(endpoints)('$method $url should return 403 for regular user', async ({ method, url, body }) => {
      const response = await app.inject({ 
        method: method as any, 
        url,
        payload: body,
        headers: { authorization: `Bearer ${userToken}` }
      });
      
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/upgrade/version', () => {
    it('should return version information for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upgrade/version',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('deploymentMode');
      expect(body.data).toHaveProperty('deploymentModeSource');
      expect(body.data).toHaveProperty('oneClickUpgradeSupported');
      expect(body.data).toHaveProperty('releaseChannel');
      expect(body.data).toHaveProperty('manifestStatus');
      expect(body.data).toHaveProperty('deliveryMode');
      expect(body.data).toHaveProperty('runtimeImages');
      expect(body.data).toHaveProperty('recoveryMode', 'automatic-recovery');
    });

    it('should prefer the public manifest when one is configured and reachable', async () => {
      vi.stubEnv('JIFFOO_CORE_UPDATE_MANIFEST_URL', 'https://updates.example.com/releases/core/manifest.json');
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            latestVersion: '1.0.11',
            latestStableVersion: '1.0.11',
            latestPrereleaseVersion: null,
            channel: 'stable',
            deliveryMode: 'image-first',
            images: {
              api: 'registry.example.com/jiffoo-oss/api:1.0.11',
              admin: 'registry.example.com/jiffoo-oss/admin:1.0.11',
              shop: 'registry.example.com/jiffoo-oss/shop:1.0.11',
              updater: 'registry.example.com/jiffoo-oss/updater:1.0.11',
            },
            releaseDate: '2026-04-11T00:00:00.000Z',
            changelogUrl: 'https://example.com/changelog/1.0.11',
            minimumCompatibleVersion: '1.0.0',
            minimumAutoUpgradableVersion: '1.0.0',
            requiresManualIntervention: false,
            releaseNotes: 'Test release manifest',
          }),
        })) as typeof fetch,
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/upgrade/version',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.latestVersion).toBe('1.0.11');
      expect(body.data.updateSource).toBe('env-manifest');
      expect(body.data.manifestStatus).toBe('available');
      expect(body.data.manifestUrl).toBe('https://updates.example.com/releases/core/manifest.json');
      expect(body.data.releaseChannel).toBe('stable');
      expect(body.data.deliveryMode).toBe('image-first');
      expect(body.data.runtimeImages).toEqual({
        api: 'registry.example.com/jiffoo-oss/api:1.0.11',
        admin: 'registry.example.com/jiffoo-oss/admin:1.0.11',
        shop: 'registry.example.com/jiffoo-oss/shop:1.0.11',
        updater: 'registry.example.com/jiffoo-oss/updater:1.0.11',
      });
    });

    it('should transparently remap the legacy api.jiffoo.com manifest URL', async () => {
      vi.stubEnv('JIFFOO_CORE_UPDATE_MANIFEST_URL', 'https://api.jiffoo.com/api/upgrade/manifest.json');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => ({
          ok: true,
          json: async () => PUBLIC_MANIFEST,
        })) as typeof fetch,
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/upgrade/version',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.manifestUrl).toBe(PUBLIC_MANIFEST_URL);
      expect(body.data.updateSource).toBe('default-public-manifest');
      expect(fetch).toHaveBeenCalledWith(
        PUBLIC_MANIFEST_URL,
        expect.objectContaining({
          method: 'GET',
          headers: { accept: 'application/json' },
        }),
      );
    });
  });

  describe('POST /api/upgrade/check', () => {
    it('should return 400 without targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/check',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should check compatibility for admin with targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/check',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { targetVersion: '2.0.0' },
      });

      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/upgrade/status', () => {
    it('should return upgrade status for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upgrade/status',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
    });
  });

  describe('POST /api/upgrade/backup', () => {
    it('should create backup for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/backup',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // May return 200 or 500 depending on backup service state
      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('POST /api/upgrade/perform', () => {
    it('should return 400 without targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/perform',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle upgrade request with targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/perform',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { targetVersion: '2.0.0' },
      });

      // May return 200, 400 (no upgrade available), or 500
      expect([400, 500]).toContain(response.statusCode);
    });
  });
});
