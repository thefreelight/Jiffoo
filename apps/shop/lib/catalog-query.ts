import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';

export const sorts = ['newest', 'oldest', 'nameAsc', 'nameDesc'] as const;
export const catalogParsers = {
  sort: parseAsStringLiteral(sorts).withDefault('newest'),
  category: parseAsString.withDefault(''),
  inStock: parseAsBoolean.withDefault(false),
  page: parseAsInteger.withDefault(1),
};
export type CatalogQuery = { sort: typeof sorts[number]; category: string; inStock: boolean; page: number };

export function readCatalogQuery(input: Record<string, string | undefined>): CatalogQuery {
  return Object.fromEntries(Object.entries(catalogParsers).map(([key, parser]) => [key, parser.parseServerSide(input[key])])) as CatalogQuery;
}

export function catalogFilters(query: CatalogQuery, category?: string): Record<string, string | number> {
  return {
    ...(category || query.category ? { category: category || query.category } : {}),
    ...(query.inStock ? { inStock: 'true' } : {}),
    sortBy: query.sort.startsWith('name') ? 'name' : 'createdAt',
    sortOrder: query.sort === 'oldest' || query.sort === 'nameAsc' ? 'asc' : 'desc',
  };
}
