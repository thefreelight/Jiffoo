// @ts-nocheck
import crypto from 'crypto';
import { prisma } from '@/config/database';
import { InventoryService } from '@/core/inventory/service';
import { WarehouseService } from '@/core/warehouse/service';

type ExternalCategoryInput = {
  externalCode: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  parentExternalCode?: string | null;
  level?: number | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  externalHash?: string | null;
};

type ExternalVariantInput = {
  externalVariantCode: string;
  name: string;
  skuCode?: string | null;
  sourceCostPrice: number;
  baseStock: number;
  sortOrder?: number | null;
  isActive?: boolean | null;
  attributes?: Record<string, unknown> | null;
  externalHash?: string | null;
  sourceUpdatedAt?: string | null;
};

type ExternalProductInput = {
  externalProductCode: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  categoryExternalCode?: string | null;
  productType?: string | null;
  requiresShipping?: boolean | null;
  images?: string[] | null;
  typeData?: Record<string, unknown> | null;
  isActive?: boolean | null;
  externalHash?: string | null;
  sourceUpdatedAt?: string | null;
  variants: ExternalVariantInput[];
};

export type CatalogImportBatchInput = {
  provider: string;
  installationId: string;
  storeId: string;
  runId?: string | null;
  categories?: ExternalCategoryInput[];
  products?: ExternalProductInput[];
};

type CatalogImportStats = {
  categoriesCreated: number;
  categoriesUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  variantsDisabled: number;
};

function now() {
  return new Date();
}

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeBoolean(value: boolean | null | undefined, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseSourceUpdatedAt(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toJsonValue(value: unknown): unknown | null {
  if (value === undefined) return null;
  return value ?? null;
}

function buildSourcePayloadHash(externalHash: string | null | undefined, payload: unknown): string {
  const normalizedExternalHash = normalizeString(externalHash);
  if (normalizedExternalHash) return normalizedExternalHash;
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildSlugCandidate(primary: string | null | undefined, fallback: string): string {
  const slug = normalizeSlug(primary || '');
  if (slug) return slug;
  return normalizeSlug(fallback) || `item-${crypto.randomUUID().slice(0, 8)}`;
}

async function ensureUniqueCategorySlug(baseSlug: string, categoryId?: string): Promise<string> {
  let attempt = baseSlug;
  let index = 0;
  while (true) {
    const existing = await prisma.category.findUnique({
      where: { slug: attempt },
      select: { id: true },
    });
    if (!existing || existing.id === categoryId) return attempt;
    index += 1;
    attempt = `${baseSlug}-${index}`;
  }
}

async function ensureUniqueProductSlug(baseSlug: string, productId?: string): Promise<string> {
  let attempt = baseSlug;
  let index = 0;
  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: attempt },
      select: { id: true },
    });
    if (!existing || existing.id === productId) return attempt;
    index += 1;
    attempt = `${baseSlug}-${index}`;
  }
}

function isBootstrapProductSnapshot(link: any): boolean {
  return !link?.sourceName &&
    !link?.sourceDescription &&
    !link?.sourceCategoryCode &&
    link?.sourceIsActive === undefined &&
    !link?.sourcePayloadHash &&
    !link?.lastComparedAt;
}

function isBootstrapVariantSnapshot(link: any): boolean {
  return !link?.sourceVariantName &&
    !link?.sourceSkuCode &&
    link?.sourceCostPrice === undefined &&
    link?.sourceIsActive === undefined &&
    !link?.sourceAttributesJson &&
    !link?.sourcePayloadHash &&
    !link?.lastComparedAt;
}

function detectProductChanges(link: any, input: ExternalProductInput, payloadHash: string): string[] {
  if (!link || isBootstrapProductSnapshot(link)) return [];

  const changedFields: string[] = [];
  if (normalizeString(link.sourceName) !== normalizeString(input.name)) changedFields.push('name');
  if (normalizeString(link.sourceDescription) !== normalizeString(input.description)) changedFields.push('description');
  if (normalizeString(link.sourceCategoryCode) !== normalizeString(input.categoryExternalCode)) changedFields.push('category');
  if ((link.sourceIsActive ?? true) !== normalizeBoolean(input.isActive, true)) changedFields.push('sourceIsActive');
  if (normalizeString(link.sourcePayloadHash) !== payloadHash) changedFields.push('payload');

  return changedFields;
}

