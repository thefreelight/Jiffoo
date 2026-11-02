import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import type { ServiceResult } from '@jiffoo/shared';

/**
 * The durable service call ledger of the core-mediated plugin service contract.
 *
 * A method that requires an idempotent outcome is recorded before the provider
 * is invoked, so a replay never produces a second effect. The row's primary key
 * is the stable call ID: the provider deduplicates on the same identifier in
 * its own transaction, and this ledger settles the same operation.
 *
 * The row moves through RUNNING to SUCCEEDED or FAILED. A timeout or a crash
 * leaves it UNKNOWN, because the effect may still have committed. An UNKNOWN
 * row is settled by an exclusive reconciliation claim, never by a blind retry:
 * the caller repeats the same method with the same input and the same key, and
 * the provider either returns the original outcome or proves that it never
 * executed.
 */

/** The status of one ledger row. */
export type ServiceCallStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

/** The grace a running invocation gets before its row counts as abandoned. */
export const SERVICE_CALL_ABANDON_GRACE_MS = 30_000;

export interface ServiceCallIdentity {
  callerInstallationId: string;
  providerInstallationId: string;
  service: string;
  version: number;
  method: string;
  idempotencyKey: string;
}

export interface ServiceCallClaimInput extends ServiceCallIdentity {
  input: unknown;
  callerSlug: string;
  providerSlug: string;
  callerGeneration: bigint;
  providerGeneration: bigint;
  principalType: string | null;
  principalId: string | null;
  timeoutMs: number;
}

export interface ServiceCallRow {
  id: string;
  status: ServiceCallStatus;
  inputHash: string;
  response: unknown;
  safeError: unknown;
  callerGeneration: bigint;
  providerGeneration: bigint;
  principalType: string | null;
  principalId: string | null;
  deadlineAt: Date;
  reconciliationSequence: number;
}

/** The ownership of an invocation. The token keeps a stale completion out. */
export interface ServiceCallHandle {
  mode: 'execute' | 'reconcile';
  callId: string;
  token: string;
  row: ServiceCallRow;
}

export type ServiceCallClaim =
  | { kind: 'execute'; handle: ServiceCallHandle }
  | { kind: 'replay'; row: ServiceCallRow; result: ServiceResult<unknown> }
  | { kind: 'in-progress'; row: ServiceCallRow }
  | { kind: 'conflict'; row: ServiceCallRow };

interface LedgerRowShape {
  id: string;
  status: string;
  inputHash: string;
  response: unknown;
  safeError: unknown;
  callerGeneration: bigint;
  providerGeneration: bigint;
  principalType: string | null;
  principalId: string | null;
  deadlineAt: Date;
  reconciliationSequence: number;
}

/** The canonical form of an input, so an equal input has an equal hash. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const entries = Object.keys(source).sort().map(key => [key, canonicalize(source[key])] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

/** The hash of a call input. Two equal inputs hash equally, in any key order. */
export function serviceInputHash(input: unknown): string {
  const canonical = JSON.stringify(canonicalize(input));
  return createHash('sha256').update(canonical ?? 'null', 'utf8').digest('hex');
}

function toRow(shape: LedgerRowShape): ServiceCallRow {
  return {
    id: shape.id,
    status: shape.status as ServiceCallStatus,
    inputHash: shape.inputHash,
    response: shape.response,
    safeError: shape.safeError,
    callerGeneration: BigInt(shape.callerGeneration),
    providerGeneration: BigInt(shape.providerGeneration),
    principalType: shape.principalType,
    principalId: shape.principalId,
    deadlineAt: shape.deadlineAt,
    reconciliationSequence: Number(shape.reconciliationSequence),
  };
}

/**
 * Claims a service call.
 *
 * The unique identity of the call is the caller and the provider installation,
 * the method and the idempotency key. An equal key with an equal input hash
 * returns the stored outcome, a different input hash is a conflict, and a call
 * that is already running is in progress.
 */
