import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { getMessages } from 'shared/src/i18n';
import { I18nProvider } from 'shared/src/i18n/react';

// The dashboard's traffic overview: the figures of the last 30 days, the
// channels by their share of visits in the core's order, and a link into the
// Traffic report opened on the same days. Rendered on the server with the data
// hook replaced by a fixed answer.
const view = vi.hoisted(() => ({
  report: undefined as unknown,
  isError: false,
  daysAsked: undefined as unknown,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => React.createElement('a', { href }, children),
  };
});
vi.mock('@/lib/hooks/use-api', () => ({
  useTrafficReport: (days: number) => {
    view.daysAsked = days;
    return { data: view.report, isLoading: view.report === undefined && !view.isError, isFetching: false, isError: view.isError, refetch: vi.fn() };
  },
}));

import { TrafficOverviewCard } from '@/components/dashboard/overview/traffic-overview-card';
import type { TrafficChannel, TrafficReport } from '@/lib/api';

type Channel = TrafficReport['channels'][number];

const figures = (visits: number, views: number) => ({
  visitors: visits, visits, views, bounceRate: visits > 0 ? 0.4 : 0, avgVisitSeconds: 60,
});

const channels = (order: TrafficChannel[]): Channel[] => order.map((channel) => ({ channel, ...figures(0, 0) }));

const report = (byChannel: Partial<Record<TrafficChannel, number>>): TrafficReport => ({
  period: { from: '2026-10-31', to: '2026-11-29' },
  host: null,
  rulesVersion: 2,
  rulesUpdatedAt: null,
  collection: 'on',
  channels: channels(['paid', 'affiliate', 'ai', 'search', 'social', 'email', 'campaign', 'referral', 'direct']).map((entry) => ({
    ...entry,
    ...figures(byChannel[entry.channel] ?? 0, byChannel[entry.channel] ?? 0),
  })),
  summary: {
    visitors: 900,
    visits: Object.values(byChannel).reduce((sum, value) => sum + (value ?? 0), 0),
    views: 3000,
    bounceRate: 0.4,
    avgVisitSeconds: 60,
  },
  daily: [],
});

type Locale = 'en' | 'zh-Hans';

const render = (locale: Locale = 'en') => renderToString(
  <I18nProvider locale={locale} messages={getMessages(locale, 'tenant')}>
    <TrafficOverviewCard />
  </I18nProvider>,
);

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the dashboard traffic overview', () => {
  it('asks for the same thirty days as the figures beside it', () => {
    view.report = report({}); view.isError = false;
    render();
    expect(view.daysAsked).toBe(30);
  });

  it('shows the figures and the five largest channels by share of visits', () => {
    view.report = report({ search: 50, direct: 20, affiliate: 15, ai: 10, social: 4, email: 1 }); view.isError = false;
    const page = render();
    const shown = text(page);
    expect(shown).toContain('Traffic · Last 30 days');
    expect(shown).toContain('Visitors 900');
    expect(shown).toContain('Visits 100');
    expect(shown).toContain('Page views 3,000');
    for (const label of ['Organic search 50%', 'Direct 20%', 'Affiliate links 15%', 'AI assistants 10%', 'Social 4.0%']) expect(shown, label).toContain(label);
    // The sixth channel is left out.
    expect(shown).not.toContain('E-mail');
    expect(page).toContain('href="/en/analytics/traffic?range=30"');
    const order = ['Organic search', 'Direct', 'Affiliate links', 'AI assistants', 'Social'].map((label) => shown.indexOf(label));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('ties keep the order the core names the channels in', () => {
    view.report = report({ email: 5, social: 5, direct: 1 }); view.isError = false;
    const shown = text(render());
    expect(shown.indexOf('Social')).toBeLessThan(shown.indexOf('E-mail'));
    expect(shown).toContain('Social 45%');
    // A share under a tenth keeps a decimal, so it is never rounded away.
    expect(shown).toContain('Direct 9.1%');
  });

  it('says so when nobody came', () => {
    view.report = report({}); view.isError = false;
    expect(text(render())).toContain('No visits in the last 30 days yet.');
  });

  it('draws nothing while the plugin is not counting, or when the report cannot be read', () => {
    view.report = { ...report({ search: 3 }), collection: 'plugin-off' }; view.isError = false;
    expect(text(render()).trim()).toBe('');
    view.report = undefined; view.isError = true;
    expect(text(render()).trim()).toBe('');
  });

  it('reads as 简体中文 from the dictionary', () => {
    view.report = report({ search: 6, affiliate: 3 }); view.isError = false;
    const shown = text(render('zh-Hans'));
    for (const piece of ['流量概览 · 近 30 天', '访客 900', '访问次数 9', '页面浏览 3,000', '打开流量分析', '自然搜索', '联盟推广']) expect(shown, piece).toContain(piece);
    expect(page_has_english(shown)).toBe(false);
  });
});

function page_has_english(shown: string): boolean {
  return /Visitors|Visits|Page views|Open the traffic report|Organic search|Affiliate links/.test(shown);
}
