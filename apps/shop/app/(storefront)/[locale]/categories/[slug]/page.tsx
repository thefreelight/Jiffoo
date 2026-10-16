import { notFound } from 'next/navigation';
import { categories, messages, products, requireLocale } from '@/lib/catalog';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { localePath } from '@/lib/locale';
import { ProductGrid } from '@/components/product-grid';
import { Pagination } from '@/components/pagination';
import { ThemeSections } from '@/components/theme-sections';
import { getShopTheme } from '@/lib/theme';
import { sectionsForPage } from '@/lib/page-classes';
import { CatalogControls } from '@/components/catalog-controls';
import { readCatalogQuery, catalogFilters } from '@/lib/catalog-query';

export default async function CategoryPage({ params, searchParams }: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: segment, slug } = await params;
  const { locale, context } = await requireLocale(segment);
  const groups = await categories(locale);
  const group = groups.find((category) => category.slug === slug);
  if (!group) notFound();
  const paramsValue = await searchParams;
  const query = readCatalogQuery(paramsValue);
  const page = Math.max(1, query.page);
  const [catalog, theme] = await Promise.all([products(locale, page, group.id, 12, catalogFilters(query, group.id)), getShopTheme(locale)]);
  const t = messages(locale);
  const path = `${localePath(locale, `/categories/${slug}`)}?${new URLSearchParams(Object.entries(paramsValue).filter((entry): entry is [string, string] => entry[1] !== undefined))}`;
  const slots = theme ? sectionsForPage('category', theme.layout) : [];
  const top = theme?.layout.slots['category.top'] ?? [];
  const bottom = slots.slice(top.length);
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="mb-4 text-sm text-subtle"><Link href={localePath(locale)}>{t.navigation.home}</Link> / {group.name}</div>
      <h1 className="text-[26px] font-semibold tracking-tight md:text-[32px]">{group.name}</h1>
      <p className="mb-7 mt-2 text-subtle">{group.description && `${group.description} · `}{t.shop.count.replace('{count}', String(group.productCount))}</p>
      <ThemeSections sections={top} locale={locale} currency={context.currency} />
      {group.productCount > 0 && <CatalogControls locale={locale} groups={groups} total={catalog?.total ?? 0} currentCategory={group.id} showFilters={theme?.layout.pages.category.showFilters ?? false} />}
      {catalog?.items.length ? <ProductGrid items={catalog.items} locale={locale} currency={context.currency}
        columns={theme?.layout.pages.category.columns} /> : <section className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-18 text-center">
          <Package aria-hidden="true" size={22} />
          <h2 className="font-semibold">{t.shop.categoryEmpty}</h2><p className="text-subtle">{t.shop.categoryEmptyBody}</p>
          <Link href={localePath(locale, '/products')} className="mt-2 rounded-md border border-line px-4 py-2">{t.shop.viewAll}</Link></section>}
      <Pagination page={page} totalPages={catalog?.totalPages ?? 0} path={path} locale={locale} />
      <ThemeSections sections={bottom} locale={locale} currency={context.currency} />
    </main>
  );
}
