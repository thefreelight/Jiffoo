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
    <SheetTrigger aria-label={t.shop.openMenu} className="flex size-9 items-center justify-center rounded-md hover:bg-highlight"><Menu size={18} /></SheetTrigger>
    <SheetContent side="left" closeLabel={t.shop.closeMenu} className="w-full gap-0 sm:max-w-[420px]">
      <div className="border-b border-line px-5 py-4"><SheetTitle className="text-base font-bold">{storeName}</SheetTitle><SheetDescription className="sr-only">{label}</SheetDescription></div>
      <div className="flex-1 overflow-auto px-5">
        {showSearch && <form action={`/${locale}/search`} method="get" role="search" aria-label={t.navigation.search} className="my-4 flex h-10 rounded-md border border-line bg-[var(--shop-core-raised)]">
          <input type="search" name="q" aria-label={t.navigation.search} placeholder={t.navigation.search} className="min-w-0 flex-1 bg-transparent px-3" />
          <button type="submit" className="px-3">{t.navigation.searchAction}</button></form>}
        <nav aria-label={label}>{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-line py-4 text-base">{link.label}<ChevronRight size={15} /></Link>)}</nav>
      </div>
      <div className="space-y-3 border-t border-line p-5">
        <div className="flex flex-wrap items-center justify-center gap-3"><AuthLinks locale={locale} loggedIn={loggedIn} labels={t.navigation} presentation="links" onNavigate={() => setOpen(false)} /></div>
        <div className="flex justify-center"><LanguageSwitcher locale={locale} supported={supported} label={t.navigation.language} names={t.navigation.localeNames} /></div>
      </div>
    </SheetContent>
  </Sheet>;
}
