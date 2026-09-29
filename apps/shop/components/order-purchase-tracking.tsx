'use client';

import { useEffect } from 'react';
import { documentTracking, sendPurchase, type PurchaseData } from '@/lib/purchase-tracking';

export function PurchaseTrackingDisabled() {
  useEffect(() => {
    documentTracking().initialized({ ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null });
  }, []);
  return null;
}

export function OrderPurchaseTracking({ order }: { order: PurchaseData }) {
  const { id, totalAmount, shippingAmount, taxAmount, currency, items } = order;
  useEffect(() => {
    const state = documentTracking();
    if (state.claimedDocument) return;
    state.claimedDocument = true;
    async function claim() {
      try {
        const response = await fetch(`/bff/orders/${encodeURIComponent(id)}/tracking-claim`, {
          method: 'POST', credentials: 'same-origin',
        });
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true ||
          !('data' in result) || !result.data || typeof result.data !== 'object' ||
          !('claimed' in result.data) || result.data.claimed !== true) return;
        const ids = await state.ready;
        sendPurchase({ id, totalAmount, shippingAmount, taxAmount, currency, items }, ids);
      } catch {
        // A consumed claim is never retried after transport or provider failures.
      }
    }
    void claim();
  }, [id, totalAmount, shippingAmount, taxAmount, currency, items]);
  return null;
}
