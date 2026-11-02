import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckoutSummary } from '../components/checkout-summary';
import type { Cart, Quote } from '../lib/checkout-types';

vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => createElement('img', props) }));

/**
 * The tax of a quote that could not be calculated.
 *
 * The tax provider did not answer, so the quote carries no tax and no total.
 * The storefront says that the tax is being calculated instead of showing an
 * empty total and a prompt that reads like a missing quote.
 */
const cart: Cart = { items: [], itemCount: 0, subtotal: 20 };
const quote = (over: Partial<Quote> = {}): Quote => ({
  currency: 'USD',
  subtotal: '20.00',
  shippingOptions: [{ id: 'free-shipping:free', label: 'Free shipping', amount: '0.00' }],
  paymentMethods: [{ providerSlug: 'manual-payment', displayName: 'Manual payment' }],
  ...over,
});

const render = (value: Quote) => renderToStaticMarkup(createElement(CheckoutSummary, {
  cart, quote: value, shippingOptionId: 'free-shipping:free', locale: 'en', currency: 'USD',
}));

describe('The degraded tax of a quote', () => {
  it('shows that the tax is being calculated and no empty total', () => {
    const html = render(quote({ taxUnavailable: true }));
    expect(html).toContain('The tax is being calculated');
    expect(html).not.toContain('—');
  });

  it('shows the tax and the total of a complete quote', () => {
    const html = render(quote({ tax: '1.80', taxInclusive: false, total: '21.80' }));
    expect(html).toContain('1.80');
    expect(html).toContain('21.80');
    expect(html).not.toContain('The tax is being calculated');
  });
});
