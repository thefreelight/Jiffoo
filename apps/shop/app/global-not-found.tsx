import './globals.css';
import { headers } from 'next/headers';
import { isShopLocale } from '@/lib/locale';
import { shopBootstrap } from '@/lib/server-bootstrap';
import { NotFoundContent } from '@/components/not-found-content';
import { getShopTheme } from '@/lib/theme';
import { ThemeShell } from '@/components/locale-layout';

export default async function GlobalNotFound() {
  const { context, theme: currentTheme, navigation, profile, cart } = await shopBootstrap();
  const segment = (await headers()).get('x-shop-locale');
  const locale = segment && isShopLocale(segment) && context.supportedLocales.includes(segment) ? segment : context.defaultLocale;
  const theme = currentTheme ?? await getShopTheme(locale);
  return <html lang={locale} data-color-mode="system" data-shop-dark-available={String(theme?.darkAvailable ?? false)}><body>
    <ThemeShell context={context} locale={locale} navigation={navigation} theme={theme} loggedIn={!!profile} cartCount={cart?.itemCount ?? 0} initialCart={cart}>
      <NotFoundContent locale={locale} />
    </ThemeShell>
  </body></html>;
}
