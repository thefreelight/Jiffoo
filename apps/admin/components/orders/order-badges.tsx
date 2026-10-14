'use client';

import { useT } from 'shared/src/i18n/react';
import { cn } from '@/lib/utils';

export function StatusShape({ status }: { status: string }) {
  const cancelled = status === 'CANCELLED' || status === 'REFUNDED';
  return <svg aria-hidden="true" viewBox="0 0 14 14" fill="none" className={cn('size-3.5 shrink-0', (status === 'PENDING' || cancelled) && 'text-faint')}>
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray={status === 'PENDING' ? '2 2.2' : undefined} fill={status === 'DELIVERED' ? 'currentColor' : 'none'} />
    {status === 'PROCESSING' && <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />}
    {status === 'SHIPPED' && <path d="M7 3.5a3.5 3.5 0 1 1-3.5 3.5H7z" fill="currentColor" />}
    {cancelled && <path d="M5.2 5.2l3.6 3.6M8.8 5.2l-3.6 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
  </svg>;
}

export function PaymentPill({ paymentStatus, requiresPaymentReview }: { paymentStatus?: string | null; requiresPaymentReview: boolean }) {
  const t = useT();
  const label = requiresPaymentReview ? t('merchant.orders.list.requiresReview') : paymentStatus === 'PAID' ? t('merchant.orders.paid') : paymentStatus === 'REFUNDED' ? t('merchant.orders.refunded') : t('merchant.orders.list.unpaid');
  return <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs whitespace-nowrap', requiresPaymentReview ? 'border-attention-line bg-attention-soft text-attention' : paymentStatus === 'PAID' ? 'border-border text-foreground' : 'border-border text-faint')}>{label}</span>;
}
