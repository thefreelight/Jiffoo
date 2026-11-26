import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductsPageProps } from 'shared/src/types/theme';
import React from 'react';
import { ProductsPage } from '@shop-themes/esim/src/components/ProductsPage';
import { getEsimProducts, type EsimApiProduct, type EsimEsimAttributes } from '@shop-themes/esim/src/lib/api';

// The eSIM mall's catalog always arrives whole: the host hands over every product at once, without page
// numbers. Before: the theme kept none of what it read and ignored the list it was given, so the pager
// never appeared (67 plans on one 46,000-pixel page), the filter chips and the sort did nothing, and a
// search for "japan" found nothing because only the Chinese source names were searched.

vi.mock('@shop-themes/esim/src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shop-themes/esim/src/lib/api')>();
  return { ...actual, getEsimProducts: vi.fn() };
});

type ApiProduct = Omit<EsimApiProduct, 'typeData'> & {
  productKind: string;
  isActive: boolean;
  typeData?: { esim: EsimEsimAttributes & { bossOdooId: number; defaultCode: string } };
};

// [region code, source name, destinations] — the shape of the real BOSS plans
const REGIONS: Array<[string, string, string[]]> = [
  ['JP', '日本流量包', ['JP']],
  ['US', '美国流量包', ['US']],
  ['EU', '欧洲流量包', ['FR', 'DE', 'IT']],
  ['GLOBAL', '全球精选流量包', ['JP', 'US', 'GB']],
  ['APAC', '亚太通用流量包', ['JP', 'KR', 'HK']],
  ['KR', '韩国流量包', ['KR']],
];
// [data allowance, validity, price]
const SIZES: Array<[number, number, number]> = [[1, 7, 2.5], [3, 15, 5.5], [5, 30, 8.9], [10, 30, 12.9], [20, 30, 72.9]];

const plan = (code: string, name: string, price: number, destinations: string[], gb: number, days: number, odooId: number): ApiProduct => ({
  id: `boss-${code}`,
  slug: `boss-${code.toLowerCase()}`,
  name,
  description: `${code} plan description`,
  price,
  currency: 'USD',
  productKind: 'digital',
  isActive: true,
  images: [],
  variants: [{ id: `boss-${code}-variant`, name, salePrice: price, isActive: true }],
  typeData: { esim: { bossOdooId: odooId, defaultCode: code, destinations, validityDays: days, data: { gb } } },
});

let nextOdooId = 12;
const PLANS: ApiProduct[] = REGIONS.flatMap(([code, name, destinations]) =>
  SIZES.map(([gb, days, price]) => plan(`${code}-${gb}GB-${days}D`, `${name} ${gb}GB/${days}天`, price, destinations, gb, days, (nextOdooId += 1)))
);

const card = (id: string, name: string, price: number): ApiProduct => ({
  id,
  slug: id,
  name,
  price,
  currency: 'USD',
  productKind: 'goods',
  isActive: true,
  images: [`/media/${id}?v=1`],
  variants: [{ id: `${id}-variant`, name, salePrice: price, isActive: true }],
});
// The instance catalog carries the two physical cards first; the mall never lists them.
const WHOLE_CATALOG: ApiProduct[] = [card('odoo-product-7', '[BOKMOO-BLE-V1] Bokmoo Bluetooth Card', 40), card('odoo-product-6', '[BOKMOO-CARD-V1] Bokmoo Card V1', 20), ...PLANS];

const readCatalog = vi.mocked(getEsimProducts);

const props = (over: Partial<ProductsPageProps> = {}): ProductsPageProps => ({
  products: WHOLE_CATALOG as unknown as ProductsPageProps['products'],
  isLoading: false,
  totalProducts: WHOLE_CATALOG.length,
  currentPage: 1,
  totalPages: 0,
  sortBy: 'createdAt',
  viewMode: 'grid',
  onSortChange: vi.fn(),
  onViewModeChange: vi.fn(),
  onPageChange: vi.fn(),
  onAddToCart: vi.fn(async () => undefined),
  onProductClick: vi.fn(),
  onSearch: vi.fn(),
  locale: 'en',
  ...over,
});

const articles = (container: HTMLElement) => [...container.querySelectorAll('[data-purpose="catalog-plan"]')];
const titles = (container: HTMLElement) => articles(container).map((article) => article.querySelector('h2')?.textContent?.trim() ?? '');
// Plan titles read "<Region> <data>GB / <validity> days"; the region is what tells plans apart here.
const regions = (container: HTMLElement) => [...new Set(titles(container).map((title) => title.replace(/ \d+GB \/ \d+ days$/, '')))].sort();
const pager = (container: HTMLElement) => container.querySelector('[data-purpose="catalog-pager"]');
const pagerText = (container: HTMLElement) => pager(container)?.querySelector('[data-purpose="catalog-page-label"]')?.textContent?.trim() ?? null;
const count = (container: HTMLElement) => container.querySelector('[data-purpose="catalog-count"]')?.textContent?.trim() ?? null;
const prices = (container: HTMLElement) =>
  articles(container).map((article) => Number((article.textContent?.match(/\$(\d+(?:\.\d+)?)/) ?? [])[1]));
