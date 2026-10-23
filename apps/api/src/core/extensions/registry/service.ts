/**
 * Extension provider registry
 *
 * Neutral, domain-independent view over installed plugin installations. The
 * plugin-management module owns installation lifecycle; this module owns the
 * read side used by commerce modules (providers per capability contract,
 * installed packages, default instance).
 */

import { prisma } from '@/config/database';
import type { PluginInstall, PluginInstallation } from '@prisma/client';
import { PLUGIN_CONTRACT_VERSIONS, type PluginContractName } from '@jiffoo/shared';

export function declaresContract(manifestJson: unknown, contract: PluginContractName): boolean {
  return Array.isArray((manifestJson as { contracts?: unknown[] } | null)?.contracts)
    && (manifestJson as { contracts: Array<{ name?: unknown; version?: unknown }> }).contracts.some((declaration) => declaration.name === contract && declaration.version === PLUGIN_CONTRACT_VERSIONS[contract]);
}

export async function listProviders(contract: 'payment' | 'shipping'): Promise<PluginInstallation[]> {
  const installations = await prisma.pluginInstallation.findMany({ where: { enabled: true, deletedAt: null, plugin: { deletedAt: null } }, include: { plugin: true } });
  return installations.filter((installation) => declaresContract(installation.plugin.manifestJson, contract));
}

export async function resolveSingleProvider(contract: 'tax' | 'fulfillment' | 'notification'): Promise<PluginInstallation | null> {
  const installations = await prisma.pluginInstallation.findMany({ where: { enabled: true, deletedAt: null, plugin: { deletedAt: null } }, include: { plugin: true } });
  return installations.find((installation) => declaresContract(installation.plugin.manifestJson, contract)) ?? null;
}

/**
 * Get all plugin packages.
 * By default excludes soft-deleted packages unless includeDeleted=true.
 */
export async function getAllPluginPackages(options?: { includeDeleted?: boolean }): Promise<PluginInstall[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const rows = await prisma.pluginInstall.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { installedAt: 'desc' },
  });

  return rows;
}

/**
 * Get default instance for a plugin
 */
export async function getDefaultInstance(slug: string): Promise<PluginInstallation | null> {
  return prisma.pluginInstallation.findUnique({
    where: {
      pluginSlug_instanceKey: {
        pluginSlug: slug,
        instanceKey: 'default',
      },
    },
  });
}
