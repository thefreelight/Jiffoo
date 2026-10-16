'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { ShopLocale } from '@/lib/locale';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';
import { storefrontMessages } from '@/lib/storefront-messages';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

export function AuthLinks({ locale, loggedIn, labels, presentation, onNavigate }: {
  locale: ShopLocale; loggedIn: boolean; presentation: 'menu' | 'links';
  labels: { login: string; register: string; account: string; logout: string; orders: string };
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const availability = useShopAvailability(locale);
  const [error, setError] = useState('');
  const next = encodeURIComponent(pathname || `/${locale}`);
  const links = loggedIn ? [{ href: `/${locale}/account`, label: labels.account }, { href: `/${locale}/account/orders`, label: labels.orders }]
    : [{ href: `/${locale}/login?next=${next}`, label: labels.login }, { href: `/${locale}/register?next=${next}`, label: labels.register }];
  async function logout() {
    availability.clear(); setError('');
    try {
      const response = await availabilityFetch('/bff/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) { setError(storefrontMessages(locale).account.genericError); return; }
      window.location.assign(`/${locale}`);
    } catch (error) { if (!availability.capture(error)) setError(storefrontMessages(locale).account.genericError); }
  }
  const message = availability.message || error;
  if (presentation === 'links') return <>
    {links.map((link, index) => <Link key={link.href} href={link.href} aria-label={link.label} onClick={onNavigate}
      className={index === 0 ? 'flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line text-sm' : 'text-sm'}>
      {index === 0 && <UserRound size={16} aria-hidden="true" />}{index === 0 ? storefrontMessages(locale).shop.accountEntry : link.label}</Link>)}
    {loggedIn && <button type="button" aria-label={labels.logout} disabled={availability.blocked} onClick={() => void logout()} className="text-sm">{labels.logout}</button>}
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
  </>;
  return <><DropdownMenu><DropdownMenuTrigger aria-label={labels.account} className="flex size-9 items-center justify-center rounded-md hover:bg-highlight"><UserRound size={18} aria-hidden="true" /></DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label={labels.account}>
      {links.map((link) => <DropdownMenuItem key={link.href} asChild><Link href={link.href}>{link.label}</Link></DropdownMenuItem>)}
      {loggedIn && <DropdownMenuItem disabled={availability.blocked} onSelect={() => void logout()}>{labels.logout}</DropdownMenuItem>}
    </DropdownMenuContent></DropdownMenu>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
  </>;
}
