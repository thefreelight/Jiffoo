'use client';

import { useState, useTransition } from 'react';
import { createSerializer, useQueryStates } from 'nuqs';
import { useRouter } from 'next/navigation';
import { catalogParsers, sorts } from '@/lib/catalog-query';
import type { Category } from '@/lib/catalog';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from './ui/sheet';
import { CatalogLoading } from './catalog-loading';

export function CatalogControls({ locale, groups, showFilters, currentCategory, total = 0 }: {
  locale: ShopLocale; groups: Category[]; showFilters: boolean; currentCategory?: string; total?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useQueryStates(catalogParsers, { shallow: false, history: 'push', startTransition });
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = storefrontMessages(locale);
  const selected = query.category || currentCategory || '';
  const changeCategory = (category: string, clearStock = false) => {
    // Cross-category filtering belongs to the canonical all-products route.
    const destination = currentCategory ? `/${locale}/products` : undefined;
    if (destination) {
      router.push(createSerializer(catalogParsers)(destination, { ...query, category, inStock: clearStock ? false : query.inStock, page: 1 }));
    } else void setQuery({ category: category || null, ...(clearStock ? { inStock: null } : {}), page: 1 });
  };
  const fields = (prefix: string) => <div className="space-y-6">
    <fieldset disabled={pending}><legend className="mb-3 font-medium">{t.catalog.category}</legend>
      {[{ id: '', name: t.shop.all, productCount: undefined }, ...groups].map((group) => <label key={group.id} className="flex items-center gap-3 py-2">
        <input type="radio" className="accent-action" name={`${prefix}-category`} checked={selected === group.id} onChange={() => changeCategory(group.id)} />
        <span className="flex-1">{group.name}</span>{group.productCount !== undefined && <span className="text-subtle">{group.productCount}</span>}
      </label>)}
    </fieldset>
    <label className="flex items-center gap-3"><input type="checkbox" className="accent-action" checked={query.inStock} disabled={pending} onChange={(event) => void setQuery({ inStock: event.target.checked, page: 1 })} />{t.shop.inStockOnly}</label>
    <button type="button" disabled={pending} onClick={() => changeCategory('', true)} className="h-10 rounded-md border border-line px-4">{t.shop.clearFilters}</button>
  </div>;
  return <div aria-busy={pending} className="mb-7 flex flex-wrap items-start justify-between gap-4">
    {showFilters ? <><div className="hidden min-w-56 md:block"><details><summary className="cursor-pointer rounded-md border border-line px-3 py-2">{t.shop.filters}</summary><div className="pt-4">{fields('desktop')}</div></details></div>
      <div className="md:hidden"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger className="h-10 rounded-md border border-line px-4">{t.shop.filters}</SheetTrigger>
        <SheetContent side="left" closeLabel={t.shop.close} className="w-full sm:max-w-[420px]">
          <div className="border-b border-line p-5"><SheetTitle>{t.shop.filters}</SheetTitle><SheetDescription className="sr-only">{t.shop.apply.replace('{count}', String(total))}</SheetDescription></div>
          <div className="flex-1 overflow-y-auto px-5">{fields('mobile')}</div><button type="button" disabled={pending} onClick={() => setOpen(false)} className="m-5 h-10 rounded-md bg-action text-action-ink">{t.shop.apply.replace('{count}', String(total))}</button>
        </SheetContent></Sheet></div></> : <span />}
    <label className="flex items-center gap-2 text-sm">{t.shop.sort}<select aria-label={t.shop.sort} value={query.sort} disabled={pending} onChange={(event) => void setQuery({ sort: event.target.value as typeof query.sort, page: 1 })} className="h-10 rounded-md border border-line bg-canvas px-3">
      {sorts.map((sort) => <option key={sort} value={sort}>{t.shop[sort]}</option>)}
    </select></label>
    {pending && <CatalogLoading locale={locale} />}
  </div>;
}
