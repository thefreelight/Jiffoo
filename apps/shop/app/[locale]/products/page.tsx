import { messages, products, requireLocale } from '@/lib/catalog';
import { localePath } from '@/lib/locale';
import { ProductGrid } from '@/components/product-grid';
import { Pagination } from '@/components/pagination';

export default async function ProductsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, context } = await requireLocale((await params).locale);
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const catalog = await products(locale, page);
  const path = localePath(locale, '/products');
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="mb-7 text-2xl font-semibold">{messages(locale).catalog.title}</h1>
      <ProductGrid items={catalog?.items ?? []} locale={locale} currency={context.currency} />
      <Pagination page={page} totalPages={catalog?.totalPages ?? 0} path={path} locale={locale} />
    </main>
  );
}
