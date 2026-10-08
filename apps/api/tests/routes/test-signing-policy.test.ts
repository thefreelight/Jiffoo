import { createHash, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import archiver from 'archiver';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { CERT_PATH, SIGNATURE_PATH, issuePublisherCertificate, signPackage, trustedRootKeys, OFFICIAL_ROOT_PUBLIC_KEY } from 'shared/plugin-signing';
import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { resetPluginState } from '@/core/admin/extension-installer/plugin-state';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { testRoot, testPublisher, untrustedRoot } from '../fixtures/plugin-signing-keys';
import { extensionInstallerSchemas } from '@/core/admin/extension-installer/schemas';

const previous = {
  override: process.env.JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE,
  key: process.env.JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY,
  marketplace: process.env.JIFFOO_TEST_MARKETPLACE_URL,
  marketplaceFlag: process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE,
};
const paymentSource = `module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/health', handler: async () => ({ status: 'healthy' }) });
  ctx.contracts.implement('payment', 1, {
    describe: (input) => ({ displayName: 'Signing fixture', requiresManualConfirmation: true,
      unpaidTimeoutMinutes: 60, supportedCurrencies: [input.storeCurrency] }),
    createSession: () => ({ sessionId: 'fixture', action: { type: 'none' } }),
    getSessionStatus: () => ({ status: 'pending' }), handleWebhook: () => ({ verification: 'verified', events: [] }),
  });
} };`;
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
let app: FastifyInstance;
let token: string;
let base: string;
let server: Server;
let origin: string;
let catalogBody: unknown;
let packageBody: Buffer;
const slugs = new Set<string>();
const own = () => { const slug = `signing-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };

async function bytes(slug: string, root: 'official' | 'test' | 'unsigned') {
  const entries = [
    { path: 'manifest.json', content: Buffer.from(JSON.stringify({
      schemaVersion: 1, slug, name: 'Signing Fixture', version: '1.0.0', description: 'Test',
      author: 'Test', category: 'payment', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'dist/index.js', permissions: [], contracts: [{ name: 'payment', version: 1 }],
    })) },
    { path: 'dist/index.js', content: Buffer.from(paymentSource) },
  ];
  if (root !== 'unsigned') {
    entries.push({ path: CERT_PATH, content: Buffer.from(JSON.stringify(issuePublisherCertificate(
      'signing-publisher', 'Signing Publisher', testPublisher.publicKey,
      root === 'official' ? untrustedRoot.privateKey : testRoot.privateKey,
    ))) });
    const listing = entries.map((entry) => ({ path: entry.path, sha256: sha(entry.content) }))
      .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    entries.push({ path: SIGNATURE_PATH, content: Buffer.from(JSON.stringify(signPackage(listing, testPublisher.privateKey))) });
  }
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  const collected = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
  });
  const archive = archiver('zip');
  archive.on('error', (error) => output.destroy(error));
  archive.pipe(output);
  for (const entry of entries) archive.append(entry.content, { name: entry.path, date: new Date('1980-01-01T00:00:00Z') });
  void archive.finalize();
  return collected;
}

async function install(slug: string, root: 'official' | 'test' | 'unsigned', source: 'upload' | 'marketplace' = 'upload') {
  const zip = await bytes(slug, root);
  if (source === 'marketplace') {
    packageBody = zip;
    catalogBody = { schemaVersion: 1, plugins: [{
      id: slug, slug, name: 'Signing Fixture', description: 'Test', publisherId: 'signing-publisher',
      declaredCapabilities: ['shipping'],
      versions: [{ version: '1.0.0', minApiVersion: 'v1', sha256: sha(zip), size: zip.length, downloadUrl: '/package.zip' }],
    }] };
    process.env.JIFFOO_TEST_MARKETPLACE_URL = `${origin}/${randomUUID()}`;
    const { waitForPluginUpload, completedPluginUploadBody } = await import('../helpers/plugin-upload');
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const previewResponse = await fetch(`${base}/api/v1/extensions/marketplace/preview`, { method: 'POST', headers, body: JSON.stringify({ pluginId: slug, version: '1.0.0' }) });
    if (!previewResponse.ok) { const body = await previewResponse.json(); return { statusCode: previewResponse.status, json: async () => body }; }
    const preview = (await previewResponse.json()).data;
    const accepted = await fetch(`${base}/api/v1/extensions/marketplace/install`, { method: 'POST', headers, body: JSON.stringify({ pluginId: slug, version: '1.0.0', previewToken: preview.previewToken, confirmMigrations: true }) });
    const response = await waitForPluginUpload(base, token, accepted);
    const body = await completedPluginUploadBody(response);
    return { statusCode: response.status, json: async () => body };
  }
  const { uploadPluginZip, completedPluginUploadBody } = await import('../helpers/plugin-upload');
  const response = await uploadPluginZip(base, token, zip, root === 'unsigned');
  const body = await completedPluginUploadBody(response);
  return { statusCode: response.status, json: async () => body };
}

async function installed(slug: string, root: 'official' | 'test' | 'unsigned') {
  const result = await install(slug, root);
  expect(result.statusCode).toBe(200);
  await PluginManagementService.updateInstance((await PluginManagementService.getDefaultInstance(slug))!.id, { enabled: true });
}

async function child(action: 'off' | 'on' | 'cached', slug: string, officialSlug: string) {
  const enabled = action !== 'off';
  const processChild = fork(path.resolve('tests/helpers/signing-policy-child.ts'), [action, slug, officialSlug, token], {
    execArgv: ['--import', 'tsx'],
    env: {
      ...process.env, NODE_ENV: 'test', JIFFOO_TEST_SIGNING_POLICY_CHILD: 'true',
      EXTENSION_TEST_SIGNING_MODE: enabled ? 'true' : 'false',
      JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY: enabled ? testRoot.publicKey : undefined,
    },
  });
  const messages: Array<{ result?: Record<string, any>; error?: string }> = [];
  processChild.on('message', (message) => messages.push(message as typeof messages[number]));
  const exit = await new Promise<number | null>((resolve, reject) => {
    processChild.once('error', reject);
    processChild.once('exit', resolve);
  });
  expect(exit, JSON.stringify(messages)).toBe(0);
  expect(messages).toHaveLength(1);
  expect(messages[0].error).toBeUndefined();
  return messages[0].result!;
}

beforeAll(async () => {
  process.env.JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE = 'true';
  process.env.JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY = untrustedRoot.publicKey;
  process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE = 'true';
  await syncBuiltinPlugins(path.resolve('builtin-plugins'));
  app = await createTestApp();
  token = (await createAdminWithToken()).token;
  base = await app.listen({ host: '127.0.0.1', port: 0 });
  server = createServer((request, response) => response.end(request.url === '/package.zip' ? packageBody : JSON.stringify(catalogBody)));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
});

afterAll(async () => {
  for (const slug of slugs) {
    await resetPluginState(slug);
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await cleanupPluginMigrationFixture(slug);
    await clearTestPluginCache(slug);
  }
  await app?.close();
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await deleteAllTestUsers();
  for (const [key, value] of [
    ['JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE', previous.override], ['JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY', previous.key],
    ['JIFFOO_TEST_MARKETPLACE_OVERRIDE', previous.marketplaceFlag], ['JIFFOO_TEST_MARKETPLACE_URL', previous.marketplace],
  ]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});

describe('installed plugin signing policy', () => {
  it('A declares administrator conflict and runtime unavailable response schemas', () => {
    expect(extensionInstallerSchemas.updateInstance.response).toHaveProperty('409');
    expect(extensionInstallerSchemas.restorePlugin.response).toHaveProperty('409');
    expect(extensionInstallerSchemas.pluginGateway.response).toHaveProperty('503');
  });
  it.each([
    ['official', 'upload'], ['test', 'upload'], ['official', 'marketplace'], ['test', 'marketplace'],
  ] as const)('B persists %s classification through %s without verifying a test root', async (root, source) => {
    const slug = own();
    const response = await install(slug, root, source);
    expect(response.statusCode).toBe(200);
    expect((await response.json()).data).toMatchObject({ signingRoot: root, publisherVerified: root === 'official' });
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    expect(row).toMatchObject({ trustLevel: 'signed', signingRoot: root, publisherId: 'signing-publisher' });
    for (const url of [`/api/v1/extensions/plugin/${slug}`, '/api/v1/extensions/plugin']) {
      const response = await app.inject({ url, headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      const plugin = url.endsWith(slug) ? data : data.items.find((item: { slug: string }) => item.slug === slug);
      expect(plugin).toMatchObject({ signingRoot: root, publisherVerified: root === 'official' });
    }
    expect(trustedRootKeys().filter((key) => key.kind === 'official')).toEqual([{ key: untrustedRoot.publicKey, kind: 'official' }]);
    expect(trustedRootKeys().some((key) => key.key === OFFICIAL_ROOT_PUBLIC_KEY)).toBe(false);
    if (source === 'marketplace') {
      const catalog = await app.inject({ url: '/api/v1/extensions/marketplace/catalog', headers: { authorization: `Bearer ${token}` } });
      expect(catalog.json().data.items[0]).toMatchObject({
        signingRoot: root, declaredCapabilities: ['shipping'], declaredCapabilitiesVerified: false,
        capabilities: ['payment'], capabilitiesSource: 'package',
      });
      expect((row.manifestJson as { contracts: unknown[] }).contracts).toEqual([{ name: 'payment', version: 1 }]);
    }
  });

  it('C real process mode-off rejects load, enable, invocation and restore, isolates checkout, and mode-on restores use', async () => {
    const slug = own();
    const official = own();
    await installed(slug, 'test');
    await installed(official, 'official');
    const blocked = await child('off', slug, official);
    expect(blocked.lifecycle).toMatchObject({ statusCode: 409, code: 'PLUGIN_TEST_SIGNING_CONFLICT' });
    for (const field of ['load', 'invoke']) expect(blocked[field].code).toBe('PLUGIN_TEST_SIGNING_DISABLED');
    for (const field of ['gateway', 'enable', 'restore']) {
      expect(blocked[`${field}Status`]).toBe(field === 'gateway' ? 503 : 409);
      expect(blocked[`${field}Error`]).toBe(field === 'gateway' ? 'PLUGIN_TEST_SIGNING_DISABLED' : 'PLUGIN_TEST_SIGNING_CONFLICT');
    }
    expect(blocked.keptDeleted).toBe(true);
    expect(blocked.detailStatus).toBe(200);
    expect(blocked.listStatus).toBe(200);
    expect(blocked.detailRoot).toBe('test');
    expect(blocked.official.displayName).toBe('Signing fixture');
    expect(blocked.builtin).toBeDefined();
    expect(blocked.quote.paymentMethods).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerSlug: official }), expect.objectContaining({ providerSlug: 'manual-payment' }),
    ]));
    expect(blocked.quote.paymentMethods.some((item: { providerSlug: string }) => item.providerSlug === slug)).toBe(false);
    expect((await child('on', slug, official)).test.displayName).toBe('Signing fixture');
  });

  it('C validated configuration blocks an already-loaded runtime and re-enabling the mode restores it', async () => {
    const slug = own();
    const official = own();
    await installed(slug, 'test');
    await installed(official, 'official');
    const result = await child('cached', slug, official);
    expect(result.before.displayName).toBe('Signing fixture');
    expect(result.blocked.code).toBe('PLUGIN_TEST_SIGNING_DISABLED');
    expect(result.gatewayStatus).toBe(503);
    expect(result.gatewayError).toBe('PLUGIN_TEST_SIGNING_DISABLED');
    expect(result.after.displayName).toBe('Signing fixture');
  });

  it('D a legacy signed null-root row requires reinstall on every trust-required path while unsigned and builtin still run', async () => {
    const slug = own();
    const official = own();
    const unsigned = own();
    await installed(slug, 'test');
    await installed(official, 'official');
    await installed(unsigned, 'unsigned');
    await prisma.pluginInstall.update({ where: { slug }, data: { signingRoot: null } });
    const blocked = await child('off', slug, official);
    expect(blocked.lifecycle).toMatchObject({ statusCode: 409, code: 'PLUGIN_REINSTALL_CONFLICT' });
    for (const field of ['load', 'invoke']) expect(blocked[field].code).toBe('PLUGIN_REINSTALL_REQUIRED');
    for (const field of ['gateway', 'enable', 'restore']) {
      expect(blocked[`${field}Status`]).toBe(field === 'gateway' ? 503 : 409);
      expect(blocked[`${field}Error`]).toBe(field === 'gateway' ? 'PLUGIN_REINSTALL_REQUIRED' : 'PLUGIN_REINSTALL_CONFLICT');
    }
    expect(blocked.keptDeleted).toBe(true);
    expect(blocked.detailStatus).toBe(200);
    expect(blocked.listStatus).toBe(200);
    expect(blocked.detailRoot).toBeNull();
    expect(await callContract(unsigned, 'payment', 1, 'describe', { storeCurrency: 'USD' })).toMatchObject({ displayName: 'Signing fixture' });
    expect(blocked.builtin).toBeDefined();
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).signingRoot).toBeNull();
    const reinstall = await install(slug, 'test');
    expect(reinstall.statusCode).toBe(200);
    expect((await reinstall.json()).data.signingRoot).toBe('test');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).signingRoot).toBe('test');
  });
});
