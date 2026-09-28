import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import type { Category, StoreContext } from '@/lib/catalog';
import { messages } from '@/lib/catalog';
import { localePath, type ShopLocale } from '@/lib/locale';
import { LanguageSwitcher } from './language-switcher';
import { AuthLinks } from './auth-links';
import { DrawerMenu } from './drawer-menu';
import { HeaderSearch } from './header-search';
import type { ShopTheme } from '@/lib/theme';

export function Header({ context, locale, categories, loggedIn, cartCount, options }: {
  context: StoreContext; locale: ShopLocale; categories: Category[]; loggedIn: boolean;
  cartCount: number; options?: ShopTheme['layout']['header'];
}) {
  const t = messages(locale);
  const links = [
    { href: localePath(locale, '/products'), label: t.navigation.products },
    ...categories.map((category) => ({
      href: localePath(locale, `/categories/${category.slug}`), label: category.name,
    })),
  ];
  return (
    <header className="border-b border-line bg-header-bg text-header-text">
      <div className={`mx-auto flex max-w-7xl flex-wrap items-center gap-[calc(var(--shop-section-spacing)*5/12)] px-[calc(var(--shop-section-spacing)/3)] py-[calc(var(--shop-section-spacing)/3)] md:gap-5 md:px-8 md:py-4 ${options?.variant === 'logo-center' ? 'justify-center' : ''}`}>
        <Link href={localePath(locale)} aria-label={context.storeName}
          className={`flex min-w-0 items-center gap-3 text-lg font-semibold ${options?.variant === 'logo-center' ? 'order-first w-full justify-center' : ''}`}>
          {context.logo && <Image src={context.logo} alt={context.storeName} width={36} height={36} className="h-9 w-9 object-contain" />}
          <span className="truncate">{context.storeName}</span>
        </Link>
        {options?.menu === 'drawer'
          ? <DrawerMenu label={t.navigation.categories} links={links} />
          : <><div className="md:hidden"><DrawerMenu label={t.navigation.categories} links={links} /></div>
            <nav aria-label={t.navigation.categories} className="order-3 hidden w-full items-center gap-5 overflow-x-auto text-sm md:order-2 md:flex md:w-auto">
            {links.map((link) => <Link key={link.href} href={link.href} className="whitespace-nowrap hover:text-action">{link.label}</Link>)}
          </nav></>}
        <div className="relative ml-auto flex w-full min-w-0 flex-wrap items-center justify-end gap-[calc(var(--shop-section-spacing)/4)] md:static md:w-auto md:flex-nowrap md:justify-start md:gap-3">
          {loggedIn && <Link href={localePath(locale, '/cart')} aria-label={`${t.navigation.cart} (${cartCount})`}
            title={`${t.navigation.cart} (${cartCount})`}
            className="flex shrink-0 items-center gap-[calc(var(--shop-section-spacing)/12)] p-[calc(var(--shop-section-spacing)/6)] text-sm text-action md:shrink md:gap-1 md:p-0">
            <ShoppingCart size={18} className="shrink-0 md:shrink" aria-hidden="true" />
            <span className="sr-only md:not-sr-only">{t.navigation.cart} ({cartCount})</span></Link>}
          <AuthLinks locale={locale} loggedIn={loggedIn} labels={t.navigation} />
          {options?.showSearch !== false && <HeaderSearch locale={locale}
            label={t.navigation.search} actionLabel={t.navigation.searchAction} />}
          <LanguageSwitcher locale={locale} supported={context.supportedLocales} label={t.navigation.language} names={t.navigation.localeNames} />
        </div>
      </div>
    </header>
  );
}
