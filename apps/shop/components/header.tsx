import Image from 'next/image';
import Link from 'next/link';
import { Search, ShoppingCart } from 'lucide-react';
import type { Category, StoreContext } from '@/lib/catalog';
import { messages } from '@/lib/catalog';
import { localePath, type ShopLocale } from '@/lib/locale';
import { LanguageSwitcher } from './language-switcher';
import { AuthLinks } from './auth-links';

export function Header({ context, locale, categories, loggedIn, cartCount }: { context: StoreContext; locale: ShopLocale; categories: Category[]; loggedIn: boolean; cartCount: number }) {
  const t = messages(locale);
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-5 px-4 py-4 md:px-8">
        <Link href={localePath(locale)} aria-label={context.storeName} className="flex min-w-0 items-center gap-3 text-lg font-semibold">
          {context.logo && <Image src={context.logo} alt={context.storeName} width={36} height={36} className="h-9 w-9 object-contain" />}
          <span className="truncate">{context.storeName}</span>
        </Link>
        <nav aria-label={t.navigation.categories} className="order-3 flex w-full items-center gap-5 overflow-x-auto text-sm md:order-2 md:w-auto">
          <Link href={localePath(locale, '/products')} className="whitespace-nowrap hover:text-action">{t.navigation.products}</Link>
          {categories.map((category) => (
            <Link key={category.id} href={localePath(locale, `/categories/${category.slug}`)} className="whitespace-nowrap hover:text-action">{category.name}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {loggedIn && <Link href={localePath(locale, '/cart')} aria-label={`${t.navigation.cart} (${cartCount})`}
            className="flex items-center gap-1 text-sm text-action"><ShoppingCart size={18} />{t.navigation.cart} ({cartCount})</Link>}
          <AuthLinks locale={locale} loggedIn={loggedIn} labels={t.navigation} />
          <form action={localePath(locale, '/search')} role="search" className="flex items-center rounded-shop border border-line bg-canvas">
            <label htmlFor="shop-search" className="sr-only">{t.navigation.search}</label>
            <input id="shop-search" name="q" type="search" placeholder={t.navigation.search} className="w-28 bg-transparent px-3 py-2 text-sm outline-none sm:w-44" />
            <button type="submit" aria-label={t.navigation.searchAction} title={t.navigation.searchAction} className="p-2 text-action"><Search size={18} /></button>
          </form>
          <LanguageSwitcher locale={locale} supported={context.supportedLocales} label={t.navigation.language} names={t.navigation.localeNames} />
        </div>
      </div>
    </header>
  );
}
