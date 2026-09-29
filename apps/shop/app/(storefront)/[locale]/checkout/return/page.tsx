import { notFound, redirect } from 'next/navigation';
import { requireLocale } from '@/lib/catalog';
import { customerData, customerOrder } from '@/lib/server-checkout';
import { accountProfile } from '@/lib/server-account';
import { OrderSummary } from '@/components/order-summary';
import { OrderPurchaseTracking } from '@/components/order-purchase-tracking';
import { purchaseData } from '@/lib/purchase-tracking';

export default async function ReturnPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await requireLocale((await params).locale);
  const id = (await searchParams).order;
  if (!id) notFound();
  if (!(await accountProfile())) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/checkout/return?order=${id}`)}`);
  const initial = await customerOrder(id);
  if (!initial) notFound();
  if (initial.paymentSessionId) {
    await customerData(`/payments/verify/${encodeURIComponent(initial.paymentSessionId)}`);
  }
  const order = await customerOrder(id);
  if (!order) notFound();
  return <><OrderSummary order={order} locale={locale} /><OrderPurchaseTracking order={purchaseData(order)} /></>;
}
