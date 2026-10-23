import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { buildApp } from '@/server';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { PluginStorageService, createStorageApi, type StorageAuthorization } from '@/core/plugin-storage/service';
import { fileUrlSecret } from '@/core/plugin-storage/grants';
import { createTaskApi, recordTaskPrincipal, withTaskScope } from '@/core/plugins/tasks';
import { PluginTaskWorker } from '@/core/plugins/task-worker';
import { LocalUploadedObjectStore, type UploadedObjectStore } from '@/core/storage/uploaded-object-store';
import { createUserWithToken } from '../helpers/auth';
import { pageFiles, pageManifest, pageZip } from '../fixtures/plugin-pages';
import { image, s3Store } from '../helpers/uploaded-storage-fixture';
import { tcpRelay } from '../helpers/error-http-fixture';
import { startThemeChild, stopThemeChild, themeHttp } from '../helpers/theme-package-fixture';
import { sanitizeData } from 'shared/logger';

const slug = 'p4-storage-fixture';
let app: Awaited<ReturnType<typeof buildApp>>;
let customer: Awaited<ReturnType<typeof createUserWithToken>>;
let other: Awaited<ReturnType<typeof createUserWithToken>>;
let admin: Awaited<ReturnType<typeof createUserWithToken>>;
let installationId: string, zipHash: string, directory: string;
let generation: bigint;
let session: { pluginToken: string; sessionId: string };
const headers = () => ({ authorization: `Bearer ${session.pluginToken}`, origin: 'null' });
const authority = (id?: string): StorageAuthorization => async () => ({ installationId, generation, principal: { type: 'customer', id: id ?? customer.user.id } });
const issue = async (actor = customer, surface = 'shop') => {
  const result = await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/session`, headers: { authorization: `Bearer ${actor.token}`, origin: surface === 'shop' ? 'http://localhost:3003' : 'http://localhost:3002' }, payload: { surface, pageId: surface === 'shop' ? 'studio' : 'reports' } });
  expect(result.statusCode, result.body).toBe(200); return result.json().data;
};
const upload = async (bytes: Buffer, type = 'image/png', token = session.pluginToken) => {
  const boundary = randomUUID();
  return app.inject({ method: 'POST', url: `/api/v1/plugin-storage/${slug}/files`, headers: { authorization: `Bearer ${token}`, origin: 'null', 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="unsafe.html"\r\nContent-Type: ${type}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]) });
};

beforeAll(async () => {
  vi.stubEnv('STOREFRONT_URL', 'http://localhost:3003'); vi.stubEnv('ADMIN_URL', 'http://localhost:3002');
  app = await buildApp(); directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-p4-test-'));
  customer = await createUserWithToken(); other = await createUserWithToken(); admin = await createUserWithToken({ role: 'ADMIN' });
  const manifest = pageManifest(slug); delete manifest.serviceDependencies; delete manifest.services; delete manifest.tasks;
  const bytes = await pageZip(pageFiles(manifest)); zipHash = createHash('sha256').update(bytes).digest('hex');
  await prisma.pluginInstall.create({ data: { slug, name: manifest.name, version: manifest.version, manifestJson: JSON.parse(JSON.stringify(manifest)), zipHash, source: 'local-zip', entryModule: manifest.entryModule,
    packageBlobs: { create: { zipHash, bytes, sizeBytes: bytes.length } } } });
  const installation = await prisma.pluginInstallation.create({ data: { pluginSlug: slug, instanceKey: 'default', enabled: true } });
  installationId = installation.id; generation = installation.protectionGeneration;
  session = await issue(); await recordTaskPrincipal(installationId, other.user);
});
afterAll(async () => {
  if (installationId) {
    await prisma.$transaction(tx => PluginStorageService.purgeInstallation(tx, installationId, 'test'));
    await new PluginStorageService().cleanup();
    await prisma.pluginFile.deleteMany({ where: { installationId } });
    await prisma.pluginFileCleanup.deleteMany({ where: { installationId } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
  }
  await app?.close(); if (directory) await fs.rm(directory, { recursive: true, force: true }); vi.unstubAllEnvs();
});

it('uploads only verified bytes and grants a transferable, revocable cookie-free image read', async () => {
  const bytes = await image(); const uploaded = await upload(bytes);
  expect(uploaded.statusCode, uploaded.body).toBe(200);
  const file = uploaded.json().data;
  const metadata = await prisma.pluginFile.findUniqueOrThrow({ where: { id: file.reference } });
  expect((await app.inject(`/uploads/${metadata.objectKey}`)).statusCode).toBe(404);
  expect(Object.keys(file).sort()).toEqual(['contentType', 'reference', 'sha256', 'size']);
  expect(file.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  const issued = await app.inject({ method: 'POST', url: `/api/v1/plugin-storage/${slug}/files/${file.reference}/read-url`, headers: headers() });
  expect(issued.statusCode, issued.body).toBe(200);
  const url = issued.json().data.url;
  const token = new URL(url, 'http://core').searchParams.get('token')!;
  const claims = jwt.verify(token, fileUrlSecret(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
  expect(JSON.stringify(sanitizeData({ url, query: { token } }))).not.toContain(token);
  expect(JSON.stringify(sanitizeData({ url: url.replace('?token=', '?%74oken=') }))).not.toContain(token);
  expect(claims.exp! - claims.iat!).toBe(60); expect(claims.disposition).toBe('inline');
  const read = await app.inject({ url, headers: { origin: 'null', cookie: 'untrusted=ignored' } });
  expect(read.statusCode, read.body).toBe(200); expect(read.rawPayload).toEqual(bytes);
  expect(read.headers['access-control-allow-origin']).toBe('null'); expect(read.headers['access-control-allow-credentials']).toBeUndefined();
  expect(read.headers['cache-control']).toBe('private, no-store'); expect(read.headers['x-content-type-options']).toBe('nosniff');
  expect((await app.inject({ method: 'HEAD', url })).statusCode).toBe(200);
  expect((await app.inject({ url: `/api/v1/plugin-files/${file.reference}`, headers: { authorization: `Bearer ${customer.token}` } })).statusCode).toBe(400);
  expect((await app.inject({ url: url + '&disposition=attachment' })).statusCode).toBe(400);
  expect((await app.inject({ url: url.replace(token, token.slice(0, -3) + 'bad') })).statusCode).toBe(404);
  const expired = jwt.sign({ ...claims, iat: Math.floor(Date.now() / 1000) - 61, exp: Math.floor(Date.now() / 1000) - 1 }, fileUrlSecret(), { algorithm: 'HS256', header: { alg: 'HS256', typ: 'plugin-file-v1' } });
  expect((await app.inject({ url: url.replace(token, expired) })).statusCode).toBe(404);
  const otherSession = await issue(other);
  const denied = await app.inject({ method: 'POST', url: `/api/v1/plugin-storage/${slug}/files/${file.reference}/read-url`, headers: { authorization: `Bearer ${otherSession.pluginToken}`, origin: 'null' } });
  expect(denied.statusCode).toBe(404);
  const otherSlug = 'p4-other-fixture';
  const otherManifest = pageManifest(otherSlug); delete otherManifest.serviceDependencies; delete otherManifest.services; delete otherManifest.tasks;
  const otherPlugin = await prisma.pluginInstall.create({ data: { slug: otherSlug, name: otherSlug, version: otherManifest.version,
    zipHash, source: 'local-zip', entryModule: otherManifest.entryModule, manifestJson: JSON.parse(JSON.stringify(otherManifest)), installations: { create: { instanceKey: 'default', enabled: true } } }, include: { installations: true } });
  try {
    await recordTaskPrincipal(otherPlugin.installations[0].id, customer.user);
    await expect(new PluginStorageService().get(async () => ({ installationId: otherPlugin.installations[0].id, generation: otherPlugin.installations[0].protectionGeneration,
      principal: { type: 'customer', id: customer.user.id } }), file.reference)).rejects.toMatchObject({ code: 'PLUGIN_FILE_NOT_FOUND' });
  } finally { await prisma.pluginInstall.delete({ where: { slug: otherSlug } }); }
  const save = await app.inject({ method: 'POST', url: `/api/v1/plugin-pages/${slug}/sessions/${session.sessionId}/download`,
    headers: { authorization: `Bearer ${customer.token}`, origin: 'http://localhost:3003' }, payload: { reference: file.reference } });
  expect(save.statusCode, save.body).toBe(200); expect(save.json().data.url).toMatch(/^\/plugin-downloads\//);
  const saved = await app.inject(save.json().data.url.replace('/plugin-downloads/', '/api/v1/plugin-files/'));
  expect(saved.headers['content-disposition']).toBe(`attachment; filename="${file.reference}.png"`);
  await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: false } });
  expect((await app.inject(url)).statusCode).toBe(404);
  await prisma.pluginInstallation.update({ where: { id: installationId }, data: { enabled: true, protectionGeneration: { increment: 1 } } });
  generation += 1n;
  expect((await app.inject(url)).statusCode).toBe(404);
  session = await issue();
});

it('a second API process verifies the same grant and object without local session authority', async () => {
  const bytes = await image(); const uploaded = await upload(bytes);
  expect(uploaded.statusCode, uploaded.body).toBe(200);
  const result = await app.inject({ method: 'POST', url: `/api/v1/plugin-storage/${slug}/files/${uploaded.json().data.reference}/read-url`, headers: headers() });
  expect(result.statusCode, result.body).toBe(200);
  const child = await startThemeChild('http');
  try {
    const read = await themeHttp(child, result.json().data.url);
    expect(read.status).toBe(200); expect(read.bytes).toEqual(bytes);
  } finally { await stopThemeChild(child); }
}, 60_000);

it('rejects oversized multipart and extra owner fields without publishing a file', async () => {
  const before = await prisma.pluginFile.count({ where: { installationId, state: 'READY' } });
  const oversized = await upload(Buffer.alloc(env.PLUGIN_UPLOAD_MAX_BYTES + 1, 'a'), 'text/plain');
  expect(oversized.statusCode, oversized.body).toBe(413);
  expect(oversized.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  const boundary = randomUUID();
  const extra = await app.inject({ method: 'POST', url: `/api/v1/plugin-storage/${slug}/files`,
    headers: { ...headers(), 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="private.png"\r\nContent-Type: image/png\r\n\r\n`), await image(),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="owner"\r\n\r\n${other.user.id}\r\n--${boundary}--\r\n`)]) });
  expect(extra.statusCode, extra.body).toBe(413);
  expect(extra.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  expect(await prisma.pluginFile.count({ where: { installationId, state: 'READY' } })).toBe(before);
});

it('rejects mislabeled active files and oversized streams before publishing references', async () => {
  for (const [bytes, type] of [[Buffer.from('<svg onload="alert(1)"/>'), 'image/png'], [Buffer.from('<html>active</html>'), 'text/plain'], [Buffer.from('MZexecutable'), 'text/plain']] as const) {
    expect((await upload(bytes, type)).statusCode).toBe(400);
  }
  const service = new PluginStorageService(new LocalUploadedObjectStore(directory));
  async function* large() { for (let i = 0; i < 11; i++) yield Buffer.alloc(1024 * 1024); }
  await expect(service.put(authority(), large(), 'text/plain')).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  expect(await prisma.pluginFile.count({ where: { installationId, state: 'RESERVED' } })).toBe(0);
});

for (const backend of ['local', 's3'] as const) it(`${backend}: partial writes, retries and late remote completion never publish or delete another namespace`, async () => {
  const store = backend === 'local' ? new LocalUploadedObjectStore(directory) : s3Store();
  await store.initialize();
  const otherKey = `private/another-installation/${randomUUID()}`;
  await store.put(otherKey, Buffer.from('preserve'), 'text/plain');
  let key = '', failedDelete = true;
  const failing: UploadedObjectStore = {
    initialize: () => store.initialize(), get: value => store.get(value), head: (value, signal) => store.head(value, signal), list: prefix => store.list(prefix), read: (value, max, signal) => store.read(value, max, signal),
    put: async (value, bytes, type, signal) => { key = value; await store.put(value, bytes.subarray(0, 3), type, signal); throw new Error('Connection lost after partial write'); },
    delete: async (value, signal) => { if (failedDelete) throw new Error('Temporary deletion outage'); await store.delete(value, signal); },
  };
  const service = new PluginStorageService(failing);
  await expect(service.put(authority(), Buffer.from('private text'), 'text/plain')).rejects.toThrow();
  const file = await prisma.pluginFile.findUniqueOrThrow({ where: { objectKey: key } });
  expect(file.state).toBe('DELETING');
  let abandoned: string | undefined, neighbour: string | undefined;
  if (backend === 'local') {
    abandoned = path.join(directory, key + '.' + randomUUID() + '.tmp');
    neighbour = path.join(path.dirname(abandoned), randomUUID() + '.' + randomUUID() + '.tmp');
    await fs.writeFile(abandoned, 'crashed local write');
    await fs.writeFile(neighbour, 'preserve staging');
  }
  await service.cleanup();
  expect((await prisma.pluginFileCleanup.findUniqueOrThrow({ where: { objectKey: key } })).lastError).toBe('UPLOAD_STORAGE_UNAVAILABLE');
  failedDelete = false;
  await prisma.pluginFileCleanup.update({ where: { objectKey: key }, data: { nextAttemptAt: new Date(0) } });
  await service.cleanup(); expect(await store.head(key)).toBeNull();
  expect(await prisma.pluginFile.findUnique({ where: { id: file.id } })).toBeNull();
  await store.put(key, Buffer.from('late remote completion'), 'text/plain');
  await prisma.pluginFileCleanup.update({ where: { objectKey: key }, data: { nextAttemptAt: new Date(0) } });
  await service.cleanup(); expect(await store.head(key)).toBeNull();
  expect((await store.get(otherKey))?.toString()).toBe('preserve');
  if (abandoned) {
    await expect(fs.stat(abandoned)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(neighbour!, 'utf8')).toBe('preserve staging');
  }
  await store.delete(otherKey, AbortSignal.timeout(5000));
});

it('S3 transport loss fails closed and recovers without reusing an object key', async () => {
  const relay = await tcpRelay(process.env.UPLOAD_S3_ENDPOINT!, 9000);
  const service = new PluginStorageService(s3Store(relay.url));
  try {
    relay.drop(); await expect(service.put(authority(), Buffer.from('transport failure'), 'text/plain')).rejects.toMatchObject({ code: 'UPLOAD_STORAGE_UNAVAILABLE' });
    relay.recover(); const file = await service.put(authority(), Buffer.from('transport recovered'), 'text/plain');
    expect((await service.get(authority(), file.reference)).toString()).toBe('transport recovered');
  } finally { await relay.close(); }
});

it('SDK rejects captured contexts, request owner overrides and aborted work', async () => {
  const storage = createStorageApi(installationId);
  await expect(storage.get(randomUUID())).rejects.toMatchObject({ code: 'PLUGIN_TASK_CLAIM_LOST' });
  const scope = { installationId, generation, zipHash, request: true, principal: { type: 'customer' as const, id: customer.user.id }, actorId: customer.user.id };
  await withTaskScope(scope, async () => {
    await expect(storage.put({ content: Buffer.from('hello'), contentType: 'text/plain', owner: { type: 'customer', id: other.user.id } })).rejects.toMatchObject({ code: 'PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN' });
    const file = await storage.put({ content: Buffer.from('trusted SDK'), contentType: 'text/plain' });
    expect(Buffer.from(await storage.get(file.reference)).toString()).toBe('trusted SDK');
    await expect(storage.get(file.reference, { signal: AbortSignal.abort() })).rejects.toThrow();
  });
});

it('concurrent reservations enforce principal quota and release unused reservation bytes', async () => {
  const service = new PluginStorageService(new LocalUploadedObjectStore(directory));
  const principalKey = { installationId, ownerType: 'CUSTOMER', ownerId: other.user.id };
  await prisma.pluginStorageQuota.upsert({ where: { installationId_ownerType_ownerId: principalKey }, create: { ...principalKey, usedBytes: 104857600n - BigInt(env.PLUGIN_UPLOAD_MAX_BYTES) }, update: { usedBytes: 104857600n - BigInt(env.PLUGIN_UPLOAD_MAX_BYTES), reservedBytes: 0 } });
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  async function* slow() { entered(); await barrier; yield Buffer.from('race'); }
  const first = service.put(authority(other.user.id), slow(), 'text/plain');
  await started;
  await expect(service.put(authority(other.user.id), Buffer.from('second'), 'text/plain')).rejects.toMatchObject({ code: 'PLUGIN_STORAGE_QUOTA_EXCEEDED' });
  release(); const file = await first;
  const quota = await prisma.pluginStorageQuota.findUniqueOrThrow({ where: { installationId_ownerType_ownerId: principalKey } });
  expect(quota.reservedBytes).toBe(0n); expect(file.size).toBe(4);
  await prisma.pluginStorageQuota.update({ where: { installationId_ownerType_ownerId: principalKey }, data: { usedBytes: 4 } });
});

it('actual G1 claims bind storage, audit unbound repair owners and reject revoked execution', async () => {
  const installed = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
  const manifest = JSON.parse(JSON.stringify(installed.manifestJson));
  manifest.tasks = [{ name: 'storage-proof', version: 1, concurrency: 1, maxAttempts: 1, maxRuntimeSeconds: 30 }];
  await prisma.pluginInstall.update({ where: { slug }, data: { manifestJson: manifest } });
  const tasks = createTaskApi(installationId, () => undefined);
  const scope = { installationId, generation, zipHash, request: true, principal: null, actorId: 'test' };
  // Internal fixture admission tests existing G1 execution, not a public repair bootstrap.
  const task = await withTaskScope(scope, () => tasks.enqueue('storage-proof', 1, {}, { idempotencyKey: randomUUID() }));
  let completed = false;
  const worker = new PluginTaskWorker({ installationIds: [installationId], execute: async () => {
    const storage = createStorageApi(installationId);
    const owner = { type: 'customer' as const, id: customer.user.id };
    async function* content() { owner.id = other.user.id; yield Buffer.from('repair output'); }
    const file = await storage.put({ content: content(), contentType: 'text/plain', owner });
    expect((await prisma.pluginFile.findUniqueOrThrow({ where: { id: file.reference } })).ownerId).toBe(customer.user.id);
    owner.id = customer.user.id;
    expect(Buffer.from(await storage.get(file.reference, { owner })).toString()).toBe('repair output');
    await prisma.pluginTask.update({ where: { id: task.id }, data: { leaseUntil: new Date(0) } });
    await expect(storage.get(file.reference, { owner })).rejects.toMatchObject({ code: 'PLUGIN_TASK_CLAIM_LOST' });
    completed = true;
    return {};
  } });
  try { await worker.tick(); await worker.drain(); expect(completed).toBe(true); }
  finally {
    await worker.drain();
    await prisma.pluginTaskExecutionSlot.deleteMany({ where: { installationId } });
    await prisma.pluginTask.deleteMany({ where: { installationId } });
    await prisma.pluginInstall.update({ where: { slug }, data: { manifestJson: installed.manifestJson! } });
  }
  expect(await prisma.adminAuditEvent.count({ where: { action: 'PLUGIN_STORAGE_PRINCIPAL_BOUND', targetId: task.id } })).toBeGreaterThan(0);
});

it('administrator uploads remain administrator-owned and generation purge revokes every grant', async () => {
  const adminSession = await issue(admin, 'admin');
  const uploaded = await upload(await image(), 'image/png', adminSession.pluginToken);
  expect(uploaded.statusCode, uploaded.body).toBe(200);
  const reference = uploaded.json().data.reference;
  expect((await prisma.pluginFile.findUniqueOrThrow({ where: { id: reference } })).ownerType).toBe('ADMIN');
  const result = await app.inject({ method: 'POST', url: `/api/v1/plugin-storage/${slug}/files/${reference}/read-url`, headers: { origin: 'null', authorization: `Bearer ${adminSession.pluginToken}` } });
  expect(result.statusCode, result.body).toBe(200);
  const url = result.json().data.url;
  await prisma.$transaction(tx => PluginStorageService.purgeInstallation(tx, installationId, admin.user.id));
  expect((await app.inject(url)).statusCode).toBe(404);
  expect(await prisma.pluginFileCleanup.count({ where: { installationId } })).toBeGreaterThan(0);
});
