import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import archiver from 'archiver';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { extensionInstaller } from '@/core/admin/extension-installer';
import type { EventSubscription, PaymentFact, WebhookOutcome } from '@jiffoo/shared';
import { createHash } from 'node:crypto';
import { cleanupPluginMigrationFixture } from './plugin-migration-cleanup';

export type FixtureContract = { name: 'payment'; version: 2 } | { name: 'shipping' | 'tax' | 'notification'; version: 1 };

export const checkoutPaymentFixtureSource = `module.exports = { register(ctx) {
  const requests = new Map();
  const account = { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' };
  const fact = input => ({ account, requestKey: input.idempotencyKey, sessionId: 'fixture_' + input.orderId + '_' + input.idempotencyKey,
    amountMinor: input.amountMinor, currency: input.currency, observedAt: new Date().toISOString(), status: 'pending',
    action: { type: 'redirect', url: 'https://example.test/pay/' + input.orderId + '?return=' + encodeURIComponent(input.returnUrl) + '&cancel=' + encodeURIComponent(input.cancelUrl) },
    captures: [], canStillBeCharged: true, requestClosed: false });
  ctx.contracts.implement('payment', 2, {
    describe: (input) => ({
      displayName: 'Fixture card', requiresManualConfirmation: false,
      unpaidTimeoutMinutes: 30,
      supportedCurrencies: ctx.config.supported === false ? ['EUR'] : [input.storeCurrency],
      account,
    }),
    createSession: input => { const value = fact(input); requests.set(input.idempotencyKey, value); return value; },
    queryByRequestKey: input => requests.get(input.requestKey),
    handleWebhook: (input) => {
      const event = JSON.parse(Buffer.from(input.rawBody).toString('utf8'));
      const value = [...requests.values()].find(value => value.sessionId === event.sessionId);
      const captures = value.captures.length ? value.captures : [{ account, requestKey: value.requestKey, sessionId: value.sessionId,
        providerPaymentId: require('node:crypto').randomUUID(), amountMinor: value.amountMinor, currency: value.currency, observedAt: value.observedAt }];
      const paid = { ...value, status: 'succeeded', providerEventId: event.providerEventId, captures };
      requests.set(value.requestKey, paid);
      return { verification: 'verified', events: [paid] };
    },
  });
} };`;

export async function verifiedPaymentFixtureFact(slug: string, sessionId: string, providerEventId: string): Promise<PaymentFact> {
  const { callContract } = await import('@/core/admin/extension-installer/plugin-runtime');
  const result = await callContract(slug, 'payment', 2, 'handleWebhook', {
    rawBody: Buffer.from(JSON.stringify({ sessionId, providerEventId, status: 'succeeded' })),
    contentType: 'application/json', headers: {}, query: {},
  }) as WebhookOutcome;
  if (result.verification !== 'verified' || result.events.length !== 1) throw new Error('Payment fixture did not verify one complete fact');
  return result.events[0];
}

interface FixturePluginInstallOptions {
  app: FastifyInstance;
  adminToken: string;
  adminUserId: string;
}

export async function installFixturePlugin(
  options: FixturePluginInstallOptions,
  slug: string,
  category: 'shipping' | 'tax' | 'payment' | 'notification' | 'integration',
  contracts: FixtureContract[],
  source: string,
  eventOptions: { subscriptions?: EventSubscription[]; config?: Record<string, unknown>; configSchema?: Record<string, unknown>; lifecycle?: Record<string, boolean>; version?: string; enable?: boolean; migrations?: Array<{ id: string; path: string; sql: string }> } = {},
): Promise<void> {
  const rootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'checkout-fixture-'));
  const sourceDirectory = path.join(rootDirectory, 'package');
  const archivePath = path.join(rootDirectory, `${slug}.zip`);
  await fs.mkdir(path.join(sourceDirectory, 'server'), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    slug,
    name: slug,
    version: eventOptions.version ?? '1.0.0',
    description: 'Checkout contract test fixture',
    category,
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
    entryModule: 'server/index.js',
    permissions: [],
    contracts,
    subscriptions: eventOptions.subscriptions ?? [],
    ...(eventOptions.configSchema ? { configSchema: eventOptions.configSchema } : {}),
    ...(eventOptions.lifecycle ? { lifecycle: eventOptions.lifecycle } : {}),
    ...(eventOptions.migrations ? { database: { apiVersion: 1, migrations: eventOptions.migrations.map((file, index) => ({ id: file.id, order: index + 1, path: file.path, sha256: createHash('sha256').update(Buffer.from(file.sql)).digest('hex') })) } } : {}),
  };
  await fs.writeFile(path.join(sourceDirectory, 'manifest.json'), JSON.stringify(manifest), 'utf8');
  await fs.writeFile(path.join(sourceDirectory, 'server', 'index.js'), source, 'utf8');
  for (const migration of eventOptions.migrations ?? []) {
    await fs.mkdir(path.dirname(path.join(sourceDirectory, migration.path)), { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, migration.path), migration.sql, 'utf8');
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(sourceDirectory, false);
      void archive.finalize();
    });
    const bytes = await fs.readFile(archivePath);
    const { localUploadOptions } = await import('./plugin-upload');
    await extensionInstaller.installFromZip('plugin', Readable.from(bytes), await localUploadOptions(bytes, options.adminUserId));
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    const enabledResponse = await options.app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`,
      headers: { authorization: `Bearer ${options.adminToken}` },
      payload: { enabled: eventOptions.enable !== false, ...(eventOptions.config ? { config: eventOptions.config } : {}) },
    });
    if (enabledResponse.statusCode !== 200) {
      throw new Error(`Fixture plugin "${slug}" enable failed: ${enabledResponse.statusCode} ${enabledResponse.payload}`);
    }
  } finally {
    await fs.rm(rootDirectory, { recursive: true, force: true });
  }
}

export async function removeFixturePlugin(options: FixturePluginInstallOptions, slug: string): Promise<void> {
  const installed = await prisma.pluginInstall.findUnique({ where: { slug } });
  if (installed && !installed.deletedAt) {
    const uninstalled = await options.app.inject({ method: 'DELETE', url: `/api/v1/extensions/plugin/${slug}`, headers: { authorization: `Bearer ${options.adminToken}` } });
    if (uninstalled.statusCode !== 200) throw new Error(`Fixture uninstall failed: ${uninstalled.payload}`);
  }
  const response = await options.app.inject({
    method: 'DELETE',
    url: `/api/v1/extensions/plugin/${slug}/purge`,
    headers: { authorization: `Bearer ${options.adminToken}` },
    payload: { confirmationSlug: slug },
  });
  if (response.statusCode !== 200 && response.statusCode !== 404) {
    throw new Error(`Fixture plugin "${slug}" purge failed: ${response.statusCode} ${response.payload}`);
  }
  await cleanupPluginMigrationFixture(slug);
}
