import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { createTestApp } from '../helpers/create-test-app';
import { deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { publishTestPlugin, clearTestPluginCache } from '../helpers/plugin-cache';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { attachPluginTaskDrain } from '@/core/plugins/task-drain';
import { createTaskApi, withTaskScope } from '@/core/plugins/tasks';

/**
 * The grant of a plugin service in the paths of a task.
 *
 * G4 requires the merchant grant to gate every path that reaches the single
 * service entry, not only the plugin's HTTP routes. A task handler and a
 * final-failure hook both run inside the plugin's one runtime, so their
 * `ctx.services.call` reaches the same `callService` wiring as a route does.
 *
 * The last case covers the timeout outcome of the durable call ledger: an
 * UNKNOWN row keeps the call reconcilable, and a retry reconciles it instead
 * of executing the provider's effect a second time.
 */

interface ProviderState {
  executions: number;
  reconciliations: number;
}

describe('The grant of a plugin service in the paths of a task', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  const providerSlug = `grantprov${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const consumerSlug = `grantcons${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const directories: string[] = [];
  const taskIds: string[] = [];
  let consumerInstallationId = '';
  let providerStatePath = '';
  let consumerResultPath = '';
  let detachDrain: (() => void) | undefined;

  const permission = `service:${providerSlug}:wallet.v1.debit`;
  const timeoutCallKey = 'key-timeout';

  const schema = {
    input: { type: 'object', properties: { mode: { type: 'string' } }, required: ['mode'], additionalProperties: false },
    result: { type: 'object', properties: { debited: { type: 'boolean' } }, required: ['debited'], additionalProperties: false },
    errorDetails: { type: 'object', additionalProperties: true },
  };

  async function pluginDirectory(files: Record<string, string>): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-grant-paths-'));
    directories.push(directory);
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(directory, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf-8');
    }
    return directory;
  }

  async function install(slug: string, directory: string, manifest: Record<string, unknown>): Promise<string> {
    const zipHash = await publishTestPlugin(slug, directory);
    await prisma.pluginInstall.create({
      data: {
        slug, name: slug, version: '1.0.0', description: 'grant path test', category: 'integration',
        runtimeType: 'internal-fastify', entryModule: 'server/index.js', source: 'local-zip',
        zipHash, manifestJson: manifest, permissions: JSON.stringify([]),
      },
    });
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled: true, configJson: JSON.stringify({}) },
    });
    return installation.id;
  }

  async function readProviderState(): Promise<ProviderState> {
    return JSON.parse(await fs.readFile(providerStatePath, 'utf8')) as ProviderState;
  }

  async function resetProviderState(): Promise<void> {
    await fs.writeFile(providerStatePath, JSON.stringify({ executions: 0, reconciliations: 0 }), 'utf8');
  }

  async function resetConsumerResult(): Promise<void> {
    await fs.rm(consumerResultPath, { force: true });
  }

  async function readConsumerResult(): Promise<any> {
    return JSON.parse(await fs.readFile(consumerResultPath, 'utf8'));
  }

  /** The provider records every entry and never answers within the call's budget. */
  function providerSource(): string {
    return `const fs = require('fs');
const statePath = ${JSON.stringify(providerStatePath)};
const read = () => JSON.parse(fs.readFileSync(statePath, 'utf8'));
const write = state => fs.writeFileSync(statePath, JSON.stringify(state));
const hold = invocation => new Promise((_, reject) => {
  const abort = () => reject(new Error('The provider was aborted'));
  if (invocation.signal.aborted) abort();
  else invocation.signal.addEventListener('abort', abort, { once: true });
});
module.exports = { register(ctx) {
  ctx.services.provide('wallet', 1, {
    debit: async (input, invocation) => {
      const state = read();
      if (invocation.reconcile) { state.reconciliations += 1; write(state); return hold(invocation); }
      state.executions += 1;
      write(state);
      return hold(invocation);
    },
  });
} };`;
  }

  /** The consumer calls the service from a task handler, a final-failure hook and a route. */
  function consumerSource(): string {
    return `const fs = require('fs');
const resultPath = ${JSON.stringify(consumerResultPath)};
const record = result => fs.writeFileSync(resultPath, JSON.stringify(result));
module.exports = { register(ctx) {
  ctx.tasks.handle('grant', 1, async input => {
    if (input.payload && input.payload.mode === 'fail') throw new Error('The task fails so that its final-failure hook runs');
    const result = await ctx.services.call({
      plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'debit',
      input: { mode: 'grant' }, idempotencyKey: input.idempotencyKey,
    });
    record(result);
    return result;
  }, { concurrency: 1, maxAttempts: 1, maxRuntimeSeconds: 300, onFinalFailure: { maxRuntimeSeconds: 2, handler: async input => {
    const result = await ctx.services.call({
      plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'debit',
      input: { mode: 'grant' }, idempotencyKey: input.idempotencyKey,
    });
    record(result);
    return result;
  } } });
  ctx.http.route({ method: 'POST', path: '/call', handler: async request => ctx.services.call({
    plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'debit',
    input: { mode: 'timeout' }, idempotencyKey: request.body.key, timeoutMs: 100,
  }) });
} };`;
  }

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false, disableRedis: false });
    detachDrain = attachPluginTaskDrain();

    const stateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-grant-paths-state-'));
    directories.push(stateDirectory);
    providerStatePath = path.join(stateDirectory, 'provider.json');
    consumerResultPath = path.join(stateDirectory, 'consumer.json');
    await resetProviderState();

    const providerManifest = {
      schemaVersion: 1, slug: providerSlug, name: 'Grant provider', version: '1.0.0',
      description: 'offers the wallet service', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [],
      services: [{ name: 'wallet', version: 1, methods: [
        { name: 'debit', idempotencyRequired: true, schema: 'services/debit.json' },
      ] }],
    };
    const providerDirectory = await pluginDirectory({
      'manifest.json': JSON.stringify(providerManifest),
      'services/debit.json': JSON.stringify(schema),
      'server/index.js': providerSource(),
    });
    await install(providerSlug, providerDirectory, providerManifest);

    const consumerManifest = {
      schemaVersion: 1, slug: consumerSlug, name: 'Grant consumer', version: '1.0.0',
      description: 'calls the wallet service from a task, a hook and a route', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [],
      serviceDependencies: [{ plugin: providerSlug, service: 'wallet', version: 1, methods: ['debit'] }],
      tasks: [{ name: 'grant', version: 1, concurrency: 1, maxAttempts: 1, maxRuntimeSeconds: 300, onFinalFailure: { maxRuntimeSeconds: 2 } }],
    };
    const consumerDirectory = await pluginDirectory({
      'manifest.json': JSON.stringify(consumerManifest),
      'server/index.js': consumerSource(),
    });
    consumerInstallationId = await install(consumerSlug, consumerDirectory, consumerManifest);
  });

  afterAll(async () => {
    detachDrain?.();
    await prisma.pluginServiceCall.deleteMany({ where: { providerSlug } });
    await prisma.pluginTaskExecutionSlot.deleteMany({ where: { installationId: consumerInstallationId } });
    await prisma.pluginTaskFairness.deleteMany({ where: { installationId: consumerInstallationId } });
    await prisma.pluginInstall.deleteMany({ where: { slug: { in: [providerSlug, consumerSlug] } } });
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: [providerSlug, consumerSlug, ...taskIds] } } });
    await clearTestPluginCache(providerSlug);
    await clearTestPluginCache(consumerSlug);
    await deleteAllTestUsers();
    await app.close();
    for (const directory of directories) await fs.rm(directory, { recursive: true, force: true });
  });

  async function enqueueTask(key: string, payload: Record<string, unknown>): Promise<string> {
    const api = createTaskApi(consumerInstallationId, () => { throw new Error('Registration is not used by this test'); });
    const live = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: consumerInstallationId }, include: { plugin: true } });
    const task = await withTaskScope({
      installationId: consumerInstallationId, generation: live.protectionGeneration, zipHash: live.plugin.zipHash!,
      request: false, principal: null, actorId: 'grant-paths-test',
    }, () => api.enqueue('grant', 1, payload, { idempotencyKey: key }));
    taskIds.push(task.id);
    return task.id;
  }

  async function drainTasks(): Promise<void> {
    const sdkRequire = createRequire(path.resolve('../../packages/plugin-sdk/package.json'));
    const sdk = sdkRequire('@jiffoo-core/plugin-sdk') as {
      drainPluginTasks(options: { installationIds: string[]; deadlineMs: number; includeFinalFailure: true }): Promise<{ completed: number; failed: number; unknownHooks: number }>;
    };
    await sdk.drainPluginTasks({ installationIds: [consumerInstallationId], deadlineMs: 15_000, includeFinalFailure: true });
  }

  async function callServiceRoute(key: string): Promise<any> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${consumerSlug}/api/call`,
      payload: { key },
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  it('settles a timed-out call as unknown and reconciles it without executing the provider again', async () => {
    await PluginManagementService.updateInstance(consumerInstallationId, { grantedPermissions: [permission] });
    await resetProviderState();

    const first = await callServiceRoute(timeoutCallKey);
    expect(first.ok).toBe(false);
    expect(first.source).toBe('core');
    expect(first.error.code).toBe('PLUGIN_SERVICE_TIMEOUT');

    const rows = await prisma.pluginServiceCall.findMany({
      where: { idempotencyKey: timeoutCallKey, callerInstallationId: consumerInstallationId },
    });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.status).toBe('UNKNOWN');
    expect((row.safeError as { code?: string } | null)?.code).toBe('PLUGIN_SERVICE_TIMEOUT');
    expect(row.response).toBeNull();

    // The retry reconciles the unknown row: the provider proves the outcome
    // again, but it is never executed a second time.
    const retry = await callServiceRoute(timeoutCallKey);
    expect(retry.ok).toBe(false);
    expect(retry.source).toBe('core');
    expect(retry.error.code).toBe('PLUGIN_SERVICE_OUTCOME_UNKNOWN');
    expect(retry.error.details.originalCallId).toBe(row.id);

    const settled = await prisma.pluginServiceCall.findUniqueOrThrow({ where: { id: row.id } });
    expect(settled.status).toBe('UNKNOWN');
    expect((settled.safeError as { code?: string } | null)?.code).toBe('PLUGIN_SERVICE_TIMEOUT');

    const providerState = await readProviderState();
    expect(providerState.executions).toBe(1);
    expect(providerState.reconciliations).toBe(1);
  });

  it('refuses a service call from a task handler that the merchant did not grant', async () => {
    await PluginManagementService.updateInstance(consumerInstallationId, { grantedPermissions: [] });
    await resetProviderState();
    await resetConsumerResult();

    const taskId = await enqueueTask('grant-handler', { mode: 'handler' });
    await drainTasks();

    const row = await prisma.pluginTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.status).toBe('SUCCEEDED');
    expect(row.result).toMatchObject({
      ok: false,
      source: 'core',
      error: { code: 'PLUGIN_SERVICE_PERMISSION_DENIED' },
    });
    expect(await readConsumerResult()).toMatchObject({
      ok: false,
      source: 'core',
      error: { code: 'PLUGIN_SERVICE_PERMISSION_DENIED' },
    });

    // The grant is checked before the provider's installation is resolved, so
    // the provider's handler was never entered.
    expect((await readProviderState()).executions).toBe(0);
  });

  it('refuses a service call from a final-failure hook that the merchant did not grant', async () => {
    await PluginManagementService.updateInstance(consumerInstallationId, { grantedPermissions: [] });
    await resetProviderState();
    await resetConsumerResult();

    const taskId = await enqueueTask('grant-hook', { mode: 'fail' });
    await drainTasks();

    const task = await prisma.pluginTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(task.status).toBe('FAILED');
    const hook = await prisma.pluginTaskFinalFailure.findFirstOrThrow({ where: { taskId } });
    expect(hook.status).toBe('SUCCEEDED');

    // The hook's return value is not published, so the hook records the result
    // it saw. It is a Core refusal, not the provider's business rejection.
    expect(await readConsumerResult()).toMatchObject({
      ok: false,
      source: 'core',
      error: { code: 'PLUGIN_SERVICE_PERMISSION_DENIED' },
    });
    expect((await readProviderState()).executions).toBe(0);
  });
});
