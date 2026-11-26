import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeConfig } from 'shared/src/types/theme';
import type { ProductsPageProps } from 'shared/src/types/theme';
import React from 'react';
import { ProductsPage } from '@shop-themes/bokmoo/src/components/ProductsPage';
import { getBokmooCatalog, getBokmooProducts, type BokmooApiProduct } from '@shop-themes/bokmoo/src/lib/api';
import { resetSaleCachesForTests } from '@shop-themes/bokmoo/src/lib/sale';

// The official store's catalog page carries cards only — plans live on the eSIM mall — and the theme
// keeps the page that is on show itself. Before: the page listed plans, and "next page" did nothing,
// because the theme's own read ran once on the first render and never again.

vi.mock('@shop-themes/bokmoo/src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shop-themes/bokmoo/src/lib/api')>();
  return { ...actual, getBokmooCatalog: vi.fn(), getBokmooProducts: vi.fn() };
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeRoot = path.resolve(__dirname, '../../../../packages/shop-themes/bokmoo');

type ApiProduct = BokmooApiProduct & { sourceUpdatedAt?: string };

const card = (id: string, name: string, price: number, changedAt: string): ApiProduct => ({
  id,
  name,
  slug: id,
  productKind: 'goods',
  price,
  requiresShipping: true,
  isActive: true,
  sourceUpdatedAt: changedAt,
  images: [`/media/${id}?v=1`],
  description: 'First paragraph of the card.\n\nSecond paragraph with setup details that the tile leaves out.',
  variants: [{ id: `${id}-variant`, name, salePrice: price, isActive: true }],
  typeData: { provider: 'odoo' },
});
const plan = (n: number, price: number): ApiProduct => ({
  id: `boss-PLAN-${n}`,
  name: `Plan ${n} 1GB/7 days`,
  slug: `boss-plan-${n}`,
  productKind: 'digital',
  price,
  isActive: true,
  sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
  variants: [{ id: `boss-plan-${n}-variant`, name: `Plan ${n}`, salePrice: price, isActive: true }],
  typeData: { esim: { country: 'Japan', region: 'Japan', carrier: 'KDDI' } },
});

const BLUETOOTH = card('odoo-product-7', '[BOKMOO-BLE-V1] Bokmoo Bluetooth Card', 40, '2026-10-26T15:25:54.000Z');
const CARD_V1 = card('odoo-product-6', '[BOKMOO-CARD-V1] Bokmoo Card V1', 20, '2026-08-24T10:13:56.000Z');
const PLANS = Array.from({ length: 14 }, (_, index) => plan(index + 1, Number((2.5 + index * 0.5).toFixed(1))));
const WHOLE_CATALOG: ApiProduct[] = [BLUETOOTH, CARD_V1, ...PLANS];

const API_SALE = {
  id: 'promo-bf', slug: 'black-friday-2026', name: 'Black Friday 2026', status: 'active',
  startsAt: '2026-11-27T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z',
  discountType: 'percent', discountValue: 20, productIds: ['odoo-product-6', 'odoo-product-7'], perUserLimit: 0,
  banner: { title: 'Black Friday — 20% off BOKMOO cards', body: 'Nov 27 – Nov 30' }, rulesUrl: '/blackfriday', activeNow: true,
};

const catalog = vi.mocked(getBokmooCatalog);
const paged = vi.mocked(getBokmooProducts);

const props = (over: Partial<ProductsPageProps> = {}): ProductsPageProps => ({
  products: [],
  isLoading: false,
  totalProducts: 0,
  currentPage: 1,
  totalPages: 1,
  sortBy: 'createdAt',
  viewMode: 'grid',
  onSortChange: vi.fn(),
  onViewModeChange: vi.fn(),
  onPageChange: vi.fn(),
  onAddToCart: vi.fn(async () => undefined),
  onProductClick: vi.fn(),
  locale: 'en',
  ...over,
});
const site = (values: Record<string, string>) => ({ site: values }) as unknown as ThemeConfig;

