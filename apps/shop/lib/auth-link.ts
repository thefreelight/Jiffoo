import type { ShopLocale } from './locale';

export function localizedAuthLink(path: 'verify-email' | 'reset-password', locale: ShopLocale, params: URLSearchParams): string {
  const query = params.toString();
  return `/${locale}/${path}${query ? `?${query}` : ''}`;
}
