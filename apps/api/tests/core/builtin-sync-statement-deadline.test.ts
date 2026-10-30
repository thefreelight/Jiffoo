import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_SYNC_LOCK,
  BUILTIN_SYNC_LOCK_WAIT_SECONDS,
  syncBuiltinPlugins,
} from '@/core/admin/extension-installer/builtin-sync';
import {
  BUILTIN_THEME_SYNC_LOCK,
  BUILTIN_THEME_SYNC_LOCK_WAIT_SECONDS,
  syncBuiltinThemes,
} from '@/core/admin/extension-installer/builtin-theme-sync';

type Query = (...args: unknown[]) => unknown;

/**
 * Records the statements of the PostgreSQL clients of a sync.
 *
 * The clients call through, so the sync runs against the real database and
 * the advisory lock of the sync is taken and released as usual.
 */
async function recordQueries(work: () => Promise<void>): Promise<string[]> {
  const queries: string[] = [];
  const original = Client.prototype.query as unknown as Query;
  const spy = vi.spyOn(Client.prototype as unknown as { query: Query }, 'query').mockImplementation(function (this: unknown, ...args: unknown[]) {
    queries.push(String(args[0]));
    return original.apply(this, args);
  });
  try {
    await work();
  } finally {
    spy.mockRestore();
  }
  return queries;
}

async function emptyRoot(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-builtin-deadline-'));
}

/** Holds an advisory lock on a connection of its own. */
async function holdLock(lockId: number): Promise<Client> {
  const holder = new Client({ connectionString: process.env.DATABASE_URL_TEST! });
  await holder.connect();
  await holder.query('SELECT pg_advisory_lock($1::bigint)', [lockId]);
  return holder;
}

describe('The advisory lock of the builtin syncs', () => {
  it('gives the connection of the plugin sync a server-side statement deadline', async () => {
    const root = await emptyRoot();
    try {
      const queries = await recordQueries(() => syncBuiltinPlugins(root));
      // A PostgreSQL that stopped answering cancels the statement instead of
      // letting the sync hold its advisory lock, which blocks every other
      // builtin sync.
      expect(queries.some(text => /statement_timeout/i.test(text))).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('gives the connection of the theme sync a server-side statement deadline', async () => {
    const root = await emptyRoot();
    try {
      const queries = await recordQueries(() => syncBuiltinThemes(root));
      expect(queries.some(text => /statement_timeout/i.test(text))).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('skips the round of the plugin sync when another instance holds the lock', async () => {
    const root = await emptyRoot();
    const holder = await holdLock(BUILTIN_SYNC_LOCK);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const started = Date.now();
      // The sync must not fail the process and must not wait for a lock that
      // is held by another instance.
      await syncBuiltinPlugins(root);
      const waited = Date.now() - started;

      expect(waited).toBeGreaterThanOrEqual(BUILTIN_SYNC_LOCK_WAIT_SECONDS * 1000 - 2_000);
      expect(waited).toBeLessThan(BUILTIN_SYNC_LOCK_WAIT_SECONDS * 1000 + 10_000);

      const record = warn.mock.calls.map(call => String(call[0])).find(line => line.includes('builtin_plugin_sync_lock_timeout'));
      expect(record).toBeDefined();
      expect((JSON.parse(String(record)) as Record<string, unknown>).event).toBe('builtin_plugin_sync_lock_timeout');
    } finally {
      warn.mockRestore();
      await holder.query('SELECT pg_advisory_unlock($1::bigint)', [BUILTIN_SYNC_LOCK]).catch(() => undefined);
      await holder.end().catch(() => undefined);
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it('skips the round of the theme sync when another instance holds the lock', async () => {
    const root = await emptyRoot();
    const holder = await holdLock(BUILTIN_THEME_SYNC_LOCK);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const started = Date.now();
      await syncBuiltinThemes(root);
      const waited = Date.now() - started;

      expect(waited).toBeGreaterThanOrEqual(BUILTIN_THEME_SYNC_LOCK_WAIT_SECONDS * 1000 - 2_000);
      expect(waited).toBeLessThan(BUILTIN_THEME_SYNC_LOCK_WAIT_SECONDS * 1000 + 10_000);

      const record = warn.mock.calls.map(call => String(call[0])).find(line => line.includes('builtin_theme_sync_lock_timeout'));
      expect(record).toBeDefined();
      expect((JSON.parse(String(record)) as Record<string, unknown>).event).toBe('builtin_theme_sync_lock_timeout');
    } finally {
      warn.mockRestore();
      await holder.query('SELECT pg_advisory_unlock($1::bigint)', [BUILTIN_THEME_SYNC_LOCK]).catch(() => undefined);
      await holder.end().catch(() => undefined);
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
