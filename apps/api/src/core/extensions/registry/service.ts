/**
 * Extension provider registry
 *
 * Neutral, domain-independent view over installed plugin installations. The
 * plugin-management module owns installation lifecycle; this module owns the
 * read side used by commerce modules (providers per capability contract,
 * installed packages, default instance).
 *
 * The registry publishes explicit projections instead of the stored rows: a
 * consumer only ever receives the fields it actually reads, and every query
 * names those fields in a `select` instead of pulling the whole row.
 *
 * The hot reads of the registry are served from the shared Redis cache. They
 * are keyed by the generation of the registry, which names the plugin cache
 * version and the freshness marker of the two plugin tables, so a cached entry
 * is invalidated by every change of the registry, whether the change came
 * through the application or straight through the database. The cache is never
 * a source of truth: an unreachable or unwritable cache degrades to the
 * database read.
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { PLUGIN_CONTRACT_VERSIONS, type PluginContractName, type PluginTrustLevel } from '@jiffoo/shared';

/**
 * An installed plugin package, reduced to the fields the commerce readers use:
 * the slug that identifies the package, its category and its stored manifest.
 */
export interface PluginPackageProjection {
  slug: string;
  category: string | null;
  manifestJson: unknown;
}

/**
 * An installed plugin package, reduced to the fields the admin installer
 * listing reads. The listing needs the packaging metadata of every installed
 * package, so it gets its own projection instead of the narrow commerce one.
 */
export interface InstalledPluginPackageProjection {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  category: string | null;
  entryModule: string | null;
  source: string;
  trustLevel: PluginTrustLevel;
  publisherId: string | null;
  publisherName: string | null;
  publisherCertificateFingerprint: string | null;
  signingRoot: string | null;
  zipHash: string | null;
  manifestJson: unknown;
  permissions: unknown;
  author: string | null;
  authorUrl: string | null;
  deletedAt: Date | null;
  installedAt: Date;
  updatedAt: Date;
}

/**
 * An installed plugin instance, reduced to the fields its readers use: the
 * installation identity, its lifecycle state and its stored configuration.
 */
export interface PluginInstanceProjection {
  id: string;
  pluginSlug: string;
  instanceKey: string;
  enabled: boolean;
  deletedAt: Date | null;
  configJson: unknown;
  protectionGeneration: bigint;
}

/**
 * A plugin installation that declares a capability contract. The consumers
 * only ever address the provider by its plugin slug.
 */
export interface ProviderProjection {
  pluginSlug: string;
}

/**
 * The package of an installed plugin, reduced to the fields the package
 * readers use: its identity, its packaging metadata and its trust state.
 */
export interface PluginPackageInstallProjection {
  slug: string;
  version: string;
  zipHash: string | null;
  manifestJson: unknown;
  trustLevel: PluginTrustLevel;
  signingRoot: string | null;
  deletedAt: Date | null;
}

/**
 * An installed plugin instance with the package it points at, reduced to the
 * fields the installation readers use.
 */
export interface PluginInstallationProjection {
  id: string;
  pluginSlug: string;
  instanceKey: string;
  enabled: boolean;
  deletedAt: Date | null;
  protectionGeneration: bigint;
  package: PluginPackageInstallProjection;
}

export function declaresContract(manifestJson: unknown, contract: PluginContractName): boolean {
  return Array.isArray((manifestJson as { contracts?: unknown[] } | null)?.contracts)
    && (manifestJson as { contracts: Array<{ name?: unknown; version?: unknown }> }).contracts.some((declaration) => declaration.name === contract && declaration.version === PLUGIN_CONTRACT_VERSIONS[contract]);
}

/**
 * The seconds a cached registry entry stays valid.
 *
 * The generation of the registry invalidates an entry exactly when the
 * registry changes, so the time to live is only the backstop for an entry
 * whose generation never changed.
 */
const REGISTRY_CACHE_TTL_SECONDS = 30;

