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
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const visible = () => document.visibilityState !== 'hidden';
    async function poll() {
      if (stopped || inFlight || !visible()) return;
      clearTimeout(timer);
      inFlight = true;
      try {
        if (order.paymentId && !order.paymentInstructions) {
          try {
            const status = await availabilityFetch(`/bff/payments/verify/${encodeURIComponent(order.paymentId)}`, { cache: 'no-store', signal: controller.signal });
            if (!status.ok) throw new Error('Payment status read failed');
          } catch (error) { if (!stopped) capture(error); }
        }
        if (stopped) return;
        const response = await availabilityFetch(`/bff/orders/${encodeURIComponent(order.id)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Order status read failed');
        const next = (await response.json()).data as Order;
        if (!stopped && (next.paymentStatus !== order.paymentStatus || next.paymentAttemptState !== order.paymentAttemptState || next.status !== order.status || next.paymentInstructions !== order.paymentInstructions)) {
          router.refresh();
        }
      } catch (error) { if (!stopped) capture(error); }
      finally {
        inFlight = false;
        if (!stopped && visible()) timer = setTimeout(() => void poll(), paymentPollDelay());
      }
    }
    const resume = () => { if (visible()) void poll(); else clearTimeout(timer); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    timer = setTimeout(() => void poll(), paymentPollDelay());
    return () => { stopped = true; clearTimeout(timer); controller.abort(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
  }, [order.id, order.paymentId, order.paymentStatus, order.paymentAttemptState, order.paymentInstructions, order.status, router]);
  return availability.message ? <p role="status" className="mx-auto max-w-[560px] px-4 text-[13px]">{availability.message}</p> : null;
}
