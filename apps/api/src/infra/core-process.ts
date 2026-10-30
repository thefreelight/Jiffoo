import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';
import { coreProcessIdentity, PROCESS_REGISTRATION_LOCK_CLASS, PROCESS_REGISTRATION_LOCK_KEY } from './core-process-identity';
import { recoveryLimit, observeRecovery } from './recovery-test-control';
import { ApiError } from '@/utils/api-errors';
import { flushCompletedPluginMarkers } from '@/core/storage/completed-plugin-markers';

export const CORE_PROCESS_HEARTBEAT_MS = 10_000;
export const CORE_PROCESS_RETENTION_DAYS = 30;
/**
 * The heartbeat age after which a core process is presumed crashed.
 *
 * The window is the suspect window of the recovery sweep: a process that
 * heartbeats every ten seconds has missed three heartbeats when its row is
 * this old.
 */
export const CORE_PROCESS_SUSPECT_MS = 30_000;
/**
 * The state of a core process whose crash is suspected but not confirmed.
 *
 * The state is neither alive nor dead: the process may still be running, so
 * its execution slots keep their occupancy, and it may be gone, so its slots
 * are not released either. Only a second observation that still finds no
 * session and no heartbeat progress confirms the death.
 */
export const CORE_PROCESS_SUSPECT_STATE = 'SUSPECT';
/** The states in which a core process is observed as running. */
export const CORE_PROCESS_RUNNING_STATES = ['LIVE', 'DRAINING'];
/** The states in which a core process may still be running. */
export const CORE_PROCESS_ALIVE_STATES = [...CORE_PROCESS_RUNNING_STATES, CORE_PROCESS_SUSPECT_STATE];
/** The states in which a core process is confirmed gone. */
export const CORE_PROCESS_DEAD_STATES = ['DEAD_CONFIRMED', 'QUIESCENT'];
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
  // A suspect row keeps its observation: the heartbeat is the evidence that
  // refutes a suspicion, so a suspect process may still prove that it lives.
  await prisma.$executeRaw`UPDATE public.core_processes SET "heartbeatAt" = clock_timestamp() AT TIME ZONE 'UTC' WHERE "bootNonce" = ${bootNonce}::uuid AND state IN (${Prisma.join(CORE_PROCESS_ALIVE_STATES)})`;
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
  await prisma.coreProcess.updateMany({ where: { bootNonce: await registration, state: { in: ['LIVE', CORE_PROCESS_SUSPECT_STATE] } }, data: { state: 'DRAINING' } });
}
export async function finishCoreProcess(): Promise<void> {
  stopCoreProcessHeartbeat();
  await pending;
  if (registration) await prisma.$executeRaw`UPDATE public.core_processes SET state = 'QUIESCENT', "drainedAt" = clock_timestamp() AT TIME ZONE 'UTC', "heartbeatAt" = clock_timestamp() AT TIME ZONE 'UTC' WHERE "bootNonce" = ${await registration}::uuid AND state IN (${Prisma.join(CORE_PROCESS_ALIVE_STATES)})`;
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

/**
 * The heartbeat age after which a core process is presumed crashed.
 *
 * The window is the suspect window of the recovery sweep, so the sweep that
 * reports a suspect marker and the sweep that reclaims the slots of a crashed
 * worker share one threshold.
 */
export function coreProcessSuspectMs(): number {
  return recoveryLimit('suspectMs', CORE_PROCESS_SUSPECT_MS);
}

/**
 * The boot nonces that still hold a database session.
 *
 * A crashed process loses its sessions, and a process that is alive but
 * frozen keeps them: every session carries the boot nonce of its process in
 * the application name, so the registry tells a crashed process from a frozen
 * one without trusting the heartbeat alone.
 */
async function liveBootNonces(client: { $queryRaw: Prisma.TransactionClient['$queryRaw'] }): Promise<Set<string>> {
  const rows = await client.$queryRaw<Array<{ application_name: string | null }>>`SELECT "application_name" FROM pg_stat_activity WHERE "datname" = current_database() AND "application_name" LIKE 'jf:%'`;
  const nonces = new Set<string>();
  for (const row of rows) {
    const encoded = row.application_name?.split(':')[1];
    if (!encoded) continue;
    const hex = Buffer.from(encoded, 'base64url').toString('hex');
    if (hex.length !== 32) continue;
    nonces.add(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
  }
  return nonces;
}

/**
 * Confirm the death of the core processes that stopped heartbeating.
 *
 * A process that was killed leaves its row in state LIVE, and the execution
 * slots it owns stay occupied until an operator reclaims them by hand, so the
 * whole platform stops claiming plugin tasks.
 *
 * The death needs two observations. The first observation only marks the row
 * as suspect: PostgreSQL loses every session when it restarts, so a single
 * missing session proves nothing about the process that owned it. The second
 * observation, from a later round, confirms the death when the process still
 * holds no session and its heartbeat has not moved since the first
 * observation. A process that heartbeats or that holds a session is alive,
 * and its row returns to the live state.
 *
 * The row of the process that runs the sweep is never touched. The write
 * happens on the client the caller passes, so it stays inside the caller's
 * transaction. The core-process registry owns the `core_processes` table.
 */
export async function confirmDeadCoreProcesses(client: { $queryRaw: Prisma.TransactionClient['$queryRaw']; $executeRaw: Prisma.TransactionClient['$executeRaw'] }, suspectMs: number): Promise<Array<{ bootNonce: string; kind: string; heartbeatAt: string }>> {
  const clock = await client.$queryRaw<Array<{ now: string }>>`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "now"`;
  const observedAt = clock[0].now;
  const suspects = await client.$queryRaw<Array<{ bootNonce: string; kind: string; state: string; heartbeatAt: string; observedHeartbeatAt: string | null; observedAt: string | null; previousState: string | null }>>`SELECT p."bootNonce", p.kind, p.state, to_char(p."heartbeatAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "heartbeatAt", p."deathProof"->>'heartbeatAt' AS "observedHeartbeatAt", p."deathProof"->>'observedAt' AS "observedAt", p."deathProof"->>'previousState' AS "previousState" FROM public.core_processes p WHERE p.state = ${CORE_PROCESS_SUSPECT_STATE} AND p."bootNonce" <> ${coreProcessIdentity.bootNonce}::uuid`;
  const stale = await client.$queryRaw<Array<{ bootNonce: string; kind: string; state: string; heartbeatAt: string }>>`SELECT p."bootNonce", p.kind, p.state, to_char(p."heartbeatAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "heartbeatAt" FROM public.core_processes p WHERE p.state IN (${Prisma.join(CORE_PROCESS_RUNNING_STATES)}) AND p."bootNonce" <> ${coreProcessIdentity.bootNonce}::uuid AND p."heartbeatAt" < (clock_timestamp() AT TIME ZONE 'UTC') - ${suspectMs} * interval '1 millisecond'`;
  if (!suspects.length && !stale.length) return [];
  const live = await liveBootNonces(client);
  const confirmed: Array<{ bootNonce: string; kind: string; heartbeatAt: string }> = [];
  // The confirmation needs an earlier observation and the time in which the
  // process could have refreshed its heartbeat twice: a process that lost its
  // sessions to a restart of PostgreSQL writes its heartbeat again within one
  // interval, so two intervals of silence mean that it is gone.
  const confirmBefore = new Date(new Date(observedAt).getTime() - Math.min(2 * CORE_PROCESS_HEARTBEAT_MS, suspectMs)).toISOString();
  for (const row of suspects) {
    if (live.has(row.bootNonce) || row.heartbeatAt !== row.observedHeartbeatAt) {
      // The process holds a session or refreshed its heartbeat: it is alive,
      // and the suspicion is refuted.
      const previous = row.previousState === 'DRAINING' ? 'DRAINING' : 'LIVE';
      await client.$executeRaw`UPDATE public.core_processes SET state = ${previous}, "deathProof" = NULL WHERE "bootNonce" = ${row.bootNonce}::uuid AND state = ${CORE_PROCESS_SUSPECT_STATE}`;
      console.warn(JSON.stringify({ event: 'core_process_suspect_refuted', bootNonce: row.bootNonce, kind: row.kind }));
      continue;
    }
    if (!row.observedAt || row.observedAt > confirmBefore) continue;
    await client.$executeRaw`UPDATE public.core_processes SET state = 'DEAD_CONFIRMED', "deathConfirmedAt" = clock_timestamp() AT TIME ZONE 'UTC', "deathProof" = ${JSON.stringify({ source: 'heartbeat-timeout-confirmed', suspectMs, observedAt: row.observedAt, heartbeatAt: row.heartbeatAt })}::jsonb WHERE "bootNonce" = ${row.bootNonce}::uuid AND state = ${CORE_PROCESS_SUSPECT_STATE}`;
    console.warn(JSON.stringify({ event: 'core_process_death_confirmed', bootNonce: row.bootNonce, kind: row.kind, suspectMs }));
    confirmed.push({ bootNonce: row.bootNonce, kind: row.kind, heartbeatAt: row.heartbeatAt });
  }
  // The first observation marks a process as suspect: it is not dead yet.
  for (const row of stale) {
    if (live.has(row.bootNonce)) continue;
    await client.$executeRaw`UPDATE public.core_processes SET state = ${CORE_PROCESS_SUSPECT_STATE}, "deathProof" = ${JSON.stringify({ source: 'heartbeat-timeout-suspect', suspectMs, observedAt, heartbeatAt: row.heartbeatAt, previousState: row.state })}::jsonb WHERE "bootNonce" = ${row.bootNonce}::uuid AND state IN (${Prisma.join(CORE_PROCESS_RUNNING_STATES)})`;
    console.warn(JSON.stringify({ event: 'core_process_suspect', bootNonce: row.bootNonce, kind: row.kind, suspectMs }));
  }
  return confirmed;
}

/**
 * Prune the process rows that outlived their retention window and that no live
 * plugin work still references. The write happens on the client the caller
 * passes, so it stays inside the caller's transaction. The core-process
 * registry owns the `core_processes` table.
 */
export async function pruneCoreProcesses(client: { $executeRaw: Prisma.TransactionClient['$executeRaw'] }, limit: number): Promise<number> {
  return client.$executeRaw`DELETE FROM public.core_processes p WHERE p."bootNonce" IN (SELECT c."bootNonce" FROM public.core_processes c WHERE c.state IN ('QUIESCENT','DEAD_CONFIRMED') AND coalesce(c."deathConfirmedAt", c."drainedAt") < (clock_timestamp() AT TIME ZONE 'UTC') - ${CORE_PROCESS_RETENTION_DAYS} * interval '1 day' AND NOT EXISTS(SELECT 1 FROM public.plugin_operation_leases l WHERE l."ownerBootNonce" = c."bootNonce") AND NOT EXISTS(SELECT 1 FROM public.plugin_migration_operations o WHERE o."ownerBootNonce" = c."bootNonce") AND NOT EXISTS(SELECT 1 FROM public.plugin_tasks t WHERE t."claimedByBootNonce" = c."bootNonce") AND NOT EXISTS(SELECT 1 FROM public.plugin_task_execution_slots s WHERE s."bootNonce" = c."bootNonce") ORDER BY c."bootNonce" LIMIT ${limit})`;
}