/**
 * An enabled installation of a live package, reduced to the fields the
 * registry readers use: the slug of the package and its stored manifest.
 */
interface RegistryInstallationRow {
  pluginSlug: string;
  manifestJson: unknown;
}

/**
 * The plugin cache version the registry entries are keyed by.
 *
 * A cache failure must never fail a read, so an unreachable cache degrades to
 * the version zero, which misses every cached entry.
 */
async function registryCacheVersion(): Promise<number> {
  try {
    return await CacheService.getPluginVersion();
  } catch {
    // An unreachable cache degrades to the database read.
    return 0;
  }
}

/**
 * The freshness marker of the two plugin tables the registry reads.
 *
 * The marker names the row counts, the counts of the rows the registry reads,
 * and the newest update of both tables, so a write to either table changes it,
 * no matter whether the write came through the application or straight through
 * the database. The read is one aggregate over two tiny tables: it never reads
 * a manifest and never reads a row body.
 */
async function registryFreshness(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ installationCount: number; enabledInstallationCount: number; installationUpdatedAt: string; packageCount: number; livePackageCount: number; packageUpdatedAt: string }>>`
    SELECT
      (SELECT count(*)::integer FROM public.plugin_installations) AS "installationCount",
      (SELECT count(*)::integer FROM public.plugin_installations WHERE enabled AND "deletedAt" IS NULL) AS "enabledInstallationCount",
      (SELECT COALESCE(to_char(max("updatedAt"), 'YYYYMMDDHH24MISSMS'), '0') FROM public.plugin_installations) AS "installationUpdatedAt",
      (SELECT count(*)::integer FROM public.plugin_installs) AS "packageCount",
      (SELECT count(*)::integer FROM public.plugin_installs WHERE "deletedAt" IS NULL) AS "livePackageCount",
      (SELECT COALESCE(to_char(max("updatedAt"), 'YYYYMMDDHH24MISSMS'), '0') FROM public.plugin_installs) AS "packageUpdatedAt"
  `;
  const row = rows[0];
  if (!row) return '0-0-0-0-0-0';
  return `${row.installationCount}-${row.enabledInstallationCount}-${row.installationUpdatedAt}-${row.packageCount}-${row.livePackageCount}-${row.packageUpdatedAt}`;
}

/**
 * The generation the registry entries are keyed by.
 *
 * The generation names the plugin cache version and the freshness marker of the
 * two plugin tables. An entry is therefore read again as soon as the version
 * or the tables changed, whether the change came through the application or
 * straight through the database.
 */
async function registryGeneration(): Promise<string> {
  const version = await registryCacheVersion();
  const freshness = await registryFreshness();
  return `v${version}:${freshness}`;
}

/**
 * Read a cached registry entry.
 *
 * A cache failure degrades to the database read, never to an error.
 */
async function readRegistryEntry<T>(generation: string, key: string): Promise<T | null> {
  try {
    return await CacheService.getPluginRegistry<T>(generation, key);
  } catch {
    // An unreachable cache degrades to the database read.
    return null;
  }
}

/**
 * Write a cached registry entry.
 *
 * A cache failure degrades to the database read, never to an error.
 */
async function writeRegistryEntry(generation: string, key: string, value: unknown): Promise<void> {
  try {
    await CacheService.setPluginRegistry(generation, key, value, REGISTRY_CACHE_TTL_SECONDS);
  } catch {
    // An unwritable cache degrades to the database read.
  }
}

/**
 * The enabled installations of the live packages.
 *
 * This is the hot path of the registry: the payment, tax, fulfilment,
 * notification and quote paths ask for it on every request, so the rows are
 * kept in the shared Redis cache. The entry is keyed by the generation of the
 * registry, which names the plugin cache version and the freshness marker of
 * the two plugin tables. The generation is captured before the database read
 * and reused for the write, so a registry change that commits while the read
 * runs stores the entry under the old generation, which no reader asks for any
 * more, instead of under the new generation of the stale data.
 */