const search = (container: HTMLElement, text: string) => {
  const input = container.querySelector('input[aria-label]') as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest('form')!);
};
const sort = (container: HTMLElement, value: string) => fireEvent.change(container.querySelector('select')!, { target: { value } });
const press = (container: HTMLElement, which: 'first' | 'last') => fireEvent.click(pager(container)!.querySelectorAll('button')[which === 'first' ? 0 : 1]);

beforeEach(() => {
  readCatalog.mockReset().mockResolvedValue({ items: WHOLE_CATALOG, page: 1, limit: 250, total: WHOLE_CATALOG.length });
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('the eSIM mall searches, filters, sorts and pages its whole catalog itself', () => {
  it('lists plans twelve to a page — no card — and says how many there are', () => {
    const { container } = render(<ProductsPage {...props()} />);

    expect(articles(container)).toHaveLength(12);
    expect(titles(container)[0]).toMatch(/^Japan 1GB \/ 7 days$/);
    expect(container.querySelector('[data-purpose="catalog-card"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Bokmoo Bluetooth Card|Bokmoo Card V1/);
    expect(count(container)).toBe('30 plans');
    expect(pagerText(container)).toBe('Page 1 / 3');
    expect(pager(container)!.querySelectorAll('button')[0].hasAttribute('disabled')).toBe(true);
    expect(pager(container)!.querySelectorAll('button')[1].hasAttribute('disabled')).toBe(false);
    expect(readCatalog).not.toHaveBeenCalled();
  });

  it('moves between pages without reading anything', () => {
    const onPageChange = vi.fn();
    const { container } = render(<ProductsPage {...props({ onPageChange })} />);
    const firstPage = titles(container)[0];

    press(container, 'last');
    expect(pagerText(container)).toBe('Page 2 / 3');
    expect(articles(container)).toHaveLength(12);
    expect(titles(container)[0]).not.toBe(firstPage);
    expect(titles(container)[0]).toMatch(/^Europe 5GB \/ 30 days$/);

    press(container, 'last');
    expect(pagerText(container)).toBe('Page 3 / 3');
    expect(articles(container)).toHaveLength(6);
    expect(pager(container)!.querySelectorAll('button')[1].hasAttribute('disabled')).toBe(true);

    press(container, 'first');
    expect(pagerText(container)).toBe('Page 2 / 3');

    expect(onPageChange).not.toHaveBeenCalled();
    expect(readCatalog).not.toHaveBeenCalled();
  });

  it('finds plans by the English name of a destination', () => {
    const { container } = render(<ProductsPage {...props()} />);

    search(container, 'japan');

    expect(regions(container)).toEqual(['Asia-Pacific', 'Global', 'Japan']);
    expect(count(container)).toBe('15 plans');
    expect(pagerText(container)).toBe('Page 1 / 2');
    expect((container.querySelector('input[aria-label]') as HTMLInputElement).value).toBe('japan');
    expect(readCatalog).not.toHaveBeenCalled();
  });

  it('needs every word of a search to match', () => {
    const { container } = render(<ProductsPage {...props()} />);

    search(container, 'japan 3gb');

    expect(titles(container).sort()).toEqual(['Asia-Pacific 3GB / 15 days', 'Global 3GB / 15 days', 'Japan 3GB / 15 days']);
    expect(count(container)).toBe('3 plans');
    expect(pager(container)).toBeNull();
  });

  it('says so when nothing matches, and comes back when the search is cleared', () => {
    const { container } = render(<ProductsPage {...props()} />);

    search(container, 'lapland');
    expect(articles(container)).toHaveLength(0);
    expect(container.textContent).toMatch(/No plans matched the current search\./);

    search(container, '');
    expect(articles(container)).toHaveLength(12);
    expect(count(container)).toBe('30 plans');
  });

  it('filters plans by coverage', () => {
    const { container } = render(<ProductsPage {...props()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Global' }));
    expect(regions(container)).toEqual(['Global']);
    expect(count(container)).toBe('5 plans');
    expect(screen.getByRole('button', { name: 'Global' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Regional' }));
    expect(regions(container)).toEqual(['Asia-Pacific', 'Europe']);
    expect(count(container)).toBe('10 plans');

    fireEvent.click(screen.getByRole('button', { name: 'Local' }));
    expect(regions(container)).toEqual(['Japan', 'South Korea', 'United States']);
    expect(count(container)).toBe('15 plans');

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(count(container)).toBe('30 plans');
  });

  it('sorts by price and by name', () => {
    const onSortChange = vi.fn();
    const { container } = render(<ProductsPage {...props({ onSortChange })} />);

    sort(container, 'price');
    expect(prices(container)).toEqual([...prices(container)].sort((a, b) => a - b));
    expect(prices(container)[0]).toBe(2.5);
    // the first page holds the twelve cheapest: every 1GB plan, then every 3GB plan
    expect(prices(container).slice(-1)[0]).toBe(5.5);
    expect(count(container)).toBe('30 plans');

    sort(container, 'name');
    const inNameOrder = titles(container).map((title) => title.replace(/ \d+GB \/ \d+ days$/, ''));
    expect(inNameOrder.slice(0, 6)).toEqual([...inNameOrder.slice(0, 6)].sort((a, b) => a.localeCompare(b)));
    expect(inNameOrder[0]).toBe('Asia-Pacific');
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it('starts narrowed when the shopper arrives from a search', () => {
    window.history.replaceState({}, '', '/search?q=japan');
    const { container } = render(<ProductsPage {...props()} />);

    expect(regions(container)).toEqual(['Asia-Pacific', 'Global', 'Japan']);
    expect(count(container)).toBe('15 plans');
    expect((container.querySelector('input[aria-label]') as HTMLInputElement).value).toBe('japan');
  });

  it('reads the catalog itself when the host has nothing to show', async () => {
    const { container } = render(<ProductsPage {...props({ products: [], totalProducts: 0 })} />);

    await waitFor(() => expect(articles(container)).toHaveLength(12));
    expect(readCatalog).toHaveBeenCalledTimes(1);
    expect(readCatalog.mock.calls[0][1]).toEqual({ page: 1, limit: 250, locale: 'en', type: 'esim' });
    expect(count(container)).toBe('30 plans');
    expect(container.textContent).not.toMatch(/Bokmoo Bluetooth Card/);
  });

  it('offers to try again when the catalog cannot be read, and lists on the second try', async () => {
    readCatalog.mockRejectedValueOnce(new Error('HTTP 503'));
    const { container } = render(<ProductsPage {...props({ products: [], totalProducts: 0 })} />);

    await waitFor(() => expect(container.textContent).toMatch(/Plans are unavailable right now\./));
    expect(container.textContent).toMatch(/HTTP 503/);

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(articles(container)).toHaveLength(12));
    expect(readCatalog).toHaveBeenCalledTimes(2);
  });

  it('keeps the page it is on, and reads once, across re-renders that hand over a new config', async () => {
    const first = props({ products: [], totalProducts: 0 });
    const { container, rerender } = render(<ProductsPage {...first} />);
    await waitFor(() => expect(articles(container)).toHaveLength(12));
    press(container, 'last');
    expect(pagerText(container)).toBe('Page 2 / 3');

    for (let index = 0; index < 5; index += 1) {
      rerender(<ProductsPage {...first} config={{ site: { brandName: `BOKMOO ${index}` } } as ProductsPageProps['config']} />);
    }

    expect(pagerText(container)).toBe('Page 2 / 3');
    expect(articles(container)).toHaveLength(12);
    expect(readCatalog).toHaveBeenCalledTimes(1);
  });

  it('still hands paging, sorting and searching to a host that pages on its server', () => {
    const onPageChange = vi.fn();
    const onSortChange = vi.fn();
    const onSearch = vi.fn();
    const { container } = render(
      <ProductsPage {...props({ products: PLANS.slice(0, 12) as unknown as ProductsPageProps['products'], totalProducts: 30, totalPages: 3, onPageChange, onSortChange, onSearch })} />
    );
    const before = titles(container);

    expect(articles(container)).toHaveLength(12);
    expect(count(container)).toBe('30 plans');
    expect(pagerText(container)).toBe('Page 1 / 3');

    press(container, 'last');
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(onPageChange).not.toHaveBeenCalledWith(1);

    sort(container, 'price');
    expect(onSortChange).toHaveBeenCalledWith('price');

    search(container, 'japan');
    expect(onSearch).toHaveBeenCalledWith('japan');
    expect(titles(container)).toEqual(before);
    expect(readCatalog).not.toHaveBeenCalled();
  });

  it('opens a plan and adds it to the cart', () => {
    const onProductClick = vi.fn();
    const onAddToCart = vi.fn(async () => undefined);
    const { container } = render(<ProductsPage {...props({ onProductClick, onAddToCart })} />);
    const first = articles(container)[0];

    fireEvent.click([...first.querySelectorAll('button')].find((button) => button.textContent?.includes('View coverage & plans'))!);
    fireEvent.click([...first.querySelectorAll('button')].find((button) => button.textContent?.includes('Add to cart'))!);

    expect(onProductClick).toHaveBeenCalledWith('boss-JP-1GB-7D');
    expect(onAddToCart).toHaveBeenCalledWith('boss-JP-1GB-7D');
  });

  it('speaks the storefront language on the pager and the count', () => {
    const simplified = render(<ProductsPage {...props({ locale: 'zh-Hans' as ProductsPageProps['locale'] })} />);
    expect(pagerText(simplified.container)).toBe('第 1 / 3');
    expect(count(simplified.container)).toBe('30 个套餐');
    cleanup();

    const japanese = render(<ProductsPage {...props({ locale: 'ja' as ProductsPageProps['locale'] })} />);
    expect(pagerText(japanese.container)).toBe('ページ 1 / 3');
    expect(count(japanese.container)).toBe('30 プラン');
    expect(pager(japanese.container)!.querySelectorAll('button')[0].getAttribute('aria-label')).toBe('前へ');
  });
});
