import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('@/hooks/use-localized-navigation', () => ({
  useLocalizedNavigation: () => ({ locale: state.locale, getHref: (route: string) => `/${state.locale}${route}` }),
}));

import BlackFridayPageClient from '@/app/[locale]/blackfriday/BlackFridayPageClient';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The page promises a sale; these were the promises of the previous campaign,
// which the store no longer runs.
const WITHDRAWN = ['raffle', 'gold pin', '抽奖', '抽獎', '純金', '纯金', 'No purchase necessary', '免购入', '免購入'];

const HEADLINES: Array<[string, string]> = [
  ['en', '20% off BOKMOO cards, and more off with a creator code'],
  ['zh-Hans', 'BOKMOO 实体卡 8 折，凭创作者折扣码还可再优惠'],
  ['zh-Hant', 'BOKMOO 實體卡 8 折，憑創作者折扣碼還可再優惠'],
  ['zh-HK', 'BOKMOO 實體卡 8 折，憑創作者折扣碼還可再優惠'],
  ['ja', 'BOKMOOカードが20%オフ、クリエイターコードでさらに割引'],
  ['ko', 'BOKMOO 카드 20% 할인, 크리에이터 코드로 추가 할인'],
  ['fr', '20 % de réduction sur les cartes BOKMOO, et davantage avec un code créateur'],
  ['de', '20 % Rabatt auf BOKMOO-Karten, mit Creator-Code noch mehr'],
];

describe('Black Friday 2026 page', () => {
  it.each(HEADLINES)('speaks %s and makes no promise the store withdrew', (locale, headline) => {
    state.locale = locale;
    const { container } = render(<BlackFridayPageClient />);
    const text = container.textContent ?? '';

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(headline);
    for (const withdrawn of WITHDRAWN) expect(text, `must not mention "${withdrawn}"`).not.toContain(withdrawn);
    // both cards, both prices, the automatic discount and the creator-code extra
    expect(text).toMatch(/(?:\$16|16\s*\$)/);
    expect(text).toMatch(/(?:\$32|32\s*\$)/);
    expect(text).toContain('support@bokmoo.com');
    // the catalog listing only shows eSIM plans, so this page is the way in to the cards
    expect(screen.getByRole('link', { name: /Black Friday deal|黑五价|黑五價|セールを見る|세일 보기|Black Friday|Angebot/ }).getAttribute('href')).toBe('#bf-cards');
    expect(screen.getByRole('link', { name: /BOKMOO Card/ }).getAttribute('href')).toBe(`/${locale}/products/odoo-product-6`);
    expect(screen.getByRole('link', { name: /Bluetooth Card/ }).getAttribute('href')).toBe(`/${locale}/products/odoo-product-7`);
  });

  it('does not send the withdrawn promises through search engines either', () => {
    const source = readFileSync(path.resolve(__dirname, '../lib/seo/public-page-metadata.ts'), 'utf8');
    const block = source.slice(source.indexOf('blackfriday: {'), source.indexOf('home: {'));
    expect(block).toContain('20% off BOKMOO cards');
    for (const withdrawn of WITHDRAWN) expect(block, `metadata must not mention "${withdrawn}"`).not.toContain(withdrawn);
  });
});
