import '../app/globals.css';
import { headers } from 'next/headers';
import { isShopLocale } from '@/lib/locale';
import { getStoreContext } from '@/lib/catalog';
import { DocumentShell } from './document-shell';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const routeLocale = (await headers()).get('x-shop-locale');
  const locale = routeLocale && isShopLocale(routeLocale) ? routeLocale : (await getStoreContext()).defaultLocale;
  return <DocumentShell locale={locale}>{children}</DocumentShell>;
}
