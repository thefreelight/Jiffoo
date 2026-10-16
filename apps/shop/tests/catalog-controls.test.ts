import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { createSerializer } from 'nuqs/server';
import { CatalogControls } from '../components/catalog-controls';
import { catalogParsers, readCatalogQuery, type CatalogQuery } from '../lib/catalog-query';

const state = vi.hoisted(() => ({
  query: { sort: 'nameAsc', category: '', inStock: false, page: 3 } as import('../lib/catalog-query').CatalogQuery,
  url: '', pending: false, setQuery: vi.fn(), push: vi.fn(),
}));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [false, vi.fn()],
  useTransition: () => [state.pending, (action: () => void) => action()],
}));
vi.mock('nuqs', async (importOriginal) => ({
  ...await importOriginal<typeof import('nuqs')>(),
  useQueryStates: () => [state.query, state.setQuery],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));

const serialize = createSerializer(catalogParsers);
beforeEach(() => {
  vi.clearAllMocks(); state.pending = false;
  state.query = { sort: 'nameAsc', category: '', inStock: false, page: 3 };
  state.url = serialize('/en/products', state.query);
  state.setQuery.mockImplementation(async (patch: Partial<Record<keyof CatalogQuery, string | number | boolean | null>>) => {
    const defaults = { sort: 'newest', category: '', inStock: false, page: 1 };
    state.query = { ...state.query, ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value === null ? defaults[key as keyof typeof defaults] : value])) } as CatalogQuery;
    state.url = serialize('/en/products', state.query);
    return new URL(state.url, 'http://shop.local').searchParams;
  });
});

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  return isValidElement(node) ? text((node as Element).props.children as ReactNode) : '';
}
function controls(showFilters = true, currentCategory?: string) {
  return elements(CatalogControls({ locale: 'en', groups: [{ id: 'books', slug: 'books', name: 'Books', description: null, productCount: 4 }], total: 4, showFilters, currentCategory }));
}
function inputInLabel(nodes: Element[], label: string) {
  const element = nodes.find((node) => node.type === 'label' && text(node).includes(label));
  if (!element) throw new Error(`Missing label: ${label}`);
  return elements(element).find((node) => node.type === 'input')!;
}
function query() { return readCatalogQuery(Object.fromEntries(new URL(state.url, 'http://shop.local').searchParams)); }

it('category radio selection is shareable in the URL and resets pagination', () => {
  const input = inputInLabel(controls(), 'Books');
  expect(input.props.type).toBe('radio');
  (input.props.onChange as () => void)();
  expect(query()).toEqual({ category: 'books', inStock: false, sort: 'nameAsc', page: 1 });
});
it('stock selection is reflected in the URL without losing sort state', () => {
  const input = inputInLabel(controls(), 'In stock only');
  (input.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  expect(query()).toMatchObject({ inStock: true, sort: 'nameAsc', page: 1 });
});
it('clearing filters clears category and stock while keeping the chosen sort', () => {
  state.query = { ...state.query, category: 'books', inStock: true };
  const button = controls().find((node) => node.type === 'button' && text(node) === 'Clear filters')!;
  (button.props.onClick as () => void)();
  expect(query()).toEqual({ category: '', inStock: false, sort: 'nameAsc', page: 1 });
});
it('choosing all from a category clears its single selection on the canonical list URL', () => {
  state.query.inStock = true;
  const input = inputInLabel(controls(true, 'books'), 'All products');
  (input.props.onChange as () => void)();
  const url = new URL(state.push.mock.calls[0][0], 'http://shop.local');
  expect(url.pathname).toBe('/en/products'); expect(url.searchParams.has('category')).toBe(false);
  expect(readCatalogQuery(Object.fromEntries(url.searchParams))).toEqual({ category: '', inStock: true, sort: 'nameAsc', page: 1 });
});
it('sort changes update the URL and reset pagination', () => {
  const select = controls(false).find((node) => node.type === 'select')!;
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'oldest' } });
  expect(query()).toMatchObject({ sort: 'oldest', page: 1 });
});
it('hides disabled theme filters and prevents concurrent changes while loading', () => {
  expect(controls(false).some((node) => node.type === 'input')).toBe(false);
  state.pending = true;
  const nodes = controls();
  expect(nodes.filter((node) => node.type === 'select' || node.type === 'fieldset').every((node) => node.props.disabled)).toBe(true);
});
