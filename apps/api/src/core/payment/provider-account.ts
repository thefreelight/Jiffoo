import { PLUGIN_CONTRACT_VERSIONS, type PaymentAccountIdentity, type PaymentV2Output } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { getDefaultInstallationRow } from '@/core/extensions/registry';
import { ApiError } from '@/utils/api-errors';
import type { NotificationTransaction } from '@/core/notifications/service';

/**
 * The bounds of the transaction that binds the provider account.
 *
 * The default bounds of Prisma are too small for the transaction: it writes
 * the account of the provider and its binding to the installation, and it
 * waits for the connection of the pool.
 */
const PAYMENT_PROVIDER_ACCOUNT_TRANSACTION_MAX_WAIT_MS = 10_000;
const PAYMENT_PROVIDER_ACCOUNT_TRANSACTION_TIMEOUT_MS = 30_000;

export function samePaymentAccount(first: PaymentAccountIdentity, second: PaymentAccountIdentity): boolean {
  return first.namespace === second.namespace && first.merchantAccount === second.merchantAccount && first.environment === second.environment;
}
export async function bindPaymentProviderAccount(slug: string, currency: string) {
  const description = await callContract(slug, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'describe', { storeCurrency: currency }) as PaymentV2Output<'describe'>;
  const installation = await getDefaultInstallationRow(slug);
  if (!installation || !installation.enabled || installation.deletedAt) throw new ApiError('PLUGIN_DISABLED');
  // The account of the provider and the binding of that account to the
  // installation belong together, so both writes are one transaction: a
  // failure of the second write never leaves an orphan account row behind.
  const account = await prisma.$transaction(async tx => {
    const account = await tx.paymentProviderAccount.upsert({
      where: { namespace_merchantAccount_environment: description.account }, update: {}, create: description.account,
    });
    await tx.paymentProviderBinding.upsert({ where: { installationId_providerKey: { installationId: installation.id, providerKey: account.providerKey } },
      update: {}, create: { installationId: installation.id, providerKey: account.providerKey } });
    return account;
  }, { maxWait: PAYMENT_PROVIDER_ACCOUNT_TRANSACTION_MAX_WAIT_MS, timeout: PAYMENT_PROVIDER_ACCOUNT_TRANSACTION_TIMEOUT_MS });
  return { account, description };
}
/**
 * Bind the provider account of an observed payment to the installation of the
 * provider.
 *
 * The binding is idempotent, and it returns false when the installation is
 * gone or disabled: the caller then knows that the observation needs a
 * review. A caller that owns a transaction passes it, so the binding joins
 * that transaction instead of opening a second connection while the
 * transaction holds the first. The installation row is read with that
 * transaction as well, so the read joins the snapshot of the caller and no
 * external I/O - the shared cache - happens inside the transaction.
 */
export async function bindObservedPaymentAccount(slug: string, providerKey: string, transaction?: NotificationTransaction): Promise<boolean> {
  const installation = await getDefaultInstallationRow(slug, transaction);
  if (!installation || !installation.enabled || installation.deletedAt) return false;
  const binding = {
    where: { installationId_providerKey: { installationId: installation.id, providerKey } },
    update: {}, create: { installationId: installation.id, providerKey },
  };
  if (transaction) await transaction.paymentProviderBinding.upsert(binding);
  else await prisma.paymentProviderBinding.upsert(binding);
  return true;
}
