'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getNamespaceMessages } from 'shared/src/i18n/messages';
import { isShopLocale, localePath, type ShopLocale } from '@/lib/locale';

export function NotFoundContent({ defaultLocale, supportedLocales }: {
  defaultLocale: ShopLocale;
  supportedLocales: ShopLocale[];
}) {
  const params = useParams();
  const segment = params.locale;
  const locale = typeof segment === 'string' && isShopLocale(segment) && supportedLocales.includes(segment) ? segment : defaultLocale;
  const t = getNamespaceMessages(locale, 'storefront') as typeof import('shared/src/i18n/messages/en/storefront').storefront;
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <p className="text-sm font-semibold text-action">404</p>
      <h1 className="mt-3 text-3xl font-semibold">{t.notFound.title}</h1>
      <p className="mt-3 text-subtle">{t.notFound.message}</p>
      <Link href={localePath(locale)} className="mt-8 inline-block text-action underline">{t.notFound.back}</Link>
    </main>
  );
}
