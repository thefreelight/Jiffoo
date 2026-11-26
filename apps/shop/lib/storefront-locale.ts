/**
 * The language of the page being rendered.
 *
 * The root layout owns `<html lang>` but sits above the [locale] segment and
 * has no params of its own, so the middleware names the locale it matched in
 * the URL on the request.
 */
import { headers } from 'next/headers';

import { isSupportedLocale, type Locale } from 'shared/src/i18n';
import { getLocaleFromPathname } from 'shared/src/proxy';

import { storeDefaultLocale } from '@/lib/store-locales';

export const STOREFRONT_LOCALE_HEADER = 'x-jiffoo-storefront-locale';

/** The locale named in the path when the store offers it, else the fallback. */
export function requestLocale(pathname: string, locales: readonly string[], fallback: string): string {
  return getLocaleFromPathname(pathname, locales) ?? fallback;
}

/** `<html lang>`: the middleware's locale for this request. */
export async function documentLocale(): Promise<Locale> {
  const named = (await headers()).get(STOREFRONT_LOCALE_HEADER) ?? '';
  // The store's locales all come from the framework list.
  return isSupportedLocale(named) ? named : (storeDefaultLocale() as Locale);
}
