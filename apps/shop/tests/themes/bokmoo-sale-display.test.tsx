import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartPage } from '@shop-themes/bokmoo/src/components/CartPage';
import { CheckoutPage } from '@shop-themes/bokmoo/src/components/CheckoutPage';
import { Header } from '@shop-themes/bokmoo/src/components/Header';
import { PromoBar } from '@shop-themes/bokmoo/src/components/PromoBar';
import { SalePrice } from '@shop-themes/bokmoo/src/components/SalePrice';
import {
  codeDiscount, countdown, priceSale, resetSaleCachesForTests, saleFor, saleUnitPrice, type Sale,
} from '@shop-themes/bokmoo/src/lib/sale';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeRoot = path.resolve(__dirname, '../../../../packages/shop-themes/bokmoo');

const CARD = 'odoo-product-6';
const PLAN = 'boss-CN-1GB-7D';

// What the public promotions endpoint serves while the Black Friday sale runs.
const API_SALE = {
  id: 'promo-bf', slug: 'black-friday-2026', name: 'Black Friday 2026', status: 'active',
  startsAt: '2026-11-27T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z',
  discountType: 'percent', discountValue: 20, productIds: [CARD, 'odoo-product-7'], perUserLimit: 0,
  banner: { title: 'Black Friday — 20% off BOKMOO cards', body: 'Nov 27 – Nov 30' },
  rulesUrl: 'https://bokmoo.com/blackfriday', activeNow: true,
};
const CARD_SALE: Sale = {
  id: 'promo-bf', slug: 'black-friday-2026', name: 'Black Friday 2026',
  startsAt: '2026-11-27T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z',
  discountType: 'percent', discountValue: 20, productIds: [CARD, 'odoo-product-7'],
  banner: { title: 'Black Friday — 20% off BOKMOO cards', body: 'Nov 27 – Nov 30' },
  rulesUrl: 'https://bokmoo.com/blackfriday', activeNow: true,
};
const VALID_CODE = { valid: true, code: 'CREATOR10', partnerName: 'Creator', discountType: 'percentage', discountValue: 10 };

function stubStorefront(options: { sales?: unknown[]; codes?: Record<string, unknown> } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
    if (url.startsWith('/api/v1/promotions/active')) return ok({ items: options.sales ?? [] });
    const code = /\/store\/promo\/([A-Z0-9_-]+)$/.exec(url)?.[1];
    if (code) return ok(options.codes?.[code] ?? { valid: false });
    throw new Error(`unexpected storefront request: ${url}`);
  }));
}

const flush = async () => { await act(async () => { await Promise.resolve(); }); };

