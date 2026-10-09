import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Client } from 'pg';
import { getPluginManifestIssues, type PluginManifest, type PluginMigrationDeclaration, readPluginZipEntries, PLUGIN_MAX_ZIP_SIZE, validatePluginMigrations, pluginSchemaName } from 'shared/plugin-signing';

export const PLUGIN_DATABASE_AUDIT_CODES = [
  'PLUGIN_DB_LEDGER_MISMATCH', 'PLUGIN_DB_LEDGER_INCOMPLETE', 'PLUGIN_DB_PENDING_UPGRADE_LEDGER',
  'PLUGIN_DB_NAMESPACE_MISMATCH', 'PLUGIN_DB_NAMESPACE_CLAIM_MISSING', 'PLUGIN_DB_UNCLAIMED_SCHEMA',
  'PLUGIN_DB_OPERATION_INCOMPLETE', 'PLUGIN_DB_RECOVERY_REQUIRED', 'PLUGIN_DB_ATTEMPT_UNKNOWN',
  'PLUGIN_DB_INVOCATION_MARKER_PRESENT', 'PLUGIN_DB_CANDIDATE_BYTES_MISSING', 'PLUGIN_DB_CANDIDATE_BYTES_RETAINED',
  'PLUGIN_DB_PACKAGE_BLOB_MISSING', 'PLUGIN_DB_PACKAGE_BLOB_INVALID', 'PLUGIN_DB_RETAINED_NAMESPACE',
  'PLUGIN_DB_SCHEMA_INCOMPLETE', 'PLUGIN_DB_AUDIT_LIMIT_REACHED',
] as const;
type Code = typeof PLUGIN_DATABASE_AUDIT_CODES[number];
export type PluginDatabaseAuditFinding = { code: Code; severity: 'blocking' | 'warning'; slug: string | null; operationId?: string; evidence: Record<string, unknown> };
export type PluginDatabaseAuditReport = {
  reportVersion: 1; scope: 'plugin-database-integrity'; startedAt: string; finishedAt: string; complete: boolean;
  database: { name: string | null; schemaState: 'current' | 'incomplete' | 'unknown' };
  processQuiescence: { proven: false; authority: 'caller' };
  counts: { plugins: number; blocking: number; warning: number }; findings: PluginDatabaseAuditFinding[];
};
const REQUIRED_COLUMNS: Record<string, string[]> = {
  _prisma_migrations: ['migration_name', 'finished_at', 'rolled_back_at'],
  plugin_installs: ['slug', 'version', 'zipHash', 'manifestJson', 'deletedAt'],
  plugin_package_blobs: ['pluginSlug', 'zipHash', 'bytes', 'sizeBytes'],
  plugin_namespaces: ['id', 'slug', 'schemaName', 'provisionedAt'],
  plugin_migration_successes: ['namespaceId', 'order', 'migrationId', 'path', 'sha256', 'manifestDigest', 'operationId'],
  plugin_migration_operations: ['id', 'slug', 'packageHash', 'packageVersion', 'manifestDigest', 'manifest', 'declarations', 'phase', 'committedPrefix', 'artifactBytes', 'ownerBootNonce'],
  plugin_migration_attempts: ['id', 'operationId', 'status', 'endedAt', 'resolution'],
  plugin_operation_leases: ['slug', 'token', 'operation', 'expiresAt', 'ownerBootNonce'],
  core_processes: ['bootNonce', 'state', 'heartbeatAt', 'deathConfirmedAt'],
};
const REQUIRED_MIGRATIONS = [
  '20260922000000_baseline', '20260923000000_remove_plugin_service_token',
  '20260923010000_checkout_contract_totals_and_payment_action', '20260923020000_notifications',
  '20260923030000_session_version', '20260924000000_plugin_failure_record',
  '20260924010000_category_translations', '20260925000000_plugin_trust_level',
  '20260926000000_auth_tokens', '20260927000000_cart_current_prices',
  '20260928000000_order_state_machine', '20260928000100_remove_admin_memberships',
  '20260928000200_theme_package', '20260928000300_theme_runtime', '20260928061848_storefront_code',
  '20260929064819_order_purchase_claim', '20260929153831_durable_plugin_events',
  '20260930142521_plugin_publisher_identity', '20261001103300_plugin_package_blobs_and_leases',
  '20261002060650_plugin_signing_root', '20261004183349_plugin_protection_generation',
  '20261007113319_theme_package_blobs', '20261008050115_plugin_migrations', '20261009092955_core_process_recovery',
];
const DEFAULT_LIMITS = { rows: 10_000, bytes: 128 * 1024 * 1024, totalMs: 60_000, statementMs: 10_000, lockMs: 1_000 };
let testLimits: Partial<typeof DEFAULT_LIMITS> | undefined;
let testSchema: string | undefined;
/** Explicit test-only hook; production callers cannot shorten or relax limits. */
export function setPluginDatabaseAuditTestLimits(enabled: boolean, limits?: Partial<typeof DEFAULT_LIMITS>, schema?: string): void {
  if (process.env.NODE_ENV !== 'test' || !enabled) throw new Error('Audit test controls require an explicit test switch');
  if (limits && Object.entries(limits).some(([key, value]) => !(key in DEFAULT_LIMITS) || !Number.isInteger(value) || value! < 1 || value! > DEFAULT_LIMITS[key as keyof typeof DEFAULT_LIMITS])) throw new Error('Invalid audit test limit');
  testLimits = limits;
  if (schema !== undefined && !/^audit_test_[a-z0-9_]+$/.test(schema)) throw new Error('Invalid audit fixture schema');
  testSchema = schema;
}
class AuditLimit extends Error {}
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const terminal = new Set(['SUCCESS', 'FAILED', 'NEEDS_RECOVERY', 'RECOVERED']);
function declarationsMatch(ledger: any[], declarations: PluginMigrationDeclaration[]): boolean {
  return ledger.every((row, index) => {
    const item = declarations[index];
    return item && row.order === index + 1 && item.order === row.order && item.id === row.migrationId && item.path === row.path && item.sha256 === row.sha256;
  });
}
function inspectPackage(bytes: Buffer, hash: string, slug: string, version: string) {
  if (bytes.length > PLUGIN_MAX_ZIP_SIZE || digest(bytes) !== hash) throw new Error('Package identity mismatch');
  const entries = readPluginZipEntries(bytes, true);
  const topFolders = new Set(entries.map(entry => entry.path.split('/')[0]).filter(name => !name.startsWith('.') && name !== '__MACOSX'));
  const wrapped = entries.filter(entry => /^[^/]+\/manifest\.json$/.test(entry.path));
  const entry = entries.find(item => item.path === 'manifest.json') ?? (topFolders.size === 1 && wrapped.length === 1 ? wrapped[0] : undefined);
  if (!entry) throw new Error('Manifest missing');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entry.content)) as PluginManifest;
  if (getPluginManifestIssues(manifest).length || manifest.slug !== slug || manifest.version !== version) throw new Error('Manifest identity mismatch');
  const root = entry.path.slice(0, -'manifest.json'.length);
  const files = entries.filter(item => !item.path.endsWith('/')).map(item => ({ ...item, path: root && item.path.startsWith(root) ? item.path.slice(root.length) : item.path }));
  return { manifest, declarations: validatePluginMigrations(manifest.database, files), manifestDigest: digest(entry.content) };
}

