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
