import { randomUUID, createHash } from 'node:crypto';
import { hostname } from 'node:os';

export const PROCESS_REGISTRATION_LOCK_CLASS = 1_246_316_110;
export const PROCESS_REGISTRATION_LOCK_KEY = 1;
export const coreProcessIdentity = Object.freeze({ bootNonce: randomUUID(), instanceId: randomUUID(), hostname: hostname(), pid: process.pid });

/**
 * The deadlines of every Core database connection.
 *
 * A broken socket must never pin a connection of the pool forever: a connect
 * attempt, a waiting caller, a stalled read and a running statement all have
 * a deadline, and the pool of the Core client has a bounded size. The values
 * live here so every Core client - the API, the worker and the scripts -
 * carries the same bounds.
 *
 * The deadlines are ordered: the socket timeout is above the statement
 * timeout, so the server cancels a runaway statement and reports it, and the
 * idle in transaction timeout is above the statement timeout, so a
 * transaction that waits for a plugin contract inside its own budget is not
 * killed while it waits.
 */

/** The seconds a connection attempt to PostgreSQL may take before it is given up. */
export const CORE_DATABASE_CONNECT_TIMEOUT_SECONDS = 10;
/** The seconds a client waits for the answer of the server before it gives up. */
export const CORE_DATABASE_SOCKET_TIMEOUT_SECONDS = 90;
/** The maximum number of connections of the pool of the Core client. */
export const CORE_DATABASE_CONNECTION_LIMIT = 10;
/** The seconds a caller waits for a free connection of the pool before it gives up. */
export const CORE_DATABASE_POOL_TIMEOUT_SECONDS = 15;
/** The milliseconds a statement may run on the server before the server cancels it. */
export const CORE_DATABASE_STATEMENT_TIMEOUT_MS = 60_000;
/** The milliseconds an idle transaction may hold its connection on the server. */
export const CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS = 120_000;
export function processApplicationPrefix(bootNonce: string = coreProcessIdentity.bootNonce): string {
  return `jf:${Buffer.from(bootNonce.replaceAll('-', ''), 'hex').toString('base64url')}:`;
}
export function processDatabaseUrl(databaseUrl: string, kind: 'core' | 'runtime' | 'migration', operationId?: string, pg = false): string {
  const url = new URL(databaseUrl);
  if (pg) for (const parameter of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(parameter);
  const applicationName = processApplicationName(kind, coreProcessIdentity.bootNonce, operationId);
  if (Buffer.byteLength(applicationName) > 63) throw new Error('Core application name exceeds PostgreSQL limit');
  url.searchParams.set('application_name', applicationName);
  if (kind === 'core') applyCoreDatabaseDeadlines(url, pg);
  return url.toString();
}

/**
 * Adds the connection deadlines of the Core client to a datasource URL.
 *
 * The Prisma client reads the bounds of its pool and the timeout of the
 * socket from the URL, so a connect attempt, a caller that waits for a free
 * connection and a read that never gets an answer all end within a deadline
 * instead of pinning a connection of the pool forever.
 *
 * The server reads the deadlines of the statements from the startup options
 * of the session. The query engine passes the `options` parameter of the URL
 * to the server, so the statement deadline and the idle in transaction
 * deadline are in force for the Core client; a statement that runs on a
 * server which stopped answering is cancelled by the server itself. The
 * options of the deployment URL are kept: the deadlines are appended to them.
 *
 * The clients that are not the Core one - the runtime of a plugin and the
 * migration of a plugin - keep the deadlines of the module that owns them.
 */
function applyCoreDatabaseDeadlines(url: URL, pg: boolean): void {
  url.searchParams.set('connect_timeout', String(CORE_DATABASE_CONNECT_TIMEOUT_SECONDS));
  const serverDeadlines = `-c statement_timeout=${CORE_DATABASE_STATEMENT_TIMEOUT_MS} -c idle_in_transaction_session_timeout=${CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS}`;
  const existingOptions = url.searchParams.get('options');
  url.searchParams.set('options', existingOptions ? `${existingOptions} ${serverDeadlines}` : serverDeadlines);
  // The pool bounds and the socket timeout belong to the Prisma client. A
  // node-postgres client has its own pool and its own deadlines.
  if (pg) return;
  url.searchParams.set('socket_timeout', String(CORE_DATABASE_SOCKET_TIMEOUT_SECONDS));
  url.searchParams.set('connection_limit', String(CORE_DATABASE_CONNECTION_LIMIT));
  url.searchParams.set('pool_timeout', String(CORE_DATABASE_POOL_TIMEOUT_SECONDS));
}
export function processApplicationName(kind: 'core' | 'runtime' | 'migration', bootNonce: string, operationId?: string): string {
  return `${processApplicationPrefix(bootNonce)}${kind === 'migration' ? `m:${createHash('sha256').update(operationId!).digest('base64url').slice(0, 22)}` : kind}`;
}