async function readEnabledInstallations(): Promise<RegistryInstallationRow[]> {
  const generation = await registryGeneration();
  const cached = await readRegistryEntry<RegistryInstallationRow[]>(generation, 'enabled-installations');
  if (cached) return cached;

  const installations = await prisma.pluginInstallation.findMany({
    where: { enabled: true, deletedAt: null, plugin: { deletedAt: null } },
    select: { pluginSlug: true, plugin: { select: { manifestJson: true } } },
  });
  const rows = installations.map((installation) => ({
    pluginSlug: installation.pluginSlug,
    manifestJson: installation.plugin.manifestJson,
  }));
  await writeRegistryEntry(generation, 'enabled-installations', rows);
  return rows;
}

export async function listProviders(contract: 'payment' | 'shipping'): Promise<ProviderProjection[]> {
  const installations = await readEnabledInstallations();
  return installations
    .filter((installation) => declaresContract(installation.manifestJson, contract))
    .map((installation) => ({ pluginSlug: installation.pluginSlug }));
}

export async function resolveSingleProvider(contract: 'tax' | 'fulfillment' | 'notification'): Promise<ProviderProjection | null> {
  const installations = await readEnabledInstallations();
  const provider = installations.find((installation) => declaresContract(installation.manifestJson, contract));
  return provider ? { pluginSlug: provider.pluginSlug } : null;
}

/**
 * Get all plugin packages.
 * By default excludes soft-deleted packages unless includeDeleted=true.
 *
 * The packages are kept in the shared Redis cache under the generation of the
 * registry, exactly like the enabled installations above.
 */
export async function getAllPluginPackages(options?: { includeDeleted?: boolean }): Promise<PluginPackageProjection[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const generation = await registryGeneration();
  const key = includeDeleted ? 'packages-all' : 'packages-live';
  const cached = await readRegistryEntry<PluginPackageProjection[]>(generation, key);
  if (cached) return cached;

  const rows = await prisma.pluginInstall.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { installedAt: 'desc' },
    select: { slug: true, category: true, manifestJson: true },
  });
  const packages = rows.map((row) => ({ slug: row.slug, category: row.category, manifestJson: row.manifestJson }));
  await writeRegistryEntry(generation, key, packages);
  return packages;
}

/**
 * Get the installed plugin packages for the admin installer listing.
 *
 * The listing reads the packaging metadata of every installed package, so it
 * selects those fields explicitly instead of reusing the narrow commerce
 * projection.
 */
export async function listInstalledPluginPackages(options?: { includeDeleted?: boolean }): Promise<InstalledPluginPackageProjection[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const rows = await prisma.pluginInstall.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { installedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      version: true,
      description: true,
      category: true,
      entryModule: true,
      source: true,
      trustLevel: true,
      publisherId: true,
      publisherName: true,
      publisherCertificateFingerprint: true,
      signingRoot: true,
      zipHash: true,
      manifestJson: true,
      permissions: true,
      author: true,
      authorUrl: true,
      deletedAt: true,
      installedAt: true,
      updatedAt: true,
    },
  });

  return rows;
}

/**
 * The default installation of a plugin, reduced to the fields its readers use:
 * the identity of the installation, its lifecycle state and the moment it was
 * deleted.
 */
export interface DefaultInstallationProjection {
  id: string;
  enabled: boolean;
  deletedAt: Date | null;
}

/**
 * The cached form of a live default installation.
 *
 * Only a live installation is cached, so its deletion marker is always null
 * and the entry stays plain JSON.
 */
interface CachedDefaultInstallation {
  id: string;
  enabled: boolean;
  deletedAt: null;
}

