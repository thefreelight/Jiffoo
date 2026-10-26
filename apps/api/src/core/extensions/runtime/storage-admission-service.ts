import type { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { readStoredPluginManifest } from './stored-manifest';
import { pluginSigningError } from './plugin-signing-policy';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Public current-installation projection, sharing the lifecycle row lock. */
export class PluginStorageAdmissionService {
  static async current(tx: Transaction, installationId: string) {
    await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${installationId} FOR SHARE`;
    const row = await tx.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
    if (!row?.enabled || row.deletedAt || row.plugin.deletedAt || !row.plugin.zipHash || pluginSigningError(row.plugin)) throw new ApiError('PLUGIN_FILE_NOT_FOUND');
    if (row.taskDependencyUnavailable || readStoredPluginManifest(row.plugin).serviceDependencies?.length) throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE');
    if (await tx.pluginMigrationOperation.findFirst({ where: { slug: row.pluginSlug, phase: { in: ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'] } } })) throw new ApiError('PLUGIN_MAINTENANCE');
    return { id: row.id, slug: row.pluginSlug, generation: row.protectionGeneration, zipHash: row.plugin.zipHash };
  }
}
