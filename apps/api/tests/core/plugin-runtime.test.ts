/**
 * Plugin Runtime Integration Tests
 *
 * Real integration coverage for:
 * - Gateway instance routing behavior
 * - Header sanitization/injection
 * - Instance-level enable/disable soft blocking
 * - Admin instance management endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'path';
import { promises as fs } from 'fs';
import http from 'http';
import { createHmac } from 'crypto';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { getPluginDir } from '@/core/admin/extension-installer/utils';

describe('Plugin Runtime - Integration', () => {
  let app: FastifyInstance;
  let adminToken: string;

  const prisma = getTestPrisma();
  const slug = `itestplug${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const pluginDir = getPluginDir(slug);
  const entryModule = 'server/index.js';

  let defaultInstallationId = '';
  let alphaInstallationId = '';
  let betaInstallationId = '';

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    const { token } = await createAdminWithToken();
    adminToken = token;

    await fs.mkdir(path.join(pluginDir, 'server'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          slug,
          name: 'Integration Test Plugin',
          version: '1.0.0',
          description: 'Plugin runtime integration tests',
          author: 'test-suite',
          runtimeType: 'internal-fastify',
          entryModule,
          permissions: [],
        },
        null,
        2
      ),
      'utf-8'
    );

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
        installPath: `extensions/plugins/${slug}`,
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

    const alphaInstance = await prisma.pluginInstallation.create({
      data: {
        pluginSlug: slug,
        instanceKey: 'alpha',
        enabled: true,
        configJson: JSON.stringify({ marker: 'alpha' }),
      },
    });
    alphaInstallationId = alphaInstance.id;
  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await fs.rm(pluginDir, { recursive: true, force: true });
    await deleteAllTestUsers();
    await app.close();
  });

  it('routes to default instance when no installation query is provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.config.marker).toBe('default');
    expect(body.headers.installationId).toBe(defaultInstallationId);
    expect(body.headers.installationKey).toBe('default');
  });

  it('supports instance routing by installation key and by installationId', async () => {
    const byKey = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo?installation=alpha`,
    });
    expect(byKey.statusCode).toBe(200);
    const byKeyBody = byKey.json();
    expect(byKeyBody.config.marker).toBe('alpha');
    expect(byKeyBody.headers.installationId).toBe(alphaInstallationId);
    expect(byKeyBody.headers.installationKey).toBe('alpha');

    const byIdPriority = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo?installation=alpha&installationId=${defaultInstallationId}`,
    });
    expect(byIdPriority.statusCode).toBe(200);
    const byIdBody = byIdPriority.json();
    expect(byIdBody.config.marker).toBe('default');
    expect(byIdBody.headers.installationId).toBe(defaultInstallationId);
    expect(byIdBody.headers.installationKey).toBe('default');
  });

  it('sanitizes spoofed inbound headers and injects platform context headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo`,
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

  it('returns 404 soft block when instance is disabled', async () => {
    await prisma.pluginInstallation.update({
      where: { id: alphaInstallationId },
      data: { enabled: false },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo?installation=alpha`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error.code).toBe('INSTANCE_DISABLED');
  });

  it('supports admin instance create/update/delete API with gateway effect', async () => {
    const createResp = await app.inject({
      method: 'POST',
      url: `/api/extensions/plugin/${slug}/instances`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        instanceKey: 'beta',
        enabled: true,
        config: { marker: 'beta' },
      },
    });
    expect(createResp.statusCode).toBe(200);
    betaInstallationId = createResp.json().data.installationId;

    const gwOk = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo?installation=beta`,
    });
    expect(gwOk.statusCode).toBe(200);
    expect(gwOk.json().config.marker).toBe('beta');

    const disableResp = await app.inject({
      method: 'PATCH',
      url: `/api/extensions/plugin/${slug}/instances/${betaInstallationId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { enabled: false },
    });
    expect(disableResp.statusCode).toBe(200);

    const gwBlocked = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo?installation=beta`,
    });
    expect(gwBlocked.statusCode).toBe(404);

    const deleteResp = await app.inject({
      method: 'DELETE',
      url: `/api/extensions/plugin/${slug}/instances/${betaInstallationId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(deleteResp.statusCode).toBe(200);
    expect(deleteResp.json().data.deleted).toBe(true);
  });
});

describe('Plugin Runtime - External HTTP config override and signature', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  const slug = `extplug${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const pluginDir = getPluginDir(slug);
  const signatureSecret = 'itest-signature-secret';

  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });

    server = http.createServer((req, res) => {
      const bodyChunks: Buffer[] = [];
      req.on('data', (chunk) => bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => {
        const body = Buffer.concat(bodyChunks).toString('utf-8');
        const payload = {
          path: req.url || '',
          method: req.method || 'GET',
          body,
          signature: req.headers['x-platform-signature'] || '',
          timestamp: req.headers['x-platform-timestamp'] || '',
        };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          slug,
          name: 'External HTTP Test Plugin',
          version: '1.0.0',
          description: 'Plugin runtime external-http tests',
          author: 'test-suite',
          runtimeType: 'external-http',
          externalBaseUrl: 'http://127.0.0.1:9',
          permissions: [],
        },
        null,
        2
      ),
      'utf-8'
    );

    await prisma.pluginInstall.create({
      data: {
        slug,
        name: 'External HTTP Test Plugin',
        version: '1.0.0',
        description: 'Plugin runtime external-http tests',
        category: 'general',
        runtimeType: 'external-http',
        source: 'local-zip',
        installPath: `extensions/plugins/${slug}`,
        permissions: JSON.stringify([]),
      },
    });

    await prisma.pluginInstallation.create({
      data: {
        pluginSlug: slug,
        instanceKey: 'default',
        enabled: true,
        configJson: JSON.stringify({
          externalBaseUrl: baseUrl,
          platformSignatureSecret: signatureSecret,
        }),
      },
    });
  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await fs.rm(pluginDir, { recursive: true, force: true });
    if (server) {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    await app.close();
  });

  it('uses installation config externalBaseUrl and injects platform signature headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${slug}/api/echo`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.path).toContain('/echo');
    expect(String(body.timestamp)).not.toHaveLength(0);
    expect(String(body.signature)).not.toHaveLength(0);

    const expected = createHmac('sha256', signatureSecret)
      .update(`GET./echo..${String(body.timestamp)}`)
      .digest('hex');
    expect(body.signature).toBe(expected);
  });
});
