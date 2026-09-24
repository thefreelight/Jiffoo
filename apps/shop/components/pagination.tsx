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
    <nav aria-label={t.page} className="mt-9 flex items-center justify-center gap-6 text-sm">
      {page > 1 && <Link href={href(page - 1)} aria-label={t.previous} className="flex items-center gap-1 text-action"><ChevronLeft size={18} />{t.previous}</Link>}
      <span>{t.page} {page} {t.of} {totalPages}</span>
      {page < totalPages && <Link href={href(page + 1)} aria-label={t.next} className="flex items-center gap-1 text-action">{t.next}<ChevronRight size={18} /></Link>}
    </nav>
  );
}
