'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ShopLocale } from '@/lib/locale';

export function AuthLinks({ locale, loggedIn, labels }: {
  locale: ShopLocale;
  loggedIn: boolean;
  labels: { login: string; register: string; account: string; logout: string };
}) {
  const pathname = usePathname();
  if (loggedIn) return <>
    <Link href={`/${locale}/account`} className="text-sm text-action">{labels.account}</Link>
    <button type="button" className="text-sm text-ink" onClick={async () => {
      await fetch('/bff/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      window.location.assign(`/${locale}`);
    }}>{labels.logout}</button>
  </>;
  const next = encodeURIComponent(pathname || `/${locale}`);
  return <>
    <Link href={`/${locale}/login?next=${next}`} className="text-sm text-action">{labels.login}</Link>
    <Link href={`/${locale}/register?next=${next}`} className="text-sm text-ink">{labels.register}</Link>
  </>;
}