/**
 * The default installation of a plugin.
 *
 * The payment module reads the installation of the provider it binds or calls.
 * That read belongs to this module, the module that owns the
 * `plugin_installations` table, so the payment module no longer queries the
 * table of another domain. The projection names the fields the readers use,
 * like every other projection of this module.
 *
 * The projection is served from the shared cache under the plugin cache
 * version, so a reader that owns a transaction reads the installation without
 * opening a second connection. The version is bumped whenever a plugin is
 * installed, enabled, disabled, reconfigured or removed, so the entry is
 * invalidated by every change of the registry. The cache is never a source of
 * truth: an unreachable cache degrades to the database read.
 *
 * A missing, disabled or deleted installation is reported as `null`, so the
 * reader treats it as an unavailable installation.
 *
 * @param slug Slug of the plugin
 */
export async function getDefaultInstallationRow(slug: string): Promise<DefaultInstallationProjection | null> {
  const version = `v${await registryCacheVersion()}`;
  const key = `default-installation:${slug}`;
  const cached = await readRegistryEntry<CachedDefaultInstallation>(version, key);
  if (cached) return cached;

  const installation = await prisma.pluginInstallation.findUnique({
    where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    select: { id: true, enabled: true, deletedAt: true },
  });
  if (!installation || !installation.enabled || installation.deletedAt) return null;
  await writeRegistryEntry(version, key, installation);
  return installation;
}

/**
 * The stored row of the default installation of a plugin with the deletion
 * state of the package it points at.
 *
 * @param slug Slug of the plugin
 */
export async function getDefaultInstallationRowWithPackage(slug: string) {
  return prisma.pluginInstallation.findUnique({
    where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    include: { plugin: { select: { deletedAt: true } } },
  });
}

/**
 * Get default instance for a plugin
 */
export async function getDefaultInstance(slug: string): Promise<PluginInstanceProjection | null> {
  const installation = await prisma.pluginInstallation.findUnique({
    where: {
      pluginSlug_instanceKey: {
        pluginSlug: slug,
        instanceKey: 'default',
      },
    },
    select: {
      id: true,
      pluginSlug: true,
      instanceKey: true,
      enabled: true,
      deletedAt: true,
      configJson: true,
      protectionGeneration: true,
    },
  });

  if (!installation) return null;
  return {
    id: installation.id,
    pluginSlug: installation.pluginSlug,
    instanceKey: installation.instanceKey,
    enabled: installation.enabled,
    deletedAt: installation.deletedAt,
    configJson: installation.configJson,
    protectionGeneration: installation.protectionGeneration,
  };
}

/**
 * Read an installed plugin instance by its installation id.
 *
 * The read is the registry's view of the `plugin_installations` table: only an
 * enabled instance of a live package with the expected package hash is found,
 * and the reader receives a projection instead of the stored rows. A missing
 * instance is reported as `null`, never as an error.
 *
 * @param installationId Identity of the installed instance
 * @param zipHash Hash of the package the instance has to serve
 */
export async function getInstallationById(installationId: string, zipHash: string): Promise<PluginInstallationProjection | null> {
  const installation = await prisma.pluginInstallation.findFirst({
    where: { id: installationId, enabled: true, deletedAt: null, plugin: { deletedAt: null, zipHash } },
    select: {
      id: true,
      pluginSlug: true,
      instanceKey: true,
      enabled: true,
      deletedAt: true,
      protectionGeneration: true,
      plugin: {
        select: {
          slug: true,
          version: true,
          zipHash: true,
          manifestJson: true,
          trustLevel: true,
          signingRoot: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!installation) return null;
  return {
    id: installation.id,
    pluginSlug: installation.pluginSlug,
    instanceKey: installation.instanceKey,
    enabled: installation.enabled,
    deletedAt: installation.deletedAt,
    protectionGeneration: installation.protectionGeneration,
    package: {
      slug: installation.plugin.slug,
      version: installation.plugin.version,
      zipHash: installation.plugin.zipHash,
      manifestJson: installation.plugin.manifestJson,
      trustLevel: installation.plugin.trustLevel,
      signingRoot: installation.plugin.signingRoot,
      deletedAt: installation.plugin.deletedAt,
    },
  };
}
