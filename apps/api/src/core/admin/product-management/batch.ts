import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { CacheService } from '@/core/cache/service';
import { AdminProductService } from './service';
import { productCount, productIds, type ProductSelection, type ProductSort } from './list-query';
import { systemSettingsService } from '@/core/settings/service';
import { getAllMessages } from 'shared/src/i18n';
import type { Locale } from 'shared/src/i18n/config';
import { csvFilename, csvRow, csvStream, csvTimestamp } from '@/utils/csv';

export interface ProductBulkRequest {
  action: 'activate' | 'deactivate' | 'setCategory' | 'delete';
  categoryId?: string | null;
  selection: ProductSelection;
  dryRun?: boolean;
}
export async function bulkProducts(body: ProductBulkRequest) {
  if (body.action === 'setCategory') {
    if (body.categoryId === undefined) throw new ApiError('VALIDATION_ERROR');
    if (body.categoryId !== null && !await prisma.category.findUnique({ where: { id: body.categoryId }, select: { id: true } })) throw new ApiError('NOT_FOUND');
  }
  const { selection } = body, filter = selection.mode === 'filter' ? selection.filter : {};
  const matched = selection.mode === 'ids' ? new Set(selection.ids).size : await productCount(filter, selection);
  if (selection.mode === 'filter' && matched > 5000) throw new ApiError('VALIDATION_ERROR', { limit: 5000, matched });
  const ids = selection.mode === 'ids' ? [...new Set(selection.ids)] : await productIds(filter, { sortBy: 'name', sortOrder: 'asc' }, 5000, 0, selection);
  const skipped: { id: string; name: string; reason: 'HAS_ORDERS' | 'NOT_FOUND' }[] = [];
  const processedPreview: { id: string; name: string }[] = [];
  let processed = 0, skippedCount = 0;
  const skip = (id: string, name: string, reason: 'HAS_ORDERS' | 'NOT_FOUND') => {
    skippedCount++; if (skipped.length < 20) skipped.push({ id, name, reason });
  };
  // Each single-product operation owns its small transaction and its events.
  // The cache version is bumped once for the whole batch at the end, and the
  // product read that a single-product call returns is not needed here.
  try {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const page = ids.slice(offset, offset + 100);
      const products = await prisma.product.findMany({ where: { id: { in: page } }, select: { id: true, name: true, _count: { select: { orderItems: true } } } });
      const byId = new Map(products.map(product => [product.id, product]));
      for (const id of page) {
        const product = byId.get(id);
        if (!product) { skip(id, '', 'NOT_FOUND'); continue; }
        if (body.action === 'delete' && product._count.orderItems > 0) { skip(id, product.name, 'HAS_ORDERS'); continue; }
        try {
          if (!body.dryRun) {
            if (body.action === 'delete') await AdminProductService.deleteProduct(id, { skipCacheVersionBump: true });
            else await AdminProductService.updateProduct(id, body.action === 'setCategory' ? { categoryId: body.categoryId } : { isActive: body.action === 'activate' }, { skipCacheVersionBump: true, skipReload: true });
          }
          processed++; if (processedPreview.length < 20) processedPreview.push({ id, name: product.name });
        } catch (error) {
          if (error instanceof ApiError && error.code === 'PRODUCT_HAS_ORDERS' && body.action === 'delete') skip(id, product.name, 'HAS_ORDERS');
          else if (error instanceof ApiError && error.code === 'NOT_FOUND') skip(id, product.name, 'NOT_FOUND');
          else throw error;
        }
      }
    }
  } finally {
    // The written products are published with one version bump for the batch.
    if (!body.dryRun && processed > 0) await CacheService.incrementProductVersion();
  }
  return { matched, processed, skipped, skippedCount, processedPreview };
}

export async function createProductExport(selection: ProductSelection, sort: ProductSort, locale: Locale) {
  const timezone = await systemSettingsService.getTimezone();
  const catalog = getAllMessages(locale).merchant!.catalog as Record<string, string>;
  const filter = selection.mode === 'filter' ? selection.filter : {};
  const matched = await productCount(filter, selection);
  async function* rows() {
    yield '\uFEFF' + csvRow(catalog.csvHeaders.split('|'));
    for (let offset = 0; ; offset += 500) {
      const ids = await productIds(filter, sort, 500, offset, selection);
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, include: { category: true, variants: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } });
      const byId = new Map(products.map(product => [product.id, product]));
      for (const id of ids) {
        const product = byId.get(id); if (!product) continue;
        const activeVariants = product.variants.filter(variant => variant.isActive);
        const status = !product.isActive || !activeVariants.length ? 'inactive' : activeVariants.reduce((sum, variant) => sum + variant.stock, 0) === 0 ? 'outOfStock' : 'active';
        for (const variant of product.variants) yield csvRow([product.spuCode, product.name, catalog[status], product.category?.name,
          variant.name, variant.skuCode, variant.salePrice.toFixed(2), variant.stock, catalog[variant.isActive ? 'yes' : 'no'],
          csvTimestamp(product.updatedAt, timezone), timezone, product.id, variant.id]);
      }
      if (ids.length < 500) break;
    }
  }
  return { stream: csvStream(rows()), filename: csvFilename('products', timezone), matched,
    skipped: selection.mode === 'ids' ? new Set(selection.ids).size - matched : 0 };
}
