import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { readStoredPluginManifest } from '@/core/extensions/runtime/stored-manifest';
import { pluginSigningError } from '@/core/extensions/runtime/plugin-signing-policy';
type PageSurface = 'shop' | 'admin';
type PageTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function projectPage(page: { id: string; path: string; title: unknown; placements?: unknown; requiresLogin?: boolean }) {
  return { id: page.id, path: page.path, title: page.title,
    ...(page.placements ? { placements: page.placements, requiresLogin: page.requiresLogin } : {}) };
}

/** Public read projections for current declared extension pages. */
export class PluginPageDeclarationService {
  static async currentPage(tx: PageTransaction, slug: string, surface: PageSurface, pageId: string) {
    const installation = await tx.pluginInstallation.findUnique({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } }, include: { plugin: true } });
    if (!installation?.enabled || installation.deletedAt || installation.plugin.deletedAt || !installation.plugin.zipHash || pluginSigningError(installation.plugin)) throw new ApiError('NOT_FOUND');
    const manifest = readStoredPluginManifest(installation.plugin);
    // Until G4 owns graph admission, declared dependencies never execute.
    if (manifest.serviceDependencies?.length || installation.taskDependencyUnavailable) throw new ApiError('NOT_FOUND');
    const page = (surface === 'shop' ? manifest.ui?.storefrontPages : manifest.ui?.adminPages)?.find(candidate => candidate.id === pageId);
    if (!page) throw new ApiError('NOT_FOUND');
    if (await tx.pluginMigrationOperation.findFirst({ where: { slug, phase: { in: ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'] } }, select: { id: true } })) throw new ApiError('PLUGIN_MAINTENANCE');
    return { installation: { id: installation.id, pluginSlug: installation.pluginSlug,
      protectionGeneration: installation.protectionGeneration, plugin: { zipHash: installation.plugin.zipHash } }, page };
  }

  static async currentForInstallation(tx: PageTransaction, installationId: string, surface: PageSurface, pageId: string) {
    const installation = await tx.pluginInstallation.findUnique({ where: { id: installationId }, select: { pluginSlug: true } });
    if (!installation) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
    return this.currentPage(tx, installation.pluginSlug, surface, pageId);
  }

  static async declarations(surface: 'shop' | 'admin', slug?: string) {
    const installations = await prisma.pluginInstallation.findMany({ where: { instanceKey: 'default', enabled: true,
      deletedAt: null, ...(slug ? { pluginSlug: slug } : {}), plugin: { deletedAt: null } }, include: { plugin: true }, orderBy: { pluginSlug: 'asc' } });
    const result = [];
    for (const installation of installations) {
      if (!installation.plugin.zipHash || pluginSigningError(installation.plugin) || installation.taskDependencyUnavailable) continue;
      const manifest = readStoredPluginManifest(installation.plugin);
      if (manifest.serviceDependencies?.length) continue;
      if (await prisma.pluginMigrationOperation.findFirst({ where: { slug: installation.pluginSlug,
        phase: { in: ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'] } }, select: { id: true } })) continue;
      const pages = surface === 'shop' ? manifest.ui?.storefrontPages : manifest.ui?.adminPages;
      if (pages?.length) result.push({ slug: installation.pluginSlug, pages: pages.map(projectPage) });
    }
    return result;
  }
}
