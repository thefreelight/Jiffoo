import type { Prisma } from '@prisma/client';
import type { EventPayload } from '@jiffoo/shared';
import type { EventTransaction } from './emit';

export function customerSnapshot(user: {
  id: string; email: string; username: string; locale: string | null;
  emailVerified: boolean; createdAt: Date;
}): EventPayload<'customer.created'> {
  return {
    id: user.id, email: user.email, username: user.username, locale: user.locale,
    emailVerified: user.emailVerified, createdAt: user.createdAt.toISOString(),
  };
}

export async function productSnapshot(transaction: EventTransaction, id: string): Promise<EventPayload<'product.created'>> {
  const product = await (transaction as Prisma.TransactionClient).product.findUniqueOrThrow({
    where: { id },
    include: { translations: true, variants: true },
  });
  return {
    id: product.id, name: product.name, isActive: product.isActive,
    translations: product.translations.map(({ locale, name, description }) => ({ locale, name, description })),
    variants: product.variants.map(({ id, skuCode, salePrice, stock, isActive }) => ({
      id, skuCode, salePrice: Number(salePrice), stock, isActive,
    })),
  };
}
