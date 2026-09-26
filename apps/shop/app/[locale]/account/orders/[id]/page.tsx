import { notFound, redirect } from 'next/navigation';
import { requireLocale } from '@/lib/catalog';
import { accountProfile } from '@/lib/server-account';
import { customerOrder } from '@/lib/server-checkout';
import { OrderDetail } from '@/components/order-detail';

export default async function OrderDetailPage({ params }: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const { locale } = await requireLocale(rawLocale);
  if (!/^c[a-z0-9]{24}$/.test(id)) notFound();
  if (!(await accountProfile())) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/orders/${id}`)}`);
  const order = await customerOrder(id);
  if (!order) notFound();
  return <OrderDetail initialOrder={order} locale={locale} />;
}
