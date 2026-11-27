import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromoBar } from '@shop-themes/bokmoo/src/components/PromoBar';
import {
  campaignCta, campaignCopy, campaignHighlight, campaignTickLabels, campaignTicks, campaignWindowLabel,
} from '@shop-themes/bokmoo/src/lib/campaign-bar';
import { resetSaleCachesForTests, type Sale } from '@shop-themes/bokmoo/src/lib/sale';

// The owner's request (2026-11-27), with the Stitch design "BOKMOO - Global Connectivity Landing Page
// (Black Friday English Edition)": "促销插件，增加这个黑五模板吧，以后还能其他活动复用" — the promotional bar
// of that design, as a template of the promotions engine that the next campaign reuses with its own words.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeRoot = path.resolve(__dirname, '../../../../packages/shop-themes/bokmoo');

// what the public promotions endpoint answers for the Black Friday campaign of the official store
const CAMPAIGN = {
  id: 'promo-bf-2026', slug: 'black-friday-2026', name: 'Black Friday 2026', status: 'active',
  startsAt: '2026-11-27T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z',
  discountType: 'percent', discountValue: 15, productIds: ['odoo-product-6', 'odoo-product-7'], perUserLimit: 0,
  banner: {
    title: 'Black Friday — 15% off BOKMOO cards', body: 'Nov 27 – Nov 30: 15% off the BOKMOO Card and the Bluetooth Card.',
    badge: '🔥 Black Friday Sale', subject: 'Physical eSIM & Bluetooth Smart Card', lead: 'Save up to', highlight: '15% OFF', cta: 'Claim 15% OFF',
  },
  bannerTemplate: 'campaign', rulesUrl: 'https://bokmoo.com/blackfriday', activeNow: true,
};

function stubStorefront(sales: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
    if (url.startsWith('/api/v1/promotions/active')) return ok({ items: sales });
    throw new Error(`unexpected storefront request: ${url}`);
  }));
}
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const text = (container: HTMLElement) => (container.textContent ?? '').replace(/\s+/g, ' ');

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'promo-bf-2026', slug: 'black-friday-2026', name: 'Black Friday 2026',
  startsAt: '2026-11-27T00:00:00.000Z', endsAt: '2026-12-01T00:00:00.000Z',
  discountType: 'percent', discountValue: 20, productIds: null,
  banner: { title: 'Black Friday — 20% off BOKMOO cards', body: 'Nov 27 – Nov 30.' },
  rulesUrl: 'https://bokmoo.com/blackfriday', activeNow: true,
  ...overrides,
});

