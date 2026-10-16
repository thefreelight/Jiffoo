'use client';

import { useState, useTransition } from 'react';
import { parseAsString, parseAsInteger, useQueryStates } from 'nuqs';
import { storefrontMessages } from '@/lib/storefront-messages';
import { Search, X } from 'lucide-react';
import type { ShopLocale } from '@/lib/locale';
import { CatalogLoading } from './catalog-loading';

export function SearchQuery({ locale, initialQuery }: { locale: ShopLocale; initialQuery: string }) {
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const [, setQuery] = useQueryStates({ q: parseAsString.withDefault(''), page: parseAsInteger.withDefault(1) }, { shallow: false, history: 'push', startTransition });
  const t = storefrontMessages(locale);
  return <form action={`/${locale}/search`} method="get" role="search" aria-label={t.catalog.results} onSubmit={(event) => {
    event.preventDefault(); void setQuery({ q: value.trim(), page: null });
  }} className="mx-auto mb-3 flex h-13 max-w-160 gap-2 rounded-lg border border-line bg-canvas px-4">
    <input key={initialQuery} type="search" name="q" aria-label={t.navigation.search} placeholder={t.navigation.search} defaultValue={initialQuery} onChange={(event) => setValue(event.target.value)} className="min-w-0 flex-1 bg-transparent" />
    <button type="submit" aria-label={t.navigation.searchAction} disabled={pending}>{pending ? <CatalogLoading locale={locale} /> : <Search size={18} />}</button>
    {initialQuery && <button type="button" aria-label={t.shop.clearSearch} disabled={pending} onClick={() => void setQuery({ q: null, page: null })}><X size={18} /></button>}
  </form>;
}
