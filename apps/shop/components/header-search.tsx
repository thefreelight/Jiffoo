'use client';

import { Search, X } from 'lucide-react';
import { localePath, type ShopLocale } from '@/lib/locale';

export function HeaderSearch({ locale, label, actionLabel }: {
  locale: ShopLocale; label: string; actionLabel: string;
}) {
  const form = (mobile: boolean) => {
    const inputId = mobile ? 'shop-search-mobile' : 'shop-search';
    return <form id={mobile ? 'shop-header-search' : 'shop-header-search-desktop'}
      action={localePath(locale, '/search')} method="get" role="search" aria-label={label}
      className={mobile
        ? 'hidden absolute left-0 right-0 top-full z-20 mt-[calc(var(--shop-section-spacing)/6)] items-center rounded-shop border border-line bg-canvas group-open:flex'
        : 'hidden items-center rounded-shop border border-line bg-canvas md:flex'}>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <input id={inputId} name="q" type="search" placeholder={label}
        className="min-w-0 flex-1 bg-transparent px-[calc(var(--shop-section-spacing)/4)] py-[calc(var(--shop-section-spacing)/6)] text-sm outline-none md:w-44 md:flex-none md:px-3 md:py-2" />
      <button type="submit" aria-label={actionLabel} title={actionLabel}
        className="shrink-0 p-[calc(var(--shop-section-spacing)/6)] text-action md:p-2">
        <Search size={18} aria-hidden="true" />
      </button>
    </form>;
  };
  return <>
    <details className="group shrink-0 md:hidden">
      <summary role="button" aria-label={label} title={label} aria-controls="shop-header-search"
        className="list-none p-[calc(var(--shop-section-spacing)/6)] text-action [&::-webkit-details-marker]:hidden">
        <Search size={18} className="group-open:hidden" aria-hidden="true" />
        <X size={18} className="hidden group-open:block" aria-hidden="true" />
      </summary>
      {form(true)}
    </details>
    {form(false)}
  </>;
}
