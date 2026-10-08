import { createHash, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import archiver from 'archiver';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { env } from '@/config/env';
import { CERT_PATH, SIGNATURE_PATH, issuePublisherCertificate, signPackage } from 'shared/plugin-signing';
import { otherPublisher, testPublisher, testRoot } from '../fixtures/plugin-signing-keys';
import { downloadPackage } from '@/core/admin/extension-installer/marketplace-install';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { snapshotPluginRows, assertPluginRowsUnchanged } from '../helpers/plugin-db-snapshot';

const prisma = getTestPrisma();
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const previous = {
  flag: process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE,
  url: process.env.JIFFOO_TEST_MARKETPLACE_URL,
  timeout: env.EXTENSION_MARKETPLACE_DOWNLOAD_TIMEOUT_MS,
};
type FileEntry = { path: string; content: Buffer };
const text = (path: string, value: string): FileEntry => ({ path, content: Buffer.from(value) });
let app: FastifyInstance;
let base: string;
let server: Server;
let origin: string;
let token: string;
let actorId: string;
let catalogBody: unknown;
let packageBody: Buffer;
let packageHandler: ((request: IncomingMessage, response: ServerResponse) => void) | undefined;
let catalogRequests = 0;
let packageRequests = 0;
let redirectTargetRequests = 0;
const slugs = new Set<string>();
const own = () => { const slug = `market-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };

async function zip(entries: FileEntry[]): Promise<Buffer> {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'market-zip-'));
  const target = path.join(directory, 'plugin.zip');
  try {
    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip');
      const output = createWriteStream(target);
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      for (const entry of entries) archive.append(entry.content, { name: entry.path });
      void archive.finalize();
    });
    return await fs.readFile(target);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function files(slug: string, version = '1.0.0'): FileEntry[] {
  return [
    text('manifest.json', JSON.stringify({
      schemaVersion: 1, slug, name: 'Marketplace Plugin', version, description: 'Test',
      author: 'Test', category: 'integration', runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1', entryModule: 'dist/index.js', permissions: [], contracts: [],
    })),
    text('dist/index.js', 'module.exports = { register() {} };'),
  ];
}

async function packageZip(slug: string, version = '1.0.0', options: {
  unsigned?: boolean; incomplete?: boolean; invalid?: boolean; publisherId?: string;
} = {}) {
  const entries = files(slug, version);
  if (!options.unsigned) {
    const certificate = JSON.stringify(issuePublisherCertificate(
      options.publisherId ?? 'publisher-x', 'Publisher X', testPublisher.publicKey, testRoot.privateKey,
    ));
    entries.push(text(CERT_PATH, certificate));
    const listing = entries.map((entry) => ({ path: entry.path, sha256: sha(entry.content) }))
      .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    if (!options.incomplete) entries.push(text(SIGNATURE_PATH, JSON.stringify(signPackage(listing, options.invalid ? otherPublisher.privateKey : testPublisher.privateKey))));
  }
  return zip(entries);
}

function setCatalog(slug: string, bytes: Buffer, version = '1.0.0', overrides: Record<string, unknown> = {}) {
  packageBody = bytes;
  catalogBody = { schemaVersion: 1, plugins: [{
    id: slug, slug, name: 'Marketplace Plugin', description: 'Test', publisherId: 'publisher-x',
    versions: [{ version, minApiVersion: 'v1', sha256: sha(bytes), size: bytes.length, downloadUrl: '/package.zip', ...overrides }],
  }] };
}

const previews = new Map<string, string>();
async function preparePreview(pluginId: string, version = '1.0.0') {
  const response = await fetch(`${base}/api/v1/extensions/marketplace/preview`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ pluginId, version }) });
  const body = await response.clone().json();
  if (response.ok) previews.set(`${pluginId}/${version}`, body.data.previewToken);
  return response;
}
async function request(pluginId: string, version = '1.0.0', extra: Record<string, unknown> = {}) {
  const { waitForPluginUpload, completedPluginUploadBody } = await import('../helpers/plugin-upload');
  if (!Object.keys(extra).length && !previews.has(`${pluginId}/${version}`)) {
    const preview = await preparePreview(pluginId, version);
    if (!preview.ok) { const body = await preview.json(); return { statusCode: preview.status, json: () => body }; }
  }
  const accepted = await fetch(`${base}/api/v1/extensions/marketplace/install`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ pluginId, version, previewToken: previews.get(`${pluginId}/${version}`) ?? 'unbound', confirmMigrations: true, ...extra }) });
  const response = await waitForPluginUpload(base, token, accepted);
  const body = await completedPluginUploadBody(response);
  return { statusCode: response.status, json: () => body };
}
async function rejectInstall(slug: string, code: string, status: number) {
  const response = await request(slug);
  expect(response.statusCode).toBe(status);
  expect(response.json().error.code).toBe(code);
  expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
}
async function downloadTemps() {
  const root = path.join(process.env.EXTENSIONS_PATH || path.join(process.cwd(), 'extensions'), 'plugins', '.tmp');
  return (await fs.readdir(root).catch(() => [])).filter((name) => name.startsWith('marketplace-download-'));
}

beforeAll(async () => {
  process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE = 'true';
  app = await createTestApp({ disableFileSystem: false });
  const admin = await createAdminWithToken();
  token = admin.token;
  actorId = admin.user.id;
  base = await app.listen({ port: 0, host: '127.0.0.1' });
  server = createServer((incoming, outgoing) => {
    if (incoming.url?.startsWith('/package.zip')) {
      packageRequests++;
      if (packageHandler) return packageHandler(incoming, outgoing);
      outgoing.end(packageBody);
      return;
    }
    if (incoming.url === '/redirect-target') { redirectTargetRequests++; outgoing.end(packageBody); return; }
    catalogRequests++;
    outgoing.setHeader('content-type', 'application/json');
    outgoing.end(JSON.stringify(catalogBody));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  process.env.JIFFOO_TEST_MARKETPLACE_URL = `${origin}/catalog`;
});

afterAll(async () => {
  await app?.close();
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  for (const slug of slugs) {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await cleanupPluginMigrationFixture(slug);
    await clearTestPluginCache(slug);
  }
  await deleteAllTestUsers();
  env.EXTENSION_MARKETPLACE_DOWNLOAD_TIMEOUT_MS = previous.timeout;
  if (previous.flag === undefined) delete process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE;
  else process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE = previous.flag;
  if (previous.url === undefined) delete process.env.JIFFOO_TEST_MARKETPLACE_URL;
  else process.env.JIFFOO_TEST_MARKETPLACE_URL = previous.url;
});

describe('Marketplace installation', () => {
  it.each(['install', 'upgrade'] as const)('I marketplace %s rolls back package, instance, registry and success audit on a real audit write failure', async operation => {
    const slug = own();
    if (operation === 'upgrade') {
      setCatalog(slug, await packageZip(slug));
      expect((await request(slug)).statusCode).toBe(200);
      expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_INSTALLED', actorId } })).toBe(1);
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    }
    const version = operation === 'upgrade' ? '2.0.0' : '1.0.0';
    setCatalog(slug, await packageZip(slug, version), version);
    const before = await snapshotPluginRows([slug]);
    const registry = (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion;
    const duplicate = await prisma.adminAuditEvent.create({ data: { actorId, action: 'collision', targetType: 'test', targetId: slug, summary: {} } });
    const worker = fork(path.resolve('tests/helpers/plugin-upload-child.ts'), [], {
      execArgv: ['--import', 'tsx'], env: { ...process.env, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_LEASE_BARRIER: 'audit' },
    });
    const receive = (kind: string) => new Promise<any>((resolve, reject) => {
      const listener = (value: any) => { if (value.kind === kind) { worker.off('message', listener); resolve(value); } };
      worker.on('message', listener); worker.once('error', reject);
    });
    const exited = once(worker, 'exit');
    await receive('ready');
    const audit = receive('plugin-audit-ready'), done = receive('done');
    worker.send({ slug, marketplace: { pluginId: slug, version, actorId } });
    const action = operation === 'upgrade' ? 'PLUGIN_UPGRADED' : 'PLUGIN_INSTALLED';
    expect((await audit).action).toBe(action);
    worker.send({ kind: 'plugin-audit-release', eventId: duplicate.id });
    expect((await done).statusCode).toBe(500);
    await exited;
    await assertPluginRowsUnchanged(before, [slug]);
    expect((await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion).toBe(registry);
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action } })).toBe(0);
  });
  it('F maps a refused package connection to MARKETPLACE_DOWNLOAD_UNAVAILABLE', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    let markClosed!: () => void;
    const closed = new Promise<void>((resolve) => { markClosed = resolve; });
    const catalogOnly = createServer((_incoming, outgoing) => {
      outgoing.setHeader('connection', 'close');
      outgoing.end(JSON.stringify(catalogBody));
      catalogOnly.close(markClosed);
    });
    await new Promise<void>((resolve) => catalogOnly.listen(0, '127.0.0.1', resolve));
    const previousUrl = process.env.JIFFOO_TEST_MARKETPLACE_URL;
    process.env.JIFFOO_TEST_MARKETPLACE_URL = `http://127.0.0.1:${(catalogOnly.address() as import('node:net').AddressInfo).port}/catalog`;
    try {
      await rejectInstall(slug, 'MARKETPLACE_DOWNLOAD_UNAVAILABLE', 502);
    } finally {
      await closed;
      process.env.JIFFOO_TEST_MARKETPLACE_URL = previousUrl;
    }
  });

  it('F maps a package DNS failure to MARKETPLACE_DOWNLOAD_UNAVAILABLE', async () => {
    await expect(downloadPackage({
      version: '1.0.0', minApiVersion: 'v1', sha256: 'a'.repeat(64),
      size: 1, downloadUrl: '/package.zip',
    }, 'https://jiffoo-nonexistent.invalid/catalog')).rejects.toMatchObject({
      code: 'MARKETPLACE_DOWNLOAD_UNAVAILABLE', statusCode: 502,
    });
  });

  it('G maps a non-2xx package response to MARKETPLACE_DOWNLOAD_UNAVAILABLE', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    packageHandler = (_incoming, outgoing) => { outgoing.writeHead(503); outgoing.end('unavailable'); };
    try {
      await rejectInstall(slug, 'MARKETPLACE_DOWNLOAD_UNAVAILABLE', 502);
    } finally {
      packageHandler = undefined;
    }
  });

  it('H rejects an incompatible catalog version before downloading', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug), '1.0.0', { minApiVersion: 'v999' });
    const before = packageRequests;
    await rejectInstall(slug, 'MARKETPLACE_INCOMPATIBLE_API_VERSION', 422);
    expect(packageRequests).toBe(before);
  });
  it('A installs a signed version with marketplace source, blob and immutable package', async () => {
    const slug = own();
    const bytes = await packageZip(slug);
    setCatalog(slug, bytes);
    const response = await request(slug);
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ slug, version: '1.0.0', publisherId: 'publisher-x', publisherVerified: false, signingRoot: 'test', installedVersion: '1.0.0' });
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    expect(row).toMatchObject({ source: 'marketplace', publisherId: 'publisher-x', trustLevel: 'signed', signingRoot: 'test', zipHash: sha(bytes) });
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(1);
    expect(await pluginPackageStore.get(slug, sha(bytes))).not.toBeNull();
    expect(await prisma.adminAuditEvent.findFirstOrThrow({ where: { targetId: slug, action: 'PLUGIN_INSTALLED' } })).toMatchObject({ actorId, summary: { source: 'marketplace', version: '1.0.0', hash: sha(bytes) } });
    for (const url of [`/api/v1/extensions/plugin/${slug}`, '/api/v1/extensions/plugin']) {
      const result = await app.inject({ url, headers: { authorization: `Bearer ${token}` } });
      expect(result.statusCode).toBe(200);
      const data = result.json().data;
      expect(url.endsWith(slug) ? data.source : data.items.find((item: { slug: string }) => item.slug === slug).source).toBe('marketplace');
    }
  });

  it('B upgrades a signed version and retains only the current blob', async () => {
    const slug = own();
    const first = await packageZip(slug);
    setCatalog(slug, first);
    expect((await request(slug)).statusCode).toBe(200);
    const next = await packageZip(slug, '2.0.0');
    setCatalog(slug, next, '2.0.0');
    expect((await request(slug, '2.0.0')).statusCode).toBe(200);
    expect(await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).toMatchObject({ version: '2.0.0', zipHash: sha(next), source: 'marketplace' });
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(1);
    expect(await pluginPackageStore.get(slug, sha(next))).not.toBeNull();
    expect(await prisma.adminAuditEvent.findFirstOrThrow({ where: { targetId: slug, action: 'PLUGIN_UPGRADED' } })).toMatchObject({ actorId, summary: { source: 'marketplace', version: '2.0.0', previousVersion: '1.0.0', hash: sha(next) } });
  });

  it('C refuses unsigned packages and unsigned confirmation in the request', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug, '1.0.0', { unsigned: true }));
    await rejectInstall(slug, 'MARKETPLACE_SIGNATURE_REQUIRED', 422);
    expect((await request(slug, '1.0.0', { confirmUnsigned: true })).statusCode).toBe(400);
  });

  it.each([
    ['incomplete', { incomplete: true }, 'INCOMPLETE_PACKAGE_SIGNATURE'],
    ['invalid', { invalid: true }, 'INVALID_PACKAGE_SIGNATURE'],
  ])('C preserves the %s signature error', async (_label, options, code) => {
    const slug = own();
    setCatalog(slug, await packageZip(slug, '1.0.0', options));
    await rejectInstall(slug, code, 422);
  });

  it.each(['sha256', 'size'])('D rejects a mismatched %s and clears the temp file', async (field) => {
    const slug = own();
    const bytes = await packageZip(slug);
    setCatalog(slug, bytes, '1.0.0', { [field]: field === 'size' ? bytes.length + 1 : 'f'.repeat(64) });
    const before = await downloadTemps();
    await rejectInstall(slug, 'MARKETPLACE_DIGEST_MISMATCH', 422);
    expect(await downloadTemps()).toEqual(before);
  });

  it.each(['slug', 'version', 'publisherId'])('E rejects a signed %s mismatch', async (field) => {
    const slug = own();
    const bytes = await packageZip(field === 'slug' ? own() : slug, field === 'version' ? '2.0.0' : '1.0.0', {
      publisherId: field === 'publisherId' ? 'publisher-y' : 'publisher-x',
    });
    setCatalog(slug, bytes);
    await rejectInstall(slug, 'MARKETPLACE_IDENTITY_MISMATCH', 422);
  });

  it('F rejects an off-origin catalog change at install time', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    expect((await app.inject({ url: '/api/v1/extensions/marketplace/catalog', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    (catalogBody as { plugins: Array<{ versions: Array<{ downloadUrl: string }> }> }).plugins[0].versions[0].downloadUrl = 'http://127.0.0.1:1/package.zip';
    const before = packageRequests;
    await rejectInstall(slug, 'MARKETPLACE_DOWNLOAD_ORIGIN_FORBIDDEN', 422);
    expect(packageRequests).toBe(before);
  });

  it('F refuses package redirects without contacting the target', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    const beforeTargets = redirectTargetRequests;
    packageHandler = (_request, response) => response.writeHead(302, { location: `${origin}/redirect-target` }).end();
    const previousCatalog = catalogRequests;
    try {
      await rejectInstall(slug, 'MARKETPLACE_DOWNLOAD_UNAVAILABLE', 502);
      expect(catalogRequests).toBe(previousCatalog + 1);
      expect(redirectTargetRequests).toBe(beforeTargets);
    } finally { packageHandler = undefined; }
  });

  it('G aborts an oversized package stream and deletes the temp file', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    const before = await downloadTemps();
    let cut = false;
    packageHandler = (_request, response) => {
      response.on('close', () => { cut = true; });
      const chunk = Buffer.alloc(256 * 1024);
      for (let i = 0; i < 48; i++) response.write(chunk);
      response.end();
    };
    try {
      await rejectInstall(slug, 'PAYLOAD_TOO_LARGE', 413);
      expect(cut).toBe(true);
      expect(await downloadTemps()).toEqual(before);
    } finally { packageHandler = undefined; }
  });

  it.each(['headers', 'body'])('H times out when package %s stalls', async (phase) => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    env.EXTENSION_MARKETPLACE_DOWNLOAD_TIMEOUT_MS = 300;
    packageHandler = (_request, response) => { if (phase === 'body') response.write('partial'); };
    try {
      const started = Date.now();
      await rejectInstall(slug, 'MARKETPLACE_DOWNLOAD_TIMEOUT', 504);
      expect(Date.now() - started).toBeLessThan(2500);
    } finally {
      env.EXTENSION_MARKETPLACE_DOWNLOAD_TIMEOUT_MS = previous.timeout;
      packageHandler = undefined;
    }
  });

  it('I rejects a concurrent install before a second package request', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    expect((await preparePreview(slug)).status).toBe(200);
    const packageRequestsBefore = packageRequests;
    let signal!: () => void;
    const started = new Promise<void>((resolve) => { signal = resolve; });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    packageHandler = (_request, response) => { signal(); void gate.then(() => response.end(packageBody)); };
    try {
      const first = request(slug);
      await started;
      const second = await request(slug);
      expect(second.statusCode).toBe(409);
      expect(second.json().error.code).toBe('PLUGIN_OPERATION_IN_PROGRESS');
      const count = packageRequests;
      expect(count).toBe(1 + packageRequestsBefore);
      release();
      expect((await first).statusCode).toBe(200);
      expect(packageRequests).toBe(count);
    } finally { release(); packageHandler = undefined; }
  });

  it.each(['downloadUrl', 'sha256', 'publisherId'])('J rejects client-supplied %s without network access', async (field) => {
    const slug = own();
    const before = { catalogRequests, packageRequests };
    const result = await request(slug, '1.0.0', { [field]: 'injected' });
    expect(result.statusCode).toBe(400);
    expect({ catalogRequests, packageRequests }).toEqual(before);
  });

  it('K refreshes the catalog despite a cached GET', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    expect((await app.inject({ url: '/api/v1/extensions/marketplace/catalog', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    const next = await packageZip(slug, '2.0.0');
    setCatalog(slug, next, '2.0.0');
    expect((await request(slug, '2.0.0')).statusCode).toBe(200);
  });

  it('L reports unknown IDs, versions and missing configuration', async () => {
    const slug = own();
    setCatalog(slug, await packageZip(slug));
    for (const [id, version] of [['missing-plugin', '1.0.0'], [slug, '9.0.0']]) {
      const result = await request(id, version);
      expect(result.statusCode).toBe(404);
      expect(result.json().error.code).toBe('MARKETPLACE_PLUGIN_NOT_FOUND');
    }
    delete process.env.JIFFOO_TEST_MARKETPLACE_URL;
    const result = await request(slug);
    expect(result.statusCode).toBe(503);
    expect(result.json().error.code).toBe('MARKETPLACE_NOT_CONFIGURED');
    process.env.JIFFOO_TEST_MARKETPLACE_URL = `${origin}/catalog`;
  });

  it('N keeps unsigned uploads on local-zip with explicit confirmation', async () => {
    const slug = own();
    const { uploadPluginZip } = await import('../helpers/plugin-upload');
    const response = await uploadPluginZip(base, token, await packageZip(slug, '1.0.0', { unsigned: true }));
    expect(response.status).toBe(200);
    expect((await response.json()).data.result.source).toBe('local-zip');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).source).toBe('local-zip');
  });
});
