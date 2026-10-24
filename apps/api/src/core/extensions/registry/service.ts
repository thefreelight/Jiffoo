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
 */

import { prisma } from '@/config/database';
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

export async function listProviders(contract: 'payment' | 'shipping'): Promise<ProviderProjection[]> {
  const installations = await prisma.pluginInstallation.findMany({
    where: { enabled: true, deletedAt: null, plugin: { deletedAt: null } },
    select: { pluginSlug: true, plugin: { select: { manifestJson: true } } },
  });
  return installations
    .filter((installation) => declaresContract(installation.plugin.manifestJson, contract))
    .map((installation) => ({ pluginSlug: installation.pluginSlug }));
}

export async function resolveSingleProvider(contract: 'tax' | 'fulfillment' | 'notification'): Promise<ProviderProjection | null> {
  const installations = await prisma.pluginInstallation.findMany({
    where: { enabled: true, deletedAt: null, plugin: { deletedAt: null } },
    select: { pluginSlug: true, plugin: { select: { manifestJson: true } } },
  });
  const provider = installations.find((installation) => declaresContract(installation.plugin.manifestJson, contract));
  return provider ? { pluginSlug: provider.pluginSlug } : null;
}

/**
 * Get all plugin packages.
 * By default excludes soft-deleted packages unless includeDeleted=true.
 */
export async function getAllPluginPackages(options?: { includeDeleted?: boolean }): Promise<PluginPackageProjection[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const rows = await prisma.pluginInstall.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { installedAt: 'desc' },
    select: { slug: true, category: true, manifestJson: true },
  });

  return rows.map((row) => ({ slug: row.slug, category: row.category, manifestJson: row.manifestJson }));
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
