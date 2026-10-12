import { randomUUID, createHash } from 'node:crypto';
import { readdirSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const CORE_MIGRATION_LOCK = 824301550;
const need = (condition, message) => { if (!condition) throw new Error(message); };
export const coreHistorySql = 'SELECT id,migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name';
export const historyTableSql = `CREATE TABLE public._prisma_migrations (
  id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz,
  migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0
)`;

export function readCoreMigrations(root) {
  const sources = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    need(!lstatSync(resolve(root, entry.name)).isSymbolicLink(), 'Core migration directory symlink is forbidden');
    const path = resolve(root, entry.name, 'migration.sql');
    need(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), 'Core migration must be a regular SQL file');
    const bytes = readFileSync(path), sql = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { name: entry.name, checksum: createHash('sha256').update(bytes).digest('hex'), sql };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  need(sources.length > 0, 'Core migration inventory is empty');
  return sources;
}

export function assertCorePrefix(history, target, complete = false) {
  need(target.length > 0 && target.every((item, index) => /^[a-f0-9]{64}$/.test(item.checksum)
    && typeof item.name === 'string' && (!index || target[index - 1].name < item.name)), 'Core inventory identity or order mismatch');
  need(history.length <= target.length && history.every((row, index) => row.migration_name === target[index]?.name
    && row.checksum === target[index]?.checksum && row.finished_at && !row.rolled_back_at), 'Core migration history mismatch; update refused');
  need(!complete || history.length === target.length, 'Core migration history is incomplete');
}

/** The caller owns the dedicated connection and durable intent storage. */
export async function executeCoreMigrations(client, sources, baseline, validate, observe) {
  need(typeof validate === 'function' && typeof observe === 'function', 'Core migration validation and intent observer are required');
  const prepared = new Map(sources.map(source => [source.name, validate(source.sql)]));
  await client.query('SELECT pg_advisory_lock($1)', [CORE_MIGRATION_LOCK]);
  try {
    assertCorePrefix((await client.query(coreHistorySql)).rows, sources);
    const expected = [...baseline];
    for (const source of sources.slice(baseline.length)) {
      const history = (await client.query(coreHistorySql)).rows;
      if (expected.length) assertCorePrefix(history, expected, true);
      else need(history.length === 0, 'Core migration history mismatch; expected empty history');
      const id = randomUUID();
      const { sql, wrapperStripped } = prepared.get(source.name);
      await observe({ status: 'intent', kind: 'core', id, name: source.name, checksum: source.checksum, wrapperStripped });
      let committing = false;
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='600s'");
        await client.query(sql);
        await client.query('INSERT INTO public._prisma_migrations (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ($1,$2,$3,clock_timestamp(),1)', [id, source.checksum, source.name]);
        committing = true;
        await client.query('COMMIT');
      } catch (error) {
        // COMMIT transport failures must remain unknown even if a subsequent query fails.
        if (committing && !/^[0-9A-Z]{5}$/.test(error.code ?? '')) {
          await observe({ status: 'unknown', kind: 'core', id, name: source.name, checksum: source.checksum });
        } else {
          let rolledBack = false;
          try { await client.query('ROLLBACK'); rolledBack = true; } catch { /* Reconciliation requires a new session. */ }
          await observe({ status: rolledBack ? 'aborted' : 'unknown', kind: 'core', id, name: source.name, checksum: source.checksum });
        }
        throw error;
      }
      expected.push(source);
      await observe({ status: 'committed', kind: 'core', id, name: source.name, checksum: source.checksum });
    }
    assertCorePrefix((await client.query(coreHistorySql)).rows, sources, true);
  } finally { await client.query('SELECT pg_advisory_unlock($1)', [CORE_MIGRATION_LOCK]).catch(() => undefined); }
}
