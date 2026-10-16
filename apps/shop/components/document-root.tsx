import '../app/globals.css';
import { headers } from 'next/headers';
import { isShopLocale } from '@/lib/locale';
import { shopBootstrap } from '@/lib/server-bootstrap';
import { DocumentShell } from './document-shell';
import { shopFontClassName } from '@/lib/fonts';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const routeLocale = (await headers()).get('x-shop-locale');
  const { context, theme } = await shopBootstrap();
  const locale = routeLocale && isShopLocale(routeLocale) ? routeLocale : context.defaultLocale;
  return <DocumentShell locale={locale} fontClassName={shopFontClassName} darkAvailable={theme?.darkAvailable ?? true}>{children}</DocumentShell>;
}
