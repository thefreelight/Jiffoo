'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, ChevronRight } from 'lucide-react';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from './ui/sheet';
import { LanguageSwitcher } from './language-switcher';
import { AuthLinks } from './auth-links';

export function DrawerMenu({ label, links, locale, supported, storeName, loggedIn, showSearch }: {
  label: string; links: Array<{ href: string; label: string }>; locale: ShopLocale;
  supported: ShopLocale[]; storeName: string; loggedIn: boolean; showSearch: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = storefrontMessages(locale);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-2 hover:bg-highlight"><Menu size={18} aria-hidden="true" /><span className="sr-only md:hidden">{t.shop.openMenu}</span><span className="hidden text-sm md:inline">{label}</span></SheetTrigger>
    <SheetContent side="left" closeLabel={t.shop.closeMenu} className="w-full gap-0 sm:max-w-[420px]">
      <div className="border-b border-line px-5 py-4"><SheetTitle className="text-base font-bold">{storeName}</SheetTitle><SheetDescription className="sr-only">{label}</SheetDescription></div>
      <div className="flex-1 overflow-auto px-5">
        {showSearch && <form action={`/${locale}/search`} method="get" role="search" aria-label={t.navigation.search} className="my-4 flex h-10 rounded-md border border-line bg-[var(--shop-core-raised)]">
          <input type="search" name="q" aria-label={t.navigation.search} placeholder={t.navigation.search} className="min-w-0 flex-1 bg-transparent px-3" />
          <button type="submit" className="px-3">{t.navigation.searchAction}</button></form>}
        <nav aria-label={label}>{links.map((link) => <Link key={link.href} href={link.href} title={link.label} onClick={() => setOpen(false)} className="flex min-w-0 items-center justify-between gap-3 border-b border-line py-4 text-base"><span className="min-w-0 truncate">{link.label}</span><ChevronRight size={15} className="shrink-0" aria-hidden="true" /></Link>)}</nav>
      </div>
      <div className="space-y-3 border-t border-line p-5">
        <div className="flex flex-wrap items-center justify-center gap-3"><AuthLinks locale={locale} loggedIn={loggedIn} labels={t.navigation} presentation="links" onNavigate={() => setOpen(false)} /></div>
        <div className="flex justify-center"><LanguageSwitcher locale={locale} supported={supported} label={t.navigation.language} names={t.navigation.localeNames} /></div>
      </div>
    </SheetContent>
  </Sheet>;
}
