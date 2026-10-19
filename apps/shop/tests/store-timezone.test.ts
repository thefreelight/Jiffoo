// @vitest-environment jsdom
import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { OrderDetail } from '../components/order-detail';
import type { Order } from '../lib/checkout-types';
import { formatStoreDate } from 'shared';

const order: Order = { id: 'timezone-probe', orderNumber: 'JF-20261012-0001', createdAt: '2026-10-12T00:15:00Z', status: 'CONFIRMED', paymentStatus: 'PAID',
  currency: 'USD', items: [], totalAmount: 1, subtotalAmount: 1, shippingAmount: 0, taxAmount: 0, taxInclusive: false,
  shipments: [], shippingAddress: null, shippingMethod: null, paymentInstructions: null, paymentSessionId: null,
  cancelledAt: null, cancelReason: null, unpaidExpiresAt: null };
it('the actual order client component hydrates without text mismatch across server and browser timezones', async () => {
  const element = createElement(OrderDetail, { initialOrder: order, locale: 'en', timezone: 'Asia/Shanghai' });
  const container = document.createElement('div'); document.body.append(container);
  let root: Root | undefined;
  const errors: string[] = [];
  try {
    vi.stubEnv('TZ', 'UTC'); container.innerHTML = renderToString(element);
    const serverHtml = container.innerHTML;
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(renderToString(element)).toBe(serverHtml);
    await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: error => errors.push(String(error)) }); await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(container.textContent).toContain(order.orderNumber); expect(container.textContent).not.toContain(order.id);
    expect(errors).toEqual([]); expect(container.textContent).toContain('Asia/Shanghai'); expect(container.textContent).toContain('08:15');
  } finally { if (root) await act(async () => root!.unmount()); container.remove(); vi.unstubAllEnvs(); }
});
it('explicit store zones cross calendar days and distinguish repeated daylight-saving hours', () => {
  expect(formatStoreDate(order.createdAt, 'en', 'America/Los_Angeles', true)).toContain('Oct 11');
  const first = formatStoreDate('2026-11-01T05:30:00Z', 'en', 'America/New_York');
  const second = formatStoreDate('2026-11-01T06:30:00Z', 'en', 'America/New_York');
  expect(first).not.toBe(second); expect(first).toContain('01:30'); expect(second).toContain('01:30');
});