/** Snapshot-only inspection on a dedicated idle session owned and closed by the caller. */
export async function auditPluginDatabase(client: Pick<Client, 'query'>): Promise<PluginDatabaseAuditReport> {
  const started = Date.now(), limits = { ...DEFAULT_LIMITS, ...testLimits };
  if ((testLimits || testSchema) && process.env.NODE_ENV !== 'test') throw new Error('Audit test controls are not permitted outside tests');
  const coreSchema = testSchema ?? 'public';
  const report: PluginDatabaseAuditReport = {
    reportVersion: 1, scope: 'plugin-database-integrity', startedAt: new Date(started).toISOString(), finishedAt: '', complete: false,
    database: { name: null, schemaState: 'unknown' }, processQuiescence: { proven: false, authority: 'caller' },
    counts: { plugins: 0, blocking: 0, warning: 0 }, findings: [],
  };
  let bytesRead = 0, begun = false;
  const finding = (code: Code, slug: string | null, evidence: Record<string, unknown>, operationId?: string) => {
    if (report.findings.length >= limits.rows) throw new AuditLimit();
    report.findings.push({ code, severity: code === 'PLUGIN_DB_RETAINED_NAMESPACE' || code === 'PLUGIN_DB_CANDIDATE_BYTES_RETAINED' ? 'warning' : 'blocking', slug, ...(operationId ? { operationId } : {}), evidence });
  };
  const query = async (sql: string, values?: unknown[]) => {
    if (Date.now() - started >= limits.totalMs) throw new AuditLimit();
    const result = await client.query(sql.replaceAll('public.', `${coreSchema}.`).replaceAll("n.nspname = 'public'", `n.nspname = '${coreSchema}'`), values);
    if (result.rows.length > limits.rows || Date.now() - started >= limits.totalMs) throw new AuditLimit();
    return result.rows;
  };
  const bounded = (sql: string) => query(`${sql} LIMIT ${limits.rows + 1}`);
  const consume = (bytes: Buffer) => { bytesRead += bytes.length; if (bytesRead > limits.bytes) throw new AuditLimit(); };
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); begun = true;
    await client.query("SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true)", [`${limits.statementMs}ms`, `${limits.lockMs}ms`]);
    report.database.name = (await query('SELECT current_database() AS name'))[0].name;
    const columns = await bounded("SELECT c.relname AS table, a.attname AS column FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid WHERE n.nspname = 'public' AND c.relname = ANY(ARRAY['" + Object.keys(REQUIRED_COLUMNS).join("','") + "']) AND a.attnum > 0 AND NOT a.attisdropped");
    const missing = Object.entries(REQUIRED_COLUMNS).flatMap(([table, names]) => names.filter(column => !columns.some(row => row.table === table && row.column === column)).map(column => `${table}.${column}`));
    if (missing.length) {
      report.database.schemaState = 'incomplete'; finding('PLUGIN_DB_SCHEMA_INCOMPLETE', null, { missing });
    } else {
      const migrations = await bounded('SELECT migration_name, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name');
      const appliedMigrations = migrations.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name);
      if (appliedMigrations.length !== REQUIRED_MIGRATIONS.length || REQUIRED_MIGRATIONS.some(name => !appliedMigrations.includes(name)) || migrations.some(row => !row.finished_at && !row.rolled_back_at)) {
        report.database.schemaState = 'incomplete'; finding('PLUGIN_DB_SCHEMA_INCOMPLETE', null, { reason: 'migration-state' });
      } else {
        report.database.schemaState = 'current';
        const metadataSize = await query('SELECT (SELECT COALESCE(sum(octet_length("manifestJson"::text)), 0) FROM public.plugin_installs) + (SELECT COALESCE(sum(octet_length(manifest::text) + octet_length(declarations::text)), 0) FROM public.plugin_migration_operations) AS bytes');
        bytesRead = Number(metadataSize[0].bytes);
        if (!Number.isSafeInteger(bytesRead) || bytesRead > limits.bytes) throw new AuditLimit();
        const plugins = await bounded('SELECT slug, version, "zipHash", "manifestJson", "deletedAt" FROM public.plugin_installs ORDER BY slug');
        const namespaces = await bounded('SELECT id, slug, "schemaName", "provisionedAt" FROM public.plugin_namespaces ORDER BY slug');
        const ledger = await bounded('SELECT "namespaceId", "order", "migrationId", path, sha256, "manifestDigest", "operationId" FROM public.plugin_migration_successes ORDER BY "namespaceId", "order"');
        const operations = await bounded('SELECT id, slug, "packageHash", "packageVersion", "manifestDigest", manifest, declarations, phase, "committedPrefix", octet_length("artifactBytes") AS "artifactSize" FROM public.plugin_migration_operations ORDER BY slug, id');
        const attempts = await bounded('SELECT id, "operationId", status, "endedAt", resolution FROM public.plugin_migration_attempts ORDER BY id');
        const markers = await bounded("SELECT slug, token, operation, \"expiresAt\" FROM public.plugin_operation_leases WHERE operation LIKE 'plugin-invocation:%' ORDER BY slug");
        const schemas = await bounded("SELECT nspname FROM pg_catalog.pg_namespace WHERE left(nspname, 7) = 'plugin_' ORDER BY nspname");
        report.counts.plugins = plugins.filter(row => !row.deletedAt).length;
        const operationById = new Map(operations.map(row => [row.id, row]));
        const namespaceById = new Map(namespaces.map(row => [row.id, row]));
        // Historical declarations remain authoritative after purge; historical ZIPs are not required.
        for (const row of ledger) {
          const namespace = namespaceById.get(row.namespaceId), operation = operationById.get(row.operationId);
          const declared = Array.isArray(operation?.declarations) ? operation.declarations[row.order - 1] : undefined;
          if (!namespace || !operation || namespace.slug !== operation.slug || !declared
            || declared.id !== row.migrationId || declared.order !== row.order || declared.path !== row.path
            || declared.sha256 !== row.sha256 || operation.manifestDigest !== row.manifestDigest
            || !Number.isInteger(operation.committedPrefix) || row.order > operation.committedPrefix) {
            finding('PLUGIN_DB_LEDGER_MISMATCH', namespace?.slug ?? operation?.slug ?? null, { reason: 'operation-declaration', order: row.order }, row.operationId);
          }
        }
        for (const operation of operations.filter(row => row.committedPrefix > 0)) {
          const namespace = namespaces.find(row => row.slug === operation.slug);
          const applied = ledger.filter(row => row.namespaceId === namespace?.id);
          if (!Number.isInteger(operation.committedPrefix) || !Array.isArray(operation.declarations)
            || operation.committedPrefix > operation.declarations.length || applied.length < operation.committedPrefix
            || !declarationsMatch(applied.slice(0, operation.committedPrefix), operation.declarations)) {
            finding('PLUGIN_DB_LEDGER_MISMATCH', operation.slug, { reason: 'committed-prefix', committed: operation.committedPrefix }, operation.id);
          }
        }
        const candidates = new Map<string, Array<{ id: string; declarations: PluginMigrationDeclaration[] }>>();
        for (const operation of operations) {
          const { id, slug, phase, artifactSize } = operation;
          if (!terminal.has(phase)) finding('PLUGIN_DB_OPERATION_INCOMPLETE', slug, { phase }, id);
          if (phase === 'NEEDS_RECOVERY') finding('PLUGIN_DB_RECOVERY_REQUIRED', slug, { phase }, id);
          if (['FAILED', 'NEEDS_RECOVERY'].includes(phase) && artifactSize === null) finding('PLUGIN_DB_CANDIDATE_BYTES_MISSING', slug, { phase }, id);
          if (['SUCCESS', 'RECOVERED'].includes(phase) && artifactSize !== null) finding('PLUGIN_DB_CANDIDATE_BYTES_RETAINED', slug, { phase, sizeBytes: artifactSize }, id);
          if (artifactSize === null) continue;
          if (artifactSize > PLUGIN_MAX_ZIP_SIZE) { finding('PLUGIN_DB_PACKAGE_BLOB_INVALID', slug, { reason: 'candidate-size', sizeBytes: artifactSize }, id); continue; }
          const rows = await query('SELECT "artifactBytes" FROM public.plugin_migration_operations WHERE id = $1', [id]);
          const bytes = rows[0].artifactBytes as Buffer; consume(bytes);
          try {
            const inspected = inspectPackage(bytes, operation.packageHash, slug, operation.packageVersion);
            if (inspected.manifestDigest !== operation.manifestDigest || !isDeepStrictEqual(inspected.manifest, operation.manifest) || !isDeepStrictEqual(inspected.declarations, operation.declarations)) throw new Error('Candidate identity mismatch');
            if (!['SUCCESS', 'RECOVERED'].includes(phase)) candidates.set(slug, [...(candidates.get(slug) ?? []), { id, declarations: inspected.declarations }]);
          } catch { finding('PLUGIN_DB_PACKAGE_BLOB_INVALID', slug, { reason: 'candidate-integrity' }, id); }
        }
        for (const attempt of attempts.filter(row => row.status === 'UNKNOWN')) {
          const operation = operations.find(row => row.id === attempt.operationId);
          finding('PLUGIN_DB_ATTEMPT_UNKNOWN', operation?.slug ?? null, { attemptId: attempt.id }, attempt.operationId);
        }
        for (const marker of markers) finding('PLUGIN_DB_INVOCATION_MARKER_PRESENT', marker.operation.slice('plugin-invocation:'.length), { marker: marker.slug, expiresAt: marker.expiresAt });
        for (const schema of schemas) if (!namespaces.some(row => row.schemaName === schema.nspname)) finding('PLUGIN_DB_UNCLAIMED_SCHEMA', null, { schema: schema.nspname });
        for (const namespace of namespaces) {
          const exists = schemas.some(row => row.nspname === namespace.schemaName);
          if (!!namespace.provisionedAt !== exists || namespace.schemaName !== pluginSchemaName(namespace.slug)) finding('PLUGIN_DB_NAMESPACE_MISMATCH', namespace.slug, { schema: namespace.schemaName, provisioned: !!namespace.provisionedAt, exists });
          const plugin = plugins.find(row => row.slug === namespace.slug && !row.deletedAt);
          const applied = ledger.filter(row => row.namespaceId === namespace.id);
          if (applied.some((row, index) => row.order !== index + 1)) finding('PLUGIN_DB_LEDGER_MISMATCH', namespace.slug, { reason: 'order-gap' });
          if (!plugin && exists && applied.length > 0 && !report.findings.some(row => row.slug === namespace.slug && ['PLUGIN_DB_LEDGER_MISMATCH', 'PLUGIN_DB_NAMESPACE_MISMATCH'].includes(row.code))) finding('PLUGIN_DB_RETAINED_NAMESPACE', namespace.slug, { schema: namespace.schemaName, committed: applied.length });
        }
        for (const plugin of plugins.filter(row => !row.deletedAt)) {
          const namespace = namespaces.find(row => row.slug === plugin.slug);
          const applied = ledger.filter(row => row.namespaceId === namespace?.id);
          if (plugin.manifestJson?.database && !namespace) finding('PLUGIN_DB_NAMESPACE_CLAIM_MISSING', plugin.slug, { reason: 'database-declaration' });
          const metadata = await query('SELECT "sizeBytes", octet_length(bytes) AS length FROM public.plugin_package_blobs WHERE "pluginSlug" = $1 AND "zipHash" = $2', [plugin.slug, plugin.zipHash]);
          if (!metadata.length) { finding('PLUGIN_DB_PACKAGE_BLOB_MISSING', plugin.slug, { packageHash: plugin.zipHash }); continue; }
          if (metadata[0].length !== metadata[0].sizeBytes || metadata[0].length > PLUGIN_MAX_ZIP_SIZE) { finding('PLUGIN_DB_PACKAGE_BLOB_INVALID', plugin.slug, { reason: 'size', sizeBytes: metadata[0].sizeBytes, actualBytes: metadata[0].length }); continue; }
          const rows = await query('SELECT bytes FROM public.plugin_package_blobs WHERE "pluginSlug" = $1 AND "zipHash" = $2', [plugin.slug, plugin.zipHash]);
          const bytes = rows[0].bytes as Buffer; consume(bytes);
          let inspected: ReturnType<typeof inspectPackage>;
          try {
            inspected = inspectPackage(bytes, plugin.zipHash, plugin.slug, plugin.version);
            if (!isDeepStrictEqual(inspected.manifest, plugin.manifestJson)) throw new Error('Installed manifest identity mismatch');
            const published = operations.filter(row => row.slug === plugin.slug && row.packageHash === plugin.zipHash && ['SUCCESS', 'RECOVERED', 'PUBLISHED'].includes(row.phase));
            if (published.some(row => row.manifestDigest !== inspected.manifestDigest)) throw new Error('Manifest byte digest mismatch');
          } catch { finding('PLUGIN_DB_PACKAGE_BLOB_INVALID', plugin.slug, { reason: 'installed-integrity' }); continue; }
          const declarations = inspected.declarations;
          if (inspected.manifest.database && !namespace && !plugin.manifestJson?.database) finding('PLUGIN_DB_NAMESPACE_CLAIM_MISSING', plugin.slug, { reason: 'database-declaration' });
          if (!declarationsMatch(applied, declarations)) {
            const candidate = applied.length > declarations.length && declarationsMatch(applied.slice(0, declarations.length), declarations)
              ? candidates.get(plugin.slug)?.find(row => declarationsMatch(applied, row.declarations)) : undefined;
            if (candidate) finding('PLUGIN_DB_PENDING_UPGRADE_LEDGER', plugin.slug, { installed: declarations.length, committed: applied.length }, candidate.id);
            else finding('PLUGIN_DB_LEDGER_MISMATCH', plugin.slug, { declared: declarations.length, committed: applied.length });
          } else if (applied.length < declarations.length) finding('PLUGIN_DB_LEDGER_INCOMPLETE', plugin.slug, { declared: declarations.length, committed: applied.length });
        }
        if (Date.now() - started >= limits.totalMs) throw new AuditLimit();
        report.complete = true;
      }
    }
    await client.query('COMMIT'); begun = false;
  } catch (error) {
    report.complete = false;
    const sqlstate = error && typeof error === 'object' && 'code' in error && /^[0-9A-Z]{5}$/.test(String(error.code)) ? String(error.code) : undefined;
    const limit = error instanceof AuditLimit || ['57014', '55P03', '25P03'].includes(sqlstate ?? '');
    // Reserve one final finding even when the finding budget itself was exhausted.
    report.findings.push({ code: limit ? 'PLUGIN_DB_AUDIT_LIMIT_REACHED' : 'PLUGIN_DB_SCHEMA_INCOMPLETE', severity: 'blocking', slug: null, evidence: { reason: limit ? 'resource-or-time-limit' : 'database-inspection-unavailable', ...(sqlstate ? { sqlstate } : {}) } });
    if (!limit) report.database.schemaState = 'incomplete';
  } finally {
    if (begun) await client.query('ROLLBACK').catch(() => undefined);
    report.finishedAt = new Date().toISOString();
    report.counts.blocking = report.findings.filter(row => row.severity === 'blocking').length;
    report.counts.warning = report.findings.filter(row => row.severity === 'warning').length;
  }
  return report;
}
export function pluginDatabaseAuditExitCode(report: PluginDatabaseAuditReport): 0 | 1 | 2 {
  return !report.complete ? 2 : report.counts.blocking ? 1 : 0;
}
