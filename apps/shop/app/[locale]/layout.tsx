import { notFound } from 'next/navigation';
import { categories, getStoreContext } from '@/lib/catalog';
import { Header } from '@/components/header';
import { isShopLocale } from '@/lib/locale';
import { accountProfile } from '@/lib/server-account';
import { customerCart } from '@/lib/server-checkout';

export const dynamic = 'force-dynamic';

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, context] = await Promise.all([params, getStoreContext()]);
  if (!isShopLocale(locale) || !context.supportedLocales.includes(locale)) notFound();
  const [navigation, profile] = await Promise.all([categories(locale), accountProfile()]);
  const cart = profile ? await customerCart() : null;
  return <><Header context={context} locale={locale} categories={navigation} loggedIn={!!profile} cartCount={cart?.itemCount ?? 0} />{children}</>;
}
