import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { PURCHASE_ORIGIN_COOKIE, purchaseOriginId } from '@/lib/auth-contract';
import { requireLocale } from '@/lib/catalog';
import { accountProfile } from '@/lib/server-account';
import { customerCart, customerData } from '@/lib/server-checkout';
import type { Order } from '@/lib/checkout-types';
import { CheckoutView } from '@/components/checkout-view';
import { localizedCountries } from '@/lib/countries';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, context } = await requireLocale((await params).locale);
  const profile = await accountProfile();
  if (!profile) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/checkout`)}`);
  const cart = await customerCart();
  if (!cart?.items.length) redirect(`/${locale}/cart`);
  const orders = await customerData<{ items: Order[] }>('/orders?limit=1');
  const address = orders?.items[0]?.shippingAddress ?? null;
  const countries = localizedCountries(locale);
  const pluginPurchaseOriginId = purchaseOriginId((await cookies()).get(PURCHASE_ORIGIN_COOKIE)?.value);
  return <CheckoutView cart={cart} locale={locale} address={address} countries={countries}
    requiredCountries={context.checkoutCountriesRequireStatePostal ?? []} email={profile.email} currency={context.currency}
    pluginPurchaseOriginId={pluginPurchaseOriginId} />;
}
