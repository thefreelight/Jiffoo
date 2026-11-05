import { prisma } from '@/config/database';
import { InventoryService } from '@/core/inventory/service';
import { systemSettingsService } from '@/core/settings/service';
import { decimalToMinor, minorToDecimal } from '@/core/shared/money';
import { fulfillmentPolicyFor } from '@/core/shared/fulfillment-policy';

/** Resolve a variant's owning product without exposing catalogue persistence. */
export class CatalogReadService {
  /** Published catalogue prices are read from their owner, never a plugin mapping. */
  static async purchasableVariants(variantIds: string[], locale: string) {
    const currency = await systemSettingsService.getShopCurrency();
    return prisma.$transaction(async tx => {
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true, product: { isActive: true } },
        select: { id: true, name: true, productId: true, salePrice: true,
          product: { select: { name: true, slug: true, productType: true, translations: { where: { locale }, select: { name: true } } } } },
      });
      const stocks = await InventoryService.getAvailableStockByVariantIds(variants.map(item => item.id), tx);
      const byId = new Map(variants.map(item => [item.id, item]));
      return { items: variantIds.flatMap(id => {
        const item = byId.get(id);
        if (!item || item.salePrice.isNegative()) return [];
        return [{ variantId: item.id, productId: item.productId, slug: item.product.slug,
          title: item.product.translations[0]?.name || item.product.name, variantTitle: item.name,
          currency, price: minorToDecimal(decimalToMinor(item.salePrice.toString(), currency), currency),
          availability: !fulfillmentPolicyFor(item.product.productType).tracksInventory || (stocks.get(id) ?? 0) > 0 ? 'available' as const : 'out_of_stock' as const }];
      }) };
    }, { isolationLevel: 'RepeatableRead', timeout: 5000 });
  }

  static async productForVariant(variantId: string): Promise<{ productId: string } | null> {
    return prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } });
  }
}
