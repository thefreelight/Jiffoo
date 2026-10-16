import { categories, messages, products, requireLocale } from '@/lib/catalog';
import { localePath } from '@/lib/locale';
import { ProductGrid } from '@/components/product-grid';
import { Pagination } from '@/components/pagination';
import { CatalogControls } from '@/components/catalog-controls';
import { readCatalogQuery, catalogFilters } from '@/lib/catalog-query';
import { getShopTheme } from '@/lib/theme';

export default async function ProductsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale, context } = await requireLocale((await params).locale);
  const paramsValue = await searchParams;
  const query = readCatalogQuery(paramsValue);
  const page = Math.max(1, query.page);
  const [catalog, groups, theme] = await Promise.all([products(locale, page, undefined, 12, catalogFilters(query)), categories(locale), getShopTheme(locale)]);
  const path = `${localePath(locale, '/products')}?${new URLSearchParams(Object.entries(paramsValue).filter((entry): entry is [string, string] => entry[1] !== undefined))}`;
  const t = messages(locale);
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="text-[26px] font-semibold tracking-tight md:text-[32px]">{t.catalog.title}</h1>
      <p className="mb-7 mt-2 text-subtle">{t.shop.count.replace('{count}', String(catalog?.total ?? 0))}</p>
      <CatalogControls locale={locale} groups={groups} total={catalog?.total ?? 0} showFilters={theme?.layout.pages.category.showFilters ?? false} />
      <ProductGrid items={catalog?.items ?? []} locale={locale} currency={context.currency} columns={theme?.layout.pages.category.columns} />
      <Pagination page={page} totalPages={catalog?.totalPages ?? 0} path={path} locale={locale} />
    </main>
  );
}
