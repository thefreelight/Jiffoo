import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import {
  CORE_DATABASE_CONNECTION_LIMIT,
  CORE_DATABASE_CONNECT_TIMEOUT_SECONDS,
  CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  CORE_DATABASE_POOL_TIMEOUT_SECONDS,
  CORE_DATABASE_SOCKET_TIMEOUT_SECONDS,
  CORE_DATABASE_STATEMENT_TIMEOUT_MS,
  processDatabaseUrl,
} from '@/infra/core-process-identity';

/**
 * Reads a duration of a setting of a session in milliseconds.
 *
 * The server prints a duration in the unit that fits it, so a deadline of
 * sixty seconds is reported as '1min' and not as '60000ms'.
 */
function toMilliseconds(setting: string): number {
  const match = /^(\d+)(ms|s|min|h|d)?$/.exec(setting.trim());
  if (!match) throw new Error(`Unexpected duration of a session setting: ${setting}`);
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'min': return amount * 60_000;
    case 'h': return amount * 3_600_000;
    case 'd': return amount * 86_400_000;
    case 's': return amount * 1_000;
    default: return amount;
  }
}

describe('The Core datasource URL', () => {
  it('carries the deadlines of the Core client and keeps the parameters of the deployment URL', () => {
    const url = new URL(processDatabaseUrl('postgresql://core:secret@db.internal:5432/jiffoo?schema=public&sslmode=require', 'core'));

    // The connect attempt, the socket and the wait for a free connection of
    // the pool are bounded, and the pool itself has a bounded size.
    expect(url.searchParams.get('connect_timeout')).toBe(String(CORE_DATABASE_CONNECT_TIMEOUT_SECONDS));
    expect(url.searchParams.get('socket_timeout')).toBe(String(CORE_DATABASE_SOCKET_TIMEOUT_SECONDS));
    expect(url.searchParams.get('connection_limit')).toBe(String(CORE_DATABASE_CONNECTION_LIMIT));
    expect(url.searchParams.get('pool_timeout')).toBe(String(CORE_DATABASE_POOL_TIMEOUT_SECONDS));

    // The server cancels a statement that runs too long and an idle
    // transaction that holds its connection too long.
    expect(url.searchParams.get('options')).toContain(`statement_timeout=${CORE_DATABASE_STATEMENT_TIMEOUT_MS}`);
    expect(url.searchParams.get('options')).toContain(`idle_in_transaction_session_timeout=${CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS}`);

    // The parameters of the deployment URL and the application name survive.
    expect(url.searchParams.get('schema')).toBe('public');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('application_name')).toContain('core');
  });

  it('keeps the server deadlines for a node-postgres client and drops the pool bounds of Prisma', () => {
    const url = new URL(processDatabaseUrl('postgresql://core:secret@db.internal:5432/jiffoo?schema=public&connection_limit=40&pool_timeout=90', 'core', undefined, true));

    expect(url.searchParams.get('connect_timeout')).toBe(String(CORE_DATABASE_CONNECT_TIMEOUT_SECONDS));
    expect(url.searchParams.get('options')).toContain(`statement_timeout=${CORE_DATABASE_STATEMENT_TIMEOUT_MS}`);
    expect(url.searchParams.get('options')).toContain(`idle_in_transaction_session_timeout=${CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS}`);

    // The pool bounds belong to the Prisma client alone.
    expect(url.searchParams.get('connection_limit')).toBeNull();
    expect(url.searchParams.get('pool_timeout')).toBeNull();
    expect(url.searchParams.get('socket_timeout')).toBeNull();
    expect(url.searchParams.get('schema')).toBeNull();
  });

  it('keeps the options of the deployment URL and appends the deadlines of the server', () => {
    const url = new URL(processDatabaseUrl('postgresql://core:secret@db.internal:5432/jiffoo?options=-c%20timezone%3DUTC', 'core'));

    expect(url.searchParams.get('options')).toContain('timezone=UTC');
    expect(url.searchParams.get('options')).toContain(`statement_timeout=${CORE_DATABASE_STATEMENT_TIMEOUT_MS}`);
    expect(url.searchParams.get('options')).toContain(`idle_in_transaction_session_timeout=${CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS}`);
  });

  it('leaves the deadlines of the clients that are not the Core one to their own module', () => {
    const url = new URL(processDatabaseUrl('postgresql://core:secret@db.internal:5432/jiffoo', 'runtime', undefined, true));

    expect(url.searchParams.get('options')).toBeNull();
    expect(url.searchParams.get('connect_timeout')).toBeNull();
    expect(url.searchParams.get('connection_limit')).toBeNull();
    expect(url.searchParams.get('pool_timeout')).toBeNull();
  });

  it('orders the deadlines so that the server reports the cancellation and a waiting transaction survives', () => {
    // The socket timeout is above the statement timeout, so the server
    // cancels a runaway statement and reports it before the client gives up
    // on the socket.
    expect(CORE_DATABASE_SOCKET_TIMEOUT_SECONDS).toBeGreaterThan(CORE_DATABASE_STATEMENT_TIMEOUT_MS / 1000);

    // The idle in transaction timeout is above the statement timeout, so a
    // transaction that waits for a plugin contract inside its own budget is
    // not killed while it waits.
    expect(CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(CORE_DATABASE_STATEMENT_TIMEOUT_MS);
  });

  it('makes the server apply the deadlines of the Core URL on the session of the API', async () => {
    // The client of the API is built with the Core URL, so this session is
    // the session a Core request runs in. SHOW is SELECT current_setting.
    const rows = await prisma.$queryRaw<Array<{ statement_timeout: string; idle_in_transaction_session_timeout: string }>>`
      SELECT current_setting('statement_timeout') AS statement_timeout,
             current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout`;
    const row = rows[0];
    expect(row).toBeDefined();
    expect(toMilliseconds(row!.statement_timeout)).toBe(CORE_DATABASE_STATEMENT_TIMEOUT_MS);
    expect(toMilliseconds(row!.idle_in_transaction_session_timeout)).toBe(CORE_DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS);
  });

  it('leaves the deadlines of a plain URL to the defaults of the server', async () => {
    // The plain URL carries no deadline of the Core client, so the session
    // reports the defaults of the server. The deadlines of the Core URL
    // therefore come from the URL and not from the server.
    const plain = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
    try {
      const rows = await plain.$queryRaw<Array<{ statement_timeout: string; idle_in_transaction_session_timeout: string }>>`
        SELECT current_setting('statement_timeout') AS statement_timeout,
               current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout`;
      const row = rows[0];
      expect(row).toBeDefined();
      expect(toMilliseconds(row!.statement_timeout)).toBe(0);
      expect(toMilliseconds(row!.idle_in_transaction_session_timeout)).toBe(0);
    } finally {
      await plain.$disconnect();
    }
  });
});
