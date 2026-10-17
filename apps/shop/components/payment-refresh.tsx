'use client';

import { useEffect, useEffectEvent } from 'react';
import { useRouter } from 'next/navigation';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';
import type { ShopLocale } from '@/lib/locale';
import type { Order } from '@/lib/checkout-types';
import { paymentPollDelay } from '@/lib/payment-result';

export function PaymentRefresh({ order, locale }: { order: Order; locale: ShopLocale }) {
  const router = useRouter();
  const availability = useShopAvailability(locale);
  const capture = useEffectEvent((error: unknown) => { availability.capture(error); });
  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      if (stopped) return;
      try {
        if (document.visibilityState !== 'hidden') {
          if (order.paymentId) {
            const status = await availabilityFetch(`/bff/payments/verify/${encodeURIComponent(order.paymentId)}`, { cache: 'no-store', signal: controller.signal });
            if (!status.ok) throw new Error('Payment status read failed');
          }
          const response = await availabilityFetch(`/bff/orders/${encodeURIComponent(order.id)}`, { cache: 'no-store', signal: controller.signal });
          if (!response.ok) throw new Error('Order status read failed');
          const next = (await response.json()).data as Order;
          if (!stopped && (next.paymentStatus !== order.paymentStatus || next.paymentAttemptState !== order.paymentAttemptState || next.status !== order.status)) {
            router.refresh(); return;
          }
        }
      } catch (error) { if (!stopped) capture(error); }
      if (!stopped) timer = setTimeout(() => void poll(), paymentPollDelay(++attempt));
    }
    timer = setTimeout(() => void poll(), paymentPollDelay(0));
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [order.id, order.paymentId, order.paymentStatus, order.paymentAttemptState, order.status, router]);
  return availability.message ? <p role="status" className="mx-auto max-w-[560px] px-4 text-[13px]">{availability.message}</p> : null;
}
