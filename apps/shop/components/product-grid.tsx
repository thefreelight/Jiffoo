import type { Product } from '@/lib/catalog';
import { messages } from '@/lib/catalog';
import type { ShopLocale } from '@/lib/locale';
import { ProductCard } from './product-card';

const columnsClass = {
  1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5',
};
export function ProductGrid({ items, locale, currency, columns = 4 }: {
  items: Product[]; locale: ShopLocale; currency: string; columns?: number;
}) {
  return items.length
    ? <div className={`grid grid-cols-2 gap-3 md:gap-5 ${columnsClass[columns as keyof typeof columnsClass] ?? columnsClass[4]}`}>{items.map((item) => <ProductCard key={item.id} product={item} locale={locale} currency={currency} />)}</div>
    : <p className="py-12 text-subtle">{messages(locale).catalog.empty}</p>;
}
