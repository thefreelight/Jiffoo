import { notFound } from 'next/navigation';
import { categories, getStoreContext } from '@/lib/catalog';
import { Header } from '@/components/header';
import { isShopLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, context] = await Promise.all([params, getStoreContext()]);
  if (!isShopLocale(locale) || !context.supportedLocales.includes(locale)) notFound();
  const navigation = await categories(locale);
  return <><Header context={context} locale={locale} categories={navigation} />{children}</>;
}
