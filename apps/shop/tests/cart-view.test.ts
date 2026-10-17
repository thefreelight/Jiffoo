import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CartView } from '../components/cart-view';
import { QuantityStepper } from '../components/quantity-stepper';
import type { Cart } from '../lib/checkout-types';

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, blocked: false, fetch: vi.fn() }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (next: unknown) => {
      state.values[index] = typeof next === 'function' ? next(state.values[index]) : next;
    }];
  },
}));
vi.mock('../lib/cart-ui', () => ({ useCartUI: () => vi.fn() }));
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
function render(cart = initial) {
  state.cursor = 0;
  return elements(CartView({ initial: cart, locale: 'en', currency: 'USD', productLinks: { 'product-1': '/en/products/product' } }));
}
function checkout(nodes: Element[]) { return nodes.find((node) => node.props.href === '/en/checkout'); }

beforeEach(() => {
  state.values = []; state.cursor = 0; state.blocked = false; vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

it.each([true, false])('prevents checkout while a quantity write is unresolved and handles success=%s', async (success) => {
  const updatedEvent = vi.fn();
  window.addEventListener('cart-updated', updatedEvent);
  let finish!: (response: Response) => void;
  state.fetch.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
  const first = render();
  expect(checkout(first)).toBeDefined();
  const input = first.find((node) => node.type === QuantityStepper)!;
  (input.props.onChange as (quantity: number) => void)(2);
  const pending = render();
  expect(pending.find((node) => node.type === QuantityStepper)?.props.value).toBe(2);
  expect(checkout(pending)).toBeUndefined();
  expect(pending.find((node) => node.type === 'button' && node.props.children === 'Checkout')?.props.disabled).toBe(true);
  expect(state.fetch).toHaveBeenCalledWith('/bff/cart/items/line-1', expect.objectContaining({ method: 'PUT', body: '{"quantity":2}' }));
  const updated = { ...initial, items: [{ ...initial.items[0], quantity: 2, subtotal: 39.98 }], itemCount: 2, subtotal: 39.98 };
  state.fetch.mockResolvedValue(new Response(JSON.stringify({ data: initial })));
  finish(new Response(JSON.stringify(success ? { data: updated } : { error: { code: 'INSUFFICIENT_STOCK', details: { availableQuantity: 1 } } }), { status: success ? 200 : 409 }));
  await vi.waitFor(() => {
    const settled = render();
    if (success) expect(checkout(settled)).toBeDefined();
    else expect(checkout(settled)).toBeUndefined();
    expect(settled.find((node) => node.type === QuantityStepper)?.props.value).toBe(success ? 2 : 1);
    expect(settled.find((node) => node.type === 'strong')?.props.children).toBe(success ? '$39.98' : '$19.99');
    expect(updatedEvent).toHaveBeenCalledTimes(success ? 1 : 0);
  });
});

it('blocks checkout while the availability boundary is blocking cart actions', () => {
  state.blocked = true;
  expect(checkout(render())).toBeUndefined();
});

it('renders the empty board state with a browse link and no checkout', () => {
  const nodes = render({ items: [], itemCount: 0, subtotal: 0 });
  expect(nodes.find((node) => node.type === 'h1')?.props.children).toBe('Your cart is empty');
  expect(nodes.some((node) => node.props.href === '/en/products')).toBe(true);
  expect(checkout(nodes)).toBeUndefined();
});

it('blocks checkout and exposes available stock for stale cart quantities', () => {
  const nodes = render({ ...initial, items: [{ ...initial.items[0], quantity: 5, maxQuantity: 3 }] });
  expect(checkout(nodes)).toBeUndefined();
  expect(nodes.find((node) => node.props.role === 'alert')?.props.children).toContain('only 3 left');
});
