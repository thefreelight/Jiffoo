'use client';

import Link from 'next/link';
import { Check, Languages } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'shared/src/i18n/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ADMIN_LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'zh-Hans', label: '简体中文' },
] as const;

function getLocalizedPath(pathname: string, locale: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return `/${locale}`;
  segments[0] = locale;
  return `/${segments.join('/')}`;
}

export function AdminLanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const locale = useLocale();
  const activeLabel = ADMIN_LOCALES.find((item) => item.value === locale)?.label || 'English';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
          aria-label="Change language"
        >
          <Languages className="h-[18px] w-[18px]" />
          {compact ? null : <span>{activeLabel}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl p-1.5">
        {ADMIN_LOCALES.map((item) => (
          <DropdownMenuItem key={item.value} asChild className="rounded-lg px-3 py-2">
            <Link href={getLocalizedPath(pathname, item.value)} className="flex w-full items-center justify-between">
              <span>{item.label}</span>
              {locale === item.value ? <Check className="h-4 w-4 text-blue-600" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