beforeEach(() => { resetSaleCachesForTests(); stubStorefront([]); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

describe('the words and the clock of the campaign bar', () => {
  const NOW = Date.parse('2026-11-28T09:24:42.000Z');
  const ticks = campaignTicks('2026-11-30T23:59:59.000Z', NOW)!;

  it('counts down to the second, in boxes of two digits', () => {
    expect(ticks).toEqual({ days: '02', hours: '14', minutes: '35', seconds: '17' });
    expect(campaignTicks('2026-11-28T09:24:42.000Z', NOW)).toBeNull();
    expect(campaignTicks('2026-11-01T00:00:00.000Z', NOW)).toBeNull();
    expect(campaignTicks('', NOW)).toBeNull();
    expect(campaignTicks(undefined, NOW)).toBeNull();
  });

  it('names the units the way the design does in each language', () => {
    // "02d 14h 35m 18s"; the Chinese edition names only the days: "02天 : 14 : 35 : 18"
    expect(campaignTickLabels(ticks, 'en')).toEqual(['02d', '14h', '35m', '17s']);
    expect(campaignTickLabels(ticks, 'zh-Hans')).toEqual(['02天', '14', '35', '17']);
    expect(campaignTickLabels(ticks, 'zh-Hant')).toEqual(['02天', '14', '35', '17']);
    expect(campaignTickLabels(ticks, 'ja')).toEqual(['02日', '14', '35', '17']);
    expect(campaignTickLabels(ticks, 'ko')).toEqual(['02일', '14', '35', '17']);
    expect(campaignTickLabels(ticks, 'fr')).toEqual(['02j', '14h', '35min', '17s']);
    expect(campaignTickLabels(ticks, 'de')).toEqual(['02T', '14h', '35min', '17s']);
    expect(campaignTickLabels(ticks, undefined)).toEqual(['02d', '14h', '35m', '17s']);
  });

  it('names the promotion’s days when the store wrote no window, the last day included', () => {
    expect(campaignWindowLabel('2026-11-27T00:00:00.000Z', '2026-12-01T00:00:00.000Z', 'en')).toBe('Nov 27 – Nov 30');
    expect(campaignWindowLabel('2026-11-27T00:00:00.000Z', '2026-12-01T00:00:00.000Z', 'zh-Hans')).toBe('11月27日 – 11月30日');
    expect(campaignWindowLabel('2026-11-27T00:00:00.000Z', '2026-12-01T00:00:00.000Z', 'de')).toBe('27. Nov. – 30. Nov.');
    // over the turn of the year the first day carries its year
    expect(campaignWindowLabel('2026-12-28T00:00:00.000Z', '2027-01-02T00:00:00.000Z', 'en')).toBe('Dec 28, 2026 – Jan 1');
    expect(campaignWindowLabel('2026-12-01T00:00:00.000Z', '2026-11-27T00:00:00.000Z', 'en')).toBeNull();
    expect(campaignWindowLabel('', '2026-12-01T00:00:00.000Z', 'en')).toBeNull();
  });

  it('takes the offer and the button from the promotion when the store wrote neither', () => {
    expect(campaignHighlight(sale(), 'en')).toBe('20% OFF');
    // Chinese names a discount the other way round
    expect(campaignHighlight(sale(), 'zh-Hans')).toBe('8 折');
    expect(campaignHighlight(sale({ discountValue: 15 }), 'zh-Hant')).toBe('8.5 折');
    expect(campaignHighlight(sale(), 'ja')).toBe('20% OFF');
    expect(campaignHighlight(sale(), 'ko')).toBe('20% 할인');
    expect(campaignHighlight(sale(), 'fr')).toBe('−20 %');
    expect(campaignHighlight(sale(), 'de')).toBe('20 % Rabatt');
    expect(campaignHighlight(sale({ discountType: 'fixed', discountValue: 5 }), 'en')).toBe('$5 OFF');
    expect(campaignHighlight(sale({ banner: { title: 'T', body: 'B', highlight: ' 15% OFF ' } }), 'en')).toBe('15% OFF');
    // a blank word is no word
    expect(campaignHighlight(sale({ banner: { title: 'T', body: 'B', highlight: '   ' } }), 'en')).toBe('20% OFF');

    expect(campaignCta(sale(), 'en')).toBe('Claim 20% OFF');
    expect(campaignCta(sale(), 'zh-Hans')).toBe('立即享受 8 折');
    expect(campaignCta(sale(), 'ja')).toBe('20% OFF を受け取る');
    expect(campaignCta(sale(), 'ko')).toBe('20% 할인 받기');
    expect(campaignCta(sale(), 'fr')).toBe('Obtenir −20 %');
    expect(campaignCta(sale(), 'de')).toBe('20 % Rabatt sichern');
    expect(campaignCta(sale({ discountType: 'fixed', discountValue: 5 }), 'en')).toBe('Claim $5 off');
    expect(campaignCta(sale({ banner: { title: 'T', body: 'B', cta: 'Shop the sale' } }), 'en')).toBe('Shop the sale');
  });

  it('falls back from the campaign’s words to the banner’s title and the promotion’s days', () => {
    const bare = sale();
    expect(campaignCopy(bare, 'en')).toEqual({
      badge: null, subject: 'Black Friday — 20% off BOKMOO cards', lead: null, highlight: '20% OFF',
      note: 'Nov 27 – Nov 30', cta: 'Claim 20% OFF', countdownLabel: 'Ends in:',
    });
    const written = campaignCopy(sale({ banner: { title: 'T', body: 'B', badge: '🔥 黑五限时礼遇', subject: 'BOKMOO 实体卡与蓝牙卡', lead: '立享', highlight: '8 折', note: '11.27 - 11.30', cta: '立即享受 8 折' } }), 'zh-Hans');
    expect(written).toEqual({
      badge: '🔥 黑五限时礼遇', subject: 'BOKMOO 实体卡与蓝牙卡', lead: '立享', highlight: '8 折', note: '11.27 - 11.30', cta: '立即享受 8 折', countdownLabel: '距结束仅剩',
    });
  });
});

describe('the campaign bar on the storefront', () => {
  const bar = (container: HTMLElement) => container.querySelector('[data-purpose="promo-bar"]');
  const ticksOf = (container: HTMLElement) => [...container.querySelectorAll('.bokmoo-campaign-tick')].map((node) => node.textContent);

  it('is drawn for a promotion whose template is the campaign bar, from the promotion’s words', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T09:24:42.000Z'));
    stubStorefront([CAMPAIGN]);
    const { container } = render(<PromoBar locale="en" />);
    await flush();

    expect(bar(container)?.getAttribute('data-template')).toBe('campaign');
    const page = text(container);
    for (const word of ['🔥 Black Friday Sale', 'Physical eSIM & Bluetooth Smart Card', '— Save up to', '15% OFF', 'Nov 27 – Nov 30', 'Ends in:', 'Claim 15% OFF']) {
      expect(page, word).toContain(word);
    }
    expect(container.querySelector('.bokmoo-campaign-highlight')?.textContent).toBe('15% OFF');
    expect(container.querySelector('.bokmoo-campaign-subject')?.textContent).toBe('Physical eSIM & Bluetooth Smart Card');
    expect(container.querySelector('.bokmoo-campaign-note')?.textContent).toBe('Nov 27 – Nov 30');
    expect(container.querySelector('.bokmoo-campaign-cta')?.getAttribute('href')).toBe('https://bokmoo.com/blackfriday');
    expect(ticksOf(container)).toEqual(['02d', '14h', '35m', '18s']);
    // the clock does not make a screen reader talk every second: the boxes are hidden from it, the timer is named
    expect(container.querySelector('.bokmoo-campaign-countdown')?.getAttribute('role')).toBe('timer');
    expect(container.querySelector('.bokmoo-campaign-countdown')?.getAttribute('aria-label')).toBe('Ends in: 02d : 14h : 35m : 18s');
  });

  it('ticks every second, and leaves out the countdown once the promotion is over', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-30T23:59:00.000Z'));
    stubStorefront([{ ...CAMPAIGN, endsAt: '2026-11-30T23:59:01.000Z', banner: { ...CAMPAIGN.banner, note: 'Last day' } }]);
    const { container } = render(<PromoBar locale="en" />);
    await flush();
    expect(ticksOf(container)).toEqual(['00d', '00h', '00m', '01s']);
    await act(async () => { await vi.advanceTimersByTime(1500); });
    // over: no boxes, the rest of the bar stays
    expect(container.querySelector('.bokmoo-campaign-countdown')).toBeNull();
    expect(text(container)).toContain('Claim 15% OFF');
    expect(text(container)).toContain('Last day');
  });

  it('says it all in the shopper’s language', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T09:24:42.000Z'));
    stubStorefront([{
      ...CAMPAIGN, endsAt: '2026-11-30T23:59:59.000Z',
      banner: {
        title: '黑五 8.5 折 · BOKMOO 实体卡', body: '结算时自动生效。', badge: '🔥 黑五限时礼遇', subject: 'BOKMOO 实体卡与蓝牙卡', lead: '立享', highlight: '8.5 折', cta: '立即享受 8.5 折',
      },
    }]);
    const { container } = render(<PromoBar locale="zh-Hans" />);
    await flush();
    const page = text(container);
    for (const word of ['🔥 黑五限时礼遇', 'BOKMOO 实体卡与蓝牙卡', '— 立享', '8.5 折', '11月27日 – 11月30日', '距结束仅剩', '立即享受 8.5 折']) expect(page, word).toContain(word);
    expect(ticksOf(container)).toEqual(['02天', '14', '35', '17']);
    expect(page).not.toMatch(/Black Friday Sale|Ends in|Claim/);
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
  });

  it('links to the products when the promotion has no rules page, and omits what the store left out', async () => {
    stubStorefront([{ ...CAMPAIGN, rulesUrl: null, banner: { title: 'Cards on offer', body: 'Body' } }]);
    const { container } = render(<PromoBar locale="en" />);
    await flush();
    // no badge, no lead: the title is the offer, followed by the discount
    expect(container.querySelector('.bokmoo-campaign-badge')).toBeNull();
    expect(container.querySelector('.bokmoo-campaign-lead')?.textContent).toBe('—');
    expect(text(container)).toContain('Cards on offer—15% OFF');
    expect(container.querySelector('.bokmoo-campaign-cta')?.getAttribute('href')).toBe('#products');
    expect(text(container)).toContain('Claim 15% OFF');
  });

  it('can be dismissed for the session, like the plain bar', async () => {
    stubStorefront([CAMPAIGN]);
    const { container, rerender } = render(<PromoBar locale="en" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(bar(container)).toBeNull();
    rerender(<PromoBar locale="en" />);
    await flush();
    expect(bar(container)).toBeNull();
    // the next campaign is a new bar: a dismissal is per promotion (the promotions answer is cached for a minute,
    // and a page only asks again when it loads)
    resetSaleCachesForTests();
    stubStorefront([{ ...CAMPAIGN, id: 'promo-cyber-monday', banner: { ...CAMPAIGN.banner, badge: '🔥 Cyber Monday' } }]);
    cleanup();
    const next = render(<PromoBar locale="en" />);
    await flush();
    expect(text(next.container)).toContain('🔥 Cyber Monday');
  });

  it('keeps the plain announcement bar for promotions without the template', async () => {
    const { bannerTemplate, ...plain } = CAMPAIGN;
    stubStorefront([plain as typeof CAMPAIGN]);
    const { container } = render(<PromoBar locale="en" />);
    await flush();
    expect(bar(container)?.getAttribute('data-template')).toBeNull();
    expect(container.querySelector('.bokmoo-campaign-bar')).toBeNull();
    expect(text(container)).toContain('-15%');
  });

  it('reads the template and the words from the public promotions answer', async () => {
    stubStorefront([CAMPAIGN]);
    const { container } = render(<PromoBar locale="en" />);
    await flush();
    expect(container.querySelector('.bokmoo-campaign-badge')?.textContent).toBe('🔥 Black Friday Sale');
    // a template that does not exist draws the plain bar
    resetSaleCachesForTests();
    stubStorefront([{ ...CAMPAIGN, bannerTemplate: 'fireworks' }]);
    cleanup();
    const other = render(<PromoBar locale="en" />);
    await flush();
    expect(other.container.querySelector('.bokmoo-campaign-bar')).toBeNull();
  });
});

