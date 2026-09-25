import type { FastifyInstance } from 'fastify';

export async function checkoutTotal(
  app: FastifyInstance,
  token: string,
  items: Array<{ productId: string; variantId: string; quantity: number }>,
  shippingAddress: Record<string, unknown>,
  shippingOptionId: string,
): Promise<string> {
  const headers = { authorization: `Bearer ${token}` };
  const cleared = await app.inject({ method: 'DELETE', url: '/api/v1/cart/', headers });
  if (cleared.statusCode !== 200) throw new Error(`Cart clear failed: ${cleared.body}`);
  for (const item of items) {
    const added = await app.inject({ method: 'POST', url: '/api/v1/cart/items', headers, payload: item });
    if (added.statusCode !== 200) throw new Error(`Cart add failed: ${added.body}`);
  }
  const quote = await app.inject({
    method: 'POST',
    url: '/api/v1/checkout/quote',
    headers,
    payload: { shippingAddress, shippingOptionId },
  });
  if (quote.statusCode !== 200) throw new Error(`Checkout quote failed: ${quote.body}`);
  const total = quote.json().data.total;
  if (typeof total !== 'string') throw new Error('Checkout quote did not return a total');
  return total;
}
