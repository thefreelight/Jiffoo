import { prisma } from '@/config/database';

/** Resolve a variant's owning product without exposing catalogue persistence. */
export class CatalogReadService {
  static async productForVariant(variantId: string): Promise<{ productId: string } | null> {
    return prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } });
  }
}
