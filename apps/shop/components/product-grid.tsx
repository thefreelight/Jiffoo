import type { Product } from '@/lib/catalog';
import { messages } from '@/lib/catalog';
import type { ShopLocale } from '@/lib/locale';
import { ProductCard } from './product-card';

export function ProductGrid({ items, locale, currency }: { items: Product[]; locale: ShopLocale; currency: string }) {
  return items.length
    ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-5">{items.map((item) => <ProductCard key={item.id} product={item} locale={locale} currency={currency} />)}</div>
    : <p className="py-12 text-subtle">{messages(locale).catalog.empty}</p>;
}
