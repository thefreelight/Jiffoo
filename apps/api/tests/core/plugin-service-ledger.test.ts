import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { createTestApp } from '../helpers/create-test-app';
import { deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { publishTestPlugin, clearTestPluginCache } from '../helpers/plugin-cache';
import { PluginManagementService } from '@/core/admin/plugin-management/service';

/**
 * The durable service call ledger of the core-mediated plugin service contract.
 *
 * A method that requires an idempotent outcome is recorded before the provider
 * runs. The tests drive one real provider and one real consumer: the provider
 * keeps its own dedup record, so a replay and a reconciliation never debit a
 * second time.
 */

interface ProviderState {
  mode: 'ok' | 'crash' | 'crashAfterEffect' | 'hold';
  outcomes: Record<string, unknown>;
  effects: number[];
  calls: Array<{ callId: string; reconcile: boolean; amount: number }>;
}

describe('Plugin service call ledger', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  const providerSlug = `ledgerprov${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const consumerSlug = `ledgercons${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const directories: string[] = [];
  let statePath = '';
  let consumerInstallationId = '';

  const schema = {
    input: { type: 'object', properties: { amount: { type: 'integer', minimum: 0 } }, required: ['amount'], additionalProperties: false },
    result: { type: 'object', properties: { debited: { type: 'boolean' }, amount: { type: 'integer' } }, required: ['debited'], additionalProperties: false },
    errorDetails: { type: 'object', additionalProperties: true },
  };

  async function readState(): Promise<ProviderState> {
    return JSON.parse(await fs.readFile(statePath, 'utf8')) as ProviderState;
  }

  async function writeState(state: ProviderState): Promise<void> {
    await fs.writeFile(statePath, JSON.stringify(state), 'utf8');
  }

  async function pluginDirectory(files: Record<string, string>): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-ledger-'));
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
        slug, name: slug, version: '1.0.0', description: 'ledger test', category: 'integration',
        runtimeType: 'internal-fastify', entryModule: 'server/index.js', source: 'local-zip',
        zipHash, manifestJson: manifest, permissions: JSON.stringify([]),
      },
    });
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled: true, configJson: JSON.stringify({}) },
    });
    return installation.id;
  }

  /** The provider's source. Its dedup record stands in for the plugin's own table. */
  function providerSource(): string {
    return `const fs = require('fs');
const statePath = ${JSON.stringify(statePath)};
const read = () => JSON.parse(fs.readFileSync(statePath, 'utf8'));
const write = (state) => fs.writeFileSync(statePath, JSON.stringify(state));
module.exports = { register(ctx) {
  ctx.services.provide('wallet', 1, {
    debit: async (input, invocation) => {
      let state = read();
      state.calls.push({ callId: invocation.callId, reconcile: invocation.reconcile, amount: input.amount });
      write(state);
      if (state.mode === 'hold') {
        await globalThis.__jiffooLedgerGate.wait();
        state = read();
      }
      const known = state.outcomes[invocation.callId];
      if (known) { write(state); return known; }
      if (state.mode === 'crash') { write(state); throw new Error('the provider crashed'); }
      if (invocation.reconcile) { write(state); return { outcome: 'NOT_EXECUTED' }; }
      const outcome = { ok: true, data: { debited: true, amount: input.amount } };
      state.outcomes[invocation.callId] = outcome;
      state.effects.push(input.amount);
      write(state);
      if (state.mode === 'crashAfterEffect') throw new Error('the provider crashed after its effect');
      return outcome;
    },
  });
} };`;
  }

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    statePath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-ledger-state-')), 'state.json');
    directories.push(path.dirname(statePath));
    await writeState({ mode: 'ok', outcomes: {}, effects: [], calls: [] });

    const providerManifest = {
      schemaVersion: 1, slug: providerSlug, name: 'Ledger provider', version: '1.0.0',
      description: 'offers the wallet service', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [],
      services: [{ name: 'wallet', version: 1, methods: [{ name: 'debit', idempotencyRequired: true, schema: 'services/debit.json' }] }],
    };
    const providerDirectory = await pluginDirectory({
      'manifest.json': JSON.stringify(providerManifest),
      'services/debit.json': JSON.stringify(schema),
      'server/index.js': providerSource(),
    });
    await install(providerSlug, providerDirectory, providerManifest);

    const consumerManifest = {
      schemaVersion: 1, slug: consumerSlug, name: 'Ledger consumer', version: '1.0.0',
      description: 'calls the wallet service', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [],
      serviceDependencies: [{ plugin: providerSlug, service: 'wallet', version: 1, methods: ['debit'] }],
    };
    const consumerDirectory = await pluginDirectory({
      'manifest.json': JSON.stringify(consumerManifest),
      'server/index.js': `module.exports = { register(ctx) {
        ctx.http.route({ method: 'POST', path: '/call', handler: async (request) => ctx.services.call({
          plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'debit',
          input: { amount: request.body.amount }, idempotencyKey: request.body.key,
        }) });
      } };`,
    });
    consumerInstallationId = await install(consumerSlug, consumerDirectory, consumerManifest);
    await PluginManagementService.updateInstance(consumerInstallationId, {
      grantedPermissions: [`service:${providerSlug}:wallet.v1.debit`],
    });
  });

  afterAll(async () => {
    await prisma.pluginServiceCall.deleteMany({ where: { providerSlug } });
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: { in: [providerSlug, consumerSlug] } } });
    await prisma.pluginInstall.deleteMany({ where: { slug: { in: [providerSlug, consumerSlug] } } });
    await clearTestPluginCache(providerSlug);
    await clearTestPluginCache(consumerSlug);
    await deleteAllTestUsers();
    await app.close();
    for (const directory of directories) await fs.rm(directory, { recursive: true, force: true });
  });

  async function call(key: string, amount: number): Promise<any> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${consumerSlug}/api/call`,
      payload: { amount, key },
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  it('settles a call and replays the stored outcome without a second effect', async () => {
    await writeState({ mode: 'ok', outcomes: {}, effects: [], calls: [] });
    const first = await call('key-settle', 10);
    expect(first).toEqual({ ok: true, data: { debited: true, amount: 10 } });

    const replay = await call('key-settle', 10);
    expect(replay).toEqual(first);

    const state = await readState();
    expect(state.effects).toEqual([10]);
    expect(state.calls).toHaveLength(1);

    const rows = await prisma.pluginServiceCall.findMany({ where: { idempotencyKey: 'key-settle' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SUCCEEDED');
  });

  it('refuses the same key with a different input', async () => {
    await writeState({ mode: 'ok', outcomes: {}, effects: [], calls: [] });
    await call('key-conflict', 20);
    const conflict = await call('key-conflict', 21);
    expect(conflict.ok).toBe(false);
    expect(conflict.source).toBe('core');
    expect(conflict.error.code).toBe('PLUGIN_SERVICE_IDEMPOTENCY_CONFLICT');

    const state = await readState();
    expect(state.effects).toEqual([20]);
    expect(state.calls).toHaveLength(1);
  });

  it('recovers the original outcome of a call that crashed after its effect', async () => {
    await writeState({ mode: 'crashAfterEffect', outcomes: {}, effects: [], calls: [] });
    const crashed = await call('key-crash-after', 30);
    expect(crashed.ok).toBe(false);
    expect(crashed.source).toBe('core');
    expect(crashed.error.code).toBe('PLUGIN_SERVICE_PROVIDER_CRASHED');

    const unknown = await prisma.pluginServiceCall.findFirst({ where: { idempotencyKey: 'key-crash-after' } });
    expect(unknown?.status).toBe('UNKNOWN');

    await writeState({ ...(await readState()), mode: 'ok' });
    const recovered = await call('key-crash-after', 30);
    expect(recovered).toEqual({ ok: true, data: { debited: true, amount: 30 } });

    const state = await readState();
    expect(state.effects).toEqual([30]);
    expect(state.calls).toHaveLength(2);
    expect(state.calls[1].reconcile).toBe(true);

    const settled = await prisma.pluginServiceCall.findFirst({ where: { idempotencyKey: 'key-crash-after' } });
    expect(settled?.status).toBe('SUCCEEDED');
  });

  it('executes once after the provider proves that it never ran', async () => {
    await writeState({ mode: 'crash', outcomes: {}, effects: [], calls: [] });
    const crashed = await call('key-crash-before', 40);
    expect(crashed.ok).toBe(false);
    expect(crashed.error.code).toBe('PLUGIN_SERVICE_PROVIDER_CRASHED');

    await writeState({ ...(await readState()), mode: 'ok' });
    const executed = await call('key-crash-before', 40);
    expect(executed).toEqual({ ok: true, data: { debited: true, amount: 40 } });

    const state = await readState();
    expect(state.effects).toEqual([40]);
    expect(state.calls).toHaveLength(3);
    expect(state.calls[1].reconcile).toBe(true);
    expect(state.calls[2].reconcile).toBe(false);
  });

  it('keeps the outcome unknown when the reconciliation cannot prove it', async () => {
    await writeState({ mode: 'crash', outcomes: {}, effects: [], calls: [] });
    await call('key-unknown', 50);
    const stillCrashing = await call('key-unknown', 50);
    expect(stillCrashing.ok).toBe(false);
    expect(stillCrashing.source).toBe('core');
    expect(stillCrashing.error.code).toBe('PLUGIN_SERVICE_OUTCOME_UNKNOWN');
    expect(stillCrashing.error.details.originalCallId).toBeTruthy();

    const row = await prisma.pluginServiceCall.findFirst({ where: { idempotencyKey: 'key-unknown' } });
    expect(row?.status).toBe('UNKNOWN');
  });

  it('refuses a duplicate while the first call is running', async () => {
    await writeState({ mode: 'hold', outcomes: {}, effects: [], calls: [] });
    let release: (() => void) | undefined;
    (globalThis as any).__jiffooLedgerGate = {
      wait: () => new Promise<void>(resolve => { release = resolve; }),
    };
    try {
      const first = call('key-concurrent', 60);
      const deadline = Date.now() + 5000;
      while ((await readState()).calls.length === 0 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect((await readState()).calls).toHaveLength(1);

      const duplicate = await call('key-concurrent', 60);
      expect(duplicate.ok).toBe(false);
      expect(duplicate.source).toBe('core');
      expect(duplicate.error.code).toBe('PLUGIN_SERVICE_CALL_IN_PROGRESS');
      expect(duplicate.error.details.originalCallId).toBeTruthy();

      release?.();
      const settled = await first;
      expect(settled).toEqual({ ok: true, data: { debited: true, amount: 60 } });
      const state = await readState();
      expect(state.effects).toEqual([60]);
      expect(state.calls).toHaveLength(1);
    } finally {
      release?.();
      delete (globalThis as any).__jiffooLedgerGate;
      await writeState({ mode: 'ok', outcomes: {}, effects: [], calls: [] });
    }
  });
});
