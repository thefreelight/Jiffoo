import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';

export interface ProductListFilter {
  search?: string;
  categoryId?: string;
  status?: 'active' | 'inactive' | 'outOfStock';
  productType?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}
export interface ProductSort { sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'price' | 'stock'; sortOrder?: 'asc' | 'desc' }
export type ProductSelection = { mode: 'ids'; ids: string[] } | { mode: 'filter'; filter: ProductListFilter; excludeIds?: string[] };

function productQuery(filter: ProductListFilter, selection?: ProductSelection) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  const search = filter.search?.trim();
  if (search) {
    const text = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
    conditions.push(Prisma.sql`(p.name ILIKE ${text} OR p.description ILIKE ${text} OR p."spuCode" ILIKE ${text}
      OR EXISTS (SELECT 1 FROM public.product_variants sv WHERE sv."productId" = p.id AND sv."skuCode" ILIKE ${text}))`);
  }
  if (filter.categoryId) conditions.push(filter.categoryId === 'none' ? Prisma.sql`p."categoryId" IS NULL` : Prisma.sql`p."categoryId" = ${filter.categoryId}`);
  if (filter.productType) conditions.push(Prisma.sql`p."productType" = ${filter.productType}`);
  const active = Prisma.sql`(p."isActive" AND a.active_count > 0)`;
  if (filter.status === 'active') conditions.push(active);
  if (filter.status === 'inactive') conditions.push(Prisma.sql`NOT ${active}`);
  if (filter.status === 'outOfStock') conditions.push(Prisma.sql`${active} AND a.active_stock = 0`);
  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) conditions.push(Prisma.sql`EXISTS (
    SELECT 1 FROM public.product_variants pv WHERE pv."productId" = p.id AND pv."isActive"
      ${filter.minPrice !== undefined ? Prisma.sql`AND pv."salePrice" >= ${filter.minPrice}` : Prisma.empty}
      ${filter.maxPrice !== undefined ? Prisma.sql`AND pv."salePrice" <= ${filter.maxPrice}` : Prisma.empty})`);
  if (filter.inStock !== undefined) conditions.push(filter.inStock ? Prisma.sql`a.active_stock > 0` : Prisma.sql`a.active_stock = 0`);
  if (selection?.mode === 'ids') conditions.push(selection.ids.length ? Prisma.sql`p.id IN (${Prisma.join(selection.ids)})` : Prisma.sql`FALSE`);
  if (selection?.mode === 'filter' && selection.excludeIds?.length) conditions.push(Prisma.sql`p.id NOT IN (${Prisma.join(selection.excludeIds)})`);
  return Prisma.sql`FROM public.products p LEFT JOIN LATERAL (
    SELECT COALESCE(MIN(v."salePrice"), 0) AS price, COALESCE(SUM(v.stock), 0) AS stock,
      COUNT(*) FILTER (WHERE v."isActive") AS active_count,
      COALESCE(SUM(v.stock) FILTER (WHERE v."isActive"), 0) AS active_stock
    FROM public.product_variants v WHERE v."productId" = p.id
  ) a ON TRUE WHERE ${Prisma.join(conditions, ' AND ')}`;
}

export async function productIds(filter: ProductListFilter, sort: ProductSort, limit: number, offset = 0, selection?: ProductSelection) {
  const columns = { name: 'p.name', createdAt: 'p."createdAt"', updatedAt: 'p."updatedAt"', price: 'a.price', stock: 'a.stock' };
  const column = Prisma.raw(columns[sort.sortBy ?? 'createdAt']);
  const direction = Prisma.raw(sort.sortOrder === 'asc' ? 'ASC' : 'DESC');
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT p.id ${productQuery(filter, selection)}
    ORDER BY ${column} ${direction}, p.id ${direction} LIMIT ${limit} OFFSET ${offset}`);
  return rows.map(row => row.id);
}
export async function productCount(filter: ProductListFilter, selection?: ProductSelection) {
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS count ${productQuery(filter, selection)}`);
  return Number(row.count);
}