const names = (container: HTMLElement) => [...container.querySelectorAll('article h2')].map((h2) => h2.textContent?.trim());
const pagerText = (container: HTMLElement) => container.querySelector('[data-purpose="catalog-pager"]')?.textContent?.trim() ?? null;

beforeEach(() => {
  resetSaleCachesForTests();
  catalog.mockReset().mockResolvedValue({ items: WHOLE_CATALOG, page: 1, limit: 250, total: WHOLE_CATALOG.length });
  paged.mockReset().mockImplementation(async (_config, params) => {
    const pageNumber = params?.page || 1;
    const items = PLANS.slice((pageNumber - 1) * 12, pageNumber * 12);
    return { items, page: pageNumber, limit: 12, total: PLANS.length };
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { items: [] } }) })));
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the official store lists cards only', () => {
  it('reads the whole catalog once and shows the two cards — no plan', async () => {
    const { container } = render(<ProductsPage {...props()} />);

    await waitFor(() => expect(names(container)).toHaveLength(2));
    expect(catalog).toHaveBeenCalledTimes(1);
    expect(paged).not.toHaveBeenCalled();
    expect(names(container)).toEqual(['Bokmoo Bluetooth Card', 'Bokmoo Card']);
    expect(container.querySelector('[data-purpose="catalog-plan"]')).toBeNull();
    expect(container.querySelector('[data-purpose="catalog-count"]')?.textContent?.trim()).toBe('2 cards');
    expect(container.textContent).not.toMatch(/Instant eSIM delivery|Destination eSIM|Coverage|Validity/);
  });

  it('is written for cards, not plans, and has no plan filters or pager', async () => {
    const { container } = render(<ProductsPage {...props()} />);
    await waitFor(() => expect(names(container)).toHaveLength(2));

    expect(container.querySelector('h1')?.textContent?.trim()).toBe('BOKMOO cards.');
    expect(screen.getByPlaceholderText('Search cards…')).toBeTruthy();
    for (const filter of ['Popular', 'Regional', 'Global']) expect(screen.queryByRole('button', { name: filter })).toBeNull();
    expect(pagerText(container)).toBeNull();
  });

  it('shows a card as a card: picture, name, the first paragraph, the price, a way to the product page', async () => {
    const onProductClick = vi.fn();
    const { container } = render(<ProductsPage {...props({ onProductClick })} />);
    await waitFor(() => expect(names(container)).toHaveLength(2));

    const tile = container.querySelector('[data-purpose="catalog-card"]')!;
    expect(tile.querySelector('img')?.getAttribute('src')).toBe('https://api.bokmoo.com/media/odoo-product-7?v=1');
    expect(tile.textContent).toContain('First paragraph of the card.');
    expect(tile.textContent).not.toContain('Second paragraph');
    expect(tile.textContent).toContain('$40.00');
    expect(tile.textContent).toContain('Physical eSIM card');
    fireEvent.click(screen.getAllByRole('button', { name: 'View card' })[0]!);
    expect(onProductClick).toHaveBeenCalledWith('odoo-product-7');
  });

  it('shows the sale price on a card under a sale', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { items: [API_SALE] } }) })));
    const { container } = render(<ProductsPage {...props()} />);
    await waitFor(() => expect(names(container)).toHaveLength(2));
    await waitFor(() => expect(container.querySelectorAll('[data-purpose="sale-price"]')).toHaveLength(2));

    // the Bluetooth card, then the BOKMOO Card: each with its list price struck and the difference
    expect([...container.querySelectorAll('[data-purpose="sale-price"]')].map((el) => el.textContent)).toEqual(['$32.00$40.00-20%', '$16.00$20.00-20%']);
  });

  it('searches within the cards', async () => {
    const { container } = render(<ProductsPage {...props()} />);
    await waitFor(() => expect(names(container)).toHaveLength(2));

    fireEvent.change(screen.getByPlaceholderText('Search cards…'), { target: { value: 'bluetooth' } });
    fireEvent.submit(screen.getByPlaceholderText('Search cards…').closest('form')!);

    await waitFor(() => expect(names(container)).toEqual(['Bokmoo Bluetooth Card']));
    expect(container.querySelector('[data-purpose="catalog-count"]')?.textContent?.trim()).toBe('1 cards');
    expect(catalog).toHaveBeenCalledTimes(1);
  });

  it('sorts the cards by the chosen order', async () => {
    const { container, rerender } = render(<ProductsPage {...props()} />);
    await waitFor(() => expect(names(container)).toHaveLength(2));
    expect(names(container)).toEqual(['Bokmoo Bluetooth Card', 'Bokmoo Card']);

    rerender(<ProductsPage {...props({ sortBy: 'price' })} />);
    expect(names(container)).toEqual(['Bokmoo Card', 'Bokmoo Bluetooth Card']);

    rerender(<ProductsPage {...props({ sortBy: 'name' })} />);
    expect(names(container)).toEqual(['Bokmoo Bluetooth Card', 'Bokmoo Card']);
    expect(catalog).toHaveBeenCalledTimes(1);
  });

  it('is the setting every other theme read falls back to', async () => {
    const { resolveBokmooSiteConfig } = await import('@shop-themes/bokmoo/src/site');
    expect(resolveBokmooSiteConfig(undefined, 'en').catalogProducts).toBe('cards');
    expect(resolveBokmooSiteConfig(site({ catalogProducts: 'plans' }), 'en').catalogProducts).toBe('plans');
    expect(resolveBokmooSiteConfig(site({ catalogProducts: 'something-else' }), 'en').catalogProducts).toBe('cards');
    const schema = JSON.parse(readFileSync(path.join(themeRoot, 'theme-pack/schemas/settings.schema.json'), 'utf8'));
    expect(schema.properties.site.properties.catalogProducts.default).toBe('cards');
    expect(schema.properties.site.properties.catalogProducts.enum).toEqual(['cards', 'plans', 'all']);
  });

  it('falls back to what the host passes — still cards only — when the theme cannot read the catalog', async () => {
    catalog.mockRejectedValue(new Error('offline'));
    const hostProducts = WHOLE_CATALOG.map((item) => ({ ...item, price: Number(item.price), images: Array.isArray(item.images) ? (item.images as string[]).map((url) => ({ id: url, url })) : [] })) as never;
    const { container } = render(<ProductsPage {...props({ products: hostProducts, totalProducts: WHOLE_CATALOG.length })} />);

    await waitFor(() => expect(names(container)).toHaveLength(2));
    expect(names(container)).toEqual(['Bokmoo Bluetooth Card', 'Bokmoo Card']);
  });
});

