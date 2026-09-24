import Link from 'next/link';
import { categories, messages, products, requireLocale } from '@/lib/catalog';
import { localePath } from '@/lib/locale';
import { ProductGrid } from '@/components/product-grid';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, context } = await requireLocale((await params).locale);
  const [groups, catalog] = await Promise.all([categories(locale), products(locale)]);
  const t = messages(locale);
  return (
    <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-8">
      <section>
        <h1 className="mb-5 text-2xl font-semibold">{t.home.categories}</h1>
        {groups.length
          ? <div className="flex flex-wrap gap-3">{groups.map((group) => <Link key={group.id} href={localePath(locale, `/categories/${group.slug}`)} className="rounded-shop border border-line bg-surface px-4 py-3 font-medium hover:border-action hover:text-action">{group.name}</Link>)}</div>
          : <p className="text-subtle">{t.catalog.noCategories}</p>}
      </section>
      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">{t.home.products}</h2>
          <Link href={localePath(locale, '/products')} className="text-sm text-action underline">{t.navigation.products}</Link>
        </div>
        <ProductGrid items={catalog?.items ?? []} locale={locale} currency={context.currency} />
      </section>
    </main>
  );
}
