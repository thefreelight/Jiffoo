export const locales = ['en', 'zh-Hans', 'zh-Hant'] as const;
export type ShopLocale = (typeof locales)[number];

export function isShopLocale(value: string): value is ShopLocale {
  return locales.some((locale) => locale === value);
}

export function localePath(locale: ShopLocale, path = '/') {
  const url = new URL(path, 'http://shop.local');
  return `/${locale}${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`;
}

export function switchLocalePath(path: string, locale: ShopLocale) {
  const url = new URL(path, 'http://shop.local');
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length && isShopLocale(segments[0])) segments.shift();
  return localePath(locale, `/${segments.join('/')}${url.search}${url.hash}`);
}
