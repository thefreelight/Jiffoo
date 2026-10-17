import { getStoreContext } from '@/lib/catalog';
import { NotFoundContent } from '@/components/not-found-content';
import { headers } from 'next/headers';
import { isShopLocale } from '@/lib/locale';

export default async function NotFoundPage() {
  const context = await getStoreContext();
  const segment = (await headers()).get('x-shop-locale');
  const locale = segment && isShopLocale(segment) && context.supportedLocales.includes(segment) ? segment : context.defaultLocale;
  return <NotFoundContent locale={locale} />;
}
