import Link from 'next/link';
import { getNamespaceMessages } from 'shared/src/i18n/messages';
import { localePath, type ShopLocale } from '@/lib/locale';

export function NotFoundContent({ locale }: { locale: ShopLocale }) {
  const t = getNamespaceMessages(locale, 'storefront') as typeof import('shared/src/i18n/messages/en/storefront').storefront;
  return (
    <main className="mx-auto flex min-h-[600px] max-w-7xl items-center justify-center px-4 md:px-8">
      <div className="flex flex-col items-center gap-3 text-center"><p className="font-mono text-subtle">404</p>
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">{t.notFound.title}</h1>
      <p className="text-subtle">{t.notFound.message}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2.5"><Link href={localePath(locale)} className="flex h-10 items-center rounded-md bg-action px-[18px] text-action-ink">{t.notFound.back}</Link>
        <Link href={localePath(locale, '/search')} className="flex h-10 items-center rounded-md border border-[var(--shop-border-strong)] px-[18px]">{t.navigation.search}</Link></div></div>
    </main>
  );
}
