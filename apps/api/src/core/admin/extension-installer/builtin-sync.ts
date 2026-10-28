import { promises as fs } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { processDatabaseUrl } from '@/infra/core-process-identity';
import { pluginFsInstaller } from './plugin-fs-installer';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { getDefaultInstance } from '@/core/extensions/registry';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { packBuiltinPlugin } from './builtin-package';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { AuditService } from '@/core/audit/service';

const BUILTIN_SYNC_LOCK = 824_301_551;
/** The seconds a sync waits for the lock of a sync that is still running. */
const BUILTIN_SYNC_LOCK_WAIT_SECONDS = 120;
/** The milliseconds between two attempts to take the sync lock. */
const BUILTIN_SYNC_LOCK_RETRY_MS = 250;
/** The milliseconds the sync transaction may hold its connection. */
const BUILTIN_SYNC_TRANSACTION_TIMEOUT_MS = 30_000;
/** The milliseconds the sync transaction waits for a free connection of the pool. */
const BUILTIN_SYNC_TRANSACTION_MAX_WAIT_MS = 10_000;

/** One builtin package: its identity, its packed bytes and its source directory. */
type BuiltinPackage = { slug: string; version: string; directory: string; hash: string; bytes: Buffer };

/**
 * Publish the package of a builtin plugin.
 *
 * The plugin runtime loads a package only when the published copy carries its
 * completion marker, so the sync asks the package store the very same
 * question: a package the runtime would refuse is a package the sync has to
 * publish again. A complete package is immutable and is never published a
 * second time.
 *
 * @returns true when this call published the package.
 */
export async function publishBuiltinPackage(slug: string, zipHash: string, sourceDirectory: string): Promise<boolean> {
  if (await pluginPackageStore.get(slug, zipHash)) return false;
  const deployment = await pluginPackageStore.put(slug, zipHash, sourceDirectory);
  await deployment.commit();
  return true;
}

/**
 * Reads and packs the builtin packages.
 *
 * The filesystem work happens before the lock is taken and before any
 * transaction opens, so a slow disk never holds the lock or a connection.
 */
async function loadBuiltinPackages(builtinRoot: string): Promise<BuiltinPackage[]> {
  const entries = await fs.readdir(builtinRoot, { withFileTypes: true });
  const packages: BuiltinPackage[] = [];
  for (const entry of entries.filter(candidate => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    const directory = path.join(builtinRoot, entry.name);
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')) as { slug: string; version: string };
    const { hash, bytes } = await packBuiltinPlugin(directory);
    packages.push({ slug: manifest.slug, version: manifest.version, directory, hash, bytes });
  }
  return packages;
}

/**
 * Takes the sync lock on a connection of its own.
 *
 * The lock is a session lock, so it covers the whole sync, including the
 * install work that runs outside of every transaction. A transaction-scoped
 * lock would be released before the installer commits its own rows. The
 * connection is closed when the sync ends, which releases the lock even when
 * the sync failed.
 */
async function takeSyncLock(): Promise<Client> {
  const client = new Client({ connectionString: processDatabaseUrl(env.DATABASE_URL, 'core', undefined, true), connectionTimeoutMillis: 5_000 });
  client.on('error', () => undefined);
  await client.connect();
  const deadline = Date.now() + BUILTIN_SYNC_LOCK_WAIT_SECONDS * 1000;
  for (;;) {
    const result = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS locked', [BUILTIN_SYNC_LOCK]);
    if (result.rows[0]?.locked) return client;
    if (Date.now() >= deadline) {
      await client.end().catch(() => undefined);
      throw new Error('Builtin plugin sync is held by another process');
    }
    await new Promise(resolve => setTimeout(resolve, BUILTIN_SYNC_LOCK_RETRY_MS));
  }
}

export async function syncBuiltinPlugins(builtinRoot: string): Promise<void> {
  // The filesystem work, outside every transaction and outside the lock.
  const packages = await loadBuiltinPackages(builtinRoot);

  // The lock of the sync, held for the whole sync on a connection of its own.
  const lock = await takeSyncLock();
  try {
    for (const pkg of packages) {
      // The state is read outside every transaction: the installer below
      // commits its own rows on the global client.
      const installed = await prisma.pluginInstall.findUnique({ where: { slug: pkg.slug } });

      if (installed && installed.version === pkg.version && installed.zipHash === pkg.hash) {
        // The package is the one the database already names. The sync owns its
        // blob and its publication. The blob is stored first and the package
        // is published after the transaction that stored the blob committed.
        await prisma.$transaction(async tx => {
          await pluginPackageBlobStore.put(tx, pkg.slug, pkg.hash, pkg.bytes);
        }, { timeout: BUILTIN_SYNC_TRANSACTION_TIMEOUT_MS, maxWait: BUILTIN_SYNC_TRANSACTION_MAX_WAIT_MS });
        await publishBuiltinPackage(pkg.slug, pkg.hash, pkg.directory);
        continue;
      }

      // The package is not the one the database names. The installer owns the
      // blob and the publication of the hash it installs, so the sync does
      // neither. The install runs outside every transaction, so its rows
      // commit with its own commit.
      const wasInstalled = Boolean(installed);
      await pluginFsInstaller.installFromDirectory(pkg.directory, { source: 'builtin' });

      if (!wasInstalled) {
        // A fresh installation is enabled and audited. The plugin-facing work
        // runs outside every transaction: the lifecycle hook and the runtime
        // validation of the plugin must not hold a connection while they run.
        const instance = await getDefaultInstance(pkg.slug);
        if (!instance) throw new Error(`Builtin plugin "${pkg.slug}" has no default installation`);
        const plan = await PluginManagementService.planInstanceUpdate(instance.id, { enabled: true });
        await plan.prepare();
        // One short transaction: the enable and the audit of the installation
        // commit together, so an enabled plugin never misses its audit.
        await prisma.$transaction(async tx => {
          await plan.commit(tx);
          await AuditService.writeStaffAudit(tx, {
            staffUserId: 'system',
            staffEmail: 'system',
            actorUserId: 'system',
            actorEmail: 'system',
            action: 'BUILTIN_PLUGIN_INSTALLED',
            metadata: { slug: pkg.slug, version: pkg.version, source: 'builtin' },
          });
        }, { timeout: BUILTIN_SYNC_TRANSACTION_TIMEOUT_MS, maxWait: BUILTIN_SYNC_TRANSACTION_MAX_WAIT_MS });
        // The post-commit work runs after the transaction resolved.
        await plan.finalize();
      }
    }
  } finally {
    // Closing the connection releases the session lock, also when the sync
    // failed.
    await lock.end().catch(() => undefined);
  }
}
