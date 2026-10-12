import { Prisma } from '@prisma/client';

export type CatalogSnapshot = {
  source: 'catalog-backfill' | 'order-time';
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  skuCode: string | null;
  variantAttributes: Prisma.JsonValue;
  productType: string;
  productTypeData: Prisma.JsonValue;
  productImages: string[];
  productTranslations: Record<string, string>;
};

export function createCatalogSnapshot(
  product: { id: string; name: string; productType: string; typeData: Prisma.JsonValue; translations: Array<{ locale: string; name: string }> },
  variant: { id: string; name: string; skuCode: string | null; attributes: Prisma.JsonValue },
): CatalogSnapshot {
  const typeData = product.typeData;
  const images = typeData && typeof typeData === 'object' && !Array.isArray(typeData) ? typeData.images : null;
  return {
    source: 'order-time', productId: product.id, variantId: variant.id,
    productName: product.name, variantName: variant.name, skuCode: variant.skuCode,
    variantAttributes: variant.attributes, productType: product.productType,
    productTypeData: typeData,
    productImages: Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string') : [],
    productTranslations: Object.fromEntries(product.translations.map(({ locale, name }) => [locale, name])),
  };
}

export function readCatalogSnapshot(value: Prisma.JsonValue): CatalogSnapshot {
  return value as unknown as CatalogSnapshot;
}

export function snapshotProductName(snapshot: CatalogSnapshot, locale?: string | null): string {
  return (locale && snapshot.productTranslations[locale]) || snapshot.productName;
}

export function isOrderItemCatalogRestriction(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    return /order_items_(productId|variantId)_fkey/.test(String(error.meta?.field_name));
  }
  // PostgreSQL 18 reports RESTRICT violations as 23001, which Prisma 6 exposes as an unknown request error.
  return error instanceof Prisma.PrismaClientUnknownRequestError && /code: "23001"/.test(error.message) &&
    /order_items_(productId|variantId)_fkey/.test(error.message);
}