describe('the pager', () => {
  const plansStore = site({ catalogProducts: 'plans' });

  it('asks for the page it shows', async () => {
    const { container } = render(<ProductsPage {...props({ config: plansStore })} />);
    await waitFor(() => expect(names(container)).toHaveLength(12));
    expect(paged).toHaveBeenLastCalledWith(expect.anything(), { page: 1, limit: 12, locale: 'en', type: 'esim' });
    expect(pagerText(container)).toBe('Page 1 of 2');
    expect(names(container)[0]).toBe('Plan 1 1GB/7 days');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(pagerText(container)).toBe('Page 2 of 2'));
    expect(paged).toHaveBeenLastCalledWith(expect.anything(), { page: 2, limit: 12, locale: 'en', type: 'esim' });
    expect(names(container)).toEqual(['Plan 13 1GB/7 days', 'Plan 14 1GB/7 days']);
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    await waitFor(() => expect(pagerText(container)).toBe('Page 1 of 2'));
    expect(names(container)[0]).toBe('Plan 1 1GB/7 days');
  });

  it('keeps the page it is on even though the host still says page 1', async () => {
    const { container } = render(<ProductsPage {...props({ config: plansStore })} />);
    await waitFor(() => expect(names(container)).toHaveLength(12));

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(pagerText(container)).toBe('Page 2 of 2'));

    expect(props().currentPage).toBe(1);
    expect(pagerText(container)).toBe('Page 2 of 2');
  });

  it('pages a long card list here, without reading again', async () => {
    const manyCards = Array.from({ length: 14 }, (_, index) => card(`card-${index}`, `BOKMOO Card ${index + 1}`, 20, `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`));
    catalog.mockResolvedValue({ items: manyCards, page: 1, limit: 250, total: manyCards.length });
    const { container } = render(<ProductsPage {...props()} />);
    await waitFor(() => expect(names(container)).toHaveLength(12));
    expect(pagerText(container)).toBe('Page 1 of 2');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(names(container)).toHaveLength(2));
    expect(pagerText(container)).toBe('Page 2 of 2');
    expect(catalog).toHaveBeenCalledTimes(1);
  });
});

