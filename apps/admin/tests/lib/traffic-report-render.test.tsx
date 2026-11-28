import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getMessages } from 'shared/src/i18n';
import { I18nProvider } from 'shared/src/i18n/react';

// The traffic report renders what the core's report and breakdown endpoints
// answer — figures, channels, search beside AI, sources, the pause switch —
// without throwing, from the real dictionary in English and in both Chinese
// scripts, and says something sensible when there is nothing to show.
// Rendered on the server with the data hooks replaced by fixed answers.
const view = vi.hoisted(() => ({
  report: undefined as unknown,
  reportError: false,
  breakdowns: {} as Record<string, unknown>,
  paused: false,
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/analytics/traffic' }));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => React.createElement('a', { href }, children),
  };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/hooks/use-api', () => {
  const answer = (data: unknown, error = false) => ({
    data,
    isLoading: data === undefined && !error,
    isFetching: false,
    isError: error,
    refetch: vi.fn(),
  });
  return {
    useTrafficReport: () => answer(view.report, view.reportError),
    useTrafficBreakdown: (dimension: string) => answer(view.breakdowns[dimension]),
    useTrafficCollectionPaused: () => ({
      paused: answer(view.paused),
      setPaused: { mutate: vi.fn(), isPending: false },
    }),
  };
});

import TrafficPage from '@/app/[locale]/analytics/traffic/page';
import { TRAFFIC_CHANNELS, type TrafficChannel, type TrafficReport } from '@/lib/api';

type Channel = TrafficReport['channels'][number];

const figures = (visits: number, views: number, bounced = visits, seconds = 0) => ({
  visitors: visits,
  visits,
  views,
  bounceRate: visits > 0 ? Number((bounced / visits).toFixed(4)) : 0,
  avgVisitSeconds: seconds,
});

const report: TrafficReport = {
  period: { from: '2026-11-22', to: '2026-11-28' },
  host: null,
  rulesVersion: 1,
  rulesUpdatedAt: null,
  collection: 'on',
  summary: { visitors: 120, visits: 148, views: 431, bounceRate: 0.46, avgVisitSeconds: 95 },
  daily: Array.from({ length: 7 }, (_, index) => ({ day: `2026-11-${22 + index}`, visitors: 17, visits: 21, views: 61 })),
  channels: [
    { channel: 'paid', ...figures(4, 9, 1, 80) },
  { channel: 'affiliate', ...figures(3, 6, 1, 70) },
    { channel: 'ai', ...figures(9, 31, 2, 210) },
    { channel: 'search', ...figures(61, 190, 26, 120) },
    { channel: 'social', ...figures(12, 20, 8, 40) },
    { channel: 'email', ...figures(7, 30, 1, 200) },
    { channel: 'campaign', ...figures(0, 0) },
    { channel: 'referral', ...figures(15, 40, 5, 90) },
    { channel: 'direct', ...figures(40, 111, 25, 45) },
  ] as Channel[],
};

const rows = (...items: Array<[string, TrafficChannel | null, number, number]>) =>
  items.map(([value, channel, visits, views]) => ({ value, channel, ...figures(visits, views, 1, 30) }));

const breakdown = (dimension: string, values: unknown[]) => ({
  dimension, period: report.period, host: null, channel: null, total: values.length, rows: values,
});

const populate = () => {
  view.report = report;
  view.reportError = false;
  view.paused = false;
  view.breakdowns = {
    host: breakdown('host', rows(['www.bokmoo.com', null, 140, 420], ['esim.bokmoo.com', null, 8, 11])),
    source: breakdown('source', rows(['chatgpt.com', 'ai', 9, 31], ['google.co.uk', 'search', 40, 130], ['nl', 'email', 7, 30])),
    referrer: breakdown('referrer', rows(
      ['chatgpt.com', 'ai', 6, 22], ['perplexity.ai', 'ai', 3, 9],
      ['google.co.uk', 'search', 40, 130], ['www.baidu.com', 'search', 21, 60],
    )),
  };
};

type Locale = 'en' | 'zh-Hans' | 'zh-Hant';

const render = (locale: Locale) => renderToString(
  <I18nProvider locale={locale} messages={getMessages(locale, 'tenant')}>
    <QueryClientProvider client={new QueryClient()}>
      <TrafficPage />
    </QueryClientProvider>
  </I18nProvider>,
).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const expectEach = (text: string, expected: string[]) => {
  for (const fragment of expected) expect(text, fragment).toContain(fragment);
};

