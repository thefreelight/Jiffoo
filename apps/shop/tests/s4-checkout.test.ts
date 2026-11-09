import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { CheckoutView } from '../components/checkout-view';
import type { Quote } from '../lib/checkout-types';
import { CheckoutSummary } from '../components/checkout-summary';

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, fetch: vi.fn(), assign: vi.fn(), focus: vi.fn(), setError: vi.fn() }));
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(),
  useEffect: () => undefined,
  useRef: () => ({ current: '' }),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (next: unknown) => { state.values[index] = next; }];
  },
}));
vi.mock('react-hook-form', () => ({ useWatch: () => 'US', useForm: (options: { defaultValues: Record<string, unknown> }) => ({
  control: {}, formState: { errors: {} }, getValues: () => 'firstName' in options.defaultValues ? ({ firstName: 'Buyer', lastName: 'Test', phone: '123', addressLine1: 'Street', addressLine2: '', city: 'City', country: 'US', state: 'CA', postalCode: '94105' }) : ({ country: 'US', state: '', city: '', postalCode: '', addressLine1: '', addressLine2: '' }),
  register: () => ({}), trigger: async () => true, handleSubmit: (callback: unknown) => callback, setError: state.setError, setFocus: state.focus,
}) }));
vi.mock('../lib/client-availability', () => ({ availabilityFetch: state.fetch, useShopAvailability: () => ({ blocked: false, message: '', clear: vi.fn(), capture: () => false }) }));

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join('');
  if (!isValidElement(node)) return String(node ?? '');
  return text((node as Element).props.children as ReactNode);
}
const quote: Quote = { currency: 'USD', subtotal: '10.00', total: '10.00', shippingOptions: [{ id: 'ship', label: 'Real shipping', amount: '0' }], paymentMethods: [{ providerSlug: 'manual', displayName: 'Provider supplied name' }] };
function render(requiresShipping = true) {
  state.cursor = 0;
  return elements(CheckoutView({ cart: { items: [{ requiresShipping, id: 'line', productId: 'product', variantId: 'variant', productName: 'Product', productImage: '', price: 10, quantity: 1, maxQuantity: 2, subtotal: 10 }], itemCount: 1, subtotal: 10 },
    locale: 'en', countries: [{ code: 'US', name: 'United States' }], requiredCountries: ['US'], email: 'buyer@example.com', currency: 'USD', address: null }));
}
function pay(nodes: Element[]) { return nodes.find((node) => node.type === 'button' && /^Pay(?: |$)|^Confirm new/.test(text(node.props.children as ReactNode)))!; }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  vi.clearAllMocks(); state.fetch.mockReset(); state.values = [quote, 'ship', 'manual', '', false, false, null];
  vi.stubGlobal('window', { location: { origin: 'http://localhost:3003', assign: state.assign } });
  vi.stubGlobal('crypto', { randomUUID: () => 'request-key' });
});
afterEach(() => vi.unstubAllGlobals());

it('requires an explicit new-amount confirmation and submits the new expectedTotal', async () => {
  state.fetch.mockResolvedValueOnce(json({ error: { code: 'QUOTE_CHANGED' } }, 409))
    .mockResolvedValueOnce(json({ data: { ...quote, subtotal: '15.00', total: '15.00' } }))
    .mockResolvedValueOnce(json({ data: { items: [{ id: 'line', productId: 'product', variantId: 'variant', productName: 'Product', productImage: '', price: 15, quantity: 1, maxQuantity: 2, subtotal: 15 }], itemCount: 1, subtotal: 15 } }));
  await (pay(render()).props.onClick as () => Promise<void>)();
  const changed = render();
  expect((changed.find((node) => node.type === CheckoutSummary)?.props.cart as { items: Array<{ price: number }> }).items[0].price).toBe(15);
  expect(text(pay(changed).props.children as ReactNode)).toBe('Confirm new total and pay $15.00');
  expect(changed.some((node) => node.props.role === 'alert' && text(node.props.children as ReactNode).includes('The total is now $15.00'))).toBe(true);
  state.fetch.mockResolvedValueOnce(json({ data: { id: 'order' } }, 201)).mockResolvedValueOnce(json({ data: { action: { type: 'instructions' } } }));
  await (pay(changed).props.onClick as () => Promise<void>)();
  const create = state.fetch.mock.calls.filter(([url]) => url === '/bff/orders');
  expect(JSON.parse(create[0][1].body).expectedTotal).toBe('10.00');
  expect(JSON.parse(create[1][1].body).expectedTotal).toBe('15.00');
  expect(state.assign).toHaveBeenCalledWith('/en/checkout/complete?order=order');
});
it('clears an unavailable payment method, shows the alert and prevents payment until reselection', async () => {
  state.fetch.mockResolvedValueOnce(json({ error: { code: 'PAYMENT_METHOD_UNAVAILABLE' } }, 409)).mockResolvedValueOnce(json({ data: { ...quote, paymentMethods: [] } }));
  await (pay(render()).props.onClick as () => Promise<void>)();
  const failed = render();
  expect(pay(failed).props.disabled).toBe(true);
  expect(failed.some((node) => node.props.role === 'alert' && text(node.props.children as ReactNode).includes('This payment method is temporarily unavailable'))).toBe(true);
  expect(state.fetch.mock.calls.filter(([url]) => url === '/bff/orders')).toHaveLength(1);
});
it('keeps the phone summary collapsed and uses plugin display names', () => {
  const nodes = render();
  expect(nodes.find((node) => node.type === 'details')?.props.open).toBeUndefined();
  expect(nodes.some((node) => text(node.props.children as ReactNode).includes('Provider supplied name'))).toBe(true);
});
it('maps a server field rejection to the field and focuses it', async () => {
  state.fetch.mockResolvedValueOnce(json({ error: { code: 'VALIDATION_ERROR', details: { issues: [{ path: 'shippingAddress.postalCode' }] } } }, 400));
  await (pay(render()).props.onClick as () => Promise<void>)();
  expect(state.setError).toHaveBeenCalledWith('postalCode', { type: 'server', message: 'Please check this field.' });
  expect(state.focus).toHaveBeenCalledWith('postalCode');
});
it('pays a quote that offers no shipping option with the total of the quote', async () => {
  // A quote of a cart that needs no shipment carries the tax and the total
  // it can rely on, and no shipping option at all.
  const digital: Quote = { currency: 'USD', subtotal: '10.00', tax: '1.00', taxInclusive: false, total: '11.00', shippingOptions: [], paymentMethods: [{ providerSlug: 'manual', displayName: 'Provider supplied name' }] };
  state.values = [digital, '', 'manual', '', false, false, null];
  state.fetch.mockResolvedValueOnce(json({ data: { id: 'order' } }, 201)).mockResolvedValueOnce(json({ data: { action: { type: 'instructions' } } }));
  await (pay(render()).props.onClick as () => Promise<void>)();
  const create = state.fetch.mock.calls.filter(([url]) => url === '/bff/orders');
  expect(create).toHaveLength(1);
  const body = JSON.parse(create[0][1].body);
  // The expected total of the order is the total of the quote, so the order
  // computes the same amount.
  expect(body.expectedTotal).toBe('11.00');
  expect(body.shippingOptionId).toBe('none:none');
  expect(state.assign).toHaveBeenCalledWith('/en/checkout/complete?order=order');
});

