/**
 * Plugin Runtime Integration Tests
 *
 * Real integration coverage for:
 * - Gateway default-instance routing behavior
 * - Header sanitization/injection
 * - Instance-level enable/disable soft blocking
 * - Admin default-instance management endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { PluginManagementService } from '@/core/admin/plugin-management/service';

describe('Plugin Runtime - Integration', () => {
  let app: FastifyInstance;
  let adminToken: string;

  const prisma = getTestPrisma();
  const slug = `itestplug${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  let pluginDir = '';
  const entryModule = 'server/index.js';

  let defaultInstallationId = '';

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    const { token } = await createAdminWithToken();
    adminToken = token;

    pluginDir = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-runtime-'));
    await fs.mkdir(path.join(pluginDir, 'server'), { recursive: true });
    const manifest = {
      schemaVersion: 1,
      slug,
      name: 'Integration Test Plugin',
      version: '1.0.0',
      description: 'Plugin runtime integration tests',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule,
      permissions: [],
    };
    await fs.writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(
        manifest,
        null,
        2
      ),
      'utf-8'
    );

    await pluginPackageStore.put(slug, pluginDir);
    pluginDir = (await pluginPackageStore.get(slug))!.getEntryPath('');

    await fs.writeFile(
      path.join(pluginDir, entryModule),
      `
module.exports = async function plugin(fastify, opts) {
  fastify.get('/echo', async (request) => {
    return {
      config: opts || {},
      query: request.query || {},
      headers: {
        pluginSlug: request.headers['x-plugin-slug'] || '',
        installationId: request.headers['x-installation-id'] || '',
        installationKey: request.headers['x-installation-key'] || '',
        userId: request.headers['x-user-id'] || '',
        userRole: request.headers['x-user-role'] || '',
        caller: request.headers['x-caller'] || '',
        requestId: request.headers['x-request-id'] || '',
        locale: request.headers['x-locale'] || '',
      },
    };
  });
};
      `.trim(),
      'utf-8'
    );

    await prisma.pluginInstall.create({
      data: {
        slug,
        name: 'Integration Test Plugin',
        version: '1.0.0',
        description: 'Plugin runtime integration tests',
        category: 'general',
        runtimeType: 'internal-fastify',
        entryModule,
        source: 'local-zip',
        manifestJson: manifest,
        permissions: JSON.stringify([]),
      },
    });

    const defaultInstance = await prisma.pluginInstallation.create({
      data: {
        pluginSlug: slug,
        instanceKey: 'default',
        enabled: true,
        configJson: JSON.stringify({ marker: 'default' }),
      },
    });
    defaultInstallationId = defaultInstance.id;

  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await pluginPackageStore.delete(slug);
    await deleteAllTestUsers();
    await app.close();
  });

  it('routes to default instance when no installation query is provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/${slug}/api/echo`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.config.marker).toBe('default');
    expect(body.headers.installationId).toBe(defaultInstallationId);
    expect(body.headers.installationKey).toBe('default');
  });

  it('sanitizes spoofed inbound headers and injects platform context headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/${slug}/api/echo`,
      headers: {
        referer: 'http://localhost:3001/admin/plugins',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'x-plugin-slug': 'spoof-plugin',
        'x-installation-id': 'spoof-installation-id',
        'x-user-id': 'spoof-user-id',
        'x-caller': 'spoof-caller',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.headers.pluginSlug).toBe(slug);
    expect(body.headers.installationId).toBe(defaultInstallationId);
    expect(body.headers.userId).toBe('');
    expect(body.headers.userRole).toBe('guest');
    expect(body.headers.caller).toBe('admin');
    expect(body.headers.locale).toBe('zh-CN');
    expect(body.headers.requestId).toBeTruthy();
  });

  it('returns 404 for removed instance create and delete routes', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${slug}/instances`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { instanceKey: 'another' },
    });
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/extensions/plugin/${slug}/instances/${defaultInstallationId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(createResponse.statusCode).toBe(404);
    expect(deleteResponse.statusCode).toBe(404);
  });

  it('returns only the default instance from the instances route', async () => {
    const nonDefault = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'legacy-list', enabled: false },
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/extensions/plugin/${slug}/instances`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.items).toHaveLength(1);
      expect(response.json().data.items[0].instanceKey).toBe('default');
    } finally {
      await prisma.pluginInstallation.delete({ where: { id: nonDefault.id } });
    }
  });

  it('rejects non-default instance keys at the service boundary', async () => {
    await expect(PluginManagementService.getInstanceByKey(slug, 'legacy')).rejects.toThrow(
      'Only the default plugin instance is supported',
    );
  });

  it('rejects updates to a non-default instance', async () => {
    const nonDefault = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'legacy', enabled: false },
    });
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/extensions/plugin/${slug}/instances/${nonDefault.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { enabled: true },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('Only the default plugin instance is supported');
    } finally {
      await prisma.pluginInstallation.delete({ where: { id: nonDefault.id } });
    }
  });
});
