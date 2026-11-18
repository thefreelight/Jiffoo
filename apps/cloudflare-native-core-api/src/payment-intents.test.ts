import { createHash } from 'node:crypto';
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

// Node WebCrypto lacks the Workers-only MD5 digest used by the easy-pay
// gateway signer; route MD5 through node:crypto in tests.
type SubtleWithMd5 = typeof crypto.subtle & { digest: typeof crypto.subtle.digest };
const subtleMd5 = crypto.subtle as SubtleWithMd5;
const nativeDigest = subtleMd5.digest.bind(subtleMd5);
subtleMd5.digest = (async (algorithm: AlgorithmIdentifier | string, data: ArrayBuffer) => {
  const name = typeof algorithm === 'string' ? algorithm : (algorithm as { name: string }).name;
  if (name.toUpperCase() === 'MD5') {
    const buf = createHash('md5').update(new Uint8Array(data)).digest();
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  return nativeDigest(algorithm as AlgorithmIdentifier, data);
}) as typeof crypto.subtle.digest;

const { authenticateNativeUser, getNativeStripeSecret, getNativePluginConfig } = vi.hoisted(() => ({
  authenticateNativeUser: vi.fn(),
  getNativeStripeSecret: vi.fn(),
  getNativePluginConfig: vi.fn(),
}));
vi.mock('./auth', () => ({ authenticateNativeUser, getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativeStripeSecret, getNativePluginConfig, getNativePluginSecret: vi.fn() }));

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
        first: async () => (sql.includes('FROM native_order_snapshots')
          ? { payload: orderPayload, total_amount: 39, currency: 'USD', payment_status: paymentStatus, user_id: 'user-1' }
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
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: { mode: 'test', testPublishableKey: 'pk_test_example' } });
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
      expect(payload.data.publishableKey).toBe('pk_test_example');
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

  it('creates a native intent for mainland-China shoppers too (gate removed 2026-11-13)', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    getNativeStripeSecret.mockResolvedValue({ mode: 'test', value: 'sk_test_example' });
    const originalFetch = global.fetch;
    let stripeCalls = 0;
    global.fetch = vi.fn(async () => {
      stripeCalls += 1;
      return new Response(JSON.stringify({ id: 'pi_test_cn', client_secret: 'pi_test_cn_secret' }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const { db, ran } = intentsDb();
      for (const headers of [
        { 'content-type': 'application/json', 'accept-language': 'zh-CN,zh;q=0.9' },
        { 'content-type': 'application/json', 'cf-ipcountry': 'CN' },
      ]) {
        stripeCalls = 0;
        const response = await tryNativeCheckout(
          new Request('https://api.example/api/v1/payments/intents', {
            method: 'POST',
            headers,
            cf: headers['cf-ipcountry'] ? { country: 'CN' } : undefined,
            body: JSON.stringify({ orderId: 'ord-test-1' }),
          } as never),
          { DB: db, NATIVE_CHECKOUT_ENABLED: 'true' } as never,
          () => Promise.resolve(null),
        );
        expect(response?.status).toBe(201);
        const payload = await (response as Response).json();
        expect(payload.data.clientSecret).toBe('pi_test_cn_secret');
        expect(stripeCalls).toBe(1);
      }
      expect(ran.some((sql) => sql.includes('INSERT INTO native_payment_sessions'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('requests a gateway payment URL from mapi.php for easy-pay sessions', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const originalFetch = global.fetch;
    let mapiBody = '';
    global.fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      mapiBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ code: 1, payurl: 'https://yzf.example/pay/submit/123/' }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const { db, ran } = intentsDb();
      const response = await tryNativeCheckout(
        new Request('https://api.example/api/v1/payments/epay/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.8' },
          body: JSON.stringify({ orderId: 'ord-test-1', payType: 'alipay' }),
        }),
        { DB: db, NATIVE_CHECKOUT_ENABLED: 'true', EPAY_GATEWAY: 'https://yzf.example', EPAY_PID: '1002', EPAY_KEY: 'k-test' } as never,
        () => Promise.resolve(null),
      );
      expect(response?.status).toBe(200);
      const payload = await (response as Response).json();
      expect(payload.data.route).toBe('epay');
      expect(payload.data.payUrl).toBe('https://yzf.example/pay/submit/123/');
      expect(payload.data.amount).toBe('280.80');
      expect(payload.data.currency).toBe('CNY');
      // mapi.php requires the shopper IP; submit.php does not exist here.
      expect(mapiBody).toContain('clientip=8.8.8.8');
      expect(mapiBody).toContain('pid=1002');
      // Easy-pay charges CNY: $39 converts at the default 7.2 rate.
      expect(mapiBody).toContain('money=280.80');
      expect(ran.some((sql) => sql.includes('INSERT INTO native_payment_sessions'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('surfaces a gateway rejection as a 502 for easy-pay sessions', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ code: -1, msg: '签名校验失败' }), { status: 200 })) as unknown as typeof fetch;
    try {
      const { db } = intentsDb();
      const response = await tryNativeCheckout(
        new Request('https://api.example/api/v1/payments/epay/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: 'ord-test-1' }),
        }),
        { DB: db, NATIVE_CHECKOUT_ENABLED: 'true', EPAY_GATEWAY: 'https://yzf.example', EPAY_PID: '1002', EPAY_KEY: 'k-test' } as never,
        () => Promise.resolve(null),
      );
      expect(response?.status).toBe(502);
      const payload = await (response as Response).json();
      expect(payload.error.code).toBe('EPAY_GATEWAY_ERROR');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('refuses to settle an easy-pay notify whose amount does not match the CNY conversion', async () => {
    getNativeStripeSecret.mockResolvedValue({ mode: 'test', value: 'whsec_example' });
    const params: Record<string, string> = {
      pid: '1002',
      trade_no: 'GW-T-1',
      out_trade_no: 'ord-test-1',
      type: 'alipay',
      name: 'order',
      money: '0.01',
      trade_status: 'TRADE_SUCCESS',
    };
    const signInput = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + 'k-test';
    const { createHash } = await import('node:crypto');
    const signed = { ...params, sign: createHash('md5').update(signInput).digest('hex'), sign_type: 'MD5' };
    const query = new URLSearchParams(signed).toString();
    const { db } = intentsDb();
    const response = await tryNativeCheckout(
      new Request(`https://api.example/api/v1/payments/webhook/epay?${query}`),
      { DB: db, NATIVE_CHECKOUT_ENABLED: 'true', EPAY_GATEWAY: 'https://yzf.example', EPAY_PID: '1002', EPAY_KEY: 'k-test' } as never,
      () => Promise.resolve(null),
    );
    expect(response?.status).toBe(400);
    expect(await (response as Response).text()).toContain('amount mismatch');
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
            if (sql.includes('FROM native_order_snapshots')) return { payload: orderPayload, user_id: 'user-1' };
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
    expect(batched.some((sql) => sql.includes('INSERT INTO native_bokmoo_notifications'))).toBe(true);
  });
});