const line = (productId: string, price: number, quantity: number) => ({
  id: `${productId}-line`, productId, productName: productId, productImage: '', price, quantity,
  variantId: `${productId}-variant`, requiresShipping: false, maxQuantity: 10, subtotal: price * quantity,
});
const cartWith = (...items: ReturnType<typeof line>[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return {
    id: 'cart-1', userId: 'user-1', items, itemCount: items.length,
    subtotal, tax: 0, shipping: 0, discount: 0, total: subtotal, status: 'active', createdAt: '', updatedAt: '',
  };
};

beforeEach(() => {
  resetSaleCachesForTests();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('sale pricing mirrors the checkout', () => {
  it('prices a covered unit and leaves the rest of the catalog alone', () => {
    expect(saleUnitPrice(CARD_SALE, 20)).toBe(16);
    expect(saleUnitPrice(CARD_SALE, 40)).toBe(32);
    expect(saleFor([CARD_SALE], CARD)).toBe(CARD_SALE);
    expect(saleFor([CARD_SALE], PLAN)).toBeNull();
    expect(saleFor([{ ...CARD_SALE, productIds: null }], PLAN)).toBeTruthy();
    expect(saleFor([{ ...CARD_SALE, productIds: [] }], CARD)).toBeNull();
    // a promotion scheduled but not started is not shown as a sale
    expect(saleFor([{ ...CARD_SALE, activeNow: false }], CARD)).toBeNull();
  });

  it('limits what a code may be applied to the items the sale covered', () => {
    const cardsOnly = priceSale([{ productId: CARD, unitPrice: 20, quantity: 2 }], [CARD_SALE]);
    expect(cardsOnly).toEqual({ saleDiscount: 8, saleBase: 32, onSale: true });

    const mixed = priceSale([
      { productId: CARD, unitPrice: 20, quantity: 1 },
      { productId: PLAN, unitPrice: 4.9, quantity: 1 },
    ], [CARD_SALE]);
    expect(mixed).toEqual({ saleDiscount: 4, saleBase: 16, onSale: true });

    // nothing on sale: the code applies to the whole order, as it always has
    const noSale = priceSale([{ productId: PLAN, unitPrice: 4.9, quantity: 2 }], [CARD_SALE]);
    expect(noSale).toEqual({ saleDiscount: 0, saleBase: 9.8, onSale: false });
  });

  it('takes a percentage of the sale price, or a fixed amount, and never below zero', () => {
    expect(codeDiscount({ code: 'C', partnerName: null, discountType: 'percentage', discountValue: 10 }, 32)).toBe(3.2);
    expect(codeDiscount({ code: 'C', partnerName: null, discountType: 'fixed_amount', discountValue: 5 }, 32)).toBe(5);
    expect(codeDiscount({ code: 'C', partnerName: null, discountType: 'fixed_amount', discountValue: 50 }, 16)).toBe(16);
    expect(codeDiscount(null, 16)).toBe(0);
  });

  it('counts down to the end and stops there', () => {
    const endsAt = '2026-12-01T00:00:00.000Z';
    expect(countdown(endsAt, Date.parse('2026-11-28T10:00:00.000Z'))).toBe('2d 14h');
    expect(countdown(endsAt, Date.parse('2026-11-30T18:59:20.000Z'))).toBe('5h 00m');
    expect(countdown(endsAt, Date.parse('2026-12-01T00:00:01.000Z'))).toBeNull();
    expect(countdown('', 0)).toBeNull();
  });
});

describe('SalePrice', () => {
  it('shows the plain price without a sale', () => {
    const { container } = render(<SalePrice unitPrice={20} sale={null} />);
    expect(container.textContent).toBe('$20.00');
    expect(container.querySelector('s')).toBeNull();
  });

  it('shows the sale price beside the struck list price and the difference', () => {
    const { container } = render(<SalePrice unitPrice={20} sale={CARD_SALE} />);
    expect(container.querySelector('.bokmoo-sale-now')?.textContent).toBe('$16.00');
    expect(container.querySelector('s')?.textContent).toBe('$20.00');
    expect(container.querySelector('.bokmoo-sale-badge')?.textContent).toBe('-20%');
  });

  it('prices a line by quantity, as the checkout bills it', () => {
    const { container } = render(<SalePrice unitPrice={20} quantity={2} sale={CARD_SALE} />);
    expect(container.querySelector('.bokmoo-sale-now')?.textContent).toBe('$32.00');
    expect(container.querySelector('s')?.textContent).toBe('$40.00');
  });
});

describe('cart under a sale', () => {
  it('shows the sale on covered lines and takes it off the total', async () => {
    stubStorefront({ sales: [API_SALE] });
    const { container } = render(
      <CartPage
        cart={cartWith(line(CARD, 20, 2), line(PLAN, 4.9, 1)) as never}
        isLoading={false}
        onUpdateQuantity={vi.fn(async () => undefined)}
        onRemoveItem={vi.fn(async () => undefined)}
        onCheckout={vi.fn()}
        onContinueShopping={vi.fn()}
        locale="en"
      />,
    );
    await flush();

    const saleRow = container.querySelector('[data-purpose="sale-discount-row"]');
    expect(saleRow?.textContent).toBe('Black Friday — 20% off BOKMOO cards-$8.00');
    // 40 + 4.9 - 8
    expect(saleRow?.nextElementSibling?.textContent).toBe('Total$36.90');
    // the card line is on sale, the plan line is not
    expect(container.querySelector('[data-purpose="sale-price"] s')?.textContent).toBe('$40.00');
    expect(container.querySelectorAll('[data-purpose="sale-price"]')).toHaveLength(1);
  });

  it('keeps list prices when no promotion is running', async () => {
    stubStorefront({ sales: [] });
    const { container } = render(
      <CartPage
        cart={cartWith(line(CARD, 20, 1)) as never}
        isLoading={false}
        onUpdateQuantity={vi.fn(async () => undefined)}
        onRemoveItem={vi.fn(async () => undefined)}
        onCheckout={vi.fn()}
        onContinueShopping={vi.fn()}
        locale="en"
      />,
    );
    await flush();
    expect(container.querySelector('[data-purpose="sale-discount-row"]')).toBeNull();
    expect(container.querySelector('[data-purpose="sale-price"]')).toBeNull();
  });
});

describe('checkout order summary', () => {
  const renderCheckout = () => render(
    <CheckoutPage
      cart={cartWith(line(CARD, 20, 1)) as never}
      isLoading={false}
      isProcessing={false}
      availablePaymentMethods={[{ name: 'stripe', displayName: 'Card' }]}
      onSubmit={vi.fn(async () => undefined)}
      onBack={vi.fn()}
      locale="en"
    />,
  );

  // The summary is a narrow column. With the sale price, the struck price and the badge beside it, the
  // name was squeezed into a sliver and the price printed over it.
  it('puts a sale price below the name, where it cannot print over it', async () => {
    stubStorefront({ sales: [API_SALE] });
    const { container } = renderCheckout();
    await flush();

    const price = container.querySelector('[data-purpose="checkout-line-price"]');
    expect(price?.getAttribute('data-layout')).toBe('stacked');
    expect(price?.textContent).toBe('$16.00$20.00-20%');
    const nameColumn = price?.parentElement;
    expect(nameColumn?.classList.contains('flex-1')).toBe(true);
    // name, quantity, price — and nothing printed beside the column
    expect(nameColumn?.children).toHaveLength(3);
    expect(nameColumn?.nextElementSibling).toBeNull();
  });

  it('keeps the price beside the name when nothing is on sale', async () => {
    stubStorefront({ sales: [] });
    const { container } = renderCheckout();
    await flush();

    const price = container.querySelector('[data-purpose="checkout-line-price"]');
    expect(price?.getAttribute('data-layout')).toBe('inline');
    expect(price?.textContent).toBe('$20.00');
  });
});

describe('checkout promo code', () => {
  const renderCheckout = () => render(
    <CheckoutPage
      cart={cartWith(line(CARD, 20, 1)) as never}
      isLoading={false}
      isProcessing={false}
      availablePaymentMethods={[{ name: 'stripe', displayName: 'Card' }]}
      onSubmit={vi.fn(async () => undefined)}
      onBack={vi.fn()}
      locale="en"
    />,
  );

  it('shows what a valid code takes off before payment', async () => {
    vi.useFakeTimers();
    stubStorefront({ sales: [API_SALE], codes: { CREATOR10: VALID_CODE } });
    const { container } = renderCheckout();
    await flush();

    // the sale alone: 20 -> 16
    expect(container.querySelector('[data-purpose="checkout-total"]')?.textContent.trim()).toBe('$16.00');

    fireEvent.change(document.getElementById('bokmoo-promo-code')!, { target: { value: 'creator10' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    // 10% of the $16 sale price
    expect(container.querySelector('[data-purpose="code-discount-row"]')?.textContent).toBe('CREATOR10-$1.60');
    expect(container.querySelector('[data-purpose="checkout-total"]')?.textContent.trim()).toBe('$14.40');
    expect(document.querySelector('[data-purpose="promo-code-message"]')?.textContent).toBe('CREATOR10: 10% off the sale price ($1.60 off).');
  });

  it('takes a fixed-amount code off after the sale', async () => {
    vi.useFakeTimers();
    stubStorefront({ sales: [API_SALE], codes: { CREATOR5: { ...VALID_CODE, code: 'CREATOR5', discountType: 'fixed_amount', discountValue: 5 } } });
    const { container } = renderCheckout();
    await flush();
    fireEvent.change(document.getElementById('bokmoo-promo-code')!, { target: { value: 'CREATOR5' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(container.querySelector('[data-purpose="checkout-total"]')?.textContent.trim()).toBe('$11.00');
    expect(document.querySelector('[data-purpose="promo-code-message"]')?.textContent).toBe('CREATOR5: $5.00 off this order.');
  });

  it('says so when a code adds no discount, and does not change the total', async () => {
    vi.useFakeTimers();
    stubStorefront({ sales: [API_SALE] });
    const { container } = renderCheckout();
    await flush();
    fireEvent.change(document.getElementById('bokmoo-promo-code')!, { target: { value: 'NOPE' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(document.querySelector('[data-purpose="promo-code-message"]')?.textContent).toBe('This code doesn’t add a discount.');
    expect(container.querySelector('[data-purpose="code-discount-row"]')).toBeNull();
    expect(container.querySelector('[data-purpose="checkout-total"]')?.textContent.trim()).toBe('$16.00');
  });

  it.each([
    ['zh-Hans', '该码没有附加折扣。'],
    ['zh-Hant', '該碼沒有附加折扣。'],
    ['ja', 'このコードは割引に使えません。'],
    ['ko', '이 코드는 할인에 사용할 수 없습니다.'],
    ['fr', 'Ce code ne donne pas de réduction.'],
    ['de', 'Dieser Code gewährt keinen Rabatt.'],
  ])('speaks the shopper’s language (%s)', async (locale, message) => {
    vi.useFakeTimers();
    stubStorefront({ sales: [API_SALE] });
    render(
      <CheckoutPage
        cart={cartWith(line(CARD, 20, 1)) as never}
        isLoading={false}
        isProcessing={false}
        availablePaymentMethods={[{ name: 'stripe', displayName: 'Card' }]}
        onSubmit={vi.fn(async () => undefined)}
        onBack={vi.fn()}
        locale={locale as never}
      />,
    );
    await flush();
    fireEvent.change(document.getElementById('bokmoo-promo-code')!, { target: { value: 'NOPE' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(document.querySelector('[data-purpose="promo-code-message"]')?.textContent).toBe(message);
  });
});

describe('promo bar', () => {
  it('announces a running promotion on every page, links to its rules and can be dismissed', async () => {
    stubStorefront({ sales: [API_SALE] });
    const { container, rerender } = render(<PromoBar locale="en" />);
    expect(container.firstChild).toBeNull();
    await flush();

    const bar = container.querySelector('[data-purpose="promo-bar"]')!;
    expect(bar.textContent).toContain('-20%');
    expect(bar.textContent).toContain('Black Friday — 20% off BOKMOO cards');
    expect(bar.querySelector('a')?.getAttribute('href')).toBe('https://bokmoo.com/blackfriday');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(container.querySelector('[data-purpose="promo-bar"]')).toBeNull();
    rerender(<PromoBar locale="en" />);
    await flush();
    // dismissed for the session, not just for this render
    expect(container.querySelector('[data-purpose="promo-bar"]')).toBeNull();
  });

  it('stays away when nothing is running or the promotion has not started', async () => {
    const { container } = render(<PromoBar locale="en" />);
    stubStorefront({ sales: [{ ...API_SALE, activeNow: false }] });
    await flush();
    expect(container.querySelector('[data-purpose="promo-bar"]')).toBeNull();
  });

  it('is part of the header', async () => {
    stubStorefront({ sales: [API_SALE] });
    const { container } = render(
      <Header
        locale="en"
        isAuthenticated={false}
        cartItemCount={0}
        onSearch={() => undefined}
        onLogout={() => undefined}
        onNavigateToCart={() => undefined}
        onNavigateToProfile={() => undefined}
        onNavigateToLogin={() => undefined}
        onNavigateToRegister={() => undefined}
        onNavigateToHome={() => undefined}
        onNavigateToProducts={() => undefined}
        onNavigateToCategories={() => undefined}
        onNavigateToDeals={() => undefined}
      />,
    );
    await flush();
    expect(container.querySelector('header > [data-purpose="promo-bar"]')).not.toBeNull();
  });
});

describe('sale stylesheet', () => {
  const BLOCK = /\/\* >>> Sale display[\s\S]*?\/\* <<< Sale display end \*\//;

  it('ships the same block in both stylesheets, styling every class the components use', () => {
    const blocks = ['src/tokens.css', 'theme-pack/tokens.css'].map((file) => BLOCK.exec(readFileSync(path.join(themeRoot, file), 'utf8'))?.[0]);
    expect(blocks[0]).toBeTruthy();
    expect(blocks[1]).toBe(blocks[0]);

    const used = new Set<string>();
    for (const file of ['SalePrice', 'PromoBar', 'CartPage', 'CheckoutPage']) {
      for (const name of readFileSync(path.join(themeRoot, `src/components/${file}.tsx`), 'utf8').match(/bokmoo-(?:sale|promo-bar|promo-code)-[a-z-]+/g) ?? []) used.add(name);
    }
    expect(used.size).toBeGreaterThan(8);
    for (const name of used) expect(blocks[0], `${name} is styled`).toMatch(new RegExp(`\\.${name}[\\s.{,]`));
  });
});
