/**
 * Plugin runtime deadlines.
 *
 * A plugin that never registers, answers with a body that is not JSON or
 * blocks its entry module must fail as a failure of that plugin: the failure
 * is recorded, the circuit breaker counts it and the next call fails fast
 * instead of hanging.
 */

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import Redis from 'ioredis';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { pageZip } from '../fixtures/plugin-pages';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { callContract, handlePluginGateway } from '@/core/extensions/runtime/plugin-runtime';
import { ensurePluginRegistryFresh } from '@/core/admin/extension-installer/plugin-registry-freshness';
import { ContractCallError } from '@/core/extensions/runtime/contract-errors';
import { encryptPluginConfig } from '@/core/extensions/shared/config-crypto';
import { sharedProtection, pluginProtectionScope } from '@/infra/shared-protection';
import { env } from '@/config/env';

const protectionRedis = new Redis(env.REDIS_URL);
const prisma = getTestPrisma();

describe('Plugin runtime deadlines', () => {
  const slugs: string[] = [];
  const sourceDirectories: string[] = [];

  afterAll(() => { protectionRedis.disconnect(); sharedProtection.close(); });

  afterEach(async () => {
    await Promise.all(slugs.splice(0).map(async (slug) => {
      const installations = await prisma.pluginInstallation.findMany({ where: { pluginSlug: slug } });
      for (const installation of installations) {
        const keys = await protectionRedis.keys(`jiffoo:protection:plugin:{${installation.id}:*`);
        if (keys.length) await protectionRedis.del(...keys);
      }
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await clearTestPluginCache(slug);
    }));
    await Promise.all(sourceDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
  });

  async function createPlugin(
    slug: string,
    source: string,
    options: { contracts?: Array<{ name: string; version: number }>; config?: Record<string, unknown>; configSchema?: unknown } = {},
  ): Promise<string> {
    slugs.push(slug);
    const sourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-runtime-deadline-'));
    sourceDirectories.push(sourceDirectory);
    await fs.mkdir(path.join(sourceDirectory, 'server'), { recursive: true });
    const manifest = {
      schemaVersion: 1,
      slug,
      name: slug,
      version: '1.0.0',
      description: 'Plugin runtime deadline test',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js',
      permissions: [],
      contracts: options.contracts ?? [],
      subscriptions: [],
      ...(options.configSchema ? { configSchema: options.configSchema } : {}),
    };
    await fs.writeFile(path.join(sourceDirectory, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
    await fs.writeFile(path.join(sourceDirectory, 'server', 'index.js'), source, 'utf-8');
    const bytes = await pageZip([
      { path: 'manifest.json', content: Buffer.from(JSON.stringify(manifest)) },
      { path: 'server/index.js', content: Buffer.from(source) },
    ]);
    const zipHash = createHash('sha256').update(bytes).digest('hex');
    await pluginPackageStore.put(slug, zipHash, sourceDirectory);
    await prisma.pluginInstall.create({
      data: { slug, name: slug, version: '1.0.0', runtimeType: 'internal-fastify', source: 'local-zip', zipHash, manifestJson: manifest },
    });
    await prisma.$transaction(tx => pluginPackageBlobStore.put(tx, slug, zipHash, bytes));
    const config = options.configSchema ? encryptPluginConfig(manifest, options.config ?? {}) : (options.config ?? {});
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled: true, configJson: JSON.stringify(config) },
    });
    // The registry reconciliation loads every installed plugin once, so the
    // call under test never fails in the registry path instead of its own.
    await ensurePluginRegistryFresh();
    return installation.id;
  }

  async function failureOf(promise: Promise<unknown>): Promise<{ code?: string; message?: string }> {
    return promise.then(() => ({}), (error: { code?: string; message?: string }) => error);
  }

  it('fails a contract call with PLUGIN_TIMEOUT when the plugin never registers, records the failure and counts the breaker', async () => {
    const slug = `deadline-register-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, `
module.exports = { register(ctx) {
  ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [] }) });
  return new Promise(() => undefined);
} };`, { contracts: [{ name: 'shipping', version: 1 }], config: { timeoutMs: 100 } });

    await expect(callContract(slug, 'shipping', 1, 'quote', {})).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT' });

    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    expect(installation.lastFailureAt).not.toBeNull();
    expect(installation.lastFailureMessage).toContain('registration timed out');
    const scope = pluginProtectionScope(installationId, installation.protectionGeneration);
    expect(await protectionRedis.zcard(`${scope}:failures`)).toBeGreaterThanOrEqual(1);

    let opened = false;
    for (let index = 0; index < 15 && !opened; index += 1) {
      const failure = await failureOf(callContract(slug, 'shipping', 1, 'quote', {}));
      if (failure.code === 'PLUGIN_CIRCUIT_OPEN') opened = true;
      else expect(failure).toMatchObject({ code: 'PLUGIN_TIMEOUT' });
    }
    expect(opened).toBe(true);
    expect(await protectionRedis.zcard(`${scope}:failures`)).toBeGreaterThanOrEqual(10);
  }, 60000);

  it('fails a contract call with CONTRACT_RESPONSE_INVALID when the plugin answers with a body that is not JSON', async () => {
    const slug = `deadline-json-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, `
module.exports = { register(ctx) {
  ctx.contracts.implement('shipping', 1, { quote: () => 'not json' });
} };`, { contracts: [{ name: 'shipping', version: 1 }] });

    await expect(callContract(slug, 'shipping', 1, 'quote', {})).rejects.toMatchObject({ code: 'CONTRACT_RESPONSE_INVALID' });

    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    expect(installation.lastFailureAt).not.toBeNull();
    expect(installation.lastFailureMessage).toContain('not JSON');
    const scope = pluginProtectionScope(installationId, installation.protectionGeneration);
    expect(await protectionRedis.zcard(`${scope}:failures`)).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('fails the load of a plugin whose entry module blocks instead of using it', async () => {
    const slug = `deadline-load-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, `
const wait = new Int32Array(new SharedArrayBuffer(4));
Atomics.wait(wait, 0, 0, 5200);
module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/slow', handler: () => ({ ok: true }) });
} };`, { contracts: [{ name: 'shipping', version: 1 }] });

    await expect(callContract(slug, 'shipping', 1, 'quote', {})).rejects.toMatchObject({ code: 'CONTRACT_CALL_FAILED' });

    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    expect(installation.lastFailureAt).not.toBeNull();
    expect(installation.lastFailureMessage).toContain('exceeded');
    const scope = pluginProtectionScope(installationId, installation.protectionGeneration);
    expect(await protectionRedis.zcard(`${scope}:failures`)).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('fails a gateway request with PLUGIN_TIMEOUT when the plugin never registers', async () => {
    const slug = `deadline-gateway-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, `
module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/slow', handler: () => ({ ok: true }) });
  return new Promise(() => undefined);
} };`, { config: { timeoutMs: 100 } });

    const app = Fastify();
    app.get('/plugin/:slug/check', (request, reply) => handlePluginGateway(request as any, reply, '/check', app));
    try {
      const response = await app.inject(`/plugin/${slug}/check`);
      expect(response.statusCode).toBe(504);
    } finally { await app.close(); }

    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    expect(installation.lastFailureAt).not.toBeNull();
    expect(installation.lastFailureMessage).toContain('registration timed out');
    const scope = pluginProtectionScope(installationId, installation.protectionGeneration);
    expect(await protectionRedis.zcard(`${scope}:failures`)).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('redacts the configuration of a plugin whose registration fails with a contract error', async () => {
    const secret = 'super-secret-plugin-value';
    // A plugin cannot import the Core error class, so the test hands its
    // prototype to the plugin through the global scope. The plugin then fails
    // with the very error the Core raises, carrying a message that embeds the
    // configuration of the plugin.
    (globalThis as unknown as Record<string, unknown>).__jiffooContractCallErrorPrototype = ContractCallError.prototype;
    const slug = `deadline-redaction-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, `
module.exports = { register(ctx) {
  const error = new Error('registration failed for ' + ctx.config.secret);
  error.code = 'PLUGIN_TIMEOUT';
  Object.setPrototypeOf(error, globalThis.__jiffooContractCallErrorPrototype);
  throw error;
} };`, {
      contracts: [{ name: 'shipping', version: 1 }],
      configSchema: { type: 'object', properties: { secret: { type: 'string', sensitive: true } }, required: ['secret'] },
      config: { secret },
    });

    const failure = await failureOf(callContract(slug, 'shipping', 1, 'quote', {}));
    expect(failure.code).toBe('PLUGIN_TIMEOUT');
    expect(failure.message).not.toContain(secret);
    expect(failure.message).toContain('***');

    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    expect(installation.lastFailureMessage).not.toContain(secret);
    expect(installation.lastFailureMessage).toContain('***');
  }, 60000);
});
