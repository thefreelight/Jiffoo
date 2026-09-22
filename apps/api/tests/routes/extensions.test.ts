/**
 * Extensions Installer Endpoints Tests
 * 
 * Coverage:
 * - POST /api/v1/extensions/:kind/install - Admin only
 * - DELETE /api/v1/extensions/:kind/:slug - Admin only
 * - GET /api/v1/extensions/:kind/:slug - Admin only
 * - GET /api/v1/extensions/:kind - Admin only
 * 
 * All extension installer endpoints require admin authentication.
 */

import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import archiver from 'archiver';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, createAdminWithToken, deleteAllTestUsers, type TestUser } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';

interface PluginArchiveOptions {
  entryModule?: string;
  packageType?: 'module';
  manifestTrustLevel?: 'builtin' | 'unsigned';
}

async function createUnsignedPluginArchive(
  slug: string,
  options: PluginArchiveOptions = {},
): Promise<{ archivePath: string; cleanup: () => Promise<void> }> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-extension-route-'));
  const packageDir = path.join(rootDir, 'package');
  const archivePath = path.join(rootDir, `${slug}.zip`);
  await fs.mkdir(path.join(packageDir, 'dist'), { recursive: true });
  await fs.writeFile(path.join(packageDir, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    slug,
    name: 'Unsigned Route Test Plugin',
    version: '1.0.0',
    description: 'Exercises the normal in-process upload path.',
    author: 'Jiffoo Test',
    category: 'other',
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
    ...(options.manifestTrustLevel === undefined ? {} : { trustLevel: options.manifestTrustLevel }),
    entryModule: options.entryModule ?? 'dist/index.js',
    permissions: [],
    capabilities: [],
  }, null, 2));
  if (options.packageType) {
    await fs.writeFile(path.join(packageDir, 'package.json'), JSON.stringify({ type: options.packageType }));
  }
  await fs.writeFile(path.join(packageDir, options.entryModule ?? 'dist/index.js'), `module.exports = async function plugin(fastify) {
  fastify.get('/health', async () => ({ status: 'healthy' }));
  fastify.get('/status', async (request) => ({
    pluginSlug: request.headers['x-plugin-slug'],
    status: 'active',
  }));
};
`);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(packageDir, false);
    archive.finalize();
  });

  return { archivePath, cleanup: () => fs.rm(rootDir, { recursive: true, force: true }) };
}

