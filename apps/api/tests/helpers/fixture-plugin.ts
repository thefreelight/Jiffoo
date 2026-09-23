import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import archiver from 'archiver';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { extensionInstaller } from '@/core/admin/extension-installer';

export type FixtureContract = { name: 'shipping' | 'tax' | 'payment'; version: 1 };

export const checkoutPaymentFixtureSource = `module.exports = { register(ctx) {
  ctx.contracts.implement('payment', 1, {
    describe: (input) => ({
      displayName: 'Fixture card', requiresManualConfirmation: false,
      unpaidTimeoutMinutes: 30,
      supportedCurrencies: ctx.config.supported === false ? ['EUR'] : [input.storeCurrency],
    }),
    createSession: (input) => ({
      sessionId: 'fixture_' + input.orderId + '_' + input.idempotencyKey,
      action: { type: 'redirect', url: 'https://example.test/pay/' + input.orderId },
    }),
    getSessionStatus: () => ({ status: 'pending' }),
    handleWebhook: (input) => {
      const event = JSON.parse(input.rawBody);
      return { events: [{ providerEventId: event.providerEventId, sessionId: event.sessionId, status: 'succeeded' }] };
    },
  });
} };`;

interface FixturePluginInstallOptions {
  app: FastifyInstance;
  adminToken: string;
  adminUserId: string;
}

export async function installFixturePlugin(
  options: FixturePluginInstallOptions,
  slug: string,
  category: 'shipping' | 'tax' | 'payment',
  contracts: FixtureContract[],
  source: string,
): Promise<void> {
  const rootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'checkout-fixture-'));
  const sourceDirectory = path.join(rootDirectory, 'package');
  const archivePath = path.join(rootDirectory, `${slug}.zip`);
  await fs.mkdir(path.join(sourceDirectory, 'server'), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    slug,
    name: slug,
    version: '1.0.0',
    description: 'Checkout contract test fixture',
    category,
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
    entryModule: 'server/index.js',
    permissions: [],
    contracts,
  };
  await fs.writeFile(path.join(sourceDirectory, 'manifest.json'), JSON.stringify(manifest), 'utf8');
  await fs.writeFile(path.join(sourceDirectory, 'server', 'index.js'), source, 'utf8');
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
    await extensionInstaller.installFromZip('plugin', Readable.from(await fs.readFile(archivePath)), {
      confirmUnsigned: true,
      actorUserId: options.adminUserId,
    });
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    const enabledResponse = await options.app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`,
      headers: { authorization: `Bearer ${options.adminToken}` },
      payload: { enabled: true },
    });
    if (enabledResponse.statusCode !== 200) {
      throw new Error(`Fixture plugin "${slug}" enable failed: ${enabledResponse.statusCode} ${enabledResponse.payload}`);
    }
  } finally {
    await fs.rm(rootDirectory, { recursive: true, force: true });
  }
}

export async function removeFixturePlugin(options: FixturePluginInstallOptions, slug: string): Promise<void> {
  const response = await options.app.inject({
    method: 'DELETE',
    url: `/api/v1/extensions/plugin/${slug}/purge`,
    headers: { authorization: `Bearer ${options.adminToken}` },
  });
  if (response.statusCode !== 200 && response.statusCode !== 404) {
    throw new Error(`Fixture plugin "${slug}" purge failed: ${response.statusCode} ${response.payload}`);
  }
}
