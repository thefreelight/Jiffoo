import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ShopLocale } from '@/lib/locale';
import { messages } from '@/lib/catalog';
import { pagePath } from '@/lib/page-path';

export function Pagination({ page, totalPages, path, locale }: { page: number; totalPages: number; path: string; locale: ShopLocale }) {
  if (totalPages < 2) return null;
  const t = messages(locale).catalog;
  const href = (number: number) => pagePath(path, number);
  return (
    <nav aria-label={t.page} className="mt-12 flex items-center justify-center gap-1 text-sm">
      {page > 1 && <Link href={href(page - 1)} aria-label={t.previous} className="flex size-9 items-center justify-center rounded-md hover:bg-highlight"><ChevronLeft size={18} /></Link>}
      <span className="sr-only">{t.page} {page} {t.of} {totalPages}</span>
      {[...new Set([1, ...Array.from({ length: 3 }, (_, offset) => page + offset - 1), totalPages])].filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b).map((number) =>
        <Link key={number} href={href(number)} aria-label={`${t.page} ${number}`} aria-current={number === page ? 'page' : undefined}
          className={`flex size-9 items-center justify-center rounded-md ${number === page ? 'bg-highlight font-semibold' : 'text-subtle hover:bg-highlight'}`}>{number}</Link>)}
      {page < totalPages && <Link href={href(page + 1)} aria-label={t.next} className="flex size-9 items-center justify-center rounded-md hover:bg-highlight"><ChevronRight size={18} /></Link>}
    </nav>
  );
}
