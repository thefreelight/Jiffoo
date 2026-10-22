import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { currentPage, type PageTransaction } from './sessions';

/** Installation locks precede attribution locks, matching lifecycle admission. */
export async function bindPurchaseOrigin(tx: PageTransaction, id: string, customerId: string, orderId: string) {
  const candidate = await tx.pluginPurchaseOrigin.findUnique({ where: { id } });
  if (!candidate?.installationId) throw new ApiError('VALIDATION_ERROR');
  await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${candidate.installationId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM public.plugin_purchase_origins WHERE id = ${id} FOR UPDATE`;
  const origin = await tx.pluginPurchaseOrigin.findUnique({ where: { id } });
  const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
  if (!origin || origin.customerId !== customerId || origin.orderId || origin.expiresAt <= now) throw new ApiError('VALIDATION_ERROR');
  const { installation, page } = await currentPage(tx, origin.pluginSlug, 'shop', origin.pageId);
  if (installation.id !== origin.installationId || installation.protectionGeneration !== origin.generation || page.path !== origin.canonicalPath) throw new ApiError('VALIDATION_ERROR');
  await tx.pluginPurchaseOrigin.update({ where: { id }, data: { orderId } });
}

export async function purchaseReturnTarget(orderId: string, customerId: string) {
  return prisma.$transaction(async tx => {
    const origin = await tx.pluginPurchaseOrigin.findUnique({ where: { orderId } });
    if (!origin?.installationId || origin.customerId !== customerId) return undefined;
    try {
      const { installation, page } = await currentPage(tx, origin.pluginSlug, 'shop', origin.pageId);
      if (installation.id !== origin.installationId || installation.protectionGeneration !== origin.generation || page.path !== origin.canonicalPath) return undefined;
      return { path: `/apps/${origin.pluginSlug}${page.path === '/' ? '' : page.path}`, title: page.title };
    } catch (error) {
      if (error instanceof ApiError && ['NOT_FOUND', 'PLUGIN_MAINTENANCE'].includes(error.code)) return undefined;
      throw error;
    }
  });
}
