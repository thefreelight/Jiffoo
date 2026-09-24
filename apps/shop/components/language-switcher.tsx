'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  const pathname = usePathname();
  const params = useSearchParams();
  const path = `${pathname}${params.size ? `?${params}` : ''}`;
  return (
    <select
      aria-label={label}
      value={locale}
      onChange={(event) => router.push(switchLocalePath(path, event.target.value as ShopLocale))}
      className="max-w-40 rounded-shop border border-line bg-surface px-2 py-2 text-sm text-ink"
    >
      {supported.map((option) => <option key={option} value={option}>{names[option]}</option>)}
    </select>
  );
}
