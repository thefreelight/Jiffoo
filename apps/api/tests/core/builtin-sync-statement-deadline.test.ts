import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { syncBuiltinThemes } from '@/core/admin/extension-installer/builtin-theme-sync';

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
});
