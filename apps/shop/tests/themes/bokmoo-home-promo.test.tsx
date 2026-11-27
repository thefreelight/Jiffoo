import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { HomePage } from '@shop-themes/bokmoo/src/components/HomePage';

// The home page used to carry its own announcement of the running promotion — a gold card under the header with
// the discount, the title, the body and an hourglass countdown — on top of the site-wide bar. The same promotion
// was announced twice on one screen (the owner's screenshot of 2026-11-28). The bar above the header announces
// it on every page; the home page itself announces nothing.
describe('the home page and the running promotion', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('the home page carries no promotion card of its own, and asks nothing about promotions', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      asked.push(url);
      if (url.includes('/promotions/active')) {
        return {
          ok: true, status: 200,
          json: async () => ({ success: true, data: { items: [{
            id: 'promo-bf', discountType: 'percent', discountValue: 15, activeNow: true, endsAt: '2026-12-01T00:00:00.000Z', rulesUrl: 'https://bokmoo.com/blackfriday',
            banner: { title: '黑五 8.5 折 · BOKMOO 实体卡', body: '11 月 27 日至 30 日：BOKMOO 卡与蓝牙卡 8.5 折，结算时自动生效。' },
          }] } }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }));
    const { container } = render(<HomePage locale="zh-Hans" onNavigate={vi.fn()} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
    const text = container.textContent ?? '';
    for (const gone of ['黑五 8.5 折', '结算时自动生效', '⏳']) expect(text, gone).not.toContain(gone);
    expect(asked.filter((url) => url.includes('/promotions/active'))).toHaveLength(0);
  });
});