describe('a page that keeps re-rendering', () => {
  it('reads the catalog once', async () => {
    let rerender = () => undefined as void;
    const Host = () => {
      const [, update] = React.useState(0);
      rerender = () => update((count) => count + 1);
      return <ProductsPage {...props({ config: { site: {} } as unknown as ThemeConfig })} />;
    };
    const { container } = render(<Host />);
    await waitFor(() => expect(names(container)).toHaveLength(2));

    for (let render_ = 0; render_ < 5; render_ += 1) {
      await act(async () => {
        rerender();
      });
    }
    await act(async () => {});

    expect(catalog).toHaveBeenCalledTimes(1);
    expect(names(container)).toHaveLength(2);
  });
});

describe('the words on the page', () => {
  it('speak the seven storefront languages', async () => {
    const expected: Record<string, { heading: string; unit: string; view: string }> = {
      en: { heading: 'BOKMOO cards.', unit: 'cards', view: 'View card' },
      'zh-Hans': { heading: 'BOKMOO 实体卡。', unit: '款卡片', view: '查看卡片' },
      'zh-Hant': { heading: 'BOKMOO 實體卡。', unit: '款卡片', view: '查看卡片' },
      ja: { heading: 'BOKMOO カード。', unit: '枚のカード', view: 'カードを見る' },
      ko: { heading: 'BOKMOO 카드.', unit: '개의 카드', view: '카드 보기' },
      fr: { heading: 'Les cartes BOKMOO.', unit: 'cartes', view: 'Voir la carte' },
      de: { heading: 'BOKMOO-Karten.', unit: 'Karten', view: 'Karte ansehen' },
    };
    for (const [locale, words] of Object.entries(expected)) {
      paged.mockImplementation(async (_config, params) => {
        const pageNumber = params?.page || 1;
        return { items: PLANS.slice((pageNumber - 1) * 12, pageNumber * 12), page: pageNumber, limit: 12, total: PLANS.length };
      });
      const { container, unmount } = render(<ProductsPage {...props({ locale: locale as ProductsPageProps['locale'] })} />);
      await waitFor(() => expect(names(container)).toHaveLength(2));
      expect(container.querySelector('h1')?.textContent?.trim(), `${locale} heading`).toBe(words.heading);
      expect(container.querySelector('[data-purpose="catalog-count"]')?.textContent?.trim(), `${locale} unit`).toBe(`2 ${words.unit}`);
      expect([...container.querySelectorAll('button')].map((b) => b.textContent?.trim()), `${locale} button`).toContain(words.view);
      unmount();
    }
  });

  it('names the pager in the page language', async () => {
    const { container, unmount } = render(<ProductsPage {...props({ config: site({ catalogProducts: 'plans' }), locale: 'zh-Hans' })} />);
    await waitFor(() => expect(pagerText(container)).toBe('第 1 / 2 页'));
    unmount();
    const { container: ja } = render(<ProductsPage {...props({ config: site({ catalogProducts: 'plans' }), locale: 'ja' })} />);
    await waitFor(() => expect(pagerText(ja)).toBe('1 / 2 ページ'));
  });
});
