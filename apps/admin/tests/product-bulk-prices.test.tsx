// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { common } from '../../../packages/shared/src/i18n/messages/en/common';

const state = vi.hoisted(() => ({ calls: [] as any[], result: null as any, error: null as any }));

vi.mock('shared/src/i18n/react', () => {
  // The real useT is a stable useCallback: the identity must survive renders.
  const translate = (key: string, params?: Record<string, string | number>) => {
    const value = key.split('.').reduce<any>((object, part) => object?.[part], { merchant, common });
    return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
  };
  return { useT: () => translate };
});
vi.mock('../components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => open ? children : null,
  DialogContent: ({ children }: any) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: any) => children,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => children,
}));
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, productsApi: { ...actual.productsApi, bulkPrices: vi.fn(async (body: any) => { state.calls.push(body); if (state.error) throw state.error; return state.result; }) } };
});

import { BulkPriceEditDialog } from '../components/products/BulkPriceEditDialog';
import { AdminApiError } from '../lib/api';

let root: Root | undefined;
async function mount(element: React.ReactNode) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}
function field(name: string): HTMLInputElement {
  const node = document.querySelector<HTMLInputElement>('[aria-label="' + name + '"]');
  if (!node) throw new Error('Missing field: ' + name);
  return node;
}
function button(name: string): HTMLButtonElement {
  const node = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(candidate => candidate.textContent?.trim() === name);
  if (!node) throw new Error('Missing button: ' + name);
  return node;
}
async function setValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function alerts(): string[] {
  return Array.from(document.querySelectorAll('[role="alert"]')).map(node => node.textContent ?? '');
}

beforeEach(() => {
  state.calls = [];
  state.error = null;
  state.result = {
    matched: 2, processed: 2, skippedCount: 0, skipped: [],
    variantsProcessed: 1, variantsSkippedCount: 1,
    variantsSkipped: [{ variantId: 'v3', productId: 'p2', productName: 'Canvas bag', reason: 'COMPARE_AT_BELOW_SALE' }],
    changes: [{ variantId: 'v1', productId: 'p1', productName: 'Linen shirt', previousSalePrice: 10, salePrice: 19.9, previousCompareAtPrice: null, compareAtPrice: null }],
  };
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('previews with dryRun and then applies the chosen sale price to the current selection', async () => {
  const applied = vi.fn();
  const container = await mount(<BulkPriceEditDialog selection={{ mode: 'ids', ids: ['p1', 'p2'] }} onClose={vi.fn()} onApplied={applied} />);
  await act(async () => field('Change sale price').click());
  await setValue(field('Sale price value'), '19.90');
  await act(async () => button('Preview changes').click());
  expect(state.calls[0]).toEqual({ selection: { mode: 'ids', ids: ['p1', 'p2'] }, salePrice: { mode: 'amount', value: '19.90' }, dryRun: true });
  expect(container.textContent).toContain('Linen shirt');
  expect(container.textContent).toContain('10.00');
  expect(container.textContent).toContain('19.90');
  expect(container.textContent).toContain('The compare-at price would be below the sale price.');
  await act(async () => button('Apply prices').click());
  expect(state.calls[1]).toEqual({ selection: { mode: 'ids', ids: ['p1', 'p2'] }, salePrice: { mode: 'amount', value: '19.90' } });
  expect(applied).toHaveBeenCalledOnce();
  expect(applied.mock.calls[0][0]).toMatchObject({ processed: 2, variantsProcessed: 1 });
});

it('sends the filter selection with its excluded ids and a percentage change', async () => {
  await mount(<BulkPriceEditDialog selection={{ mode: 'filter', filter: { search: 'boots' }, excludeIds: ['p9'] }} onClose={vi.fn()} onApplied={vi.fn()} />);
  await act(async () => field('Change sale price').click());
  await act(async () => field('Sale price: change by percentage').click());
  await setValue(field('Sale price value'), '-10');
  await act(async () => button('Preview changes').click());
  expect(state.calls[0]).toEqual({ selection: { mode: 'filter', filter: { search: 'boots' }, excludeIds: ['p9'] }, salePrice: { mode: 'percentage', value: '-10' }, dryRun: true });
});

it('rejects an invalid value inline and never reaches the API', async () => {
  await mount(<BulkPriceEditDialog selection={{ mode: 'ids', ids: ['p1'] }} onClose={vi.fn()} onApplied={vi.fn()} />);
  await act(async () => field('Change sale price').click());
  await setValue(field('Sale price value'), 'twenty');
  await act(async () => button('Preview changes').click());
  expect(state.calls).toEqual([]);
  expect(alerts()).toContain('Enter a decimal value.');
});

it('rejects a percentage of -100 or less inline', async () => {
  await mount(<BulkPriceEditDialog selection={{ mode: 'ids', ids: ['p1'] }} onClose={vi.fn()} onApplied={vi.fn()} />);
  await act(async () => field('Change sale price').click());
  await act(async () => field('Sale price: change by percentage').click());
  await setValue(field('Sale price value'), '-100');
  await act(async () => button('Preview changes').click());
  expect(state.calls).toEqual([]);
  expect(alerts()).toContain('Enter a percentage greater than -100.');
});

it('asks for a price when nothing is selected', async () => {
  await mount(<BulkPriceEditDialog selection={{ mode: 'ids', ids: ['p1'] }} onClose={vi.fn()} onApplied={vi.fn()} />);
  await act(async () => button('Preview changes').click());
  expect(state.calls).toEqual([]);
  expect(alerts()).toContain('Choose at least one price to change.');
});

it('clears the compare-at price instead of editing it', async () => {
  await mount(<BulkPriceEditDialog selection={{ mode: 'ids', ids: ['p1'] }} onClose={vi.fn()} onApplied={vi.fn()} />);
  await act(async () => field('Clear compare-at price').click());
  expect(field('Change compare-at price').checked).toBe(false);
  await act(async () => button('Preview changes').click());
  expect(state.calls[0]).toEqual({ selection: { mode: 'ids', ids: ['p1'] }, clearCompareAtPrice: true, dryRun: true });
});

it('reports a failed request instead of swallowing it', async () => {
  state.error = new AdminApiError('Too many products', 'VALIDATION_ERROR', undefined, 400);
  await mount(<BulkPriceEditDialog selection={{ mode: 'ids', ids: ['p1'] }} onClose={vi.fn()} onApplied={vi.fn()} />);
  await act(async () => field('Change sale price').click());
  await setValue(field('Sale price value'), '10');
  await act(async () => button('Preview changes').click());
  expect(alerts().join(' ')).toContain('Validation Error');
});
