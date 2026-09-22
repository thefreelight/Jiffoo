/**
 * Plugin Gateway Baseline Tests (Task 2.1.2)
 *
 * These tests establish a regression baseline for the plugin gateway's current
 * behavior before the R2 security convergence work begins. They cover:
 * - Normal gateway call (echo through internal-fastify)
 * - Plugin 404 (non-existent slug)
 * - Slug format validation
 *
 * As tasks 2.2–2.6 land, these tests should continue to pass. New tests for
 * signature verification, timeout, circuit breaker, etc. will be added alongside.
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

describe('Plugin Gateway — Baseline (Task 2.1.2)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;

  const prisma = getTestPrisma();
  const slug = `baselinegw${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  let pluginDir = '';
  const entryModule = 'server/index.js';

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    const { token, user } = await createAdminWithToken();
    adminToken = token;
    adminUserId = user.id;

    // Create a minimal internal-fastify plugin for gateway testing
    pluginDir = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-gateway-'));
    await fs.mkdir(path.join(pluginDir, 'server'), { recursive: true });
    const manifest = {
      schemaVersion: 1,
      slug,
      name: 'Baseline Gateway Test Plugin',
      version: '1.0.0',
      description: 'Plugin gateway baseline tests',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule,
      permissions: [], category: 'integration', contracts: [],
    };
    await fs.writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(
        manifest,
        null,
        2,
      ),
      'utf-8',
    );

    await pluginPackageStore.put(slug, pluginDir);
    pluginDir = (await pluginPackageStore.get(slug))!.getEntryPath('');

    await fs.writeFile(
      path.join(pluginDir, entryModule),
      `
module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/health', handler: async () => ({ status: 'ok', slug: '${slug}' }) });
  ctx.http.route({ method: 'POST', path: '/echo', handler: async (request) => ({ received: request.body }) });
  ctx.http.route({ method: 'GET', path: '/headers', handler: async (request) => ({
    caller: request.headers['x-caller'] || null,
    userId: request.headers['x-user-id'] || null,
    userRole: request.headers['x-user-role'] || null,
    platformId: request.headers['x-platform-id'] || null
  }) });
} };
      `.trim(),
      'utf-8',
    );

    await prisma.pluginInstall.create({
      data: {
        slug,
        name: 'Baseline Gateway Test Plugin',
        version: '1.0.0',
        description: 'Plugin gateway baseline tests',
        category: 'integration',
        runtimeType: 'internal-fastify',
        entryModule,
        source: 'local-zip',
        manifestJson: manifest,
        permissions: JSON.stringify([]),
      },
    });

    await prisma.pluginInstallation.create({
      data: {
        pluginSlug: slug,
        instanceKey: 'default',
        enabled: true,
        configJson: JSON.stringify({}),
      },
    });
  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await pluginPackageStore.delete(slug);
    await deleteAllTestUsers();
    await app.close();
  });

  // --- Normal gateway call ---

  it('routes GET to internal-fastify plugin and returns 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/${slug}/api/health`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.slug).toBe(slug);
  });

  it('routes POST to internal-fastify plugin with body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${slug}/api/echo`,
      payload: { message: 'hello' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.received).toEqual({ message: 'hello' });
  });

  it('allows anonymous public plugin routes and strips spoofed platform headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/${slug}/api/headers`,
      headers: {
        'x-caller': 'admin',
        'x-user-id': 'spoofed-user',
        'x-platform-id': 'spoofed-platform',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.caller).not.toBe('admin');
    expect(body.userId).not.toBe('spoofed-user');
    expect(body.platformId).not.toBe('spoofed-platform');
  });

  it('injects authenticated user context when a bearer token is present', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/${slug}/api/headers`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.userId).toBe(adminUserId);
    expect(body.userRole).toBe('ADMIN');
  });

  // --- Plugin 404 ---

  it('returns 404 for non-existent plugin slug', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/non-existent-plugin-slug/api/health`,
    });

    expect(response.statusCode).toBe(404);
  });

  // --- Slug format validation ---

  it('rejects invalid slug format (uppercase)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/InvalidSlug/api/health`,
    });

    // Gateway should reject or 404 — either is acceptable baseline behavior
    expect([400, 404]).toContain(response.statusCode);
  });

  it('rejects invalid slug format (special chars)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/invalid_slug/api/health`,
    });

    expect([400, 404]).toContain(response.statusCode);
  });

  // --- Admin endpoints baseline ---

  it('GET /api/v1/extensions/plugin lists installed plugins (admin only)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/extensions/plugin',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('GET /api/v1/extensions/plugin/:slug returns plugin detail', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/${slug}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.slug).toBe(slug);
    expect(body.data.runtimeType).toBe('internal-fastify');
  });
});
