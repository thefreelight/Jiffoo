import { messages, requireLocale, search } from '@/lib/catalog';
import { localePath } from '@/lib/locale';
import { ProductGrid } from '@/components/product-grid';
import { Pagination } from '@/components/pagination';

export default async function SearchPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale, context } = await requireLocale((await params).locale);
  const { q = '', page: pageValue } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageValue ?? '1', 10) || 1);
  const catalog = q.trim() ? await search(locale, q.trim(), page) : null;
  const t = messages(locale).catalog;
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="mb-7 text-2xl font-semibold">{q ? `${t.resultsFor} “${q}”` : t.results}</h1>
      <ProductGrid items={catalog?.items ?? []} locale={locale} currency={context.currency} />
      <Pagination page={page} totalPages={catalog?.totalPages ?? 0} path={localePath(locale, `/search?q=${encodeURIComponent(q)}`)} locale={locale} />
    </main>
  );
}
