'use client';

import { useT } from 'shared/src/i18n/react';
import { cn } from '@/lib/utils';

export function StatusShape({ status }: { status: string }) {
  const cancelled = status === 'CANCELLED' || status === 'REFUNDED';
  return <span aria-hidden="true" className={cn('relative inline-flex size-3 shrink-0 rounded-full border border-current',
    (status === 'PENDING' || cancelled) && 'text-faint', status === 'PENDING' && 'border-dashed')}
    style={{ background: status === 'DELIVERED' ? 'currentColor' : status === 'PROCESSING' ? 'conic-gradient(currentColor 50%, transparent 0)' : status === 'SHIPPED' ? 'conic-gradient(currentColor 75%, transparent 0)' : undefined }}>
    {cancelled && <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none">×</span>}
  </span>;
}

export function PaymentPill({ paymentStatus, requiresPaymentReview }: { paymentStatus?: string | null; requiresPaymentReview: boolean }) {
  const t = useT();
  const label = requiresPaymentReview ? t('merchant.orders.list.requiresReview') : paymentStatus === 'PAID' ? t('merchant.orders.paid') : paymentStatus === 'REFUNDED' ? t('merchant.orders.refunded') : t('merchant.orders.list.unpaid');
  return <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs whitespace-nowrap', requiresPaymentReview ? 'border-attention-line bg-attention-soft text-attention' : paymentStatus === 'PAID' ? 'border-border text-foreground' : 'border-border text-faint')}>{label}</span>;
}
