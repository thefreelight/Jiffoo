'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Languages } from 'lucide-react';
import { switchLocalePath, type ShopLocale } from '@/lib/locale';

export function LanguageSwitcher({
  locale, supported, label, names,
}: {
  locale: ShopLocale;
  supported: ShopLocale[];
  label: string;
  names: Record<ShopLocale, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const path = `${pathname}${params.size ? `?${params}` : ''}`;
  return (
    <>
    <button type="button" aria-label={label} title={label} aria-expanded={open}
      aria-controls="shop-header-language" onClick={() => setOpen(!open)}
      className="shrink-0 p-[calc(var(--shop-section-spacing)/6)] text-ink md:hidden">
      <Languages size={18} aria-hidden="true" />
    </button>
    <select
      id="shop-header-language"
      aria-label={label}
      value={locale}
      onChange={(event) => {
        setOpen(false);
        router.push(switchLocalePath(path, event.target.value as ShopLocale));
      }}
      className={`${open ? 'block' : 'hidden'} absolute right-0 top-full z-20 mt-[calc(var(--shop-section-spacing)/6)] max-w-full rounded-shop border border-line bg-surface px-[calc(var(--shop-section-spacing)/6)] py-[calc(var(--shop-section-spacing)/6)] text-sm text-ink md:static md:mt-0 md:block md:max-w-40 md:px-2 md:py-2`}
    >
      {supported.map((option) => <option key={option} value={option}>{names[option]}</option>)}
    </select></>
  );
}