export async function claimServiceCall(input: ServiceCallClaimInput): Promise<ServiceCallClaim> {
  const inputHash = serviceInputHash(input.input);
  const callId = randomUUID();
  const token = randomUUID();
  const deadlineAt = new Date(Date.now() + input.timeoutMs + SERVICE_CALL_ABANDON_GRACE_MS);

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO plugin_service_calls
        (id, "callerInstallationId", "callerSlug", "providerInstallationId", "providerSlug",
         service, version, method, "idempotencyKey", "inputHash", status,
         "callerGeneration", "providerGeneration", "principalType", "principalId",
         "claimToken", "deadlineAt", "reconciliationSequence", "createdAt", "updatedAt")
      VALUES
        (${callId}, ${input.callerInstallationId}, ${input.callerSlug},
         ${input.providerInstallationId}, ${input.providerSlug},
         ${input.service}, ${input.version}, ${input.method}, ${input.idempotencyKey}, ${inputHash}, 'RUNNING',
         ${input.callerGeneration.toString()}::bigint, ${input.providerGeneration.toString()}::bigint,
         ${input.principalType}, ${input.principalId},
         ${token}::uuid, ${deadlineAt}, 0, now(), now())
      ON CONFLICT ("callerInstallationId", "providerInstallationId", service, version, method, "idempotencyKey")
      DO NOTHING
      RETURNING id`;
    if (inserted.length) {
      const row: ServiceCallRow = {
        id: callId,
        status: 'RUNNING',
        inputHash,
        response: null,
        safeError: null,
        callerGeneration: input.callerGeneration,
        providerGeneration: input.providerGeneration,
        principalType: input.principalType,
        principalId: input.principalId,
        deadlineAt,
        reconciliationSequence: 0,
      };
      return { kind: 'execute', handle: { mode: 'execute', callId, token, row } };
    }

    const rows = await tx.$queryRaw<Array<LedgerRowShape>>`
      SELECT c.id AS id, c.status AS status, c."inputHash" AS "inputHash", c.response AS response,
        c."safeError" AS "safeError", c."callerGeneration" AS "callerGeneration",
        c."providerGeneration" AS "providerGeneration", c."principalType" AS "principalType",
        c."principalId" AS "principalId", c."deadlineAt" AS "deadlineAt",
        c."reconciliationSequence" AS "reconciliationSequence"
      FROM plugin_service_calls c
      WHERE c."callerInstallationId" = ${input.callerInstallationId}
        AND c."providerInstallationId" = ${input.providerInstallationId}
        AND c.service = ${input.service}
        AND c.version = ${input.version}
        AND c.method = ${input.method}
        AND c."idempotencyKey" = ${input.idempotencyKey}
      FOR UPDATE`;
    const found = rows[0];
    if (!found) throw new Error('The service call ledger lost its row');
    const row = toRow(found);

    if (row.inputHash !== inputHash) return { kind: 'conflict', row };
    if (row.status === 'SUCCEEDED' || row.status === 'FAILED') {
      return { kind: 'replay', row, result: row.response as ServiceResult<unknown> };
    }
    if (row.status === 'RUNNING') {
      if (row.deadlineAt.getTime() > Date.now()) return { kind: 'in-progress', row };
      // The owning invocation is gone and its outcome is unknown. The row
      // becomes reconcilable instead of running forever.
      await tx.$executeRaw`
        UPDATE plugin_service_calls SET status = 'UNKNOWN', "updatedAt" = now()
        WHERE id = ${row.id} AND status = 'RUNNING'`;
      row.status = 'UNKNOWN';
    }
    if (row.status === 'UNKNOWN') {
      const reconcileDeadline = new Date(Date.now() + input.timeoutMs + SERVICE_CALL_ABANDON_GRACE_MS);
      const claimed = await tx.$queryRaw<Array<{ sequence: number }>>`
        UPDATE plugin_service_calls
        SET "reconciliationClaimToken" = ${token}::uuid,
          "reconciliationDeadlineAt" = ${reconcileDeadline},
          "reconciliationSequence" = "reconciliationSequence" + 1,
          "updatedAt" = now()
        WHERE id = ${row.id} AND status = 'UNKNOWN'
          AND ("reconciliationClaimToken" IS NULL OR "reconciliationDeadlineAt" < now())
        RETURNING "reconciliationSequence" AS sequence`;
      if (!claimed.length) return { kind: 'in-progress', row };
      return {
        kind: 'execute',
        handle: { mode: 'reconcile', callId: row.id, token, row },
      };
    }
    return { kind: 'in-progress', row };
  });
}

/**
 * Settles a claimed call. A success and a durable business rejection are
 * terminal outcomes; a Core refusal is not, and leaves the row unknown.
 *
 * The answer is whether the row was settled. A lost claim means that another
 * caller owns the row now, so the outcome must not be published as settled.
 */
export async function settleServiceCall(handle: ServiceCallHandle, result: ServiceResult<unknown>): Promise<boolean> {
  const status = result.ok ? 'SUCCEEDED' : 'FAILED';
  const response = JSON.stringify(result);
  if (handle.mode === 'execute') {
    const updated = await prisma.$executeRaw`
      UPDATE plugin_service_calls
      SET status = ${status}, response = ${response}::jsonb, "safeError" = NULL, "updatedAt" = now()
      WHERE id = ${handle.callId} AND status = 'RUNNING' AND "claimToken" = ${handle.token}::uuid`;
    return updated > 0;
  }
  const updated = await prisma.$executeRaw`
    UPDATE plugin_service_calls
    SET status = ${status}, response = ${response}::jsonb, "safeError" = NULL,
      "reconciliationClaimToken" = NULL, "reconciliationDeadlineAt" = NULL, "updatedAt" = now()
    WHERE id = ${handle.callId} AND status = 'UNKNOWN' AND "reconciliationClaimToken" = ${handle.token}::uuid`;
  return updated > 0;
}

/**
 * Releases a claim of a call that never ran. The row of a first execution is
 * removed, so the next caller is not told that the call is in progress. An
 * unknown row keeps its claim and its deadline: the outcome stays unknown.
 */
export async function releaseServiceCallClaim(handle: ServiceCallHandle): Promise<void> {
  if (handle.mode !== 'execute') return;
  await prisma.$executeRaw`
    DELETE FROM plugin_service_calls
    WHERE id = ${handle.callId} AND status = 'RUNNING' AND "claimToken" = ${handle.token}::uuid`;
}

/**
 * Leaves the outcome of a call unknown. The effect may still have committed, so
 * the row is never settled as a failure.
 */
export async function markServiceCallUnknown(handle: ServiceCallHandle, safeError: { code: string; message: string }): Promise<void> {
  const reason = JSON.stringify({ code: safeError.code, message: safeError.message });
  if (handle.mode === 'execute') {
    await prisma.$executeRaw`
      UPDATE plugin_service_calls
      SET status = 'UNKNOWN', "safeError" = ${reason}::jsonb, "updatedAt" = now()
      WHERE id = ${handle.callId} AND status = 'RUNNING' AND "claimToken" = ${handle.token}::uuid`;
    return;
  }
  await prisma.$executeRaw`
    UPDATE plugin_service_calls
    SET "safeError" = ${reason}::jsonb, "updatedAt" = now()
    WHERE id = ${handle.callId} AND status = 'UNKNOWN' AND "reconciliationClaimToken" = ${handle.token}::uuid`;
}

/**
 * Fences a proven non-execution. The provider proved that it committed no
 * effect, so the row returns to RUNNING once and the normal invocation runs
 * with the same call ID.
 */
export async function fenceNotExecuted(handle: ServiceCallHandle, timeoutMs: number): Promise<ServiceCallHandle | null> {
  if (handle.mode !== 'reconcile') return null;
  const token = randomUUID();
  const deadlineAt = new Date(Date.now() + timeoutMs + SERVICE_CALL_ABANDON_GRACE_MS);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE plugin_service_calls
    SET status = 'RUNNING', "claimToken" = ${token}::uuid, "deadlineAt" = ${deadlineAt},
      "reconciliationClaimToken" = NULL, "reconciliationDeadlineAt" = NULL, "updatedAt" = now()
    WHERE id = ${handle.callId} AND status = 'UNKNOWN' AND "reconciliationClaimToken" = ${handle.token}::uuid
    RETURNING id`;
  if (!rows.length) return null;
  return { mode: 'execute', callId: handle.callId, token, row: handle.row };
}
