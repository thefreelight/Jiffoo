import { categories, messages, products, requireLocale, search } from '@/lib/catalog';
import Link from 'next/link';
import { localePath } from '@/lib/locale';
import { ProductGrid } from '@/components/product-grid';
import { Pagination } from '@/components/pagination';
import { SearchQuery } from '@/components/search-query';

export default async function SearchPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale, context } = await requireLocale((await params).locale);
  const { q = '', page: pageValue } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageValue ?? '1', 10) || 1);
  const catalog = q.trim() ? await search(locale, q.trim(), page) : null;
  const t = messages(locale);
  const empty = !catalog?.items.length;
  const [groups, recent] = empty ? await Promise.all([categories(locale), products(locale, 1, undefined, 4)]) : [[], null];
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="sr-only">{q ? `${t.catalog.resultsFor} “${q}”` : t.catalog.results}</h1>
      <SearchQuery key={q} locale={locale} initialQuery={q} />
      <p className="mb-9 text-center text-subtle">{empty ? (q ? t.shop.noResults.replace('{query}', q) : t.catalog.results) : t.shop.searchCount.replace('{count}', String(catalog?.total ?? 0)).replace('{query}', q)}</p>
      {empty ? <><section className="pb-12 pt-6 text-center"><h2 className="sr-only">{q ? t.shop.noResults.replace('{query}', q) : t.catalog.results}</h2><p className="mt-2 text-subtle">{t.shop.searchHint}</p>
        {groups.length > 0 && <nav aria-label={t.navigation.categories} className="mt-6 flex flex-wrap justify-center gap-2">{groups.map((group) => <Link key={group.id} href={localePath(locale, `/categories/${group.slug}`)} className="rounded-md border border-line px-4 py-2">{group.name}</Link>)}</nav>}</section>
        {!!recent?.items.length && <section className="mt-10"><h2 className="mb-6 text-[22px] font-semibold">{t.shop.newProducts}</h2><ProductGrid items={recent.items} locale={locale} currency={context.currency} /></section>}</>
        : <ProductGrid items={catalog!.items} locale={locale} currency={context.currency} />}
      <Pagination page={page} totalPages={catalog?.totalPages ?? 0} path={localePath(locale, `/search?q=${encodeURIComponent(q)}`)} locale={locale} />
    </main>
  );
}
