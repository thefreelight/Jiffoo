import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { PluginStorageService, PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS } from '@/core/plugin-storage/service';
import { listPluginRecovery } from '@/core/admin/extension-installer/plugin-recovery';
import type { UploadedObjectStore } from '@/core/storage/uploaded-object-store';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';

const slug = `cleanup-dead-${randomUUID().slice(0, 8)}`;
let installationId: string;
let ownerId: string;

beforeEach(async () => {
  await prisma.pluginInstall.deleteMany({ where: { slug } });
  ownerId = randomUUID();
  const install = await prisma.pluginInstall.create({ data: { slug, name: slug, version: '1.0.0' } });
  const installation = await prisma.pluginInstallation.create({ data: { pluginSlug: install.slug, instanceKey: 'default', enabled: true } });
  installationId = installation.id;
});

afterEach(async () => {
  await prisma.pluginFileCleanup.deleteMany({ where: { installationId } });
  await prisma.pluginFile.deleteMany({ where: { installationId } });
  await prisma.pluginStorageQuota.deleteMany({ where: { installationId } });
  await prisma.pluginInstallation.deleteMany({ where: { id: installationId } });
  await prisma.pluginInstall.deleteMany({ where: { slug } });
});

/** A store whose remote delete always fails. */
function failingStore() {
  const deleted: string[] = [];
  const store: UploadedObjectStore = {
    initialize: async () => {},
    put: async () => {},
    get: async () => null,
    read: async () => null,
    delete: async key => { deleted.push(key); throw new Error('object store outage'); },
    head: async () => null,
    list: async () => [],
  };
  return { store, deleted };
}

/** A store whose remote delete succeeds and whose object is gone. */
function successfulStore() {
  const deleted: string[] = [];
  const store: UploadedObjectStore = {
    initialize: async () => {},
    put: async () => {},
    get: async () => null,
    read: async () => null,
    delete: async key => { deleted.push(key); },
    head: async () => null,
    list: async () => [],
  };
  return { store, deleted };
}

/** A ready file with its quota reserved and its cleanup row queued. */
async function seed(objectKey: string, bytes = 12) {
  const file = await prisma.pluginFile.create({ data: { installationId, ownerType: 'CUSTOMER', ownerId, objectKey,
    contentType: 'text/plain', sizeBytes: BigInt(bytes), reservedBytes: 0n, sha256: 'a'.repeat(64),
    state: 'READY', reservationExpiresAt: new Date(Date.now() + 60_000) } });
  for (const key of [{ ownerType: 'INSTALLATION', ownerId: '' }, { ownerType: 'CUSTOMER', ownerId }]) {
    await prisma.pluginStorageQuota.upsert({ where: { installationId_ownerType_ownerId: { installationId, ...key } },
      create: { installationId, ...key, usedBytes: BigInt(bytes), reservedBytes: 0n },
      update: { usedBytes: BigInt(bytes), reservedBytes: 0n } });
  }
  const cleanup = await prisma.pluginFileCleanup.create({ data: { fileId: file.id, installationId, objectKey } });
  return { file, cleanup };
}

/** Runs the sweep until the cleanup row of the key exhausts the attempt budget. */
async function driveToDeadLetter(service: PluginStorageService, cleanupId: string) {
  for (let attempt = 1; attempt <= PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS; attempt++) {
    await prisma.pluginFileCleanup.update({ where: { id: cleanupId }, data: { nextAttemptAt: new Date(0) } });
    await service.cleanup();
  }
  return prisma.pluginFileCleanup.findUniqueOrThrow({ where: { id: cleanupId } });
}

it('a cleanup row whose delete keeps failing reaches the dead letter state after the attempt budget', async () => {
  const objectKey = `private/${installationId}/CUSTOMER/${randomUUID()}`;
  const { cleanup } = await seed(objectKey);
  const { store, deleted } = failingStore();
  const service = new PluginStorageService(store);
  for (let attempt = 1; attempt <= PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS; attempt++) {
    await prisma.pluginFileCleanup.update({ where: { id: cleanup.id }, data: { nextAttemptAt: new Date(0) } });
    await service.cleanup();
    const row = await prisma.pluginFileCleanup.findUniqueOrThrow({ where: { id: cleanup.id } });
    expect(row.attempts).toBe(attempt);
    expect(row.status).toBe(attempt < PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS ? 'PENDING' : 'DEAD');
  }
  const dead = await prisma.pluginFileCleanup.findUniqueOrThrow({ where: { id: cleanup.id } });
  expect(dead.status).toBe('DEAD');
  expect(dead.attempts).toBe(PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS);
  expect(dead.lastError).toBe('UPLOAD_STORAGE_UNAVAILABLE');
  expect(dead.objectKey).toBe(objectKey);
  expect(dead.claimToken).toBeNull();
  expect(dead.leaseUntil).toBeNull();
  expect(deleted.filter(key => key === objectKey)).toHaveLength(PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS);
});