function detectVariantChanges(link: any, input: ExternalVariantInput, payloadHash: string): string[] {
  if (!link || isBootstrapVariantSnapshot(link)) return [];

  const changedFields: string[] = [];
  if (normalizeString(link.sourceVariantName) !== normalizeString(input.name)) changedFields.push('name');
  if (normalizeString(link.sourceSkuCode) !== normalizeString(input.skuCode || input.externalVariantCode)) changedFields.push('skuCode');
  if (Number(link.sourceCostPrice ?? NaN) !== Number(input.sourceCostPrice)) changedFields.push('costPrice');
  if ((link.sourceIsActive ?? true) !== normalizeBoolean(input.isActive, true)) changedFields.push('sourceIsActive');
  if (normalizeString(link.sourcePayloadHash) !== payloadHash) changedFields.push('payload');

  return changedFields;
}

function buildPendingChangeSummary(changedFields: string[]): Record<string, unknown> | null {
  if (changedFields.length === 0) return null;
  return { changedFields };
}

export class AdminCatalogImportService {
  static async importBatch(input: CatalogImportBatchInput): Promise<{ stats: CatalogImportStats }> {
    const provider = input.provider.trim().toLowerCase();
    const installationId = input.installationId.trim();
    const storeId = input.storeId.trim();
    const categories = Array.isArray(input.categories) ? input.categories : [];
    const products = Array.isArray(input.products) ? input.products : [];
    const defaultWarehouse = await WarehouseService.getDefaultWarehouse();

    const stats: CatalogImportStats = {
      categoriesCreated: 0,
      categoriesUpdated: 0,
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      variantsDisabled: 0,
    };

    const sortedCategories = [...categories].sort(
      (a, b) => Number(a.level ?? 1) - Number(b.level ?? 1) || Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
    );

    for (const category of sortedCategories) {
      if (!category.externalCode?.trim() || !category.name?.trim()) continue;
      const externalCode = category.externalCode.trim();
      const link = await prisma.externalCategoryLink.findUnique({
        where: {
          provider_installationId_storeId_externalCode: {
            provider,
            installationId,
            storeId,
            externalCode,
          },
        },
      });

      let parentId: string | null = null;
      if (category.parentExternalCode?.trim()) {
        const parentLink = await prisma.externalCategoryLink.findUnique({
          where: {
            provider_installationId_storeId_externalCode: {
              provider,
              installationId,
              storeId,
              externalCode: category.parentExternalCode.trim(),
            },
          },
          select: { coreCategoryId: true },
        });
        parentId = parentLink?.coreCategoryId || null;
      }

      const baseSlug = buildSlugCandidate(category.slug, `${externalCode}-${category.name}`);
      if (link?.coreCategoryId) {
        const categorySlug = await ensureUniqueCategorySlug(baseSlug, link.coreCategoryId);
        await prisma.category.update({
          where: { id: link.coreCategoryId },
          data: {
            name: category.name.trim(),
            slug: categorySlug,
            description: category.description ?? null,
            parentId,
            level: Math.max(1, Number(category.level ?? 1)),
            sortOrder: Number(category.sortOrder ?? 0),
          },
        });
        await prisma.externalCategoryLink.update({
          where: { id: link.id },
          data: {
            externalName: category.name.trim(),
            externalHash: category.externalHash || null,
            coreCategorySlug: categorySlug,
            syncStatus: category.isActive === false ? 'DISABLED' : 'ACTIVE',
            lastSyncedAt: now(),
            lastError: null,
          },
        });
        stats.categoriesUpdated += 1;
        continue;
      }

      const categorySlug = await ensureUniqueCategorySlug(baseSlug);
      const created = await prisma.category.create({
        data: {
          name: category.name.trim(),
          slug: categorySlug,
          description: category.description ?? null,
          parentId,
          level: Math.max(1, Number(category.level ?? 1)),
          sortOrder: Number(category.sortOrder ?? 0),
        },
        select: { id: true, slug: true },
      });

      await prisma.externalCategoryLink.create({
        data: {
          provider,
          installationId,
          storeId,
          externalCode,
          externalName: category.name.trim(),
          externalHash: category.externalHash || null,
          coreCategoryId: created.id,
          coreCategorySlug: created.slug,
          syncStatus: category.isActive === false ? 'DISABLED' : 'ACTIVE',
          lastSyncedAt: now(),
        },
      });
      stats.categoriesCreated += 1;
    }

    for (const product of products) {
      if (!product.externalProductCode?.trim() || !product.name?.trim()) continue;
      const externalProductCode = product.externalProductCode.trim();
      const productLink = await prisma.externalProductLink.findUnique({
        where: {
          provider_installationId_storeId_externalProductCode: {
            provider,
            installationId,
            storeId,
            externalProductCode,
          },
        },
      });

      let coreCategoryId: string | null = null;
      if (product.categoryExternalCode?.trim()) {
        const categoryLink = await prisma.externalCategoryLink.findUnique({
          where: {
            provider_installationId_storeId_externalCode: {
              provider,
              installationId,
              storeId,
              externalCode: product.categoryExternalCode.trim(),
            },
          },
          select: { coreCategoryId: true },
        });
        coreCategoryId = categoryLink?.coreCategoryId || null;
      }

      const baseSlug = buildSlugCandidate(product.slug, `${externalProductCode}-${product.name}`);
      const typeDataObject = {
        ...(product.typeData || {}),
        images: Array.isArray(product.images) ? product.images : [],
      };
      const productPayloadHash = buildSourcePayloadHash(product.externalHash, {
        externalProductCode,
        name: normalizeString(product.name),
        description: normalizeString(product.description),
        categoryExternalCode: normalizeString(product.categoryExternalCode),
        productType: normalizeString(product.productType),
        requiresShipping: product.requiresShipping ?? null,
        images: Array.isArray(product.images) ? product.images : [],
        typeData: product.typeData || {},
        isActive: normalizeBoolean(product.isActive, true),
        variants: (product.variants || []).map((variant) => ({
          externalVariantCode: normalizeString(variant.externalVariantCode),
          name: normalizeString(variant.name),
          skuCode: normalizeString(variant.skuCode || variant.externalVariantCode),
          sourceCostPrice: Number(variant.sourceCostPrice),
          baseStock: Math.max(0, Math.trunc(Number(variant.baseStock))),
          isActive: normalizeBoolean(variant.isActive, true),
          attributes: variant.attributes || null,
        })),
      });
      const productChangedFields = detectProductChanges(productLink, product, productPayloadHash);
      const sourceIsActive = normalizeBoolean(product.isActive, true);
      const sourceUpdatedAt = parseSourceUpdatedAt(product.sourceUpdatedAt);
      let coreProductId = productLink?.coreProductId || null;

      if (coreProductId) {
        const existingProduct = await prisma.product.findUnique({
          where: { id: coreProductId },
          select: { id: true },
        });
        if (!existingProduct) {
          coreProductId = null;
        } else {
          const productUpdateData: Record<string, unknown> = {
            categoryId: coreCategoryId,
            productType: product.productType || 'digital',
            requiresShipping: product.requiresShipping ?? false,
            typeData: typeDataObject,
          };
          if (!sourceIsActive) {
            productUpdateData.isActive = false;
          }

          await prisma.product.update({
            where: { id: coreProductId },
            data: productUpdateData,
          });
          await prisma.externalProductLink.update({
            where: { id: productLink!.id },
            data: {
              externalName: product.name.trim(),
              externalHash: product.externalHash || null,
              sourceName: normalizeString(product.name),
              sourceDescription: normalizeString(product.description),
              sourceCategoryCode: normalizeString(product.categoryExternalCode),
              sourceIsActive,
              sourcePayloadJson: toJsonValue({
                name: normalizeString(product.name),
                description: normalizeString(product.description),
                categoryExternalCode: normalizeString(product.categoryExternalCode),
                images: Array.isArray(product.images) ? product.images : [],
                typeData: product.typeData || {},
              }),
              sourcePayloadHash: productPayloadHash,
              hasPendingChange: Boolean(productLink?.hasPendingChange) || productChangedFields.length > 0,
              pendingChangeSummary: buildPendingChangeSummary(productChangedFields),
              lastComparedAt: now(),
              sourceUpdatedAt,
              syncStatus: sourceIsActive ? 'ACTIVE' : 'DISABLED',
              lastSyncedAt: now(),
              lastError: null,
            },
          });
          stats.productsUpdated += 1;
        }
      }

      if (!coreProductId) {
        const productSlug = await ensureUniqueProductSlug(baseSlug);
        const createdProduct = await prisma.product.create({
          data: {
            name: product.name.trim(),
            slug: productSlug,
            description: product.description ?? null,
            categoryId: coreCategoryId,
            productType: product.productType || 'digital',
            requiresShipping: product.requiresShipping ?? false,
            typeData: typeDataObject,
            isActive: sourceIsActive,
            storeId,
          } as any,
          select: { id: true, slug: true },
        });
        coreProductId = createdProduct.id;

        if (productLink) {
          await prisma.externalProductLink.update({
            where: { id: productLink.id },
            data: {
              coreProductId,
              coreProductSlug: createdProduct.slug,
              externalName: product.name.trim(),
              externalHash: product.externalHash || null,
              sourceName: normalizeString(product.name),
              sourceDescription: normalizeString(product.description),
              sourceCategoryCode: normalizeString(product.categoryExternalCode),
              sourceIsActive,
              sourcePayloadJson: toJsonValue({
                name: normalizeString(product.name),
                description: normalizeString(product.description),
                categoryExternalCode: normalizeString(product.categoryExternalCode),
                images: Array.isArray(product.images) ? product.images : [],
                typeData: product.typeData || {},
              }),
              sourcePayloadHash: productPayloadHash,
              hasPendingChange: false,
              pendingChangeSummary: null,
              lastComparedAt: now(),
              sourceUpdatedAt,
              syncStatus: sourceIsActive ? 'ACTIVE' : 'DISABLED',
              lastSyncedAt: now(),
              lastError: null,
            },
          });
        } else {
          await prisma.externalProductLink.create({
            data: {
              provider,
              installationId,
              storeId,
              externalProductCode,
              externalName: product.name.trim(),
              externalHash: product.externalHash || null,
              sourceName: normalizeString(product.name),
              sourceDescription: normalizeString(product.description),
              sourceCategoryCode: normalizeString(product.categoryExternalCode),
              sourceIsActive,
              sourcePayloadJson: toJsonValue({
                name: normalizeString(product.name),
                description: normalizeString(product.description),
                categoryExternalCode: normalizeString(product.categoryExternalCode),
                images: Array.isArray(product.images) ? product.images : [],
                typeData: product.typeData || {},
              }),
              sourcePayloadHash: productPayloadHash,
              hasPendingChange: false,
              pendingChangeSummary: null,
              lastComparedAt: now(),
              sourceUpdatedAt,
              coreProductId,
              coreProductSlug: createdProduct.slug,
              syncStatus: sourceIsActive ? 'ACTIVE' : 'DISABLED',
              lastSyncedAt: now(),
            },
          });
        }
        stats.productsCreated += 1;
      }

      if (!coreProductId) {
        throw new Error(`Failed to resolve core product for external product ${externalProductCode}`);
      }

      const incomingVariantCodes = new Set<string>();
      for (const [index, variant] of (product.variants || []).entries()) {
        if (!variant.externalVariantCode?.trim()) continue;
        const externalVariantCode = variant.externalVariantCode.trim();
        incomingVariantCodes.add(externalVariantCode);
        const variantLink = await prisma.externalVariantLink.findUnique({
          where: {
            provider_installationId_storeId_externalVariantCode: {
              provider,
              installationId,
              storeId,
              externalVariantCode,
            },
          },
        });
        const variantPayloadHash = buildSourcePayloadHash(variant.externalHash, {
          externalProductCode,
          externalVariantCode,
          name: normalizeString(variant.name),
          skuCode: normalizeString(variant.skuCode || externalVariantCode),
          sourceCostPrice: Number(variant.sourceCostPrice),
          baseStock: Math.max(0, Math.trunc(Number(variant.baseStock))),
          sortOrder: Number(variant.sortOrder ?? index),
          isActive: normalizeBoolean(variant.isActive, true),
          attributes: variant.attributes || null,
        });
        const variantChangedFields = detectVariantChanges(variantLink, variant, variantPayloadHash);
        const variantSourceIsActive = sourceIsActive && normalizeBoolean(variant.isActive, true);
        const variantSourceUpdatedAt = parseSourceUpdatedAt(variant.sourceUpdatedAt) ?? sourceUpdatedAt;

        const normalizedStock = Math.max(0, Math.trunc(Number(variant.baseStock)));
        const variantData = {
          productId: coreProductId,
          name: variant.name.trim(),
          skuCode: variant.skuCode || externalVariantCode,
          salePrice: Number(variant.sourceCostPrice),
          costPrice: Number(variant.sourceCostPrice),
          sortOrder: Number(variant.sortOrder ?? index),
          isActive: variantSourceIsActive,
          attributes: variant.attributes ?? null,
        };

        let coreVariantId = variantLink?.coreVariantId || null;
        if (coreVariantId) {
          const exists = await prisma.productVariant.findUnique({
            where: { id: coreVariantId },
            select: { id: true },
          });
          if (!exists) {
            coreVariantId = null;
          } else {
            await prisma.$transaction(async (tx) => {
              await tx.productVariant.update({
                where: { id: coreVariantId },
                data: {
                  costPrice: variantData.costPrice,
                  sortOrder: variantData.sortOrder,
                  ...(variantSourceIsActive ? {} : { isActive: false }),
                },
              });
              await InventoryService.setStock(
                tx,
                coreVariantId,
                normalizedStock,
                defaultWarehouse.id
              );
            });
            await prisma.externalVariantLink.update({
              where: { id: variantLink!.id },
              data: {
                externalProductCode,
                coreProductId,
                sourceVariantName: normalizeString(variant.name),
                sourceSkuCode: normalizeString(variant.skuCode || externalVariantCode),
                sourceCostPrice: Number(variant.sourceCostPrice),
                sourceIsActive: variantSourceIsActive,
                sourceAttributesJson: toJsonValue(variant.attributes || null),
                sourcePayloadHash: variantPayloadHash,
                hasPendingChange: Boolean(variantLink?.hasPendingChange) || variantChangedFields.length > 0,
                pendingChangeSummary: buildPendingChangeSummary(variantChangedFields),
                lastComparedAt: now(),
                sourceUpdatedAt: variantSourceUpdatedAt,
                externalHash: variant.externalHash || null,
                syncStatus: variantSourceIsActive ? 'ACTIVE' : 'DISABLED',
                lastSyncedAt: now(),
                lastError: null,
              },
            });
            stats.variantsUpdated += 1;
          }
        }

        if (!coreVariantId) {
          const createdVariant = await prisma.$transaction(async (tx) => {
            const created = await tx.productVariant.create({
              data: variantData,
              select: { id: true },
            });
            await InventoryService.setStock(
              tx,
              created.id,
              normalizedStock,
              defaultWarehouse.id
            );
            return created;
          });
          coreVariantId = createdVariant.id;
          if (variantLink) {
            await prisma.externalVariantLink.update({
              where: { id: variantLink.id },
              data: {
                externalProductCode,
                coreProductId,
                coreVariantId,
                sourceVariantName: normalizeString(variant.name),
                sourceSkuCode: normalizeString(variant.skuCode || externalVariantCode),
                sourceCostPrice: Number(variant.sourceCostPrice),
                sourceIsActive: variantSourceIsActive,
                sourceAttributesJson: toJsonValue(variant.attributes || null),
                sourcePayloadHash: variantPayloadHash,
                hasPendingChange: false,
                pendingChangeSummary: null,
                lastComparedAt: now(),
                sourceUpdatedAt: variantSourceUpdatedAt,
                coreSkuCode: variantData.skuCode,
                externalHash: variant.externalHash || null,
                syncStatus: variantSourceIsActive ? 'ACTIVE' : 'DISABLED',
                lastSyncedAt: now(),
                lastError: null,
              },
            });
          } else {
            await prisma.externalVariantLink.create({
              data: {
                provider,
                installationId,
                storeId,
                externalProductCode,
                externalVariantCode,
                externalHash: variant.externalHash || null,
                sourceVariantName: normalizeString(variant.name),
                sourceSkuCode: normalizeString(variant.skuCode || externalVariantCode),
                sourceCostPrice: Number(variant.sourceCostPrice),
                sourceIsActive: variantSourceIsActive,
                sourceAttributesJson: toJsonValue(variant.attributes || null),
                sourcePayloadHash: variantPayloadHash,
                hasPendingChange: false,
                pendingChangeSummary: null,
                lastComparedAt: now(),
                sourceUpdatedAt: variantSourceUpdatedAt,
                coreProductId,
                coreVariantId,
                coreSkuCode: variantData.skuCode,
                syncStatus: variantSourceIsActive ? 'ACTIVE' : 'DISABLED',
                lastSyncedAt: now(),
              },
            });
          }
          stats.variantsCreated += 1;
        }
      }

      const staleLinks = await prisma.externalVariantLink.findMany({
        where: {
          provider,
          installationId,
          storeId,
          externalProductCode,
          externalVariantCode: { notIn: Array.from(incomingVariantCodes) },
          syncStatus: { not: 'DISABLED' },
        },
        select: { id: true, coreVariantId: true },
      });
      if (staleLinks.length > 0) {
        await prisma.externalVariantLink.updateMany({
          where: { id: { in: staleLinks.map((item) => item.id) } },
          data: {
            syncStatus: 'DISABLED',
            sourceIsActive: false,
            lastSyncedAt: now(),
          },
        });
        await prisma.productVariant.updateMany({
          where: { id: { in: staleLinks.map((item) => item.coreVariantId) } },
          data: { isActive: false },
        });
        stats.variantsDisabled += staleLinks.length;
      }
    }

    return { stats };
  }
}
