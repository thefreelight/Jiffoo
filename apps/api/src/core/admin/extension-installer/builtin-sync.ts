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

/** One builtin package: its identity, its packed bytes and its source. */
type BuiltinPackage = { slug: string; version: string; directory: string; hash: string; bytes: Buffer };

/**
 * The state of one builtin package when the sync starts.
 *
 * `audited` says that the staff audit of the installation exists. The audit
 * row is written in the transaction that completes the installation, so it is
 * the marker of an installation the sync finished.
 */
type BuiltinState = { pkg: BuiltinPackage; installed: boolean; upToDate: boolean; audited: boolean };

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
 * The filesystem work happens before any transaction opens, so a slow disk
 * never holds a transaction or the sync lock.
 */
async function loadBuiltinPackages(builtinRoot: string): Promise<BuiltinPackage[]> {
  const entries = await fs.readdir(builtinRoot, { withFileTypes: true });
  const packages: BuiltinPackage[] = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
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

/**
 * Reads the state of every builtin package.
 *
 * The read runs outside a transaction: the install work below writes through
 * the global client, and a transaction that stayed open across it would hold
 * its snapshot while the installer commits.
 */
async function readBuiltinStates(packages: BuiltinPackage[]): Promise<BuiltinState[]> {
  const audits = await prisma.adminStaffAuditLog.findMany({ where: { action: 'BUILTIN_PLUGIN_INSTALLED' }, select: { metadata: true } });
  const audited = new Set<string>();
  for (const row of audits) {
    const metadata = row.metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata) && typeof metadata.slug === 'string') audited.add(metadata.slug);
  }
  const states: BuiltinState[] = [];
  for (const pkg of packages) {
    const installed = await prisma.pluginInstall.findUnique({ where: { slug: pkg.slug } });
    states.push({ pkg, installed: !!installed,
      upToDate: !!installed && installed.version === pkg.version && installed.zipHash === pkg.hash,
      audited: audited.has(pkg.slug) });
  }
  return states;
}

export async function syncBuiltinPlugins(builtinRoot: string): Promise<void> {
  const packages = await loadBuiltinPackages(builtinRoot);
  const lock = await takeSyncLock();
  try {
    const states = await readBuiltinStates(packages);

    // The install work runs outside every transaction. The installer writes
    // through the global client, so its rows commit on their own and the
    // transaction below never rolls them back.
    for (const state of states) {
      if (state.upToDate) continue;
      await pluginFsInstaller.installFromDirectory(state.pkg.directory, { source: 'builtin' });
    }

    // The instance of a fresh installation is enabled here, outside the
    // transaction that writes the audit, and the read of the instance is
    // valid because the installer committed it.
    for (const state of states) {
      if (!state.installed) {
        const instance = await getDefaultInstance(state.pkg.slug);
        if (!instance) throw new Error(`Builtin plugin "${state.pkg.slug}" has no default installation`);
        await PluginManagementService.updateInstance(instance.id, { enabled: true });
        continue;
      }
      // A sync that installed the package but died before its audit left an
      // installation the merchant cannot use. The audit is the marker of a
      // completed installation, so a missing audit means the installation is
      // incomplete and this sync completes it. A merchant that disabled the
      // instance keeps its choice, because that installation is audited.
      if (state.audited) continue;
      const instance = await getDefaultInstance(state.pkg.slug);
      if (instance && !instance.enabled) await PluginManagementService.updateInstance(instance.id, { enabled: true });
    }

    // The publication of a package is filesystem work and happens before the
    // blob is stored, so a package the runtime cannot load never gets a
    // blob.
    for (const pkg of packages) await publishBuiltinPackage(pkg.slug, pkg.hash, pkg.directory);

    // The transaction stores the blobs and writes the audit of every
    // installation that has none. The advisory lock is held by the session
    // lock above, so this transaction stays short and holds nothing but the
    // blob and the audit rows.
    await prisma.$transaction(async tx => {
      for (const state of states) {
        await pluginPackageBlobStore.put(tx, state.pkg.slug, state.pkg.hash, state.pkg.bytes);
        if (state.audited) continue;
        await AuditService.writeStaffAudit(tx, {
          staffUserId: 'system',
          staffEmail: 'system',
          actorUserId: 'system',
          actorEmail: 'system',
          action: 'BUILTIN_PLUGIN_INSTALLED',
          metadata: { slug: state.pkg.slug, version: state.pkg.version, source: 'builtin' },
        });
      }
    }, { timeout: 120_000 });

    // After the commit every package whose store entry is missing is
    // published again, so a package that lost its published copy in the
    // meantime is loadable again.
    for (const pkg of packages) await publishBuiltinPackage(pkg.slug, pkg.hash, pkg.directory);
  } finally {
    await lock.end().catch(() => undefined);
  }
}
