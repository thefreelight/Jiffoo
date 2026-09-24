import type { ShopLocale } from './locale';

export function formatPrice(value: number, locale: ShopLocale, currency: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}