it('a dead cleanup row is never claimed again', async () => {
  const objectKey = `private/${installationId}/CUSTOMER/${randomUUID()}`;
  const { cleanup } = await seed(objectKey);
  const { store, deleted } = failingStore();
  const service = new PluginStorageService(store);
  await driveToDeadLetter(service, cleanup.id);
  await prisma.pluginFileCleanup.update({ where: { id: cleanup.id }, data: { nextAttemptAt: new Date(0) } });
  await service.cleanup();
  const row = await prisma.pluginFileCleanup.findUniqueOrThrow({ where: { id: cleanup.id } });
  expect(row.status).toBe('DEAD');
  expect(row.attempts).toBe(PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS);
  expect(deleted.filter(key => key === objectKey)).toHaveLength(PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS);
});

it('a cleanup row that succeeds before the budget stays pending, releases the quota and keeps the tombstone', async () => {
  const objectKey = `private/${installationId}/CUSTOMER/${randomUUID()}`;
  const { file, cleanup } = await seed(objectKey, 12);
  const { store, deleted } = successfulStore();
  await new PluginStorageService(store).cleanup();
  const row = await prisma.pluginFileCleanup.findUniqueOrThrow({ where: { id: cleanup.id } });
  expect(row.status).toBe('PENDING');
  expect(row.attempts).toBe(1);
  expect(row.lastError).toBeNull();
  expect(row.objectKey).toBe(objectKey);
  expect(row.fileId).toBeNull();
  expect(deleted).toContain(objectKey);
  expect(await prisma.pluginFile.findUnique({ where: { id: file.id } })).toBeNull();
  const quotas = await prisma.pluginStorageQuota.findMany({ where: { installationId } });
  expect(quotas).toHaveLength(2);
  expect(quotas.every(quota => quota.usedBytes === 0n)).toBe(true);
});

it('the recovery listing reports the dead cleanup row as an item that needs an operator', async () => {
  const objectKey = `private/${installationId}/CUSTOMER/${randomUUID()}`;
  const { file, cleanup } = await seed(objectKey, 12);
  const { store } = failingStore();
  await driveToDeadLetter(new PluginStorageService(store), cleanup.id);
  const listing = await listPluginRecovery();
  const item = listing.items.find(row => row.slug === slug);
  expect(item).toBeDefined();
  expect(item!.maintenanceRequired).toBe(true);
  expect(item!.deadCleanupCount).toBe(1);
  expect(item!.deadCleanupsTruncated).toBe(false);
  expect(item!.deadCleanups).toEqual([{ objectKey, fileId: file.id, attempts: PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS, lastError: 'UPLOAD_STORAGE_UNAVAILABLE', sizeBytes: 12 }]);
  expect(listing.deadCleanupTotal).toBe(await prisma.pluginFileCleanup.count({ where: { status: 'DEAD' } }));
  expect(listing.deadCleanupPage.limit).toBe(50);
  expect(listing.deadCleanupPage.offset).toBe(0);
  expect(listing.deadCleanupPage.returned).toBe(Math.min(50, listing.deadCleanupTotal));
  expect(listing.deadCleanupPage.hasMore).toBe(listing.deadCleanupTotal > listing.deadCleanupPage.returned);
  expect(listing.orphanedDeadCleanups.filter(row => row.objectKey === objectKey)).toEqual([]);
});

