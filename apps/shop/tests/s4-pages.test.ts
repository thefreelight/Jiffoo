import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { addressSchema, authSchema } from '../lib/form-validation';
import { paymentResult, paymentPollDelay } from '../lib/payment-result';
import { CheckoutSummary } from '../components/checkout-summary';
import { OrderSummary } from '../components/order-summary';
import { AuthForm } from '../components/auth-form';
import { OrderStatus } from '../components/order-status';
import { storefront as en } from '../../../packages/shared/src/i18n/messages/en/storefront';
import type { Order } from '../lib/checkout-types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { storefront as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/storefront';

vi.mock('server-only', () => ({}));
vi.mock('../lib/catalog', () => ({ messages: () => en }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../lib/client-availability', () => ({ useShopAvailability: () => ({ blocked: false, message: '', clear: vi.fn(), capture: vi.fn() }), availabilityFetch: vi.fn() }));

const address = { firstName: 'First', lastName: 'Last', phone: '123', addressLine1: 'Street', addressLine2: '', city: 'City', state: '', postalCode: '', country: 'DE' };
const auth = { email: 'buyer@example.com', username: 'buyer', password: '12345678', newPassword: '123456', confirmPassword: '123456', code: '123456' };
const order: Order = { id: 'cm9abcdefghijklmnopqrstuv', createdAt: '2026-10-10T00:00:00Z', status: 'PENDING', paymentStatus: 'PENDING', paymentInstructions: 'Pay manually.', paymentSessionId: null, items: [], shippingAddress: null, currency: 'USD', subtotalAmount: 20, shippingAmount: 0, taxAmount: 0, taxInclusive: false, totalAmount: 20, shippingMethod: null, shipments: [], cancelReason: null, cancelledAt: null, unpaidExpiresAt: null };

describe('S4 form contracts', () => {
  it('requires region and postal code only for merchant-configured countries', () => {
    expect(addressSchema(en.s4, []).safeParse(address).success).toBe(true);
    const result = addressSchema(en.s4, ['DE']).safeParse(address);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(({ path }) => path[0])).toEqual(['state', 'postalCode']);
    expect(addressSchema(en.s4, ['DE']).safeParse({ ...address, state: 'Berlin', postalCode: '10115' }).success).toBe(true);
  });
  it('rejects whitespace-only required address fields and allows optional address supplement', () => {
    const result = addressSchema(en.s4, []).safeParse({ ...address, firstName: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['firstName']);
  });
  it('keeps username required and applies the approved registration password hint', () => {
    expect(authSchema('register', en.s4).safeParse(auth).success).toBe(true);
    for (const username of ['', 'ab']) expect(authSchema('register', en.s4).safeParse({ ...auth, username }).success).toBe(false);
    expect(authSchema('register', en.s4).safeParse({ ...auth, password: '1234567' }).success).toBe(false);
    expect(authSchema('login', en.s4).safeParse({ ...auth, password: '123456' }).success).toBe(true);
  });
  it('checks reset confirmation and verification code', () => {
    expect(authSchema('reset-password', en.s4).safeParse({ ...auth, confirmPassword: 'different' }).success).toBe(false);
    expect(authSchema('verify-email', en.s4).safeParse({ ...auth, code: '12345x' }).success).toBe(false);
    expect(authSchema('forgot-password', en.s4).safeParse({ ...auth, email: 'invalid' }).success).toBe(false);
  });
  it.each(['login', 'register', 'forgot-password', 'reset-password', 'verify-email'] as const)('renders the %s form with explicit labels', (mode) => {
    const html = renderToStaticMarkup(createElement(AuthForm, { mode, locale: 'en', labels: en.account, next: '/en', token: 'token' }));
    expect(html).toContain('noValidate');
    expect(html).toContain('auth-');
    if (mode === 'register') expect(html).toContain('Username');
    if (mode === 'reset-password') expect(html).toContain(en.s4.confirmPassword);
  });
});

describe('S4 result and summary states', () => {
  it('keeps the approved static Simplified Chinese copy byte-identical to the design sources', () => {
    const boards = Buffer.concat(['Cart', 'Checkout', 'CheckoutResult', 'SignIn', 'Account', 'NotFound'].map((name) => readFileSync(resolve(__dirname, `../../../docs/design/shop/${name}.dc.html`))));
    for (const key of ['summary', 'unitPrice', 'continueShopping', 'browse', 'emptyTitle', 'emptyBody', 'calculatedCheckout', 'contact', 'backCart', 'finish', 'optional', 'afterAddress', 'shippingPrompt', 'paymentPrompt', 'changedTitle', 'unavailableTitle', 'unavailableBody', 'paid', 'pending', 'pendingBody', 'cancelled', 'orderNumber', 'accountTitle', 'accountInfo', 'verified', 'registerHint', 'registerMail', 'forgotBody', 'forgotReceived', 'confirmPassword', 'verifiedTitle', 'verifiedBody', 'goShopping', 'storeTime'] as const) {
      expect(boards.includes(Buffer.from(hans.s4[key], 'utf8')), key).toBe(true);
    }
  });
  it.each(['UNKNOWN', 'REQUIRES_REVIEW'])('keeps %s pending even with an inconsistent paid snapshot', (paymentAttemptState) => {
    expect(paymentResult({ status: 'PENDING', paymentStatus: 'PAID', paymentAttemptState })).toBe('pending');
  });
  it('only renders success for a server-confirmed paid order', () => {
    const pending = renderToStaticMarkup(createElement(OrderSummary, { order, locale: 'en', timezone: 'UTC' }));
    expect(pending).toContain(en.s4.pending);
    expect(pending).not.toContain(en.s4.paid);
    const paid = renderToStaticMarkup(createElement(OrderSummary, { order: { ...order, paymentStatus: 'PAID' }, locale: 'en', timezone: 'UTC' }));
    expect(paid).toContain(en.s4.paid);
    expect(paid).not.toContain('Pay manually.');
    const cancel = renderToStaticMarkup(createElement(OrderSummary, { order, locale: 'en', timezone: 'UTC', cancelled: true }));
    expect(cancel).toContain(en.s4.cancelled);
    expect(cancel).toContain('/en/cart');
    expect(cancel).toContain(en.s4.cancellationBody);
    expect(cancel).not.toContain('cart has been kept');
  });
  it('backs off polling from 5 seconds to a bounded 30 seconds', () => {
    expect([0, 1, 2, 3, 20].map(paymentPollDelay)).toEqual([5000, 10000, 20000, 30000, 30000]);
  });
  it('shows final cancellation or failure without polling forever or claiming that an expired order awaits payment', () => {
    const html = renderToStaticMarkup(createElement(OrderSummary, { order: { ...order, status: 'CANCELLED' }, locale: 'en', timezone: 'UTC' }));
    expect(html).toContain(en.s4.cancelled);
    expect(html).not.toContain(en.s4.cancellationBody);
    expect(html).not.toContain(en.s4.pendingBody);
    expect(paymentResult({ ...order, paymentStatus: 'FAILED' })).toBe('cancelled');
    const alreadyPaid = renderToStaticMarkup(createElement(OrderSummary, { order: { ...order, paymentStatus: 'PAID' }, locale: 'en', timezone: 'UTC', cancelled: true }));
    expect(alreadyPaid).toContain(en.s4.paid); expect(alreadyPaid).not.toContain(en.s4.cancellationBody);
  });
  it('never invents shipping before a quote, and shows actual tax and shipping afterwards', () => {
    const cart = { items: [], itemCount: 0, subtotal: 20 };
    const before = renderToStaticMarkup(createElement(CheckoutSummary, { cart, quote: null, shippingOptionId: '', locale: 'en', currency: 'USD' }));
    expect(before).toContain(en.s4.afterAddress);
    const after = renderToStaticMarkup(createElement(CheckoutSummary, { cart, quote: { currency: 'USD', subtotal: '20', total: '24', tax: '1', shippingOptions: [{ id: 'ship', label: 'Shipping', amount: '3' }], paymentMethods: [] }, shippingOptionId: 'ship', locale: 'en', currency: 'USD' }));
    expect(after).toContain('$24.00'); expect(after).toContain('$3.00'); expect(after).toContain('$1.00');
  });
  it.each(['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])('renders a real %s order status', (status) => {
    expect(renderToStaticMarkup(createElement(OrderStatus, { status, paymentStatus: 'PENDING', locale: 'en' }))).toContain(status === 'PENDING' ? en.orders.paymentStatus.PENDING : en.orders.status[status as keyof typeof en.orders.status]);
  });
});
