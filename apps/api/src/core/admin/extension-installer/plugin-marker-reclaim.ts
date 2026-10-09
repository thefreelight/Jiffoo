import type { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { PROCESS_REGISTRATION_LOCK_CLASS, PROCESS_REGISTRATION_LOCK_KEY } from '@/infra/core-process-identity';
import { assertRecoveryTestControl } from './plugin-recovery-test-control';

export type CompleteStopEvidence = { version: 1; requestId: string; actorId: string; reason: string; composeFile: string; project: string; coreServices: string[]; boots: Array<{ bootNonce: string; containerId: string }> };
export type RecordedBoot = { bootNonce: string; hostname: string; databaseRole: string };
export class MarkerReclaimError extends Error { readonly code = 'PLUGIN_MIGRATION_RECOVERY_REQUIRED'; }
export async function reclaimInvocationMarkers(client: Client, evidence: CompleteStopEvidence, verify: (boots: RecordedBoot[], evidence: CompleteStopEvidence) => Promise<void>, testSchema?: string) {
  let schema = 'public';
  if (testSchema !== undefined) {
    assertRecoveryTestControl();
    if (!/^test_reclaim_[a-z0-9_]+$/.test(testSchema) || (await client.query('SELECT current_database() AS name')).rows[0].name !== 'jiffoo_core_test') throw new MarkerReclaimError('Unsafe recovery fixture schema');
    schema = testSchema;
  }
  const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (evidence.version !== 1 || !validUuid(evidence.requestId) || !evidence.actorId?.trim() || !evidence.reason?.trim()
    || !Array.isArray(evidence.boots) || evidence.boots.some(boot => !validUuid(boot.bootNonce))) throw new MarkerReclaimError('Complete stop evidence is required');
  const digest = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'"); await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)', [PROCESS_REGISTRATION_LOCK_CLASS, PROCESS_REGISTRATION_LOCK_KEY]);
    const prior = await client.query(`SELECT summary FROM "${schema}".admin_audit_events WHERE action = $1 AND "targetType" = $2 AND "targetId" = $3`, ['PLUGIN_MARKERS_RECLAIMED', 'core-process-recovery', evidence.requestId]);
    if (prior.rows.length) {
      if (prior.rows[0].summary.evidenceDigest !== digest) throw new MarkerReclaimError('Request identity was reused with different evidence');
      await client.query('COMMIT'); return { reclaimed: prior.rows[0].summary.reclaimed as number, alreadyApplied: true };
    }
    const boots = (await client.query<RecordedBoot>(`SELECT "bootNonce", hostname, "databaseRole" FROM "${schema}".core_processes ORDER BY "bootNonce" FOR UPDATE`)).rows;
    const supplied = evidence.boots.map(boot => boot.bootNonce).sort(), expected = boots.map(boot => boot.bootNonce).sort();
    if (JSON.stringify(supplied) !== JSON.stringify(expected)) throw new MarkerReclaimError('Evidence must cover every recorded boot exactly once');
    await verify(boots, evidence);
    // Registered Core sessions have enforced boot names. Role checks also cover
    // anonymous markers whose owner cannot be reconstructed from old rows.
    const roles = [...new Set(boots.map(boot => boot.databaseRole))];
    const sessions = await client.query('SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND (application_name LIKE $1 OR usename = ANY($2::text[]) OR usename = session_user)', ['jf:%', roles]);
    if (sessions.rows.length) throw new MarkerReclaimError('Core database sessions are still present; no markers were reclaimed');
    const privilege = await client.query("SELECT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) OR pg_has_role(current_user, 'pg_read_all_stats', 'MEMBER') OR $1::text[] <@ ARRAY[current_user::text] AS visible", [roles]);
    if (!privilege.rows[0].visible) throw new MarkerReclaimError('Database session visibility is insufficient');
    const removed = await client.query(`DELETE FROM "${schema}".plugin_operation_leases WHERE operation LIKE $1 RETURNING slug, token, "ownerBootNonce"`, ['plugin-invocation:%']);
    await client.query(`UPDATE "${schema}".core_processes SET state = 'DEAD_CONFIRMED', "deathConfirmedAt" = clock_timestamp() AT TIME ZONE 'UTC', "deathProof" = $1::jsonb`, [JSON.stringify({ requestId: evidence.requestId, actorId: evidence.actorId, evidenceDigest: digest })]);
    await client.query(`INSERT INTO "${schema}".admin_audit_events (id,"actorId",action,"targetType","targetId",summary,"createdAt") VALUES($1,$2,$3,$4,$5,$6::jsonb,clock_timestamp() AT TIME ZONE 'UTC')`, [randomUUID(), evidence.actorId, 'PLUGIN_MARKERS_RECLAIMED', 'core-process-recovery', evidence.requestId, JSON.stringify({ evidenceDigest: digest, reason: evidence.reason, boots: evidence.boots, reclaimed: removed.rowCount, markers: removed.rows })]);
    await client.query('COMMIT'); return { reclaimed: removed.rowCount!, alreadyApplied: false };
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
}
