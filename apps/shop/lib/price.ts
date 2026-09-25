import type { ShopLocale } from './locale';

export function formatPrice(value: string | number, locale: ShopLocale, currency: string) {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return (formatter.format as (amount: string | number) => string)(value);
}
