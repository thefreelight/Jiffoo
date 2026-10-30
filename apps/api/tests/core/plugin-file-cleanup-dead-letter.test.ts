import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { PluginStorageService, PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS } from '@/core/plugin-storage/service';
import { listPluginRecovery } from '@/core/admin/extension-installer/plugin-recovery';
import type { UploadedObjectStore } from '@/core/storage/uploaded-object-store';

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
  expect(item!.deadCleanups).toEqual([{ objectKey, fileId: file.id, attempts: PLUGIN_FILE_CLEANUP_MAX_ATTEMPTS, lastError: 'UPLOAD_STORAGE_UNAVAILABLE', sizeBytes: 12 }]);
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
});
