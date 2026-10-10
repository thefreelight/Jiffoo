import type { PaymentAccountIdentity, PaymentV2Output } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { ApiError } from '@/utils/api-errors';

export function samePaymentAccount(first: PaymentAccountIdentity, second: PaymentAccountIdentity): boolean {
  return first.namespace === second.namespace && first.merchantAccount === second.merchantAccount && first.environment === second.environment;
}
export async function bindPaymentProviderAccount(slug: string, currency: string) {
  const description = await callContract(slug, 'payment', 2, 'describe', { storeCurrency: currency }) as PaymentV2Output<'describe'>;
  const installation = await prisma.pluginInstallation.findUnique({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
  if (!installation || !installation.enabled || installation.deletedAt) throw new ApiError('PLUGIN_DISABLED');
  const account = await prisma.paymentProviderAccount.upsert({
    where: { namespace_merchantAccount_environment: description.account }, update: {}, create: description.account,
  });
  await prisma.paymentProviderBinding.upsert({ where: { installationId_providerKey: { installationId: installation.id, providerKey: account.providerKey } },
    update: {}, create: { installationId: installation.id, providerKey: account.providerKey } });
  return { account, description };
}
export async function bindObservedPaymentAccount(slug: string, providerKey: string): Promise<boolean> {
  const installation = await prisma.pluginInstallation.findUnique({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
  if (!installation || !installation.enabled || installation.deletedAt) return false;
  await prisma.paymentProviderBinding.upsert({ where: { installationId_providerKey: { installationId: installation.id, providerKey } },
    update: {}, create: { installationId: installation.id, providerKey } });
  return true;
}
