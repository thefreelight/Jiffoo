import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { isShopLocale } from '@/lib/locale';
import { shopBootstrap } from '@/lib/server-bootstrap';
import { themeStyle } from '@/lib/theme-style';
import { Footer } from '@/components/footer';
import type { StoreContext, Category } from '@/lib/catalog';
import type { ShopTheme } from '@/lib/theme';
import type { ShopLocale } from '@/lib/locale';
import { CartSheet } from './cart-sheet';
import { SectionRenderer } from './theme-sections';
import type { Cart } from '@/lib/checkout-types';

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isShopLocale(locale)) notFound();
  const { context, theme, navigation, profile, cart } = await shopBootstrap();
  if (!isShopLocale(locale) || !context.supportedLocales.includes(locale)) notFound();
  return <ThemeShell context={context} locale={locale} navigation={navigation} theme={theme}
    loggedIn={!!profile} cartCount={cart?.itemCount ?? 0} initialCart={cart}>{children}</ThemeShell>;
}

export function ThemeShell({ context, locale, navigation, theme, loggedIn, cartCount, initialCart, children }: {
  context: StoreContext; locale: ShopLocale; navigation: Category[]; theme: ShopTheme | null;
  loggedIn: boolean; cartCount: number; initialCart?: Cart | null; children?: React.ReactNode;
}) {
  return <>
    <style data-shop-theme="" dangerouslySetInnerHTML={{ __html: themeStyle(theme) }} />
    {theme?.layout.pages.home.sections.filter((section) => section.type === 'announcement-bar').map((section) =>
      <SectionRenderer key={section.id} section={section} data={{ locale, currency: context.currency, groups: navigation, items: [] }} />)}
    <Header context={context} locale={locale} categories={navigation} loggedIn={loggedIn}
      cartCount={cartCount} options={theme?.layout.header} />
    {children}
    <Footer locale={locale} columns={theme?.layout.footer.columns ?? []} />
    <CartSheet locale={locale} currency={context.currency} loggedIn={loggedIn} initial={initialCart} />
  </>;
}
