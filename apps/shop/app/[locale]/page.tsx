import { categories, messages, products, requireLocale } from '@/lib/catalog';
import { ThemeSections } from '@/components/theme-sections';
import { getShopTheme } from '@/lib/theme';
import { sectionsForPage } from '@/lib/page-classes';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, context } = await requireLocale((await params).locale);
  const [groups, catalog, theme] = await Promise.all([categories(locale), products(locale, 1, undefined, 48), getShopTheme(locale)]);
  const t = messages(locale);
  const fallback = [
    { id: 'home-categories', type: 'category-list', settings: { title: t.home.categories } },
    { id: 'home-products', type: 'product-grid', settings: { title: t.home.products, source: 'latest' } },
  ];
  const sections = theme ? sectionsForPage('home', theme.layout) : fallback;
  return (
    <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-8">
      <ThemeSections sections={sections} locale={locale} currency={context.currency}
        groups={groups} items={catalog?.items ?? []} />
    </main>
  );
}
