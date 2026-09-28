import { notFound } from 'next/navigation';
import { categories, getStoreContext } from '@/lib/catalog';
import { Header } from '@/components/header';
import { isShopLocale } from '@/lib/locale';
import { accountProfile } from '@/lib/server-account';
import { customerCart } from '@/lib/server-checkout';
import { getShopTheme } from '@/lib/theme';
import { themeStyle } from '@/lib/theme-style';
import { Footer } from '@/components/footer';
import type { StoreContext, Category } from '@/lib/catalog';
import type { ShopTheme } from '@/lib/theme';
import type { ShopLocale } from '@/lib/locale';

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isShopLocale(locale)) notFound();
  const [context, theme] = await Promise.all([getStoreContext(), getShopTheme(locale)]);
  if (!isShopLocale(locale) || !context.supportedLocales.includes(locale)) notFound();
  const [navigation, profile] = await Promise.all([categories(locale), accountProfile()]);
  const cart = profile ? await customerCart() : null;
  return <ThemeShell context={context} locale={locale} navigation={navigation} theme={theme}
    loggedIn={!!profile} cartCount={cart?.itemCount ?? 0}>{children}</ThemeShell>;
}

export function ThemeShell({ context, locale, navigation, theme, loggedIn, cartCount, children }: {
  context: StoreContext; locale: ShopLocale; navigation: Category[]; theme: ShopTheme | null;
  loggedIn: boolean; cartCount: number; children?: React.ReactNode;
}) {
  return <>
    <style precedence="theme" dangerouslySetInnerHTML={{ __html: themeStyle(theme) }} />
    <Header context={context} locale={locale} categories={navigation} loggedIn={loggedIn}
      cartCount={cartCount} options={theme?.layout.header} />
    {children}
    <Footer locale={locale} columns={theme?.layout.footer.columns ?? []} />
  </>;
}
