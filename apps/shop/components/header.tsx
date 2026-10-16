import { ShopImage as Image } from './shop-image';
import Link from 'next/link';
import type { Category, StoreContext } from '@/lib/catalog';
import { messages } from '@/lib/catalog';
import { localePath, type ShopLocale } from '@/lib/locale';
import { LanguageSwitcher } from './language-switcher';
import { AuthLinks } from './auth-links';
import { DrawerMenu } from './drawer-menu';
import { HeaderSearch } from './header-search';
import { CartButton } from './cart-sheet';
import type { ShopTheme } from '@/lib/theme';

export function Header({ context, locale, categories, loggedIn, cartCount, options }: {
  context: StoreContext; locale: ShopLocale; categories: Category[]; loggedIn: boolean;
  cartCount: number; options?: ShopTheme['layout']['header'];
}) {
  const t = messages(locale);
  const links = [{ href: localePath(locale, '/products'), label: t.navigation.products },
    ...categories.map((category) => ({ href: localePath(locale, `/categories/${category.slug}`), label: category.name }))];
  return <header className="relative z-30 border-b border-line bg-header-bg text-header-text">
    <div className={`mx-auto flex min-h-14 max-w-7xl items-center gap-2 px-4 md:min-h-16 md:gap-7 md:px-8 ${options?.variant === 'logo-center' ? 'flex-wrap justify-center' : ''}`}>
      <div className={options?.menu === 'drawer' ? '' : 'md:hidden'}><DrawerMenu label={t.navigation.categories} links={links}
        locale={locale} supported={context.supportedLocales} storeName={context.storeName} loggedIn={loggedIn} showSearch={options?.showSearch !== false} /></div>
      <Link href={localePath(locale)} aria-label={context.storeName} className={`flex min-w-0 items-center gap-2 text-[17px] font-bold tracking-tight ${options?.variant === 'logo-center' ? 'md:order-first md:w-full md:justify-center md:pt-3' : ''}`}>
        {context.logo && <Image src={context.logo} alt={context.storeName} width={32} height={32} className="size-8 object-contain" />}<span className="truncate">{context.storeName}</span>
      </Link>
      {options?.menu !== 'drawer' && <nav aria-label={t.navigation.categories} className="hidden min-w-0 items-center gap-[22px] overflow-x-auto text-sm text-subtle md:flex">
        {links.map((link) => <Link key={link.href} href={link.href} className="whitespace-nowrap hover:text-ink">{link.label}</Link>)}
      </nav>}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {options?.showSearch !== false && <HeaderSearch locale={locale} label={t.navigation.search} actionLabel={t.navigation.searchAction} />}
        <div className="hidden items-center gap-2 md:flex"><LanguageSwitcher locale={locale} supported={context.supportedLocales} label={t.navigation.language} names={t.navigation.localeNames} />
          <AuthLinks locale={locale} loggedIn={loggedIn} labels={t.navigation} presentation="menu" /></div>
        <CartButton initialCount={cartCount} locale={locale} loggedIn={loggedIn} />
      </div>
    </div>
  </header>;
}
