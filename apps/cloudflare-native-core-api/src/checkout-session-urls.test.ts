import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { authenticateNativeUser, getNativeStripeSecret } = vi.hoisted(() => ({
  authenticateNativeUser: vi.fn(),
  getNativeStripeSecret: vi.fn(),
}));
vi.mock('./auth', () => ({ authenticateNativeUser, getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret, getNativePluginSecret: vi.fn(), getNativePluginConfig: vi.fn() }));

import { storefrontOrigin, tryNativeCheckout } from './checkout';

const orderPayload = JSON.stringify({
  id: 'ord-test-1',
  userId: 'user-1',
  currency: 'USD',
  totalAmount: 39,
  items: [{ productName: 'RemoteRadar Pro (Monthly)', unitPrice: 39, quantity: 1 }],
});

function sessionDb() {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => {
        if (sql.includes('native_order_snapshots snapshots')) {
          return { first: async () => ({ payload: orderPayload, total_amount: 39, currency: 'USD', payment_status: 'PENDING' }) };
        }
        if (sql.includes('FROM native_payment_sessions')) {
          return { first: async () => null };
        }
        return { first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true, meta: { changes: 1 } }) };
      },
      first: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async (statements: unknown[]) => statements,
  } as never;
}

describe('storefront payment result defaults', () => {
  it('resolves the browser Origin and keeps the shared default for headless callers', () => {
    expect(storefrontOrigin(new Request('https://api.example/api/v1/payments/sessions', {
      method: 'POST', headers: { origin: 'https://remoteradar.cc' },
    }))).toBe('https://remoteradar.cc');
    expect(storefrontOrigin(new Request('https://api.example/api/v1/payments/sessions', {
      method: 'POST', headers: { origin: 'javascript:void(0)' },
    }))).toBe('https://shop.jiffoo.com');
    expect(storefrontOrigin(new Request('https://api.example/api/v1/payments/sessions', { method: 'POST' })))
      .toBe('https://shop.jiffoo.com');
  });

  it('creates the Stripe session with success and cancel URLs on the storefront origin', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    getNativeStripeSecret.mockResolvedValue({ mode: 'test', value: 'sk_test_example' });
    const calls: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      calls.push(String(init?.body ?? ''));
      return Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', expires_at: Math.floor(Date.now() / 1000) + 3600 });
    }) as unknown as typeof fetch;
    try {
      const response = await tryNativeCheckout(
        new Request('https://api.example/api/v1/payments/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'https://remoteradar.cc' },
          body: JSON.stringify({ paymentMethod: 'stripe', orderId: 'ord-test-1', idempotencyKey: 'idem-1' }),
        }),
        { DB: sessionDb(), NATIVE_CHECKOUT_ENABLED: 'true' } as never,
        () => Promise.resolve(null),
      );
      expect(response?.status).toBe(201);
      expect(calls).toHaveLength(1);
      const form = new URLSearchParams(calls[0]);
      expect(form.get('success_url')).toBe('https://remoteradar.cc/payment/success?session_id={CHECKOUT_SESSION_ID}');
      expect(form.get('cancel_url')).toBe('https://remoteradar.cc/checkout');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('honors explicit success and cancel URLs', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    getNativeStripeSecret.mockResolvedValue({ mode: 'test', value: 'sk_test_example' });
    const calls: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      calls.push(String(init?.body ?? ''));
      return Response.json({ id: 'cs_test_2', url: 'https://checkout.stripe.com/c/pay/cs_test_2' });
    }) as unknown as typeof fetch;
    try {
      await tryNativeCheckout(
        new Request('https://api.example/api/v1/payments/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'https://remoteradar.cc' },
          body: JSON.stringify({
            paymentMethod: 'stripe', orderId: 'ord-test-1', idempotencyKey: 'idem-2',
            successUrl: 'https://remoteradar.cc/en/order-success?session_id={CHECKOUT_SESSION_ID}',
            cancelUrl: 'https://remoteradar.cc/en/checkout',
          }),
        }),
        { DB: sessionDb(), NATIVE_CHECKOUT_ENABLED: 'true' } as never,
        () => Promise.resolve(null),
      );
      const form = new URLSearchParams(calls[0]);
      expect(form.get('success_url')).toBe('https://remoteradar.cc/en/order-success?session_id={CHECKOUT_SESSION_ID}');
      expect(form.get('cancel_url')).toBe('https://remoteradar.cc/en/checkout');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
