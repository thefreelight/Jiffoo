import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { CERT_PATH, SIGNATURE_PATH, issuePublisherCertificate, signPackage, verifyPluginZip } from 'shared/plugin-signing';
import { inspectPluginUpload } from '@/core/admin/extension-installer/plugin-upload';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { uploadPluginZip } from '../helpers/plugin-upload';
import { pageManifest, pageFiles, pageZip, symlinkDirectoryZip } from '../fixtures/plugin-pages';
import { testPublisher, testRoot } from '../fixtures/plugin-signing-keys';
import { extensionInstallerSchemas } from '@/core/admin/extension-installer/schemas';

const root = path.resolve('../..'), sdk = path.join(root, 'packages/plugin-sdk/dist/cli.js');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const slugs = new Set<string>();
const own = () => { const slug = `pages-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };
const run = (args: string[]) => spawnSync(process.execPath, [sdk, ...args], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000 });

describe('P-1 verified page packages', () => {
  let app: FastifyInstance, token: string, actorId: string, base: string, temporary: string;
  beforeAll(async () => {
    const built = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'packages/plugin-sdk/tsconfig.json')], { cwd: root, encoding: 'utf8', windowsHide: true });
    expect(built.status, built.stdout + built.stderr).toBe(0);
    app = await createTestApp({ disableFileSystem: false });
    base = await app.listen({ host: '127.0.0.1', port: 0 });
    const admin = await createAdminWithToken(); token = admin.token; actorId = admin.user.id;
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-pages-'));
  });
  afterAll(async () => {
    for (const slug of slugs) {
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await cleanupPluginMigrationFixture(slug); await clearTestPluginCache(slug);
      await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
    }
    await app.close(); await deleteTestUser(actorId); await fs.rm(temporary, { recursive: true, force: true });
  });
  async function post(bytes: Buffer, suffix: 'preview' | 'install') {
    const form = new FormData(); form.set('file', new Blob([bytes], { type: 'application/zip' }), 'plugin.zip');
    return fetch(`${base}/api/v1/extensions/plugin/${suffix}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  }
  it('publishes declaration and asset failures in the existing installer OpenAPI responses', () => {
    for (const schema of [extensionInstallerSchemas.previewPlugin, extensionInstallerSchemas.installExtension, extensionInstallerSchemas.restorePlugin]) {
      expect(schema.response).toHaveProperty('413'); expect(schema.response).toHaveProperty('422');
      expect(schema.response[422].properties.error.properties.code.enum).toEqual(expect.arrayContaining([
        'PLUGIN_UI_MANIFEST_INVALID', 'PLUGIN_UI_ASSET_INVALID', 'PLUGIN_UI_ASSET_TOO_LARGE',
        'PLUGIN_TASK_DECLARATION_INVALID', 'PLUGIN_SERVICE_DEPENDENCY_INVALID',
      ]));
    }
  });
  it('preview and final reject a symlink disguised as an unsigned ZIP directory', async () => {
    const bytes = await symlinkDirectoryZip(pageManifest(own()));
    for (const suffix of ['preview', 'install'] as const) {
      const response = await post(bytes, suffix);
      expect(response.status).toBe(422); expect((await response.json()).error.code).toBe('PACKAGE_CONTENT_MISMATCH');
    }
  });
  it.each(['ui', 'task', 'service', 'coercion', 'svg', 'map', 'mime', 'extensionless', 'large'])('preview and final reject the same invalid %s without publishing', async kind => {
    const manifest = pageManifest(own());
    if (kind === 'ui') (manifest.ui as any).unknown = true;
    if (kind === 'task') manifest.tasks![0].maxRuntimeSeconds = 601;
    if (kind === 'coercion') (manifest.tasks![0] as unknown as Record<string, unknown>).version = { toString: 'blocked', valueOf: 'blocked' };
    if (kind === 'service') manifest.serviceDependencies![0].methods = ['debit', 'debit'];
    const files = pageFiles(manifest);
    if (kind === 'svg') files.push({ path: 'ui/logo.svg', content: Buffer.from('<svg/>') });
    if (kind === 'map') files.push({ path: 'ui/app.js.map', content: Buffer.from('{}') });
    if (kind === 'mime') files.push({ path: 'ui/logo.png', content: Buffer.from('<svg/>') });
    if (kind === 'extensionless') files.push({ path: 'ui/js', content: Buffer.from('export default 1') });
    if (kind === 'large') files.push({ path: 'ui/huge.js', content: Buffer.alloc(5 * 1024 * 1024 + 1, 32) });
    const bytes = await pageZip(files);
    const expected = kind === 'ui' ? 'PLUGIN_UI_MANIFEST_INVALID' : kind === 'task' || kind === 'coercion' ? 'PLUGIN_TASK_DECLARATION_INVALID'
      : kind === 'service' ? 'PLUGIN_SERVICE_DEPENDENCY_INVALID' : kind === 'large' ? 'PLUGIN_UI_ASSET_TOO_LARGE' : 'PLUGIN_UI_ASSET_INVALID';
    for (const suffix of ['preview', 'install'] as const) {
      const response = await post(bytes, suffix);
      expect(response.status).toBe(kind === 'large' ? 413 : 422);
      expect((await response.json()).error.code).toBe(expected);
    }
    expect(await prisma.pluginInstall.count({ where: { slug: manifest.slug } })).toBe(0);
    expect(await pluginPackageStore.list()).not.toContain(manifest.slug);
  });
  it('SDK pack rejects the same declarations and assets and produces the identical valid index', async () => {
    const input = path.join(temporary, 'input'); await fs.mkdir(input);
    const manifest = pageManifest(own());
    for (const file of pageFiles(manifest)) {
      await fs.mkdir(path.dirname(path.join(input, file.path)), { recursive: true }); await fs.writeFile(path.join(input, file.path), file.content);
    }
    const output = path.join(temporary, 'valid.zip');
    expect(run(['pack', '--input', input, '--output', output]).status).toBe(0);
    expect((await inspectPluginUpload(await fs.readFile(output))).assetIndex)
      .toEqual((await inspectPluginUpload(await pageZip(pageFiles(manifest)))).assetIndex);
    for (const [filename, bytes, code] of [
      ['manifest.json', Buffer.from(JSON.stringify({ ...manifest, ui: { ...manifest.ui, unknown: true } })), 'PLUGIN_UI_MANIFEST_INVALID'],
      ['manifest.json', Buffer.from(JSON.stringify({ ...manifest, tasks: [{ ...manifest.tasks![0], concurrency: 0 }] })), 'PLUGIN_TASK_DECLARATION_INVALID'],
      ['manifest.json', Buffer.from(JSON.stringify({ ...manifest, tasks: [{ ...manifest.tasks![0], version: { toString: 'blocked', valueOf: 'blocked' } }] })), 'PLUGIN_TASK_DECLARATION_INVALID'],
      ['manifest.json', Buffer.from(JSON.stringify({ ...manifest, serviceDependencies: [{ ...manifest.serviceDependencies![0], methods: ['*'] }] })), 'PLUGIN_SERVICE_DEPENDENCY_INVALID'],
      ['ui/bad.svg', Buffer.from('<svg/>'), 'PLUGIN_UI_ASSET_INVALID'],
      ['ui/source.js.map', Buffer.from('{}'), 'PLUGIN_UI_ASSET_INVALID'],
      ['ui/bad.png', Buffer.from('not a PNG'), 'PLUGIN_UI_ASSET_INVALID'],
      ['ui/huge.js', Buffer.alloc(5 * 1024 * 1024 + 1, 32), 'PLUGIN_UI_ASSET_TOO_LARGE'],
    ] as const) {
      await fs.writeFile(path.join(input, filename), bytes);
      const result = run(['pack', '--input', input, '--output', path.join(temporary, `${randomUUID()}.zip`)]);
      expect(result.status).toBe(1); expect(result.stderr).toContain(code);
      if (filename === 'manifest.json') await fs.writeFile(path.join(input, filename), JSON.stringify(manifest));
      else await fs.rm(path.join(input, filename));
    }
    const link = path.join(input, 'ui', 'linked');
    await fs.symlink(path.join(input, 'services'), link, process.platform === 'win32' ? 'junction' : 'dir');
    try { expect(run(['pack', '--input', input, '--output', path.join(temporary, 'symlink.zip')]).stderr).toContain('SPECIAL_FILE'); }
    finally { await fs.unlink(link); }
  });
  it('a signature covers every UI asset, including dynamically imported modules and fonts', async () => {
    const files = pageFiles(pageManifest(own()));
    const certificate = issuePublisherCertificate('page-publisher', 'Page Publisher', testPublisher.publicKey, testRoot.privateKey);
    const signedFiles = [...files, { path: CERT_PATH, content: Buffer.from(JSON.stringify(certificate)) }];
    const listing = signedFiles.map(file => ({ path: file.path, sha256: digest(file.content) })).sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    const signature = { path: SIGNATURE_PATH, content: Buffer.from(JSON.stringify(signPackage(listing, testPublisher.privateKey))) };
    expect(await verifyPluginZip(await pageZip([...signedFiles, signature]))).toMatchObject({ publisherId: 'page-publisher' });
    for (const target of ['ui/index.html', 'ui/assets/chunk.js', 'ui/assets/font.woff2']) {
      const tampered = signedFiles.map(file => file.path === target ? { ...file, content: Buffer.concat([file.content, Buffer.from('x')]) } : file);
      await expect(inspectPluginUpload(await pageZip([...tampered, signature]))).rejects.toMatchObject({ code: 'PACKAGE_CONTENT_MISMATCH' });
    }
  });
  it('installs, updates and restores validated bytes and reads binary content through storage', async () => {
    const manifest = pageManifest(own());
    let bytes = await pageZip(pageFiles(manifest));
    expect((await uploadPluginZip(base, token, bytes)).status).toBe(200);
    const first = await inspectPluginUpload(bytes);
    const pkg = await pluginPackageStore.get(manifest.slug, first.hash);
    expect(await pkg!.readBinary('ui/assets/font.woff2')).toEqual(pageFiles(manifest).find(file => file.path.endsWith('.woff2'))!.content);
    manifest.version = '1.0.1'; bytes = await pageZip(pageFiles(manifest));
    expect((await uploadPluginZip(base, token, bytes)).status).toBe(200);
    const updated = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: manifest.slug } });
    expect(updated.version).toBe('1.0.1'); expect(updated.manifestJson).toEqual(manifest);
    await prisma.pluginInstall.update({ where: { slug: manifest.slug }, data: { deletedAt: new Date() } });
    const restored = await fetch(`${base}/api/v1/extensions/plugin/${manifest.slug}/restore`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    expect(restored.status, await restored.text()).toBe(200);
    const invalid = pageFiles(manifest); invalid.push({ path: 'ui/bad.png', content: Buffer.from('not PNG') });
    const invalidBytes = await pageZip(invalid), invalidHash = digest(invalidBytes);
    await prisma.$transaction(async tx => {
      await tx.pluginInstall.update({ where: { slug: manifest.slug }, data: { zipHash: invalidHash, deletedAt: new Date() } });
      await pluginPackageBlobStore.put(tx, manifest.slug, invalidHash, invalidBytes);
    });
    const rejected = await fetch(`${base}/api/v1/extensions/plugin/${manifest.slug}/restore`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    expect(rejected.status).toBe(422); expect((await rejected.json()).error.code).toBe('PLUGIN_UI_ASSET_INVALID');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: manifest.slug } })).deletedAt).not.toBeNull();
  });
});
