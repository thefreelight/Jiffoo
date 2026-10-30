/**
 * Plugin runtime deadlines.
 *
 * A plugin that never registers, answers with a body that is not JSON or
 * blocks its entry module must fail as a failure of that plugin: the failure
 * is recorded, the circuit breaker counts it and the next call fails fast
 * instead of hanging.
 */

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
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
import { recordPluginFailure } from '@/core/extensions/runtime/failure';
import { sharedProtection, pluginProtectionScope } from '@/infra/shared-protection';
import { env } from '@/config/env';

/**
 * Every Fastify instance of the process is tracked, so a test can tell whether
 * the candidate instance of a failed plugin load was closed.
 */
const { createdInstances } = vi.hoisted(() => ({ createdInstances: [] as Array<{ closeCalls: number; closed: boolean }> }));

vi.mock('fastify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fastify')>();
  const factory = (options?: unknown) => {
    const app = (actual.default as unknown as (options?: unknown) => any)(options);
    const entry = { closeCalls: 0, closed: false };
    createdInstances.push(entry);
    try {
      const close = app.close.bind(app);
      app.close = (...args: unknown[]) => {
        entry.closeCalls += 1;
        if ((globalThis as unknown as Record<string, unknown>).__jiffooFailCandidateClose) throw new Error('candidate close failed');
        return close(...args);
      };
    } catch { /* the instance does not allow the wrap */ }
    app.addHook('onClose', async () => { entry.closed = true; });
    return app;
  };
  Object.assign(factory, actual.default);
  return { ...actual, default: factory };
});

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
    options: { contracts?: Array<{ name: string; version: number }>; config?: Record<string, unknown>; configSchema?: unknown; prime?: boolean } = {},
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
    if (options.prime !== false) await ensurePluginRegistryFresh();
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

  it('closes the candidate runtime instance of a plugin that fails to load', async () => {
    const slug = `candidate-close-${Date.now().toString(36)}`.slice(0, 30);
    await createPlugin(slug, `
module.exports = { register(ctx) {
  throw new Error('registration failed');
} };`, { contracts: [{ name: 'shipping', version: 1 }] });

    const before = createdInstances.length;
    await expect(callContract(slug, 'shipping', 1, 'quote', {})).rejects.toMatchObject({ code: 'CONTRACT_CALL_FAILED' });

    const candidates = createdInstances.slice(before);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) expect(candidate.closeCalls >= 1 || candidate.closed).toBe(true);
  }, 60000);

  it('closes the candidate runtime instance of a plugin that fails to load', async () => {
    const slug = `candidate-close-${Date.now().toString(36)}`.slice(0, 30);
    await createPlugin(slug, `
module.exports = { register(ctx) {
  throw new Error('registration failed');
} };`, { contracts: [{ name: 'shipping', version: 1 }] });

    const before = createdInstances.length;
    await expect(callContract(slug, 'shipping', 1, 'quote', {})).rejects.toMatchObject({ code: 'CONTRACT_CALL_FAILED' });

    const candidates = createdInstances.slice(before);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) expect(candidate.closeCalls >= 1 || candidate.closed).toBe(true);
  }, 60000);

  it('keeps the original failure when the close of the candidate instance fails', async () => {
    const records: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => { records.push(String(line)); });
    (globalThis as unknown as Record<string, unknown>).__jiffooFailCandidateClose = true;
    const slug = `candidate-close-fails-${Date.now().toString(36)}`.slice(0, 30);
    try {
      await createPlugin(slug, `
module.exports = { register(ctx) {
  throw new Error('registration failed');
} };`, { contracts: [{ name: 'shipping', version: 1 }] });
      await expect(callContract(slug, 'shipping', 1, 'quote', {})).rejects.toMatchObject({ code: 'CONTRACT_CALL_FAILED' });
    } finally {
      (globalThis as unknown as Record<string, unknown>).__jiffooFailCandidateClose = false;
      spy.mockRestore();
    }
    const events = records.map((line) => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return {}; } });
    expect(events.some((entry) => entry.event === 'plugin_candidate_close_failed' && entry.slug === slug)).toBe(true);
  }, 60000);

  it('gives the call its own budget after a slow runtime setup', async () => {
    // The registry is reconciled before the plugin exists, so the call under
    // test pays the setup itself and the setup eats into the budget of the
    // call only when both share one deadline.
    await ensurePluginRegistryFresh();
    const slug = `setup-budget-${Date.now().toString(36)}`.slice(0, 30);
    const installationId = await createPlugin(slug, `
const wait = new Int32Array(new SharedArrayBuffer(4));
Atomics.wait(wait, 0, 0, 4500);
module.exports = { register(ctx) {
  ctx.contracts.implement('shipping', 1, { quote: async () => {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    return { options: [{ id: 'standard', label: 'Standard', amountMinor: 499, estimatedDays: { min: 2, max: 4 } }] };
  } });
} };`, { contracts: [{ name: 'shipping', version: 1 }], prime: false });

    await expect(callContract(slug, 'shipping', 1, 'quote', {})).resolves.toMatchObject({ options: [{ id: 'standard' }] });

    // A slow setup is not a failure of the plugin, so the breaker does not
    // count it.
    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    const scope = pluginProtectionScope(installationId, installation.protectionGeneration);
    expect(await protectionRedis.zcard(`${scope}:failures`)).toBe(0);
  }, 60000);

  it('records the context of a failure and of a throttled failure', async () => {
    const records: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => { records.push(String(line)); });
    const client = { pluginInstallation: { updateMany: async () => ({ count: 1 }) } } as never;
    const slug = `failure-record-${Date.now().toString(36)}`.slice(0, 30);
    try {
      await recordPluginFailure(slug, new Error('plugin failed'), 'contract', 'installation-1', { config: {}, manifest: {} }, client);
      await recordPluginFailure(slug, new Error('plugin failed'), 'contract', 'installation-1', { config: {}, manifest: {} }, client);
    } finally {
      spy.mockRestore();
    }
    const events = records.map((line) => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return {}; } });
    const failure = events.find((entry) => entry.event === 'plugin_failure');
    const throttled = events.find((entry) => entry.event === 'plugin_failure_throttled');
    expect(failure).toMatchObject({ event: 'plugin_failure', slug, context: 'contract', installationId: 'installation-1', message: 'plugin failed' });
    expect(String(failure?.stack)).toContain('plugin-runtime-deadline');
    expect(throttled).toMatchObject({ event: 'plugin_failure_throttled', slug, context: 'contract', installationId: 'installation-1' });
  }, 60000);
});
