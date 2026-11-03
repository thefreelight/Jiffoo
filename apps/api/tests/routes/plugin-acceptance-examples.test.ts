import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { attachPluginTaskDrain } from '@/core/plugins/task-drain';
import { createTaskApi, withTaskScope } from '@/core/plugins/tasks';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { servicePermission } from '@/core/extensions/registry';
import { pluginSchemaName } from 'shared/plugin-signing';
import { buildAcceptancePackages, CONSUMER_SLUG, PROVIDER_SLUG } from '../fixtures/acceptance-plugins';

/**
 * The acceptance of the two ordinary plugins of the plugin design.
 *
 * `wallet-provider` and `page-studio` are installed through the real install
 * path, so the provider's own migration creates its ledger in the plugin's
 * own schema. The consumer calls the provider through Core: the merchant's
 * grant decides whether the call happens, and the provider's ledger decides
 * whether the effect happens once.
 */

interface LedgerRow {
  idempotencyKey: string;
  method: string;
  amountMinor: string;
}

describe('The acceptance examples of the plugin line', () => {
  let app: FastifyInstance;
  let base: string;
  let token = '';
  let actorId = '';
  let consumerInstallationId = '';
  let detachDrain: (() => void) | undefined;
  const taskIds: string[] = [];

  const sdkRequire = createRequire(path.resolve('../../packages/plugin-sdk/package.json'));
  const sdk = sdkRequire('@jiffoo-core/plugin-sdk') as {
    drainPluginTasks(options: { installationIds: string[]; deadlineMs: number; includeFinalFailure: true }): Promise<{ completed: number; failed: number; unknownHooks: number }>;
  };

  /** The rows of the provider's own ledger. */
  async function ledgerRows(): Promise<LedgerRow[]> {
    const schema = pluginSchemaName(PROVIDER_SLUG);
    return prisma.$queryRawUnsafe<LedgerRow[]>(
      `SELECT "idempotencyKey", method, "amountMinor" FROM "${schema}".wallet_ledger ORDER BY method, "idempotencyKey"`);
  }

  /** The rows of the ledger that belong to one key and one method. */
  async function ledgerRowsOf(key: string, method: string): Promise<LedgerRow[]> {
    return (await ledgerRows()).filter(row => row.idempotencyKey === key && row.method === method);
  }

  /** The preview of a package, the way the administration uploads one. */
  async function preview(bytes: Buffer): Promise<any> {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), 'plugin.zip');
    const response = await fetch(`${base}/api/v1/extensions/plugin/preview`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form,
    });
    expect(response.status).toBe(200);
    return (await response.json()).data;
  }

  /** The install of a package, through the real path, with its migrations. */
  async function install(bytes: Buffer): Promise<any> {
    const plan = await preview(bytes);
    const form = new FormData();
    form.set('previewToken', plan.previewToken);
    if (plan.migrationPlan.changesDatabase) form.set('confirmMigrations', 'true');
    form.set('file', new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), 'plugin.zip');
    const accepted = await fetch(`${base}/api/v1/extensions/plugin/install`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form,
    });
    expect(accepted.status).toBe(202);
    const operationId = (await accepted.json()).data.operationId;
    const deadline = Date.now() + 25_000;
    let cursor = '';
    while (Date.now() < deadline) {
      const response = await fetch(`${base}/api/v1/extensions/plugin/operations/${operationId}?wait=true${cursor}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      const state = (await response.json()).data;
      if (!state.terminal) {
        cursor = `&phase=${encodeURIComponent(state.phase)}&committedPrefix=${state.committedPrefix}`;
        continue;
      }
      return state;
    }
    throw new Error('The install operation did not reach a terminal state');
  }

  /** The installation of a package, enabled and ready to serve. */
  async function installAndEnable(bytes: Buffer, slug: string): Promise<string> {
    const state = await install(bytes);
    expect(state.phase, `The install of ${slug} failed: ${state.errorCode ?? 'unknown'}`).toBe('SUCCESS');
    const installation = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    const enabled = await fetch(`${base}/api/v1/extensions/plugin/${slug}/instances/${installation.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enabled.status).toBe(200);
    return installation.id;
  }

  /** Enqueues a task of the consumer, the way the task engine takes it. */
  async function enqueueTask(key: string, payload: Record<string, unknown>): Promise<string> {
    const api = createTaskApi(consumerInstallationId, () => { throw new Error('Registration is not used by this test'); });
    const live = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { id: consumerInstallationId }, include: { plugin: true },
    });
    const task = await withTaskScope({
      installationId: consumerInstallationId, generation: live.protectionGeneration, zipHash: live.plugin.zipHash!,
      request: false, principal: null, actorId: 'acceptance-examples-test',
    }, () => api.enqueue('render', 1, payload, { idempotencyKey: key }));
    taskIds.push(task.id);
    return task.id;
  }

  /** Drains the tasks of the consumer, the final-failure hooks included. */
  async function drainTasks(): Promise<void> {
    await sdk.drainPluginTasks({ installationIds: [consumerInstallationId], deadlineMs: 15_000, includeFinalFailure: true });
  }

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false, disableRedis: false });
    base = await app.listen({ host: '127.0.0.1', port: 0 });
    const admin = await createAdminWithToken();
    token = admin.token;
    actorId = admin.user.id;
    detachDrain = attachPluginTaskDrain();

    const packages = await buildAcceptancePackages();
    // The provider comes first: the consumer declares its dependency on it.
    await installAndEnable(packages.provider.bytes, PROVIDER_SLUG);
    consumerInstallationId = await installAndEnable(packages.consumer.bytes, CONSUMER_SLUG);

    await PluginManagementService.updateInstance(consumerInstallationId, {
      grantedPermissions: [
        servicePermission(PROVIDER_SLUG, 'wallet', 1, 'debit'),
        servicePermission(PROVIDER_SLUG, 'wallet', 1, 'refund'),
      ],
    });
  });

  afterAll(async () => {
    detachDrain?.();
    for (const slug of [PROVIDER_SLUG, CONSUMER_SLUG]) {
      const installations = await prisma.pluginInstallation.findMany({ where: { pluginSlug: slug }, select: { id: true } });
      const ids = installations.map(installation => installation.id);
      const tasks = await prisma.pluginTask.findMany({ where: { installationId: { in: ids } }, select: { id: true } });
      await prisma.pluginTaskFinalFailure.deleteMany({ where: { taskId: { in: tasks.map(task => task.id) } } });
      await prisma.pluginTask.deleteMany({ where: { installationId: { in: ids } } });
      await prisma.pluginTaskExecutionSlot.deleteMany({ where: { installationId: { in: ids } } });
      await prisma.pluginTaskFairness.deleteMany({ where: { installationId: { in: ids } } });
      await prisma.pluginPrincipal.deleteMany({ where: { installationId: { in: ids } } });
      await prisma.pluginServiceCall.deleteMany({ where: { providerSlug: slug } });
      await prisma.pluginServiceCall.deleteMany({ where: { callerInstallationId: { in: ids } } });
      const namespace = await prisma.pluginNamespace.findUnique({ where: { slug } });
      if (namespace) {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${namespace.schemaName}" CASCADE`);
        await prisma.pluginMigrationAttempt.deleteMany({ where: { namespaceId: namespace.id } });
        await prisma.pluginMigrationSuccess.deleteMany({ where: { namespaceId: namespace.id } });
        await prisma.pluginNamespace.delete({ where: { id: namespace.id } });
      }
      await prisma.pluginMigrationOperation.deleteMany({ where: { slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
      await clearTestPluginCache(slug);
    }
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: taskIds } } });
    await deleteTestUser(actorId);
    await app.close();
  });

  it('holds one ledger row for the debit of a task that succeeded', async () => {
    const key = 'acceptance-debit-1';
    const taskId = await enqueueTask(key, { amountMinor: 1200 });
    await drainTasks();

    const task = await prisma.pluginTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(task.status).toBe('SUCCEEDED');
    expect(task.result).toMatchObject({ ok: true, data: { debited: true, amountMinor: 1200 } });

    const rows = await ledgerRowsOf(key, 'debit');
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amountMinor)).toBe(1200);
  });

  it('holds one refund row for the final-failure hook of a task that failed permanently', async () => {
    const key = 'acceptance-refund-1';
    const taskId = await enqueueTask(key, { amountMinor: 800, fail: true });
    await drainTasks();

    const task = await prisma.pluginTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(task.status).toBe('FAILED');
    const hook = await prisma.pluginTaskFinalFailure.findFirstOrThrow({ where: { taskId } });
    expect(hook.status).toBe('SUCCEEDED');

    const refunds = await ledgerRowsOf(key, 'refund');
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].amountMinor)).toBe(800);
    // The task failed before it could debit, so no debit was ever written.
    expect(await ledgerRowsOf(key, 'debit')).toHaveLength(0);
  });

  it('holds one ledger row for a repeated debit with the same idempotency key', async () => {
    const key = 'acceptance-replay-1';
    const call = async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/extensions/plugin/${CONSUMER_SLUG}/api/wallet/debit`,
        payload: { key, amountMinor: 500 },
      });
      expect(response.statusCode).toBe(200);
      return response.json();
    };

    const first = await call();
    expect(first).toMatchObject({ ok: true, data: { debited: true, amountMinor: 500 } });
    const replay = await call();
    expect(replay).toEqual(first);

    const rows = await ledgerRowsOf(key, 'debit');
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amountMinor)).toBe(500);
  });
});
