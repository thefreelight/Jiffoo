import Link from 'next/link';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { AccountLogout } from './account-logout';

export function AccountNav({ locale, active }: { locale: ShopLocale; active: 'orders' | 'profile' }) {
  const t = storefrontMessages(locale);
  return <>
    <h1 className="mb-5 text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">{t.s4.accountTitle}</h1>
    <nav aria-label={t.s4.accountTitle} className="mb-7 flex gap-5 border-b border-line">
      <Link href={`/${locale}/account/orders`} aria-current={active === 'orders' ? 'page' : undefined} className={`-mb-px border-b-2 py-2.5 ${active === 'orders' ? 'border-ink font-medium' : 'border-transparent text-subtle'}`}>{t.orders.title}</Link>
      <Link href={`/${locale}/account`} aria-current={active === 'profile' ? 'page' : undefined} className={`-mb-px border-b-2 py-2.5 ${active === 'profile' ? 'border-ink font-medium' : 'border-transparent text-subtle'}`}>{t.s4.accountInfo}</Link>
      <AccountLogout locale={locale} />
    </nav>
  </>;
}
