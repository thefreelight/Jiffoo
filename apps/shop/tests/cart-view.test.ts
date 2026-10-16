import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CartView } from '../components/cart-view';
import type { Cart } from '../lib/checkout-types';

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, blocked: false, fetch: vi.fn() }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (next: unknown) => {
      state.values[index] = typeof next === 'function' ? next(state.values[index]) : next;
    }];
  },
}));
vi.mock('../lib/client-availability', () => ({
  availabilityFetch: state.fetch,
  useShopAvailability: () => ({ blocked: state.blocked, message: '', clear: vi.fn(), capture: () => false }),
}));

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
const initial: Cart = { items: [{ id: 'line-1', productId: 'product-1', variantId: 'variant-1',
  productName: 'Product', productImage: '', price: 19.99, quantity: 1, maxQuantity: 20, subtotal: 19.99 }], itemCount: 1, subtotal: 19.99 };
function render() {
  state.cursor = 0;
  return elements(CartView({ initial, locale: 'en', currency: 'USD' }));
}
function checkout(nodes: Element[]) { return nodes.find((node) => node.props.href === '/en/checkout'); }

beforeEach(() => {
  state.values = []; state.cursor = 0; state.blocked = false; vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

it.each([true, false])('prevents checkout while a quantity write is unresolved and restores it after success=%s', async (success) => {
  let finish!: (response: Response) => void;
  state.fetch.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
  const first = render();
  expect(checkout(first)).toBeDefined();
  const input = first.find((node) => node.type === 'input')!;
  (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '2' } });
  const pending = render();
  expect(pending.find((node) => node.type === 'input')?.props.value).toBe(2);
  expect(checkout(pending)).toBeUndefined();
  expect(pending.find((node) => node.type === 'button' && node.props.children === 'Checkout')?.props.disabled).toBe(true);
  expect(state.fetch).toHaveBeenCalledWith('/bff/cart/items/line-1', expect.objectContaining({ method: 'PUT', body: '{"quantity":2}' }));
  const updated = { ...initial, items: [{ ...initial.items[0], quantity: 2, subtotal: 39.98 }], itemCount: 2, subtotal: 39.98 };
  finish(new Response(JSON.stringify(success ? { data: updated } : { error: { code: 'INSUFFICIENT_STOCK', details: { availableQuantity: 1 } } }), { status: success ? 200 : 409 }));
  await vi.waitFor(() => {
    const settled = render();
    expect(checkout(settled)).toBeDefined();
    expect(settled.find((node) => node.type === 'input')?.props.value).toBe(success ? 2 : 1);
    expect(settled.find((node) => node.type === 'strong')?.props.children).toBe(success ? '$39.98' : '$19.99');
  });
});

it('blocks checkout while the availability boundary is blocking cart actions', () => {
  state.blocked = true;
  expect(checkout(render())).toBeUndefined();
});