it('omits shipping addresses from digital quotes and reveals tax address fields on a server requirement', async () => {
  state.values = [null, '', '', '', false, false, null];
  const nodes = render(false);
  expect(nodes.some(node => node.type === 'input' && node.props.id === 'address-country')).toBe(false);
  state.fetch.mockResolvedValueOnce(json({ error: { code: 'VALIDATION_ERROR', details: { issues: [{ path: 'taxAddress.country', code: 'TAX_ADDRESS_REQUIRED' }] } } }, 400));
  const form = nodes.find(node => node.type === 'form')!;
  (form.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(state.fetch).toHaveBeenCalled());
  await vi.waitFor(() => expect(render(false).some(node => node.props.role === 'status' && text(node.props.children as ReactNode).includes('applicable tax'))).toBe(true));
  expect(JSON.parse(state.fetch.mock.calls[0][1].body)).not.toHaveProperty('shippingAddress');
  const retry = render(false);
  expect(retry.some(node => node.type === 'select')).toBe(true);
  expect(retry.some(node => node.props.id === 'address-firstName')).toBe(false);
  expect(retry.some(node => node.props.role === 'status' && text(node.props.children as ReactNode).includes('applicable tax'))).toBe(true);
  state.fetch.mockResolvedValueOnce(json({ data: { ...quote, shippingOptions: [] } }));
  await (retry.find(node => node.type === 'form')!.props.onSubmit as () => Promise<void>)();
  expect(JSON.parse(state.fetch.mock.calls[1][1].body)).toEqual({ taxAddress: { country: 'US' } });
});

it('invalidates an existing total and payment choice when requoting fails on the network', async () => {
  state.fetch.mockRejectedValueOnce(new Error('Offline'));
  const nodes = render();
  const form = nodes.find(node => node.type === 'form')!;
  await (form.props.onSubmit as () => Promise<void>)();
  expect(pay(render()).props.disabled).toBe(true);
  expect(state.values[0]).toBeNull();
  expect(state.values[2]).toBe('');
});

it('keeps genuine checkout failures visible even after the tax location form has been revealed', async () => {
  state.values = [null, '', '', '', false, false, null];
  state.fetch.mockResolvedValueOnce(json({ error: { code: 'VALIDATION_ERROR', details: { issues: [{ path: 'taxAddress.country', code: 'TAX_ADDRESS_REQUIRED' }] } } }, 400));
  const submit = render(false).find(node => node.type === 'form')!;
  (submit.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(render(false).some(node => node.props.role === 'status' && text(node.props.children as ReactNode).includes('applicable tax'))).toBe(true));
  expect(render(false).some(node => node.props.role === 'alert')).toBe(false);
  state.fetch.mockResolvedValueOnce(json({ error: { code: 'CONTRACT_CALL_FAILED' } }, 503));
  await (render(false).find(node => node.type === 'form')!.props.onSubmit as () => Promise<void>)();
  expect(render(false).some(node => node.props.role === 'alert')).toBe(true);
});

it('clears a payment provider removed by a changed-total quote before allowing confirmation', async () => {
  state.fetch.mockResolvedValueOnce(json({ error: { code: 'QUOTE_CHANGED' } }, 409))
    .mockResolvedValueOnce(json({ data: { ...quote, total: '15.00', paymentMethods: [{ providerSlug: 'replacement', displayName: 'Replacement provider' }] } }))
    .mockResolvedValueOnce(json({ data: { items: [], itemCount: 0, subtotal: 15 } }));
  await (pay(render()).props.onClick as () => Promise<void>)();
  const nodes = render();
  expect(pay(nodes).props.disabled).toBe(true);
  expect(nodes.some(node => node.type === 'input' && node.props.name === 'payment' && node.props.checked)).toBe(false);
  expect(state.fetch.mock.calls.filter(([url]) => url === '/bff/orders')).toHaveLength(1);
});
