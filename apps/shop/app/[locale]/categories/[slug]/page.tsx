import { notFound } from 'next/navigation';
import { categories, products, requireLocale } from '@/lib/catalog';
import { localePath } from '@/lib/locale';
import { ProductGrid } from '@/components/product-grid';
import { Pagination } from '@/components/pagination';

export default async function CategoryPage({ params, searchParams }: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale: segment, slug } = await params;
  const { locale, context } = await requireLocale(segment);
  const group = (await categories(locale)).find((category) => category.slug === slug);
  if (!group) notFound();
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const catalog = await products(locale, page, group.id);
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold">{group.name}</h1>
      {group.description && <p className="mb-7 mt-2 text-subtle">{group.description}</p>}
      {!group.description && <div className="mb-7" />}
      <ProductGrid items={catalog?.items ?? []} locale={locale} currency={context.currency} />
      <Pagination page={page} totalPages={catalog?.totalPages ?? 0} path={localePath(locale, `/categories/${slug}`)} locale={locale} />
    </main>
  );
}
