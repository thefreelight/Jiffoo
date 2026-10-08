import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import archiver from 'archiver';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { CERT_PATH, SIGNATURE_PATH, issuePublisherCertificate, signPackage } from 'shared/plugin-signing';
import { otherPublisher, testPublisher, testRoot, untrustedRoot } from '../fixtures/plugin-signing-keys';

const prisma = getTestPrisma();
const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const uniqueSlug = () => `signed-${randomUUID().slice(0, 12)}`;
type FileEntry = { path: string; content: Buffer };
const text = (path: string, content: string): FileEntry => ({ path, content: Buffer.from(content) });

function pluginFiles(slug: string, version = '1.0.0'): FileEntry[] {
  return [
    text('manifest.json', JSON.stringify({
      schemaVersion: 1, slug, name: 'Signed Test Plugin', version, description: 'Signing test',
      author: 'Test', category: 'integration', runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1', entryModule: 'dist/index.js', permissions: [], contracts: [],
    })),
    text('dist/index.js', 'module.exports = { register(ctx) { ctx.http.route({ method: "GET", path: "/health", handler: async () => ({ status: "healthy" }) }); } };'),
  ];
}

async function zip(entries: FileEntry[]): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'signed-archive-'));
  const target = path.join(dir, 'plugin.zip');
  try {
    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip');
      const stream = createWriteStream(target);
      stream.on('close', resolve);
      stream.on('error', reject);
      archive.on('error', reject);
      archive.pipe(stream);
      for (const entry of entries) archive.append(entry.content, { name: entry.path });
      void archive.finalize();
    });
    return await fs.readFile(target);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

