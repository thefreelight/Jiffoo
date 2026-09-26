import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

// Node WebCrypto lacks the Workers-only crypto.subtle.timingSafeEqual used by
// the Stripe signature verifier; only the final digest comparison is polyfilled.
type SubtleWithTimingSafeEqual = typeof crypto.subtle & { timingSafeEqual?: (left: ArrayBuffer, right: ArrayBuffer) => boolean };
const subtle = crypto.subtle as SubtleWithTimingSafeEqual;
subtle.timingSafeEqual ??= (left: ArrayBuffer, right: ArrayBuffer): boolean => {
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index]! ^ rightBytes[index]!;
  return difference === 0;
};

const { authenticateNativeUser, getNativeStripeSecret } = vi.hoisted(() => ({
  authenticateNativeUser: vi.fn(),
  getNativeStripeSecret: vi.fn(),
}));
vi.mock('./auth', () => ({ authenticateNativeUser, getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret, getNativePluginSecret: vi.fn(), getNativePluginConfig: vi.fn() }));

import { tryNativeCheckout } from './checkout';

const orderPayload = JSON.stringify({
  id: 'ord-test-1',
  userId: 'user-1',
  currency: 'USD',
  totalAmount: 39,
  items: [{ productName: 'Bokmoo Card V1', unitPrice: 39, quantity: 1 }],
});

function intentsDb(paymentStatus = 'PENDING') {
  const ran: string[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (..._values: unknown[]) => ({
        first: async () => (sql.includes('native_order_snapshots snapshots')
          ? { payload: orderPayload, total_amount: 39, currency: 'USD', payment_status: paymentStatus }
          : null),
        run: async () => {
          ran.push(sql);
          return { success: true };
        },
      }),
      first: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async (statements: unknown[]) => statements,
  };
  return { db, ran };
}

async function stripeSignatureHeader(raw: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${raw}`));
  const hex = [...new Uint8Array(signature)].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('native PaymentSheet payment intents', () => {
  it('creates a Stripe PaymentIntent from the order total and returns the client secret', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    getNativeStripeSecret.mockResolvedValue({ mode: 'test', value: 'sk_test_example' });
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return Response.json({ id: 'pi_test_1', client_secret: 'cs_test_secret' });
    }) as unknown as typeof fetch;
    try {
      const { db, ran } = intentsDb();
      const response = await tryNativeCheckout(
        new Request('https://api.example/api/v1/payments/intents', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: 'ord-test-1' }),
        }),
        { DB: db, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
        () => Promise.resolve(null),
      );
      expect(response?.status).toBe(201);
      const payload = await (response as Response).json();
      expect(payload.data.intentId).toBe('pi_test_1');
      expect(payload.data.clientSecret).toBe('cs_test_secret');
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('https://api.stripe.com/v1/payment_intents');
      const form = new URLSearchParams(String(calls[0].init.body));
      expect(form.get('amount')).toBe('3900');
      expect(form.get('currency')).toBe('usd');
      expect(form.get('automatic_payment_methods[enabled]')).toBe('true');
      expect(form.get('metadata[orderId]')).toBe('ord-test-1');
      expect(calls[0].init.headers && new Headers(calls[0].init.headers as HeadersInit).get('idempotency-key'))
        .toBe('order:ord-test-1:stripe-intent');
      expect(ran.some((sql) => sql.includes('INSERT INTO native_payment_sessions'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('rejects an already paid order without calling Stripe', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    getNativeStripeSecret.mockResolvedValue({ mode: 'test', value: 'sk_test_example' });
    const originalFetch = global.fetch;
    global.fetch = vi.fn() as unknown as typeof fetch;
    try {
      const { db } = intentsDb('PAID');
      const response = await tryNativeCheckout(
        new Request('https://api.example/api/v1/payments/intents', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: 'ord-test-1' }),
        }),
        { DB: db, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
        () => Promise.resolve(null),
      );
      expect(response?.status).toBe(409);
      const payload = await (response as Response).json();
      expect(payload.error.code).toBe('ORDER_ALREADY_PAID');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('settles the order from a payment_intent.succeeded webhook', async () => {
    getNativeStripeSecret.mockResolvedValue({ mode: 'test', value: 'whsec_example' });
    const batched: string[] = [];
    const raw = JSON.stringify({
      id: 'evt_test_1',
      type: 'payment_intent.succeeded',
      livemode: false,
      data: { object: { id: 'pi_test_1', status: 'succeeded', metadata: { orderId: 'ord-test-1' } } },
    });
    const db = {
      prepare: (sql: string) => ({
        bind: (..._values: unknown[]) => ({
          sqlTag: sql,
          first: async () => {
            if (sql.includes('FROM native_payment_sessions')) return { id: 'pi_test_1' };
            if (sql.includes('FROM native_payment_events')) return null;
            if (sql.includes('FROM native_order_snapshots')) return { payload: orderPayload };
            return null;
          },
          run: async () => ({ success: true }),
        }),
        first: async () => null,
        run: async () => ({ success: true }),
      }),
      batch: async (statements: Array<{ sqlTag?: string }>) => {
        batched.push(...statements.map((statement) => statement.sqlTag ?? ''));
        return statements;
      },
    } as never;
    const header = await stripeSignatureHeader(raw, 'whsec_example');
    const response = await tryNativeCheckout(
      new Request('https://api.example/api/v1/payments/webhook/stripe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': header },
        body: raw,
      }),
      { DB: db, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
      () => Promise.resolve(null),
    );
    expect(response?.status).toBe(200);
    const payload = await (response as Response).json();
    expect(payload.data.applied).toBe(true);
    expect(batched.some((sql) => sql.includes("SET payment_status = 'PAID'"))).toBe(true);
    expect(batched.some((sql) => sql.includes('payment.succeeded'))).toBe(true);
  });
});
