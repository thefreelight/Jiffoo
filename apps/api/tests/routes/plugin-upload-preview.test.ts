import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { previewPluginUpload } from '@/core/admin/extension-installer/plugin-upload';
import { extensionInstallerSchemas } from '@/core/admin/extension-installer/schemas';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { localUploadOptions } from '../helpers/plugin-upload';

let app: FastifyInstance;
let token: string, actorId: string, otherToken: string, directory: string, base: string;
const slugs = new Set<string>();
const own = () => { const slug = `upload-${randomUUID().slice(0, 12)}`; slugs.add(slug); return slug; };
async function archive(slug: string, version = '1.0.0', source = 'module.exports = { register() {} };', hook = false, minApiVersion = 'v1') {
  const stream = new PassThrough(); const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { stream.on('data', chunk => chunks.push(chunk)); stream.on('end', () => resolve(Buffer.concat(chunks))); stream.on('error', reject); });
  const zip = archiver('zip'); zip.on('error', error => stream.destroy(error)); zip.pipe(stream);
  zip.append(JSON.stringify({ schemaVersion: 1, slug, name: 'Upload fixture', version, minApiVersion, description: 'Upload fixture', category: 'integration',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [], ...(hook ? { lifecycle: { onInstall: true, onUpgrade: true } } : {}) }), { name: 'manifest.json', date: new Date('1980-01-01') });
  zip.append(source, { name: 'index.js', date: new Date('1980-01-01') }); void zip.finalize(); return done;
}
async function request(bytes: Buffer, fields: Record<string, string> = {}, bearer = token, url = '/api/v1/extensions/plugin/install') {
  const boundary = `boundary-${randomUUID()}`;
  const parts = Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="plugin.zip"\r\nContent-Type: application/zip\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`));
  return app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${bearer}`, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(parts) });
}
async function fields(bytes: Buffer) {
  const preview = await previewPluginUpload(bytes, actorId);
  return { previewToken: preview.previewToken, confirmUnsigned: 'true', confirmationSlug: preview.package.slug };
}
function signedPayload(tokenValue: string, change: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(tokenValue.split('.')[0], 'base64url').toString()), ...change })).toString('base64url');
  const key = createHmac('sha256', env.JWT_SECRET).update('jiffoo-core/plugin-upload-preview/key/v1').digest();
  return `${body}.${createHmac('sha256', key).update('jiffoo-core/plugin-upload-preview/token/v1\0').update(body).digest('base64url')}`;
}
function message(child: ChildProcess, kind: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const receive = (value: any) => { if (value.kind === kind) { child.off('message', receive); resolve(value); } };
    child.on('message', receive); child.once('error', reject);
  });
}
async function child(flag: string) {
  const worker = fork(path.resolve('tests/helpers/plugin-upload-child.ts'), [], { execArgv: ['--import', 'tsx'], env: { ...process.env, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_LEASE_BARRIER: flag } });
  await message(worker, 'ready'); return worker;
}

beforeAll(async () => {
  app = await createTestApp(); const admin = await createAdminWithToken(); token = admin.token; actorId = admin.user.id;
  base = await app.listen({ host: '127.0.0.1', port: 0 });
  otherToken = (await createAdminWithToken()).token; directory = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-preview-'));
});
afterAll(async () => {
  for (const slug of slugs) { await prisma.pluginInstall.deleteMany({ where: { slug } }); await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } }); await clearTestPluginCache(slug); }
  await app.close(); await deleteAllTestUsers(); await fs.rm(directory, { recursive: true, force: true });
});

