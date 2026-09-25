import { redirect } from 'next/navigation';
import { requireLocale } from '@/lib/catalog';
import { accountProfile } from '@/lib/server-account';
import { customerCart, customerData } from '@/lib/server-checkout';
import type { Address, Order } from '@/lib/checkout-types';
import { CheckoutView } from '@/components/checkout-view';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await requireLocale((await params).locale);
  if (!(await accountProfile())) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/checkout`)}`);
  const cart = await customerCart();
  if (!cart?.items.length) redirect(`/${locale}/cart`);
  const orders = await customerData<{ items: Order[] }>('/orders?limit=1');
  const address = orders?.items[0]?.shippingAddress ?? null;
  return <CheckoutView cart={cart} locale={locale} address={address as Address | null} />;
}
