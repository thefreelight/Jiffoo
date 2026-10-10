import { prisma } from '@/config/database';
import { coreProcessIdentity, PROCESS_REGISTRATION_LOCK_CLASS, PROCESS_REGISTRATION_LOCK_KEY } from './core-process-identity';
import { recoveryLimit, observeRecovery } from '@/core/admin/extension-installer/plugin-recovery-test-control';
import { ApiError } from '@/utils/api-errors';
import { flushCompletedPluginMarkers } from '@/core/storage/completed-plugin-markers';

export const CORE_PROCESS_HEARTBEAT_MS = 10_000;
export const CORE_PROCESS_RETENTION_DAYS = 30;
let registration: Promise<string> | undefined;
let heartbeat: NodeJS.Timeout | undefined;
let pending: Promise<unknown> | undefined;
export function coreProcessState() {
  return { registered: registration !== undefined, heartbeatRunning: heartbeat !== undefined, heartbeatPending: pending !== undefined };
}
export function ensureCoreProcess(kind: 'api' | 'worker' = 'api'): Promise<string> {
  return registration ??= prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${PROCESS_REGISTRATION_LOCK_CLASS}::integer, ${PROCESS_REGISTRATION_LOCK_KEY}::integer)`;
    const roles = await tx.$queryRaw<Array<{ role: string }>>`SELECT session_user AS role`;
    const old = await tx.coreProcess.findUnique({ where: { bootNonce: coreProcessIdentity.bootNonce } });
    if (old?.state === 'DEAD_CONFIRMED') throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
    await tx.coreProcess.upsert({ where: { bootNonce: coreProcessIdentity.bootNonce }, create: { ...coreProcessIdentity, kind, databaseRole: roles[0].role }, update: { state: 'LIVE', drainedAt: null } });
    console.info(JSON.stringify({ event: 'core-process-started', ...coreProcessIdentity, kind }));
    return coreProcessIdentity.bootNonce;
  }).catch(error => { registration = undefined; throw error; });
}
export async function heartbeatCoreProcess(): Promise<void> {
  const bootNonce = await ensureCoreProcess();
  await prisma.$executeRaw`UPDATE public.core_processes SET "heartbeatAt" = clock_timestamp() AT TIME ZONE 'UTC' WHERE "bootNonce" = ${bootNonce}::uuid AND state IN ('LIVE', 'DRAINING')`;
  observeRecovery('heartbeat', bootNonce);
  await flushCompletedPluginMarkers();
}
export async function startCoreProcess(kind: 'api' | 'worker'): Promise<void> {
  await ensureCoreProcess(kind); await heartbeatCoreProcess();
  if (!heartbeat) heartbeat = setInterval(() => {
    if (pending) return;
    pending = heartbeatCoreProcess().catch(() => undefined).finally(() => { pending = undefined; });
  }, recoveryLimit('heartbeatMs', CORE_PROCESS_HEARTBEAT_MS));
}
export async function drainCoreProcess(): Promise<void> {
  if (!registration) return;
  await prisma.coreProcess.updateMany({ where: { bootNonce: await registration, state: 'LIVE' }, data: { state: 'DRAINING' } });
}
export async function finishCoreProcess(): Promise<void> {
  stopCoreProcessHeartbeat();
  await pending;
  if (registration) await prisma.$executeRaw`UPDATE public.core_processes SET state = 'QUIESCENT', "drainedAt" = clock_timestamp() AT TIME ZONE 'UTC', "heartbeatAt" = clock_timestamp() AT TIME ZONE 'UTC' WHERE "bootNonce" = ${await registration}::uuid AND state IN ('LIVE','DRAINING')`;
  registration = undefined;
}
/** Deadline shutdown leaves DRAINING intact and must not await a stuck heartbeat. */
export function stopCoreProcessHeartbeat(): void {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = undefined;
}
export async function drainCoreProcessHeartbeat(): Promise<void> {
  stopCoreProcessHeartbeat();
  await pending;
}
