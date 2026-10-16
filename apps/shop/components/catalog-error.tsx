'use client';

import { useParams } from 'next/navigation';
import { isShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';

export function CatalogError({ reset }: { reset: () => void }) {
  const value = useParams<{ locale: string }>().locale;
  const t = storefrontMessages(isShopLocale(value) ? value : 'en');
  return <main className="mx-auto max-w-7xl px-4 py-16 text-center md:px-8"><p role="alert">{t.shop.error}</p><button type="button" onClick={reset} className="mt-6 rounded-md border border-line px-4 py-2">{t.shop.retry}</button></main>;
}
