import { createHash, randomUUID } from 'node:crypto';
import type { PluginFile } from '@prisma/client';
import type { PluginFileReference, PluginStorage, PluginStorageOptions, TaskPrincipal } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-errors';
import { AdminAuditService } from '@/core/admin/audit-events/service';
import { PluginStorageAdmissionService } from '@/core/admin/extension-installer/storage-admission-service';
import { assertTaskOperation, lockTaskScheduler, validateTaskPrincipal, taskDatabaseTime, type TaskTransaction } from '@/core/plugins/tasks';
import { uploadedObjectStore, type UploadedObjectStore } from '@/core/storage/uploaded-object-store';
import { sharedProtection } from '@/infra/shared-protection';
import { collectFile, fileTypes, untilAbort, validateFileContent, type FileType } from './content';
import { signFileGrant, verifyFileGrant } from './grants';

type Authority = { installationId: string; principal: TaskPrincipal; generation: bigint; signal?: AbortSignal };
export type StorageAuthorization = (tx: TaskTransaction) => Promise<Authority>;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const owner = (authority: Authority) => ({ ownerType: authority.principal.type.toUpperCase(), ownerId: authority.principal.id });

async function admit(tx: TaskTransaction, authorize: StorageAuthorization) {
  await lockTaskScheduler(tx);
  const authority = await authorize(tx);
  const live = await PluginStorageAdmissionService.current(tx, authority.installationId);
  if (live.generation !== authority.generation) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
  await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${authority.principal.id} FOR SHARE`;
  await validateTaskPrincipal(tx, authority.installationId, authority.principal);
  authority.signal?.throwIfAborted();
  return authority;
}

async function lockQuotas(tx: TaskTransaction, installationId: string, ownerType: string, ownerId: string, create: boolean) {
  for (const key of [{ installationId, ownerType: 'INSTALLATION', ownerId: '' }, { installationId, ownerType, ownerId }]) {
    if (create) await tx.pluginStorageQuota.upsert({ where: { installationId_ownerType_ownerId: key }, create: key, update: {} });
    await tx.$queryRaw`SELECT "installationId" FROM public.plugin_storage_quotas WHERE "installationId" = ${installationId} AND "ownerType" = ${key.ownerType} AND "ownerId" = ${key.ownerId} FOR UPDATE`;
  }
}

async function ownedFile(tx: TaskTransaction, authority: Authority, reference: string) {
  if (typeof reference !== 'string' || !uuid.test(reference)) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
  const file = await tx.pluginFile.findFirst({ where: { id: reference, installationId: authority.installationId, ...owner(authority), state: 'READY', deletedAt: null } });
  if (!file?.sha256) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
  return file;
}

async function queueCleanup(tx: TaskTransaction, file: PluginFile) {
  await tx.pluginFileCleanup.upsert({ where: { objectKey: file.objectKey }, create: { fileId: file.id, installationId: file.installationId, objectKey: file.objectKey }, update: {} });
  await tx.pluginFile.updateMany({ where: { id: file.id }, data: { state: 'DELETING', deletedAt: new Date() } });
}

/** Owns private metadata, quotas and durable cleanup. No public object paths escape. */
export class PluginStorageService {
  constructor(private readonly store: UploadedObjectStore = uploadedObjectStore) {}

  async put(authorize: StorageAuthorization, content: Uint8Array | AsyncIterable<Uint8Array>, contentType: FileType): Promise<PluginFileReference> {
    if (!Object.hasOwn(fileTypes, contentType)) throw new ApiError('FORBIDDEN_FILE_TYPE');
    const reservation = await prisma.$transaction(async tx => {
      const authority = await admit(tx, authorize);
      const installationPermit = await sharedProtection.rate(`jiffoo:private-upload:${authority.installationId}`, 60_000, 100);
      if (!installationPermit.allowed) throw new ApiError('RATE_LIMITED');
      const permit = await sharedProtection.rate(`jiffoo:private-upload:${authority.installationId}:${authority.principal.type}:${authority.principal.id}`, 60_000, 20);
      if (!permit.allowed) throw new ApiError('RATE_LIMITED');
      const identity = owner(authority), reserve = BigInt(env.PLUGIN_UPLOAD_MAX_BYTES);
      await lockQuotas(tx, authority.installationId, identity.ownerType, identity.ownerId, true);
      for (const [type, id, cap] of [['INSTALLATION', '', 1073741824n], [identity.ownerType, identity.ownerId, 104857600n]] as const) {
        const key = { installationId: authority.installationId, ownerType: type, ownerId: id };
        const quota = await tx.pluginStorageQuota.findUniqueOrThrow({ where: { installationId_ownerType_ownerId: key } });
        if (quota.usedBytes + quota.reservedBytes + reserve > cap) throw new ApiError('PLUGIN_STORAGE_QUOTA_EXCEEDED');
        await tx.pluginStorageQuota.update({ where: { installationId_ownerType_ownerId: key }, data: { reservedBytes: { increment: reserve } } });
      }
      const now = await taskDatabaseTime(tx);
      const file = await tx.pluginFile.create({ data: { installationId: authority.installationId, ...identity,
        objectKey: `private/${authority.installationId}/${identity.ownerType}/${createHash('sha256').update(identity.ownerId).digest('hex')}/${randomUUID()}`,
        contentType, reservedBytes: reserve, reservationExpiresAt: new Date(now.getTime() + 120_000) } });
      return { authority, file };
    });
    const signal = AbortSignal.any([AbortSignal.timeout(60_000), ...(reservation.authority.signal ? [reservation.authority.signal] : [])]);
    try {
      const bytes = await collectFile(content, env.PLUGIN_UPLOAD_MAX_BYTES, signal);
      await untilAbort(validateFileContent(bytes, contentType), signal);
      await untilAbort(this.store.put(reservation.file.objectKey, bytes, contentType, signal), signal);
      const metadata = await untilAbort(this.store.head(reservation.file.objectKey, signal), signal);
      if (metadata?.size !== bytes.length) throw new ApiError('UPLOAD_STORAGE_CORRUPT');
      const stored = await untilAbort(this.store.read(reservation.file.objectKey, bytes.length, signal), signal);
      const sha256 = digest(bytes);
      if (!stored || digest(stored) !== sha256) throw new ApiError('UPLOAD_STORAGE_CORRUPT');
      await prisma.$transaction(async tx => {
        const authority = await admit(tx, authorize);
        if (authority.installationId !== reservation.authority.installationId || authority.generation !== reservation.authority.generation
          || authority.principal.id !== reservation.authority.principal.id || authority.principal.type !== reservation.authority.principal.type) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
        const identity = owner(authority);
        await lockQuotas(tx, authority.installationId, identity.ownerType, identity.ownerId, false);
        const now = await taskDatabaseTime(tx);
        const updated = await tx.pluginFile.updateMany({ where: { id: reservation.file.id, state: 'RESERVED', reservationExpiresAt: { gt: now } }, data: { state: 'READY', sha256, sizeBytes: bytes.length, reservedBytes: 0 } });
        if (!updated.count) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
        for (const key of [{ installationId: authority.installationId, ownerType: 'INSTALLATION', ownerId: '' }, { installationId: authority.installationId, ...identity }]) {
          await tx.pluginStorageQuota.update({ where: { installationId_ownerType_ownerId: key }, data: { reservedBytes: { decrement: reservation.file.reservedBytes }, usedBytes: { increment: bytes.length } } });
        }
        signal.throwIfAborted();
      });
      return { reference: reservation.file.id, contentType, size: bytes.length, sha256 };
    } catch (error) {
      // Reservation expiry also recovers a crash before this compensation commits.
      await prisma.$transaction(async tx => {
        const file = await tx.pluginFile.findUnique({ where: { id: reservation.file.id } });
        if (file) await queueCleanup(tx, file);
      });
      throw error;
    }
  }

  async get(authorize: StorageAuthorization, reference: string) {
    const { file, authority } = await prisma.$transaction(async tx => { const authority = await admit(tx, authorize); return { authority, file: await ownedFile(tx, authority, reference) }; });
    const signal = AbortSignal.any([AbortSignal.timeout(15_000), ...(authority.signal ? [authority.signal] : [])]);
    const bytes = await untilAbort(this.store.read(file.objectKey, Number(file.sizeBytes), signal), signal);
    if (!bytes || bytes.length !== Number(file.sizeBytes) || digest(bytes) !== file.sha256) throw new ApiError('UPLOAD_STORAGE_CORRUPT');
    await prisma.$transaction(async tx => { await ownedFile(tx, await admit(tx, authorize), reference); });
    signal.throwIfAborted();
    return bytes;
  }

  async readUrl(authorize: StorageAuthorization, reference: string, attachment = false) {
    return prisma.$transaction(async tx => {
      const authority = await admit(tx, authorize), file = await ownedFile(tx, authority, reference);
      const disposition = attachment || !file.contentType.startsWith('image/') ? 'attachment' : 'inline';
      const grant = signFileGrant({ fileId: file.id, installationId: file.installationId, ownerType: file.ownerType as 'CUSTOMER' | 'ADMIN', ownerId: file.ownerId,
        sha256: file.sha256!, generation: authority.generation.toString(), disposition }, await taskDatabaseTime(tx));
      return { url: `/api/v1/plugin-files/${file.id}?token=${encodeURIComponent(grant.token)}`, expiresAt: grant.expiresAt };
    });
  }

  async readGrant(reference: string, token: string) {
    const claims = verifyFileGrant(token);
    if (claims.fileId !== reference) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
    const authorize: StorageAuthorization = async tx => {
      if (claims.exp * 1000 <= (await taskDatabaseTime(tx)).getTime()) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
      const authority = { installationId: claims.installationId, generation: BigInt(claims.generation), principal: { type: claims.ownerType === 'ADMIN' ? 'admin' as const : 'customer' as const, id: claims.ownerId } };
      const file = await ownedFile(tx, authority, reference);
      if (file.sha256 !== claims.sha256 || !file.contentType.startsWith('image/') && claims.disposition !== 'attachment') throw new ApiError('PLUGIN_FILE_NOT_FOUND');
      return authority;
    };
    const content = await this.get(authorize, reference);
    const file = await prisma.$transaction(async tx => ownedFile(tx, await admit(tx, authorize), reference));
    return { content, contentType: file.contentType as FileType, disposition: claims.disposition };
  }

  static async purgeInstallation(tx: TaskTransaction, installationId: string, actorId: string) {
    const files = await tx.pluginFile.findMany({ where: { installationId } });
    for (const file of files) await queueCleanup(tx, file);
    await AdminAuditService.record(tx, { actorId, action: 'PLUGIN_FILES_PURGED', targetType: 'plugin', targetId: installationId, summary: { files: files.length } });
  }

  async cleanup(isStopping: () => boolean = () => false) {
    await prisma.$transaction(async tx => {
      await lockTaskScheduler(tx);
      const now = await taskDatabaseTime(tx);
      const expired = await tx.pluginFile.findMany({ where: { state: 'RESERVED', reservationExpiresAt: { lte: now } }, orderBy: { reservationExpiresAt: 'asc' }, take: 25 });
      for (const file of expired) await queueCleanup(tx, file);
    });
    for (let count = 0; count < 25 && !isStopping(); count++) {
      const claim = await prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.plugin_file_cleanup WHERE "nextAttemptAt" <= clock_timestamp() AND ("leaseUntil" IS NULL OR "leaseUntil" <= clock_timestamp()) ORDER BY "nextAttemptAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!rows.length) return null;
        const now = await taskDatabaseTime(tx);
        return tx.pluginFileCleanup.update({ where: { id: rows[0].id }, data: { claimToken: randomUUID(), leaseUntil: new Date(now.getTime() + 30_000) } });
      });
      if (!claim) break;
      let failure: string | null = null;
      try {
        const signal = AbortSignal.timeout(15_000);
        await untilAbort(this.store.delete(claim.objectKey, signal), signal);
        if (await untilAbort(this.store.head(claim.objectKey, signal), signal)) throw new ApiError('UPLOAD_STORAGE_CORRUPT');
      } catch (error) { failure = error instanceof ApiError ? error.code : 'UPLOAD_STORAGE_UNAVAILABLE'; }
      await prisma.$transaction(async tx => {
        await lockTaskScheduler(tx);
        await tx.$queryRaw`SELECT id FROM public.plugin_file_cleanup WHERE id = ${claim.id} FOR UPDATE`;
        const now = await taskDatabaseTime(tx);
        const live = await tx.pluginFileCleanup.findFirst({ where: { id: claim.id, claimToken: claim.claimToken, leaseUntil: { gt: now } } });
        if (!live) return;
        if (!failure && live.fileId) {
          const file = await tx.pluginFile.findUnique({ where: { id: live.fileId } });
          if (file) {
            await lockQuotas(tx, file.installationId, file.ownerType, file.ownerId, false);
            for (const key of [{ installationId: file.installationId, ownerType: 'INSTALLATION', ownerId: '' }, { installationId: file.installationId, ownerType: file.ownerType, ownerId: file.ownerId }]) {
              await tx.pluginStorageQuota.updateMany({ where: key, data: { reservedBytes: { decrement: file.reservedBytes }, usedBytes: { decrement: file.sizeBytes } } });
            }
            await tx.pluginFile.delete({ where: { id: file.id } });
          }
        }
        // Keep an immutable-key tombstone: cancellation cannot prevent a late remote PUT.
        await tx.pluginFileCleanup.updateMany({ where: { id: claim.id, claimToken: claim.claimToken, leaseUntil: { gt: now } }, data: {
          fileId: failure ? live.fileId : null, claimToken: null, leaseUntil: null, lastError: failure,
          attempts: Math.min(live.attempts + 1, 1_000_000),
          nextAttemptAt: new Date(now.getTime() + (failure ? Math.min(3_600_000, 1000 * 2 ** Math.min(live.attempts, 12)) : 86_400_000)),
        } });
      });
    }
  }
}

export const pluginStorage = new PluginStorageService();

export function createStorageApi(installationId: string): PluginStorage {
  const authorize = (options?: PluginStorageOptions): StorageAuthorization => {
    const hasOwner = !!options && Object.hasOwn(options, 'owner');
    const selected = options?.owner ? Object.freeze({ ...options.owner }) : options?.owner;
    const callerSignal = options?.signal;
    return async tx => {
      const scope = await assertTaskOperation(tx, installationId);
      let principal = scope.principal;
      if (hasOwner) {
        if (scope.request || scope.principal || !scope.claim) throw new ApiError('PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN');
        if (!selected || !['customer', 'admin'].includes(selected.type) || typeof selected.id !== 'string' || !selected.id || selected.id.length > 128
          || Object.keys(selected).sort().join(',') !== 'id,type') throw new ApiError('PLUGIN_TASK_PRINCIPAL_INVALID');
        await validateTaskPrincipal(tx, installationId, selected);
        principal = selected;
        await AdminAuditService.record(tx, { actorId: scope.actorId, action: 'PLUGIN_STORAGE_PRINCIPAL_BOUND', targetType: 'plugin-task', targetId: scope.claim.task.id,
          summary: { installationId, principal: { type: principal.type, id: principal.id }, claimId: scope.claim.claimId } });
      }
      if (!principal) throw new ApiError('PLUGIN_TASK_PRINCIPAL_REQUIRED');
      return { installationId, principal, generation: scope.generation,
        signal: AbortSignal.any([...(scope.signal ? [scope.signal] : []), ...(callerSignal ? [callerSignal] : [])]) };
    };
  };
  return { put: input => pluginStorage.put(authorize(input), input.content, input.contentType),
    get: (reference, options) => pluginStorage.get(authorize(options), reference),
    readUrl: (reference, options) => pluginStorage.readUrl(authorize(options), reference) };
}

export { fileUrlSecret } from './grants';