// Every channel the core names has its row, in the core's order. The
// search-or-AI card above the table uses some of the same labels, so the
// order is read inside the table alone.
const channelNames: Record<Locale, Record<TrafficChannel, string>> = {
  en: { paid: 'Paid', affiliate: 'Affiliate links', ai: 'AI assistants', search: 'Organic search', social: 'Social', email: 'E-mail', campaign: 'Tagged campaigns', referral: 'Referrals', direct: 'Direct' },
  'zh-Hans': { paid: '付费推广', affiliate: '联盟推广', ai: 'AI 助手', search: '自然搜索', social: '社交', email: '邮件', campaign: '标记活动', referral: '引荐链接', direct: '直接访问' },
  'zh-Hant': { paid: '付費推廣', affiliate: '聯盟推廣', ai: 'AI 助手', search: '自然搜尋', social: '社交', email: '郵件', campaign: '標記活動', referral: '引薦連結', direct: '直接訪問' },
};

function expectChannelsInCoreOrder(text: string, locale: Locale, header: string, next: string) {
  const table = text.slice(text.indexOf(header), text.indexOf(next, text.indexOf(header)));
  const positions = TRAFFIC_CHANNELS.map((channel) => table.indexOf(channelNames[locale][channel]));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
}

describe('the traffic report', () => {
  it('renders the figures, every channel, search beside AI and the sources', () => {
    populate();
    const text = render('en');
    expectEach(text, [
      '2026-11-22 – 2026-11-28',
      'Visitors 120', 'Visits 148', 'Page views 431', 'Bounce rate 46.0%',
      'Avg. visit time 2min',
      'Search or AI', 'Organic search (SEO)', 'AI assistants (GEO)',
      'Search engines', 'google.co.uk', 'www.baidu.com',
      'AI assistants', 'chatgpt.com', 'perplexity.ai',
      'AI traffic is a floor, not a total',
      'Sources', 'nl',
      'All storefronts', 'esim.bokmoo.com',
      'Pause collection', 'Nothing personal is stored', 'Channel lists v 1',
    ]);
    expectChannelsInCoreOrder(text, 'en', 'Channels Visitors Visits Page views Share', 'Sources');
  });

  it('says so when the range has no visits yet', () => {
    populate();
    view.report = {
      ...report,
      summary: { visitors: 0, visits: 0, views: 0, bounceRate: 0, avgVisitSeconds: 0 },
      channels: report.channels.map((channel) => ({ ...channel, ...figures(0, 0) })) as Channel[],
    };
    const text = render('en');
    expect(text).toContain('No visits recorded in this range yet');
    expect(text).not.toContain('Search or AI');
    expect(text).not.toContain('Sources');
  });

  it('shows that collection is paused', () => {
    populate();
    view.paused = true;
    const text = render('en');
    expect(text).toContain('Collection is paused');
    expect(text).toContain('Resume collection');
  });

  it('says why nothing is counted while the plugin is off, and offers no pause button then', () => {
    populate();
    view.report = { ...report, collection: 'plugin-off' };
    const text = render('en');
    expect(text).toContain('the Traffic Analytics plugin is not installed or enabled');
    expect(text).not.toContain('Pause collection');
    expect(text).not.toContain('Collection is paused');
  });

  it('tells the merchant when the reports cannot be read', () => {
    populate();
    view.report = undefined;
    view.reportError = true;
    expect(render('en')).toContain('Traffic reports are not available right now');
  });

  it('reads as 简体中文 from the dictionary', () => {
    populate();
    const text = render('zh-Hans');
    expectEach(text, [
      '流量分析', '店面的访问从哪里来', '访客', '访问次数', '页面浏览', '跳出率', '搜索还是 AI',
      '自然搜索（SEO）', 'AI 助手（GEO）', '搜索引擎', '来源明细', '暂停统计', '不保存任何个人信息', '渠道名单',
    ]);
    expectChannelsInCoreOrder(text, 'zh-Hans', '渠道 访客 访问次数 页面浏览 占比', '来源明细');
  });

  it('reads as 繁體中文 from the dictionary', () => {
    populate();
    const text = render('zh-Hant');
    expectEach(text, ['流量分析', '店面的訪問從哪裡來', '訪問次數', '頁面瀏覽', '跳出率', '搜尋還是 AI', '自然搜尋（SEO）', '來源明細', '暫停統計']);
  });
});
