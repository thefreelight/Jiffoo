'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, LogIn, LogOut, UserRound, UserRoundPlus } from 'lucide-react';
import type { ShopLocale } from '@/lib/locale';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';

export function AuthLinks({ locale, loggedIn, labels }: {
  locale: ShopLocale;
  loggedIn: boolean;
  labels: { login: string; register: string; account: string; logout: string; orders: string };
}) {
  const pathname = usePathname();
  const availability = useShopAvailability(locale);
  const mobileEntry = 'flex shrink-0 items-center p-[calc(var(--shop-section-spacing)/6)] md:block md:shrink md:p-0';
  if (loggedIn) return <>
    <Link href={`/${locale}/account/orders`} aria-label={labels.orders} title={labels.orders} className={`${mobileEntry} text-sm text-action`}>
      <ClipboardList size={18} className="md:hidden" aria-hidden="true" /><span className="sr-only md:not-sr-only">{labels.orders}</span></Link>
    <Link href={`/${locale}/account`} aria-label={labels.account} title={labels.account} className={`${mobileEntry} text-sm text-action`}>
      <UserRound size={18} className="md:hidden" aria-hidden="true" /><span className="sr-only md:not-sr-only">{labels.account}</span></Link>
    <button type="button" disabled={availability.blocked} aria-label={labels.logout} title={labels.logout} className={`${mobileEntry} text-sm text-ink`} onClick={async () => {
      availability.clear();
      try {
        await availabilityFetch('/bff/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        window.location.assign(`/${locale}`);
      } catch (error) { if (!availability.capture(error)) throw error; }
    }}><LogOut size={18} className="md:hidden" aria-hidden="true" /><span className="sr-only md:not-sr-only">{labels.logout}</span></button>
    {availability.message && <p role="status" className="text-sm text-action">{availability.message}</p>}
  </>;
  const next = encodeURIComponent(pathname || `/${locale}`);
  return <>
    <Link href={`/${locale}/login?next=${next}`} aria-label={labels.login} title={labels.login} className={`${mobileEntry} text-sm text-action`}>
      <LogIn size={18} className="md:hidden" aria-hidden="true" /><span className="sr-only md:not-sr-only">{labels.login}</span></Link>
    <Link href={`/${locale}/register?next=${next}`} aria-label={labels.register} title={labels.register} className={`${mobileEntry} text-sm text-ink`}>
      <UserRoundPlus size={18} className="md:hidden" aria-hidden="true" /><span className="sr-only md:not-sr-only">{labels.register}</span></Link>
  </>;
}
