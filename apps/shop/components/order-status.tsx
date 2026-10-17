import type { ShopLocale } from '@/lib/locale';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/order-labels';

export function OrderStatus({ status, paymentStatus, locale }: { status: string; paymentStatus: string; locale: ShopLocale }) {
  const attention = status === 'PENDING' && paymentStatus === 'PENDING';
  return <span className={`inline-flex h-[22px] items-center rounded-md px-2 text-xs font-medium ${attention ? 'bg-[var(--shop-core-attention-soft)] text-[var(--shop-core-attention)]'
    : status === 'SHIPPED' ? 'bg-[var(--shop-success-soft)] text-success' : 'bg-highlight text-subtle'}`}>
    {attention ? paymentStatusLabel(locale, paymentStatus) : orderStatusLabel(locale, status)}
  </span>;
}
