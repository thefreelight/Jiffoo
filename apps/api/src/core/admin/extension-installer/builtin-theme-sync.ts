import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Client } from 'pg';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { processDatabaseUrl } from '@/infra/core-process-identity';
import { installBuiltinTheme } from './theme-service';
import { activateTheme, prepareThemeActivation, acquireThemeLeases, releaseThemeLeases, type ThemeActivationPlan } from './theme-runtime';
import { validateThemeManifest, validateThemeZip } from '@/core/storage/theme-validator';
import { ExtensionInstallerError } from '@/core/extensions/shared/errors';
import { ThemePackageResolutionError } from '@/core/storage/current-theme-package';

const LOCK = 824_301_552;
/** The seconds a sync waits for the lock of a sync that is still running. */
const LOCK_WAIT_SECONDS = 120;
/** The milliseconds between two attempts to take the sync lock. */
const LOCK_RETRY_MS = 250;
/** The milliseconds the activation transaction may hold its connection. */
const ACTIVATION_TRANSACTION_TIMEOUT_MS = 30_000;
/** The milliseconds the activation transaction waits for a free connection of the pool. */
const ACTIVATION_TRANSACTION_MAX_WAIT_MS = 10_000;

/** One activation of the sync: the theme that becomes the active one. */
type Activation = { target: 'shop' | 'admin'; slug: string; action: string; onlyIfEmpty: boolean };

/**
 * Takes the sync lock on a connection of its own.
 *
 * The lock is a session lock, so it covers the whole sync, including the
 * filesystem work that runs outside of every transaction. A transaction-scoped
 * lock would be released before the installer commits its own rows. The
 * connection is closed when the sync ends, which releases the lock even when
 * the sync failed.
 */
async function takeSyncLock(): Promise<Client> {
  const client = new Client({ connectionString: processDatabaseUrl(env.DATABASE_URL, 'core', undefined, true), connectionTimeoutMillis: 5_000 });
  client.on('error', () => undefined);
  await client.connect();
  const deadline = Date.now() + LOCK_WAIT_SECONDS * 1000;
  for (;;) {
    const result = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS locked', [LOCK]);
    if (result.rows[0]?.locked) return client;
    if (Date.now() >= deadline) {
      await client.end().catch(() => undefined);
      throw new Error('Builtin theme sync is held by another process');
    }
    await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS));
  }
}

/**
 * Checks the package of the active theme of a target.
 *
 * The check reads the stored package and hashes it, so it runs outside every
 * transaction.
 *
 * @returns true when the active package is missing or corrupt.
 */
async function activePackageIsInvalid(target: 'shop' | 'admin', active: { slug: string; packageHash: string }): Promise<boolean> {
  try {
    const stored = await prisma.theme.findUniqueOrThrow({ where: { slug: active.slug } });
    const manifest = validateThemeManifest(stored.manifestJson);
    const blob = await prisma.themePackageBlob.findUnique({ where: { themeSlug_packageHash: { themeSlug: active.slug, packageHash: active.packageHash } } });
    if (stored.target !== target || manifest.target !== target || stored.packageHash !== active.packageHash || !blob)
      throw new ThemePackageResolutionError('THEME_PACKAGE_UNAVAILABLE');
    const bytes = Buffer.from(blob.bytes);
    if (bytes.length !== blob.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== active.packageHash)
      throw new ThemePackageResolutionError('THEME_PACKAGE_CORRUPT');
    const packaged = validateThemeZip(bytes).manifest;
    if (packaged.slug !== stored.slug || packaged.target !== target || packaged.version !== stored.version
      || !isDeepStrictEqual(packaged, manifest))
      throw new ThemePackageResolutionError('THEME_PACKAGE_CORRUPT');
    return false;
  } catch (cause) {
    if (!(cause instanceof ExtensionInstallerError) && !(cause instanceof ThemePackageResolutionError)) throw cause;
    // Preserve invalid packages and configuration for inspection; only the active pointer changes.
    return true;
  }
}

export async function syncBuiltinThemes(root: string): Promise<void> {
  // The lock of the sync, held for the whole sync on a connection of its own.
  const lock = await takeSyncLock();
  try {
    // The filesystem work and the installs, outside every transaction. Every
    // install commits its own rows, so a slow disk never holds a connection.
    const builtins = new Map<string, string>();
    const activations: Activation[] = [];
    for (const entry of (await fs.readdir(root, { withFileTypes: true })).filter(item => item.isDirectory())) {
      const installed = await installBuiltinTheme(path.join(root, entry.name));
      const target = installed.target as 'shop' | 'admin';
      if (installed.slug === `default-${installed.target}`) builtins.set(installed.target, installed.slug);
      activations.push({ target, slug: installed.slug, action: 'theme.activate', onlyIfEmpty: true });
    }

    // The check of the active packages, outside every transaction: it reads
    // the stored package and hashes it.
    for (const target of ['admin', 'shop'] as const) {
      const fallback = builtins.get(target);
      if (!fallback) continue;
      const active = await prisma.themeActive.findUnique({ where: { target } });
      if (!active) continue;
      if (await activePackageIsInvalid(target, active)) {
        // The active package is missing or corrupt: the pointer falls back to
        // the builtin theme of the target.
        activations.push({ target, slug: fallback, action: 'theme.startup_fallback', onlyIfEmpty: false });
      }
    }

    // The preparation of the activations, outside every transaction: it reads
    // the theme rows and resolves their packages.
    const prepared: Array<{ activation: Activation; plan: ThemeActivationPlan }> = [];
    for (const activation of activations) {
      prepared.push({ activation, plan: await prepareThemeActivation(activation.target, activation.slug, 'system', activation.action, activation.onlyIfEmpty) });
    }

    if (prepared.length) {
      // The theme operation leases are held across the transaction, so a
      // concurrent theme operation cannot interleave with the pointer switch.
      const leases = await acquireThemeLeases(activations.map(activation => ({ target: activation.target, slug: activation.slug })));
      try {
        // One short transaction: the active pointers and their audits. The
        // filesystem work and the hashing stay outside it.
        await prisma.$transaction(async tx => {
          for (const { activation, plan } of prepared) {
            await activateTheme(activation.target, activation.slug, 'system', activation.action, activation.onlyIfEmpty, { transaction: { tx, leases }, plan });
          }
        }, { timeout: ACTIVATION_TRANSACTION_TIMEOUT_MS, maxWait: ACTIVATION_TRANSACTION_MAX_WAIT_MS });
      } finally {
        // The release waits for the commit: the transaction holds the lock of
        // the lease rows while it fences them.
        await releaseThemeLeases(leases);
      }
    }
  } finally {
    // Closing the connection releases the session lock, also when the sync
    // failed.
    await lock.end().catch(() => undefined);
  }
}