it('an orphaned dead cleanup row is reported by the operator surface and is still never claimed', async () => {
  const objectKey = `private/${installationId}/CUSTOMER/${randomUUID()}`;
  const { file, cleanup } = await seed(objectKey, 12);
  const { store, deleted } = failingStore();
  const service = new PluginStorageService(store);
  await driveToDeadLetter(service, cleanup.id);
  // The installation is removed: the cleanup row has no foreign key, so the
  // row survives its installation and becomes orphaned.
  await prisma.pluginInstallation.delete({ where: { id: installationId } });
  await prisma.pluginFileCleanup.update({ where: { id: cleanup.id }, data: { nextAttemptAt: new Date(0) } });
  await service.cleanup();
  const row = await prisma.pluginFileCleanup.findUniqueOrThrow({ where: { id: cleanup.id } });
  expect(row.status).toBe('DEAD');
  expect(row.attempts).toBe(PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS);
  expect(deleted.filter(key => key === objectKey)).toHaveLength(PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS);
  const listing = await listPluginRecovery();
  expect(listing.items.find(item => item.slug === slug)).toBeUndefined();
  expect(listing.orphanedDeadCleanups.filter(row => row.objectKey === objectKey))
    .toEqual([{ objectKey, fileId: file.id, attempts: PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS, lastError: 'UPLOAD_STORAGE_UNAVAILABLE', sizeBytes: 12 }]);
  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM public.plugin_file_cleanup c LEFT JOIN public.plugin_installations i ON i.id = c."installationId" WHERE c.status = 'DEAD' AND i.id IS NULL`;
  expect(listing.orphanedDeadCleanupTotal).toBe(Number(orphanRows[0].count));
});

it('the dead cleanup listing pages every dead row and reports the total', async () => {
  const keys: string[] = [];
  for (let index = 0; index < 3; index++) {
    const objectKey = `private/${installationId}/CUSTOMER/${randomUUID()}`;
    keys.push(objectKey);
    const { cleanup } = await seed(objectKey, 12);
    await prisma.pluginFileCleanup.update({ where: { id: cleanup.id }, data: { status: 'DEAD', attempts: PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS, lastError: 'UPLOAD_STORAGE_UNAVAILABLE' } });
  }
  const total = await prisma.pluginFileCleanup.count({ where: { status: 'DEAD' } });
  expect(total).toBeGreaterThanOrEqual(3);
  // The plugin stays an item of the listing even when its dead rows fall
  // outside the current page: a dead row is never claimed again, so a row
  // that is not visible would never be resolved.
  const first = await listPluginRecovery({ deadCleanupLimit: 1 });
  const item = first.items.find(row => row.slug === slug);
  expect(item).toBeDefined();
  expect(item!.deadCleanupCount).toBe(3);
  expect(item!.deadCleanupsTruncated).toBe(true);
  expect(item!.deadCleanups).toHaveLength(1);
  expect(first.deadCleanupTotal).toBe(total);
  expect(first.deadCleanupPage).toEqual({ limit: 1, offset: 0, returned: 1, hasMore: total > 1 });
  // Every dead row is reachable by paging.
  const seen = new Set<string>();
  let offset = 0, hasMore = true, pages = 0;
  while (hasMore && pages < 50) {
    const page = await listPluginRecovery({ deadCleanupLimit: 2, deadCleanupOffset: offset });
    expect(page.deadCleanupTotal).toBe(total);
    expect(page.deadCleanupPage.offset).toBe(offset);
    for (const row of page.items.flatMap(entry => entry.deadCleanups)) seen.add(row.objectKey);
    for (const row of page.orphanedDeadCleanups) seen.add(row.objectKey);
    hasMore = page.deadCleanupPage.hasMore;
    offset += page.deadCleanupPage.returned;
    pages++;
  }
  expect(hasMore).toBe(false);
  for (const key of keys) expect(seen.has(key)).toBe(true);
});

it('the recovery route pages the dead cleanup rows and rejects an out of range page', async () => {
  const app = await createTestApp();
  const admin = await createAdminWithToken();
  try {
    const objectKey = `private/${installationId}/CUSTOMER/${randomUUID()}`;
    const { cleanup } = await seed(objectKey, 12);
    await prisma.pluginFileCleanup.update({ where: { id: cleanup.id }, data: { status: 'DEAD', attempts: PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS, lastError: 'UPLOAD_STORAGE_UNAVAILABLE' } });
    const total = await prisma.pluginFileCleanup.count({ where: { status: 'DEAD' } });
    const response = await app.inject({ method: 'GET', url: '/api/v1/extensions/plugin/recovery?deadCleanupLimit=1', headers: admin.authHeader });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.deadCleanupTotal).toBe(total);
    expect(data.deadCleanupPage).toEqual({ limit: 1, offset: 0, returned: 1, hasMore: total > 1 });
    expect(typeof data.orphanedDeadCleanupTotal).toBe('number');
    expect(Array.isArray(data.orphanedDeadCleanups)).toBe(true);
    // The plugin of the dead rows stays an item of the listing, whatever page
    // its rows fall into.
    const item = data.items.find((entry: { slug: string }) => entry.slug === slug);
    expect(item).toMatchObject({ slug, maintenanceRequired: true });
    expect(item.deadCleanupCount).toBeGreaterThanOrEqual(1);
    // An out of range page is refused by the schema of the route.
    expect((await app.inject({ method: 'GET', url: '/api/v1/extensions/plugin/recovery?deadCleanupLimit=501', headers: admin.authHeader })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/v1/extensions/plugin/recovery?deadCleanupOffset=-1', headers: admin.authHeader })).statusCode).toBe(400);
  } finally {
    await app.close();
    await deleteTestUser(admin.user.id);
  }
});
