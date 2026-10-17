// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CheckoutView } from '../components/checkout-view';
import type { SavedAddress } from '../lib/checkout-types';

const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../lib/client-availability', () => ({ availabilityFetch: state.fetch, useShopAvailability: () => ({ blocked: false, message: '', clear: vi.fn(), capture: () => false }) }));
afterEach(() => vi.clearAllMocks());

it.each([null, undefined])('submits a real validated quote from saved optional fields set to %s', async (empty) => {
  const address: SavedAddress = { firstName: 'Buyer', lastName: 'Test', phone: '123456', addressLine1: 'Main Street', city: 'Paris', country: 'FR', addressLine2: empty, state: empty, postalCode: empty, company: empty };
  state.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { currency: 'USD', subtotal: '10.00', total: '10.00', shippingOptions: [], paymentMethods: [] } }), { status: 200 }));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(CheckoutView, { cart: { items: [], itemCount: 0, subtotal: 10 }, locale: 'en', address, countries: [{ code: 'FR', name: 'France' }], requiredCountries: [], email: 'buyer@example.com', currency: 'USD' })));
    await act(async () => container.getElementsByTagName('button')[0].click());
    expect(state.fetch).toHaveBeenCalledOnce();
    expect(state.fetch.mock.calls[0][0]).toBe('/bff/checkout/quote');
    expect(JSON.parse(state.fetch.mock.calls[0][1].body)).toEqual({ shippingAddress: { firstName: 'Buyer', lastName: 'Test', phone: '123456', addressLine1: 'Main Street', city: 'Paris', country: 'FR' } });
    expect(container.textContent).not.toContain('Expected string');
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it('keeps configured state and postal requirements when saved values are null', async () => {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(CheckoutView, { cart: { items: [], itemCount: 0, subtotal: 10 }, locale: 'en', address: { firstName: 'Buyer', lastName: 'Test', phone: '123456', addressLine1: 'Street', city: 'City', country: 'US', state: null, postalCode: null }, countries: [{ code: 'US', name: 'United States' }], requiredCountries: ['US'], email: 'buyer@example.com', currency: 'USD' })));
    await act(async () => container.getElementsByTagName('button')[0].click());
    expect(state.fetch).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('address-state');
  } finally { await act(async () => root.unmount()); container.remove(); }
});
