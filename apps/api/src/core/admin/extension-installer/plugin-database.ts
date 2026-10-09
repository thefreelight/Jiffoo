import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { ApiError, isDatabaseUnavailable } from '@/utils/api-errors';
import type { PluginDatabase, PluginDatabaseOptions, PluginDatabaseParameter, PluginDatabaseResult, PluginDatabaseTransaction } from '@jiffoo/shared';
import { pluginSchemaName } from 'shared/plugin-signing';
import { processDatabaseUrl } from '@/infra/core-process-identity';
import { PluginDatabaseQueue } from './plugin-database-queue';
import { assertPluginDatabaseSql } from './plugin-database-sql';
import { assertPluginDatabaseTestControl, observePluginDatabase, pluginDatabaseBeforeCommit, pluginDatabaseLimit, pluginDatabaseCallbackDeadline } from './plugin-database-test-control';

type Scope = { slug: string; installationId: string; handler: boolean; open: boolean; root: Scope; controller: AbortController; pending: Set<Promise<unknown>>; settled: Promise<void>; failure?: PluginDatabaseError };
const scopes = new AsyncLocalStorage<Scope>();
const invocations = new Set<Scope>();
const transactions = new AsyncLocalStorage<object>();
const failures = new WeakSet<object>();
type DatabaseCode = 'PLUGIN_ERROR' | 'PLUGIN_TIMEOUT' | 'DATABASE_UNAVAILABLE' | 'PLUGIN_DATABASE_BUSY' | 'PLUGIN_DATABASE_OUTCOME_UNKNOWN' | 'PLUGIN_MIGRATION_DRIFT';
type NamespaceLookup = (slug: string) => Promise<{ schemaName: string; provisionedAt: Date | null } | null>;
class PluginDatabaseError extends ApiError {
  constructor(code: DatabaseCode) { super(code); failures.add(this); }
}
export function isPluginDatabaseError(error: unknown): error is ApiError { return !!error && typeof error === 'object' && failures.has(error); }
function mapped(error: unknown, committing = false): PluginDatabaseError {
  if (isPluginDatabaseError(error)) return error as PluginDatabaseError;
  if (error instanceof ApiError) return new PluginDatabaseError(error.code as DatabaseCode);
  if (isDatabaseUnavailable(error)) return new PluginDatabaseError('DATABASE_UNAVAILABLE');
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (committing && !/^[0-9A-Z]{5}$/.test(code)) return new PluginDatabaseError('PLUGIN_DATABASE_OUTCOME_UNKNOWN');
  if (error instanceof Error && ['Connection terminated', 'Connection terminated unexpectedly', 'Client has encountered a connection error and is not queryable'].includes(error.message)) return new PluginDatabaseError('DATABASE_UNAVAILABLE');
  if (['57014', '55P03', '25P03'].includes(code)) return new PluginDatabaseError('PLUGIN_TIMEOUT');
  if (code.startsWith('08') || ['57P01', '57P02', '57P03', '53300', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND'].includes(code)) return new PluginDatabaseError('DATABASE_UNAVAILABLE');
  return new PluginDatabaseError('PLUGIN_ERROR');
}

/** Called inside the existing durable gate. It does not acquire another gate. */
export async function withPluginDatabaseInvocation<T>(slug: string, installationId: string, invoke: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  let finish!: () => void;
  const settled = new Promise<void>(resolve => { finish = resolve; });
  const scope = { slug, installationId, handler: false, open: true, controller, pending: new Set<Promise<unknown>>(), settled } as Scope;
  scope.root = scope;
  invocations.add(scope);
  try {
    return await scopes.run(scope, async () => {
      const result = await invoke();
      // inject may resolve as soon as a handler calls reply.send(). Retain the
      // gate until that handler and every admitted database task truly settle.
      while (scope.pending.size) await Promise.allSettled([...scope.pending]);
      if (scope.failure) throw scope.failure;
      return result;
    });
  } finally {
    scope.open = false;
    await Promise.allSettled([...scope.pending]);
    signal?.removeEventListener('abort', abort);
    invocations.delete(scope); finish();
  }
}

/** Timers inherit ALS but cannot reuse admission after the real handler settles. */
export async function withPluginDatabaseHandler<T>(slug: string, installationId: string, invoke: () => Promise<T> | T): Promise<T> {
  const parent = scopes.getStore();
  if (!parent || parent.slug !== slug || parent.installationId !== installationId || !parent.open) return invoke();
  const scope: Scope = { ...parent, handler: true, open: true, pending: new Set() };
  const work = scopes.run(scope, async () => {
    try { return await invoke(); }
    catch (error) { if (isPluginDatabaseError(error)) parent.root.failure = error as PluginDatabaseError; throw error; }
    finally { scope.open = false; await Promise.allSettled([...scope.pending]); }
  });
  parent.root.pending.add(work);
  void work.finally(() => parent.root.pending.delete(work)).catch(() => undefined);
  return work;
}

function admission(slug: string, installationId: string): Scope {
  const scope = scopes.getStore();
  if (!scope?.handler || !scope.open || !scope.root.open || scope.slug !== slug || scope.installationId !== installationId) throw new PluginDatabaseError('PLUGIN_ERROR');
  if (scope.controller.signal.aborted) throw new PluginDatabaseError('PLUGIN_TIMEOUT');
  return scope;
}

class PluginDatabaseRuntime {
  private readonly pool: Pool;
  private readonly queue: PluginDatabaseQueue;
  private readonly active = new Map<Promise<unknown>, AbortController>();
  private closing = false;
  private closeWork: Promise<void> | undefined;
  constructor(databaseUrl: string, poolMax: number, private readonly lookupNamespace: NamespaceLookup = slug => prisma.pluginNamespace.findUnique({ where: { slug }, select: { schemaName: true, provisionedAt: true } })) {
    this.pool = new Pool({ connectionString: processDatabaseUrl(databaseUrl, 'runtime', undefined, true), max: poolMax * 2,
      connectionTimeoutMillis: pluginDatabaseLimit('connectMs', 5_000), idleTimeoutMillis: 30_000, allowExitOnIdle: true,
    });
    this.pool.on('error', () => undefined);
    this.queue = new PluginDatabaseQueue(poolMax);
  }

  database(slug: string, installationId: string): PluginDatabase {
    const schemaName = pluginSchemaName(slug);
    let namespace: Promise<void> | undefined;
    const provisioned = () => namespace ??= this.lookupNamespace(slug).then(row => {
      if (!row?.provisionedAt) throw new PluginDatabaseError('PLUGIN_ERROR');
      if (row.schemaName !== schemaName) throw new PluginDatabaseError('PLUGIN_MIGRATION_DRIFT');
    }).catch(error => { namespace = undefined; throw error; });
    const transaction = <T>(run: (tx: PluginDatabaseTransaction) => Promise<T>, options?: PluginDatabaseOptions, standalone = false): Promise<T> => {
      try {
        const scope = admission(slug, installationId);
        if (transactions.getStore() || this.closing || typeof run !== 'function') throw new PluginDatabaseError(this.closing ? 'DATABASE_UNAVAILABLE' : 'PLUGIN_ERROR');
        const controller = new AbortController();
        const work = this.execute(slug, schemaName, scope, controller, provisioned, run, options, standalone);
        this.active.set(work, controller); scope.pending.add(work); scope.root.pending.add(work);
        void work.finally(() => { this.active.delete(work); scope.pending.delete(work); scope.root.pending.delete(work); }).catch(() => undefined);
        return work;
      } catch (error) { return Promise.reject(mapped(error)); }
    };
    return Object.freeze({
      query: <Row extends Record<string, unknown>>(text: string, values: readonly PluginDatabaseParameter[], options?: PluginDatabaseOptions) => {
        try { assertPluginDatabaseSql(text, values); } catch (error) { return Promise.reject(mapped(error)); }
        return transaction(tx => tx.query<Row>(text, values), options, true);
      },
      transaction: <T>(run: (tx: PluginDatabaseTransaction) => Promise<T>, options?: PluginDatabaseOptions) => transaction(run, options),
    });
  }

  private async execute<T>(slug: string, schemaName: string, scope: Scope, controller: AbortController, provisioned: () => Promise<void>, run: (tx: PluginDatabaseTransaction) => Promise<T>, options?: PluginDatabaseOptions, standalone = false): Promise<T> {
    const signal = AbortSignal.any([controller.signal, scope.controller.signal, ...(options?.signal ? [options.signal] : [])]);
    let release: (() => void) | undefined, client: PoolClient | undefined, timer: NodeJS.Timeout | undefined;
    let pid: number | undefined, backendStart: string | undefined, busy = false, open = true, committing = false, committed = false, broken = false;
    let tail: Promise<unknown> = Promise.resolve(), cancellation: Promise<unknown> | undefined;
    let interrupt!: (error: PluginDatabaseError) => void;
    const interrupted = new Promise<never>((_resolve, reject) => { interrupt = reject; });
    const clientError = (error: Error) => { broken = true; open = false; interrupt(mapped(error, committing)); };
    void interrupted.catch(() => undefined);
    const abort = () => {
      open = false; interrupt(new PluginDatabaseError('PLUGIN_TIMEOUT'));
      if (busy && pid && !committing && !cancellation) {
        cancellation = prisma.$queryRaw`SELECT pg_cancel_backend(${pid}::integer)`;
        void cancellation.finally(() => {
          // A lost reply must not leave admission waiting on a dead transport.
          if (busy && client) { broken = true; void client.end().catch(() => undefined); }
        }).catch(() => undefined);
        void cancellation.catch(() => undefined);
      } else if (busy && committing && client) {
        broken = true; void client.end().catch(() => undefined);
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    const check = () => { if (signal.aborted || !open) throw new PluginDatabaseError('PLUGIN_TIMEOUT'); };
    const wire = async (text: string, values?: unknown[]) => {
      busy = true;
      // pg supports queryMode, but its installed declarations omit the field.
      const query = { text, values, queryMode: 'extended' };
      try { return await client!.query(query); }
      catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || !/^[0-9A-Z]{5}$/.test(String(error.code))) broken = true; throw error; }
      finally { busy = false; }
    };
    try {
      const permit = this.queue.acquire(slug, signal, pluginDatabaseLimit('queueMs', 5_000));
      if (this.queue.snapshot(slug).queued) observePluginDatabase({ stage: 'queued', slug, ...this.queue.snapshot(slug) });
      release = await permit;
      observePluginDatabase({ stage: 'admitted', slug, ...this.queue.snapshot(slug) });
      const transactionMs = pluginDatabaseLimit('transactionMs', 30_000);
      const setupMs = pluginDatabaseCallbackDeadline() ? 30_000 : transactionMs;
      timer = setTimeout(() => controller.abort(), setupMs);
      check(); await provisioned(); check();
      try { client = await this.pool.connect(); } catch { throw new PluginDatabaseError('DATABASE_UNAVAILABLE'); }
      // pg supplies this protocol identity even though its declarations omit it.
      if ('processID' in client && typeof client.processID === 'number') pid = client.processID;
      client.on('error', clientError);
      check();
      await wire('BEGIN');
      await wire(`SET LOCAL search_path = "${schemaName}"`);
      const settings = await wire("SELECT pg_backend_pid() AS pid, (SELECT extract(epoch FROM backend_start)::text FROM pg_stat_activity WHERE pid = pg_backend_pid()) AS started, current_schema() AS schema, set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true), set_config('idle_in_transaction_session_timeout', $3, true)",
        [`${pluginDatabaseLimit('statementMs', 10_000)}ms`, `${pluginDatabaseLimit('lockMs', 1_000)}ms`, `${setupMs}ms`]);
      pid = settings.rows[0].pid;
      backendStart = settings.rows[0].started;
      if (settings.rows[0].schema !== schemaName) throw new PluginDatabaseError('PLUGIN_MIGRATION_DRIFT');
      check();
      const token = {};
      const tx: PluginDatabaseTransaction = Object.freeze({ query: <Row extends Record<string, unknown>>(text: string, values: readonly PluginDatabaseParameter[], queryOptions?: PluginDatabaseOptions): Promise<PluginDatabaseResult<Row>> => {
        try {
          if (!open || !standalone && !scope.open || !scope.root.open || transactions.getStore() !== token || scopes.getStore() !== scope) throw new PluginDatabaseError('PLUGIN_ERROR');
          assertPluginDatabaseSql(text, values); check();
        } catch (error) { return Promise.reject(mapped(error)); }
        const queryAbort = () => controller.abort();
        queryOptions?.signal?.addEventListener('abort', queryAbort, { once: true });
        if (queryOptions?.signal?.aborted) queryAbort();
        const work = tail.then(async () => {
          check();
          const resultPromise = wire(text, [...values].map(value => value instanceof Uint8Array ? Buffer.from(value) : value));
          observePluginDatabase({ stage: 'query', slug, pid });
          const result = await resultPromise;
          check(); return { rows: result.rows as Row[], rowCount: result.rowCount };
        }).catch(error => { throw mapped(error); }).finally(() => queryOptions?.signal?.removeEventListener('abort', queryAbort));
        tail = work; void work.catch(() => undefined); return work;
      } });
      const callback = transactions.run(token, () => Promise.resolve().then(() => {
        const result = run(tx);
        if (pluginDatabaseCallbackDeadline()) { clearTimeout(timer); timer = setTimeout(() => controller.abort(), transactionMs); }
        return result;
      })).catch(error => { throw isPluginDatabaseError(error) ? error : new PluginDatabaseError('PLUGIN_ERROR'); });
      void callback.catch(() => undefined);
      const result = await Promise.race([callback, interrupted]);
      await Promise.race([tail, interrupted]); check();
      await Promise.race([pluginDatabaseBeforeCommit(), interrupted]); check();
      open = false; committing = true;
      await wire('COMMIT'); committing = false; committed = true;
      return result;
    } catch (error) {
      if (signal.aborted && !committing && !(this.closing && !release)) throw new PluginDatabaseError('PLUGIN_TIMEOUT');
      throw mapped(error, committing);
    } finally {
      open = false; clearTimeout(timer);
      await cancellation?.catch(() => undefined);
      await tail.catch(() => undefined);
      if (client) {
        if (!broken && !committed) { try { await client.query('ROLLBACK'); } catch { broken = true; } }
        client.removeListener('error', clientError); client.release(broken);
        // A broken socket alone is not evidence that its server-side work ended.
        // Keep the durable invocation marker until a fresh control query proves it.
        if (broken && pid) {
          for (;;) {
            try {
              const rows = await prisma.$queryRaw<Array<{ present: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid = ${pid}::integer AND (${backendStart ?? null}::text IS NULL OR extract(epoch FROM backend_start)::text = ${backendStart ?? null})) AS present`;
              if (!rows[0].present) break;
            } catch { /* Unknown server execution must retain the invocation marker. */ }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      signal.removeEventListener('abort', abort);
      release?.(); observePluginDatabase({ stage: 'released', slug, ...this.queue.snapshot(slug) });
    }
  }

  snapshot(slug: string) { return this.queue.snapshot(slug); }
  resources() { return { connections: this.pool.totalCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount }; }
  close(): Promise<void> {
    if (this.closeWork) return this.closeWork;
    this.closing = true; this.queue.close();
    for (const controller of this.active.values()) controller.abort();
    this.closeWork = Promise.allSettled([...this.active.keys()]).then(() => this.pool.end());
    return this.closeWork;
  }
}

let runtime: PluginDatabaseRuntime | undefined;
export function pluginDatabaseResources() {
  return { poolCreated: runtime !== undefined, activeInvocations: invocations.size, ...(runtime?.resources() ?? { connections: 0, idle: 0, waiting: 0 }) };
}
export function createPluginDatabase(slug: string, installationId: string): PluginDatabase {
  runtime ??= new PluginDatabaseRuntime(env.DATABASE_URL, env.PLUGIN_DB_POOL_MAX);
  return runtime.database(slug, installationId);
}
export async function closePluginDatabase(): Promise<void> {
  await runtime?.close();
  while (invocations.size) {
    const active = [...invocations];
    for (const scope of active) scope.controller.abort();
    await Promise.all(active.map(scope => scope.settled));
  }
  runtime = undefined;
}
export function createPluginDatabaseTestRuntime(databaseUrl: string, poolMax = 4, lookupNamespace?: NamespaceLookup) {
  assertPluginDatabaseTestControl();
  if (new URL(databaseUrl).pathname !== '/jiffoo_core_test') throw new Error('Unsafe plugin database test database');
  return new PluginDatabaseRuntime(databaseUrl, poolMax, lookupNamespace);
}
