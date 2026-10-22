import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
vi.mock('../lib/core-transport', () => ({ shopApi: vi.fn() }));
import { shopApi } from '../lib/core-transport';
import { POST } from '../app/bff/[...path]/route';
import { ACCESS_COOKIE, PURCHASE_ORIGIN_COOKIE, purchaseOriginId } from '../lib/auth-contract';

const origin = 'http://127.0.0.1:3003';
const source = 'a89b8122-6346-4da0-b302-aec0b60b4185';
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

async function order(cookieOrigin: string | undefined, key: string, checkoutOrigin?: string) {
  vi.stubEnv('STOREFRONT_URL', origin);
  vi.mocked(shopApi).mockResolvedValue(Response.json({ success: true, data: { id: 'order' } }));
  const request = new NextRequest(`${origin}/bff/orders`, { method: 'POST', headers: {
    Origin: origin, 'Content-Type': 'application/json',
    Cookie: `${ACCESS_COOKIE}=core-token; ${PURCHASE_ORIGIN_COOKIE}=${encodeURIComponent(JSON.stringify({ id: cookieOrigin }))}`,
  }, body: JSON.stringify({ idempotencyKey: key, ...(checkoutOrigin ? { pluginPurchaseOriginId: checkoutOrigin } : {}) }) });
  const response = await POST(request, { params: Promise.resolve({ path: ['orders'] }) });
  return { response, sent: JSON.parse(String(vi.mocked(shopApi).mock.calls.at(-1)![2]!.body)) };
}

it('retains the checkout snapshot on exact retries after clearing the consumed cookie', async () => {
  const first = await order(source, 'first-order', source);
  expect(first.response.status).toBe(200);
  expect(first.sent.pluginPurchaseOriginId).toBe(source);
  expect(first.response.cookies.get(PURCHASE_ORIGIN_COOKIE)?.value).toBe('');
  expect((await order(undefined, 'first-order', source)).sent.pluginPurchaseOriginId).toBe(source);
});

it('does not infer an ordinary order source from a different tab cookie', async () => {
  const next = await order(source, 'second-order');
  expect(next.response.status).toBe(200);
  expect(next.sent).not.toHaveProperty('pluginPurchaseOriginId');
});

it('does not replace an open checkout source or erase a newer tab intent', async () => {
  const newer = 'b89b8122-6346-4da0-b302-aec0b60b4185';
  const first = await order(newer, 'first-order', source);
  expect(first.sent.pluginPurchaseOriginId).toBe(source);
  expect(first.response.cookies.get(PURCHASE_ORIGIN_COOKIE)).toBeUndefined();
});

it('ignores malformed intent cookies when taking a checkout snapshot', () => {
  for (const value of [undefined, '', 'broken', 'null', '{}', '{"id":"//evil.example"}']) expect(purchaseOriginId(value)).toBeUndefined();
  expect(purchaseOriginId(JSON.stringify({ id: source }))).toBe(source);
});