function signedEntries(slug: string, options: {
  version?: string; publisherId?: string; root?: typeof testRoot; key?: typeof testPublisher;
  signer?: typeof testPublisher; files?: FileEntry[]; certificate?: string;
} = {}): FileEntry[] {
  const files = options.files ?? pluginFiles(slug, options.version);
  const certificate = options.certificate ?? JSON.stringify(issuePublisherCertificate(
    options.publisherId ?? 'publisher-x', 'Publisher X', (options.key ?? testPublisher).publicKey,
    (options.root ?? testRoot).privateKey,
  ));
  const content = [...files, text(CERT_PATH, certificate)];
  const listing = content.map((entry) => ({ path: entry.path, sha256: digest(entry.content) }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return [...content, text(SIGNATURE_PATH, JSON.stringify(signPackage(listing, (options.signer ?? testPublisher).privateKey)))];
}

describe('Signed plugin uploads over HTTP', () => {
  let app: FastifyInstance;
  let base: string;
  let token: string;
  const slugs = new Set<string>();
  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    token = (await createAdminWithToken()).token;
    base = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => {
    for (const slug of slugs) {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await cleanupPluginMigrationFixture(slug);
      await clearTestPluginCache(slug);
    }
    await deleteAllTestUsers();
    await app.close();
  });
  const own = () => { const slug = uniqueSlug(); slugs.add(slug); return slug; };
  async function upload(entries: FileEntry[] | Buffer, confirmUnsigned = false) {
    const { uploadPluginZip, completedPluginUploadBody } = await import('../helpers/plugin-upload');
    const response = await uploadPluginZip(base, token, Buffer.isBuffer(entries) ? entries : await zip(entries), confirmUnsigned);
    return { status: response.status, body: await completedPluginUploadBody(response) };
  }
  async function absent(slug: string) {
    expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
    expect(await pluginPackageStore.list()).not.toContain(slug);
  }
  async function rejected(slug: string, entries: FileEntry[], code: string, status = 422) {
    const result = await upload(entries);
    expect(result.status).toBe(status);
    expect(result.body.error.code).toBe(code);
    await absent(slug);
  }

  it('A valid test-signed install persists and exposes its test root', async () => {
    const slug = own();
    const result = await upload(signedEntries(slug));
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ publisherId: 'publisher-x', publisherName: 'Publisher X', publisherVerified: false, signingRoot: 'test' });
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    expect(row).toMatchObject({ trustLevel: 'signed', signingRoot: 'test', publisherId: 'publisher-x', publisherName: 'Publisher X' });
    expect(row.publisherCertificateFingerprint).toMatch(/^[a-f0-9]{64}$/);
    for (const url of [`/api/v1/extensions/plugin/${slug}`, '/api/v1/extensions/plugin']) {
      const response = await fetch(`${base}${url}`, { headers: { authorization: `Bearer ${token}` } });
      expect(response.status).toBe(200);
      const result = (await response.json()).data;
      const plugin = url.endsWith(slug) ? result : result.items.find((item: { slug: string }) => item.slug === slug);
      expect(plugin).toMatchObject({
        publisherId: 'publisher-x',
        publisherName: 'Publisher X',
        publisherVerified: false,
        signingRoot: 'test',
        publisherCertificateFingerprint: row.publisherCertificateFingerprint,
      });
    }
  });
  it('B rejects a tampered file without installation or deployment', async () => {
    const slug = own(); const entries = signedEntries(slug);
    entries[0] = text('manifest.json', entries[0].content.toString().replace('Signing test', 'Tampered test'));
    await rejected(slug, entries, 'PACKAGE_CONTENT_MISMATCH');
  });
  it('C rejects an extra file', async () => {
    const slug = own(); await rejected(slug, [...signedEntries(slug), text('extra.txt', 'extra')], 'PACKAGE_CONTENT_MISMATCH');
  });
  it('D rejects a removed file', async () => {
    const slug = own(); await rejected(slug, signedEntries(slug).filter((entry) => entry.path !== 'dist/index.js'), 'PACKAGE_CONTENT_MISMATCH');
  });
  it('E rejects an untrusted root certificate', async () => {
    const slug = own(); await rejected(slug, signedEntries(slug, { root: untrustedRoot }), 'UNTRUSTED_PUBLISHER_CERTIFICATE');
  });
  it('F rejects a signature from another publisher key', async () => {
    const slug = own(); await rejected(slug, signedEntries(slug, { signer: otherPublisher }), 'INVALID_PACKAGE_SIGNATURE');
  });
  it.each([CERT_PATH, SIGNATURE_PATH])('G rejects incomplete signature missing %s', async (missing) => {
    const slug = own(); await rejected(slug, signedEntries(slug).filter((entry) => entry.path !== missing), 'INCOMPLETE_PACKAGE_SIGNATURE');
  });
  it('H rejects a malformed certificate', async () => {
    const slug = own(); const entries = signedEntries(slug);
    entries[2] = text(CERT_PATH, '{invalid');
    await rejected(slug, entries, 'INVALID_PUBLISHER_CERTIFICATE');
  });
  it('I forbids a publisher identity change and preserves the installed package', async () => {
    const slug = own(); expect((await upload(signedEntries(slug))).status).toBe(200);
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    const enabled = await fetch(`${base}/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, {
      method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enabled.status).toBe(200);
    const health = () => fetch(`${base}/api/v1/extensions/plugin/${slug}/api/health`);
    expect((await health()).status).toBe(200);
    const result = await upload(signedEntries(slug, { version: '2.0.0', publisherId: 'publisher-y' }));
    expect(result.status).toBe(409); expect(result.body.error.code).toBe('PUBLISHER_CHANGE_FORBIDDEN');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).version).toBe('1.0.0');
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    expect(await pluginPackageStore.get(slug, row.zipHash!)).not.toBeNull();
    expect((await health()).status).toBe(200);
  });
  it('J requires signatures on upgrades of signed plugins', async () => {
    const slug = own(); expect((await upload(signedEntries(slug))).status).toBe(200);
    const result = await upload(pluginFiles(slug, '2.0.0'), true);
    expect(result.status).toBe(409); expect(result.body.error.code).toBe('SIGNED_UPGRADE_REQUIRED');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).version).toBe('1.0.0');
  });
  it('K upgrades an unsigned plugin to signed', async () => {
    const slug = own(); expect((await upload(pluginFiles(slug), true)).status).toBe(200);
    expect((await upload(signedEntries(slug, { version: '2.0.0' }))).status).toBe(200);
    expect(await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).toMatchObject({ version: '2.0.0', trustLevel: 'signed', publisherId: 'publisher-x' });
  });
  it('L accepts a reissued certificate for the same publisher and updates its fingerprint', async () => {
    const slug = own(); expect((await upload(signedEntries(slug))).status).toBe(200);
    const previous = (await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).publisherCertificateFingerprint;
    const reissued = JSON.stringify(issuePublisherCertificate('publisher-x', 'Publisher X Reissued', otherPublisher.publicKey, testRoot.privateKey));
    const result = await upload(signedEntries(slug, { version: '2.0.0', key: otherPublisher, signer: otherPublisher, certificate: reissued }));
    expect(result.status).toBe(200);
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
    expect(row.publisherCertificateFingerprint).not.toBe(previous);
    expect(row.publisherName).toBe('Publisher X Reissued');
  });
  it('M verifies content and publisher identity before the ZIP hash shortcut', async () => {
    const slug = own(); const entries = signedEntries(slug);
    const original = await zip(entries);
    expect((await upload(original)).status).toBe(200);
    const tampered = [...entries];
    tampered[1] = text('dist/index.js', 'tampered');
    const alteredZip = await zip(tampered);
    await prisma.pluginInstall.update({ where: { slug }, data: { zipHash: digest(alteredZip) } });
    const invalid = await upload(alteredZip);
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('PACKAGE_CONTENT_MISMATCH');
    await prisma.pluginInstall.update({ where: { slug }, data: { zipHash: digest(original), publisherId: 'publisher-y' } });
    const result = await upload(original);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('PUBLISHER_CHANGE_FORBIDDEN');
    expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(1);
  });
  it.each([
    ['duplicate', (entries: FileEntry[]) => [...entries, entries[0]]],
    ['traversal', (entries: FileEntry[]) => [...entries, text('../escape', 'bad')]],
    ['case collision', (entries: FileEntry[]) => [...entries, text('MANIFEST.JSON', 'bad')]],
    ['directory', (entries: FileEntry[]) => [...entries, text('empty/', '')]],
    ['wrapper', (entries: FileEntry[]) => entries.map((entry) => ({ ...entry, path: `wrapper/${entry.path}` }))],
  ])('N rejects a %s path in a signed package', async (_kind, mutate) => {
    const slug = own(); await rejected(slug, mutate(signedEntries(slug)), 'PACKAGE_CONTENT_MISMATCH');
  });
  it('P installs a certificate issued by the owner tool without exposing private material', async () => {
    const slug = own(); const dir = await fs.mkdtemp(path.join(tmpdir(), 'cert-tool-'));
    try {
      const privatePath = path.join(dir, 'root.pem');
      const certificatePath = path.join(dir, 'cert.json');
      await fs.writeFile(privatePath, testRoot.privateKey);
      const result = spawnSync(process.execPath, [
        path.resolve('../../tools/owner/issue-publisher-cert.mjs'),
        '--publisher-id', 'publisher-x', '--name', 'Publisher X', '--public-key', testPublisher.publicKey,
        '--root-private-key', privatePath, '--output', certificatePath,
      ], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      const certificate = await fs.readFile(certificatePath, 'utf8');
      expect(result.stdout + result.stderr + certificate).not.toContain(testRoot.privateKey);
      expect((await upload(signedEntries(slug, { certificate: certificate.trim() }))).status).toBe(200);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
});