async function multipartPluginUpload(
  archivePath: string,
  confirmUnsigned: boolean,
): Promise<{ headers: Record<string, string>; payload: Buffer }> {
  const boundary = `----jiffoo-${Date.now().toString(36)}`;
  const file = await fs.readFile(archivePath);
  const parts: Buffer[] = [];
  if (confirmUnsigned) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="confirmUnsigned"\r\n\r\ntrue\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="plugin.zip"\r\nContent-Type: application/zip\r\n\r\n`));
  parts.push(file);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat(parts),
  };
}

describe('Extensions Installer Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let adminUser: TestUser;
  const prisma = getTestPrisma();
  const uploadSlug = `route-unsigned-${Date.now().toString(36)}`.slice(0, 32);
  let cleanupArchive: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    const { token: uToken } = await createUserWithToken();
    const admin = await createAdminWithToken();
    userToken = uToken;
    adminToken = admin.token;
    adminUser = admin.user;
  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: uploadSlug } });
    await prisma.pluginInstall.deleteMany({ where: { slug: uploadSlug } });
    await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: adminUser.id } });
    await pluginPackageStore.delete(uploadSlug);
    await cleanupArchive?.();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Security - 401 without token', () => {
    const endpoints = [
      { method: 'POST', url: '/api/v1/extensions/plugin/install' },
      { method: 'DELETE', url: '/api/v1/extensions/plugin/test-slug' },
      { method: 'POST', url: '/api/v1/extensions/plugin/test-slug/restore' },
      { method: 'DELETE', url: '/api/v1/extensions/plugin/test-slug/purge' },
    ];

    it.each(endpoints)('$method $url should return 401 without token', async ({ method, url }) => {
      const response = await app.inject({ method: method as any, url });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Security - 403 for non-admin user', () => {
    const endpoints = [
      { method: 'POST', url: '/api/v1/extensions/plugin/install' },
      { method: 'DELETE', url: '/api/v1/extensions/plugin/test-slug' },
      { method: 'POST', url: '/api/v1/extensions/plugin/test-slug/restore' },
      { method: 'DELETE', url: '/api/v1/extensions/plugin/test-slug/purge' },
    ];

    it.each(endpoints)('$method $url should return 403 for regular user', async ({ method, url }) => {
      const response = await app.inject({
        method: method as any,
        url,
        headers: { authorization: `Bearer ${userToken}` }
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/extensions/:kind/install', () => {
    const kinds = ['plugin'];

    it.each(kinds)('should require file upload for %s (400 without file)', async (kind) => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/extensions/${kind}/install`,
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'multipart/form-data; boundary=---boundary'
        },
        payload: '---boundary--'
      });

      // Multipart upload required, so expect 400 without file
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid kind', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions/invalid-kind/install',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(400);
    });

    it('requires unsigned confirmation, audits it before persistence, and serves the installed in-process plugin', async () => {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: uploadSlug } });
      await prisma.pluginInstall.deleteMany({ where: { slug: uploadSlug } });
      await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: adminUser.id } });
      await pluginPackageStore.delete(uploadSlug);
      const archive = await createUnsignedPluginArchive(uploadSlug);
      cleanupArchive = archive.cleanup;

      const unconfirmed = await multipartPluginUpload(archive.archivePath, false);
      const unconfirmedResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions/plugin/install',
        headers: { authorization: `Bearer ${adminToken}`, ...unconfirmed.headers },
        payload: unconfirmed.payload,
      });
      expect(unconfirmedResponse.statusCode).toBe(400);
      expect(unconfirmedResponse.json().error.code).toBe('UNSIGNED_CONFIRMATION_REQUIRED');
      expect(await prisma.adminStaffAuditLog.count({
        where: { staffUserId: adminUser.id, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' },
      })).toBe(0);

      const confirmed = await multipartPluginUpload(archive.archivePath, true);
      const installedResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions/plugin/install',
        headers: { authorization: `Bearer ${adminToken}`, ...confirmed.headers },
        payload: confirmed.payload,
      });
      expect(installedResponse.statusCode).toBe(200);
      expect(installedResponse.json().data.slug).toBe(uploadSlug);

      const [audit, plugin] = await Promise.all([
        prisma.adminStaffAuditLog.findFirst({
          where: { staffUserId: adminUser.id, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.pluginInstall.findUnique({ where: { slug: uploadSlug } }),
      ]);
      expect(audit?.metadata).toMatchObject({ slug: uploadSlug, version: '1.0.0', source: 'local-zip' });
      expect(plugin).not.toBeNull();
      expect(plugin?.trustLevel).toBe('unsigned');
      expect(audit!.createdAt.getTime()).toBeLessThanOrEqual(plugin!.installedAt.getTime());

      const defaultInstance = await prisma.pluginInstallation.findUnique({
        where: { pluginSlug_instanceKey: { pluginSlug: uploadSlug, instanceKey: 'default' } },
      });
      expect(defaultInstance).not.toBeNull();
      const enableResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/extensions/plugin/${uploadSlug}/instances/${defaultInstance!.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { enabled: true },
      });
      expect(enableResponse.statusCode).toBe(200);

      const gatewayResponse = await app.inject({ method: 'GET', url: `/api/v1/extensions/plugin/${uploadSlug}/api/status` });
      expect(gatewayResponse.statusCode).toBe(200);
      expect(gatewayResponse.json()).toMatchObject({ status: 'active' });

      const failureAt = new Date('2026-09-22T10:00:00.000Z');
      await prisma.pluginInstallation.update({
        where: { id: defaultInstance!.id },
        data: { lastFailureAt: failureAt, lastFailureMessage: 'plugin runtime failure' },
      });
      const instancesResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/extensions/plugin/${uploadSlug}/instances`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(instancesResponse.statusCode).toBe(200);
      expect(instancesResponse.json().data.items[0]).toMatchObject({
        installationId: defaultInstance!.id,
        lastFailureAt: failureAt.toISOString(),
        lastFailureMessage: 'plugin runtime failure',
      });

      const unsignedDetail = await app.inject({
        method: 'GET',
        url: `/api/v1/extensions/plugin/${uploadSlug}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(unsignedDetail.statusCode).toBe(200);
      expect(unsignedDetail.json().data.trustLevel).toBe('unsigned');

      await prisma.pluginInstall.update({
        where: { slug: uploadSlug },
        data: { source: 'builtin', trustLevel: 'builtin' },
      });
      const builtinDetail = await app.inject({
        method: 'GET',
        url: `/api/v1/extensions/plugin/${uploadSlug}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(builtinDetail.statusCode).toBe(200);
      expect(builtinDetail.json().data.trustLevel).toBe('builtin');

      await prisma.pluginInstall.update({ where: { slug: uploadSlug }, data: { manifestJson: {} } });
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/extensions/plugin',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().data.items.find((item: { slug: string }) => item.slug === uploadSlug).manifestError.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'schemaVersion' })]),
      );
      const invalidDetail = await app.inject({
        method: 'GET',
        url: `/api/v1/extensions/plugin/${uploadSlug}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(invalidDetail.statusCode).toBe(200);
      expect(invalidDetail.json().data.manifestError.issues).toEqual(expect.any(Array));

      const unchangedEnabled = (await prisma.pluginInstallation.findUnique({ where: { id: defaultInstance!.id } }))?.enabled;
      const invalidEnable = await app.inject({
        method: 'PATCH',
        url: `/api/v1/extensions/plugin/${uploadSlug}/instances/${defaultInstance!.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { enabled: !unchangedEnabled },
      });
      expect(invalidEnable.statusCode).toBe(422);
      expect((await prisma.pluginInstallation.findUnique({ where: { id: defaultInstance!.id } }))?.enabled).toBe(unchangedEnabled);
    });

    it('rejects a package whose manifest declares a trust tier', async () => {
      const builtinSlug = `route-builtin-${Date.now().toString(36)}`.slice(0, 32);
      const archive = await createUnsignedPluginArchive(builtinSlug, { manifestTrustLevel: 'builtin' });

      try {
        await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: builtinSlug } });
        await prisma.pluginInstall.deleteMany({ where: { slug: builtinSlug } });
        await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: adminUser.id } });
        await pluginPackageStore.delete(builtinSlug);

        const unconfirmed = await multipartPluginUpload(archive.archivePath, false);
        const unconfirmedResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/extensions/plugin/install',
          headers: { authorization: `Bearer ${adminToken}`, ...unconfirmed.headers },
          payload: unconfirmed.payload,
        });
        expect(unconfirmedResponse.statusCode).toBe(400);
        expect(unconfirmedResponse.json().error.code).toBe('MANIFEST_TRUST_LEVEL_NOT_ALLOWED');
        expect(await prisma.adminStaffAuditLog.count({
          where: { staffUserId: adminUser.id, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' },
        })).toBe(0);

        expect(await prisma.pluginInstall.findUnique({ where: { slug: builtinSlug } })).toBeNull();
      } finally {
        await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: builtinSlug } });
        await prisma.pluginInstall.deleteMany({ where: { slug: builtinSlug } });
        await pluginPackageStore.delete(builtinSlug);
        await archive.cleanup();
      }
    });

    it('rejects loading an ESM plugin entry package', async () => {
      const esmSlug = `route-esm-${Date.now().toString(36)}`.slice(0, 32);
      const archive = await createUnsignedPluginArchive(esmSlug, { packageType: 'module' });

      try {
        const upload = await multipartPluginUpload(archive.archivePath, true);
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/extensions/plugin/install',
          headers: { authorization: `Bearer ${adminToken}`, ...upload.headers },
          payload: upload.payload,
        });

        expect(response.statusCode).toBe(200);

        const defaultInstance = await prisma.pluginInstallation.findUnique({
          where: { pluginSlug_instanceKey: { pluginSlug: esmSlug, instanceKey: 'default' } },
        });
        expect(defaultInstance).not.toBeNull();

        const enableResponse = await app.inject({
          method: 'PATCH',
          url: `/api/v1/extensions/plugin/${esmSlug}/instances/${defaultInstance!.id}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { enabled: true },
        });
        expect(enableResponse.statusCode).toBe(400);

        const unchangedInstance = await prisma.pluginInstallation.findUnique({
          where: { pluginSlug_instanceKey: { pluginSlug: esmSlug, instanceKey: 'default' } },
        });
        expect(unchangedInstance?.enabled).toBe(false);
      } finally {
        await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: esmSlug } });
        await prisma.pluginInstall.deleteMany({ where: { slug: esmSlug } });
        await pluginPackageStore.delete(esmSlug);
        await archive.cleanup();
      }
    });
  });

  describe('DELETE /api/v1/extensions/plugin/:slug', () => {
    it('should return error for non-existent extension', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/extensions/plugin/non-existent-plugin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 500]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/v1/extensions/plugin/:slug/purge', () => {
    it('should return 404 for non-existent plugin purge', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/extensions/plugin/non-existent-plugin/purge',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/extensions/plugin/:slug/restore', () => {
    it('should return 404 for non-existent plugin restore', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions/plugin/non-existent-plugin/restore',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

});