describe('Local plugin upload preview', () => {
  it('G incompatible API requirement in a real ZIP is rejected server-side on final install with nothing installed', async () => {
    const slug = own(), bytes = await archive(slug, '1.0.0', 'module.exports = { register() {} };', false, 'v99');
    const preview = await request(bytes, {}, token, '/api/v1/extensions/plugin/preview');
    expect(preview.statusCode).toBe(200); expect(preview.json().data.compatibility.compatible).toBe(false);
    const response = await request(bytes, { previewToken: preview.json().data.previewToken, confirmUnsigned: 'true', confirmationSlug: slug });
    expect(response.statusCode).toBe(422); expect(response.json().error.code).toBe('INCOMPATIBLE_API_VERSION');
    expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0);
    expect(await prisma.pluginInstallation.count({ where: { pluginSlug: slug } })).toBe(0);
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(0);
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug } })).toBe(0);
    expect(await pluginPackageStore.list()).not.toContain(slug);
  });
  it('A preview parses a real archive without executing entry or hooks or changing database or package storage', async () => {
    const slug = own(), marker = path.join(directory, 'preview-marker');
    const bytes = await archive(slug, '1.0.0', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); module.exports = { register() {}, __lifecycle_onInstall() {} };`, true);
    const before = { installs: await prisma.pluginInstall.count(), blobs: await prisma.pluginPackageBlob.count(), instances: await prisma.pluginInstallation.count(), audits: await prisma.adminAuditEvent.count(), leases: await prisma.pluginOperationLease.count() };
    const response = await request(bytes, {}, token, '/api/v1/extensions/plugin/preview');
    expect(response.statusCode).toBe(200); expect(response.json().data.operation).toBe('install');
    expect(await fs.access(marker).then(() => true, () => false)).toBe(false);
    expect(await pluginPackageStore.list()).not.toContain(slug);
    expect({ installs: await prisma.pluginInstall.count(), blobs: await prisma.pluginPackageBlob.count(), instances: await prisma.pluginInstallation.count(), audits: await prisma.adminAuditEvent.count(), leases: await prisma.pluginOperationLease.count() }).toEqual(before);
  });
  it.each(['previewToken', 'confirmUnsigned', 'confirmationSlug'])('B rejects an unsigned install missing %s', async missing => {
    const bytes = await archive(own()); const values: Record<string, string> = await fields(bytes); delete values[missing];
    const response = await request(bytes, values); expect(response.statusCode).toBe(missing === 'previewToken' ? 409 : 400);
  });
  it('B rejects the boolean-only shortcut and the wrong typed slug', async () => {
    const bytes = await archive(own()); expect((await request(bytes, { confirmUnsigned: 'true' })).statusCode).toBe(409);
    expect((await request(bytes, { ...await fields(bytes), confirmationSlug: 'wrong-slug' })).statusCode).toBe(400);
  });
  it.each(['expired', 'tampered', 'actor', 'action', 'zip', 'snapshot'])('C rejects a %s preview binding without installing', async kind => {
    const slug = own(), bytes = await archive(slug); const values = await fields(bytes); let payload = bytes, bearer = token;
    if (kind === 'expired') values.previewToken = signedPayload(values.previewToken, { expiresAt: 0 });
    if (kind === 'tampered') values.previewToken += 'x';
    if (kind === 'actor') bearer = otherToken;
    if (kind === 'action') values.previewToken = signedPayload(values.previewToken, { action: 'plugin.purge' });
    if (kind === 'zip') payload = await archive(slug, '2.0.0');
    if (kind === 'snapshot') await prisma.pluginInstall.create({ data: { slug, name: slug, version: '1.0.0' } });
    const response = await request(payload, values, bearer); expect(response.statusCode).toBe(409); expect(response.json().error.code).toBe('PLUGIN_PREVIEW_REQUIRED');
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(0);
  });
  it.each(['install', 'upgrade', 'unchanged'])('C rejects replay after the %s outcome', async operation => {
    const slug = own(); let bytes = await archive(slug);
    if (operation !== 'install') expect((await request(bytes, await fields(bytes))).statusCode).toBe(200);
    if (operation === 'upgrade') bytes = await archive(slug, '2.0.0');
    const values = await fields(bytes); expect((await request(bytes, values)).statusCode).toBe(200);
    expect((await request(bytes, values)).statusCode).toBe(409);
  });
  it('D a committed unsigned confirmation is visible to entry code and survives a later candidate failure', async () => {
    const slug = own(); const first = await archive(slug); expect((await request(first, await fields(first))).statusCode).toBe(200);
    const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } });
    await prisma.pluginInstallation.update({ where: { id: instance.id }, data: { enabled: true } });
    const marker = path.join(directory, 'failure-marker');
    const next = await archive(slug, '2.0.0', `module.exports = { async register() {
      const response = await fetch(${JSON.stringify(base + '/api/v1/admin/audit-events?targetType=plugin&action=PLUGIN_UNSIGNED_INSTALL_CONFIRMED')}, { headers: { authorization: ${JSON.stringify('Bearer ' + token)} } });
      const body = await response.json();
      if (!response.ok || !body.data.items.some(event => event.targetId === ${JSON.stringify(slug)} && event.summary.version === '2.0.0')) throw new Error('confirmation not committed');
      require('fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); throw new Error('candidate failed');
    } };`);
    const failed = await request(next, await fields(next)); expect(failed.statusCode).toBe(500);
    expect(await fs.readFile(marker, 'utf8')).toBe('executed');
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' } })).toBe(2);
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).version).toBe('1.0.0');
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_UPGRADED' } })).toBe(0);
  });
  it.each(['PLUGIN_UNSIGNED_INSTALL_CONFIRMED', 'PLUGIN_INSTALLED'])('D I a real duplicate-key failure in %s blocks its transaction', async action => {
    const slug = own(), bytes = await archive(slug), filePath = path.join(directory, `${slug}.zip`); await fs.writeFile(filePath, bytes);
    const duplicate = await prisma.adminAuditEvent.create({ data: { actorId, action: 'collision', targetType: 'test', targetId: slug, summary: {} } });
    const worker = await child('audit'); const exited = once(worker, 'exit');
    const atAudit = message(worker, 'plugin-audit-ready'); const done = message(worker, 'done');
    worker.send({ filePath, options: await localUploadOptions(bytes, actorId), slug });
    let pending = await atAudit;
    if (pending.action !== action) { const next = message(worker, 'plugin-audit-ready'); worker.send({ kind: 'plugin-audit-release' }); pending = await next; }
    expect(pending.action).toBe(action); worker.send({ kind: 'plugin-audit-release', eventId: duplicate.id });
    expect((await done).statusCode).toBe(500); await exited;
    expect(await prisma.pluginInstall.count({ where: { slug } })).toBe(0); expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(0);
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_INSTALLED' } })).toBe(0);
    if (action === 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED') expect(await pluginPackageStore.list()).not.toContain(slug);
  });
  it('F rejects downgrade and same-version changed content with the required codes', async () => {
    const slug = own(), bytes = await archive(slug, '2.0.0'); expect((await request(bytes, await fields(bytes))).statusCode).toBe(200);
    for (const [version, code] of [['1.0.0', 'PLUGIN_DOWNGRADE_NOT_SUPPORTED'], ['2.0.0', 'PLUGIN_VERSION_CONTENT_CHANGED']]) {
      const response = await request(await archive(slug, version, 'module.exports = { register() { } };'), {}, token, '/api/v1/extensions/plugin/preview');
      expect(response.statusCode).toBe(409); expect(response.json().error.code).toBe(code);
    }
  });
  it('G same-hash upload repairs the blob, directory and missing default instance without enabling', async () => {
    const slug = own(), bytes = await archive(slug); expect((await request(bytes, await fields(bytes))).statusCode).toBe(200);
    const row = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } }); const pkg = await pluginPackageStore.get(slug, row.zipHash!);
    await fs.rm(pkg!.getEntryPath(''), { recursive: true, force: true }); await prisma.pluginPackageBlob.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    expect((await request(bytes, await fields(bytes))).statusCode).toBe(200);
    expect(await pluginPackageStore.get(slug, row.zipHash!)).not.toBeNull(); expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug } })).toBe(1);
    expect((await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } })).enabled).toBe(false);
  });
  it('H concurrent final upload rejects the second lease and commits one success audit', async () => {
    const slug = own(), bytes = await archive(slug), filePath = path.join(directory, `${slug}.zip`); await fs.writeFile(filePath, bytes);
    const options = await localUploadOptions(bytes, actorId), values = await fields(bytes);
    const worker = await child('published'); const exited = once(worker, 'exit'); const ready = message(worker, 'plugin-lease-ready'), done = message(worker, 'done');
    worker.send({ filePath, options, slug }); await ready;
    const response = await request(bytes, values); expect(response.statusCode).toBe(409); expect(response.json().error.code).toBe('PLUGIN_OPERATION_IN_PROGRESS');
    worker.send({ kind: 'plugin-lease-release' }); expect((await done).statusCode).toBe(200); await exited;
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_INSTALLED' } })).toBe(1);
  });
  it('I a post-commit hook warning returns the installed version and declares the actual statuses', async () => {
    const slug = own(), first = await archive(slug); expect((await request(first, await fields(first))).statusCode).toBe(200);
    const next = await archive(slug, '2.0.0', "module.exports = { register() {}, __lifecycle_onUpgrade() { throw new Error('hook failed'); } };", true);
    const response = await request(next, await fields(next)); expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ version: '2.0.0', warnings: ['PLUGIN_UPGRADE_HOOK_WARNING'] });
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).version).toBe('2.0.0');
    expect(await prisma.adminAuditEvent.count({ where: { targetId: slug, action: 'PLUGIN_UPGRADED' } })).toBe(1);
    expect(extensionInstallerSchemas.installExtension.response).toHaveProperty('200'); expect(extensionInstallerSchemas.installExtension.response).not.toHaveProperty('201');
    for (const status of [400, 401, 403, 409, 413, 422, 500]) expect(extensionInstallerSchemas.previewPlugin.response).toHaveProperty(String(status));
  });
  it('P bundle installation is absent and only local final or marketplace routes call an installer', async () => {
    const before = await prisma.pluginInstall.count(); const response = await app.inject({ method: 'POST', url: '/api/v1/extensions/bundle/install', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(404); expect(await prisma.pluginInstall.count()).toBe(before);
    const source = await fs.readFile(path.resolve('src/core/admin/extension-installer/routes.ts'), 'utf8');
    expect(source).not.toContain('bundleInstaller'); expect(source.match(/extensionInstaller\.installFromZip\(/g)).toHaveLength(1); expect(source.match(/await installMarketplacePlugin\(/g)).toHaveLength(1);
    expect(source).toContain("admin.post('/plugin/preview'"); expect(source).toContain("admin.post('/plugin/install'");
  });
});