describe('campaign bar stylesheet', () => {
  const BLOCK = /\/\* >>> Campaign bar[\s\S]*?\/\* <<< Campaign bar end \*\//;

  it('ships the same block in both stylesheets, styling every class the bar uses', () => {
    const blocks = ['src/tokens.css', 'theme-pack/tokens.css'].map((file) => BLOCK.exec(readFileSync(path.join(themeRoot, file), 'utf8'))?.[0]);
    expect(blocks[0]).toBeTruthy();
    expect(blocks[1]).toBe(blocks[0]);

    const used = new Set(readFileSync(path.join(themeRoot, 'src/components/CampaignPromoBar.tsx'), 'utf8').match(/bokmoo-campaign-[a-z-]+/g) ?? []);
    expect(used.size).toBeGreaterThan(15);
    for (const name of used) expect(blocks[0], `${name} is styled`).toMatch(new RegExp(`\\.${name}[\\s.{,:]`));
  });

  it('follows the design’s breakpoints: the window from 768px, the countdown from 1280px, one row from 640px', () => {
    const block = BLOCK.exec(readFileSync(path.join(themeRoot, 'src/tokens.css'), 'utf8'))?.[0] ?? '';
    expect(block).toMatch(/\.bokmoo-campaign-note \{\s*display: none;/);
    expect(block).toMatch(/@media \(min-width: 768px\)[\s\S]*?\.bokmoo-campaign-note \{\s*display: inline;/);
    expect(block).toMatch(/\.bokmoo-campaign-countdown \{\s*display: none;/);
    expect(block).toMatch(/@media \(min-width: 1280px\)\s*\{\s*\.bokmoo-campaign-countdown \{\s*display: inline-flex;/);
    expect(block).toMatch(/@media \(min-width: 640px\)\s*\{\s*\.bokmoo-campaign-bar-inner \{\s*flex-wrap: nowrap;/);
    // the design's own colours
    for (const colour of ['#0c0c0e', '#1a1711', '#e5c365', '#f2ca50', '#d4af37', '#1f1d18']) expect(block).toContain(colour);
    expect(block).toMatch(/prefers-reduced-motion/);
  });
});
