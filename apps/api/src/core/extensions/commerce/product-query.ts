import { prisma } from '@/config/database';
import { hostCapabilityAdapters } from '@/core/extensions/host-capabilities/service';
import { sharedProtection } from '@/infra/shared-protection';
import { ApiError } from '@/utils/api-errors';

export const COMMERCE_PRODUCTS_READ_PERMISSION = 'commerce:products.read';

async function authorized(installationId: string) {
  const installation = await prisma.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
  if (!installation) throw new ApiError('FORBIDDEN');
  if (!installation.enabled || installation.deletedAt || installation.plugin?.deletedAt) throw new ApiError('PLUGIN_DISABLED');
  const permissions = installation.grantedPermissions;
  if (!Array.isArray(permissions) || !permissions.includes(COMMERCE_PRODUCTS_READ_PERMISSION)) throw new ApiError('FORBIDDEN');
  return installation.protectionGeneration;
}

/** A bounded current-price projection; checkout always revalidates price and stock. */
export async function getPurchasableVariants(installationId: string, request: { variantIds: string[]; locale: string }) {
  await prisma.$transaction(tx => hostCapabilityAdapters().assertOperation(tx, installationId));
  const result = await getPurchasableVariantsForPage(installationId, request);
  await prisma.$transaction(tx => hostCapabilityAdapters().assertOperation(tx, installationId));
  return result;
}

/** Only the Core shell may use this entry after authenticating its page session. */
export async function getPurchasableVariantsForPage(installationId: string, request: { variantIds: string[]; locale: string }) {
  const generation = await authorized(installationId);
  if (!request || !Array.isArray(request.variantIds) || request.variantIds.length < 1 || request.variantIds.length > 100
    || request.variantIds.some(id => typeof id !== 'string' || !id || id.length > 128)
    || !['en', 'zh-Hans', 'zh-Hant'].includes(request.locale)) throw new ApiError('VALIDATION_ERROR');
  const permit = await sharedProtection.rate(`commerce:products:${installationId}`, 60_000, 30);
  if (!permit.allowed) throw new ApiError('RATE_LIMITED');
  const result = await hostCapabilityAdapters().catalogue([...new Set(request.variantIds)], request.locale);
  if (await authorized(installationId) !== generation) throw new ApiError('FORBIDDEN');
  return result;
}
