import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Storefront traffic collection on the self-hosted line, against a real
// PostgreSQL: the on/off switch, the origin and volume guards, how visits open
// and continue, the per-month visitor key, retention, the admin gate, channel
// rules, and the generic reports the admin page is built from. The scenarios
// mirror the native worker's traffic.test.ts; the two lines must agree.
const { pluginEnabled } = vi.hoisted(() => ({ pluginEnabled: { value: true } }));
vi.mock('@/core/admin/plugin-management/service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // In production this is a directory check; here it is a knob.
  isPluginEnabled: vi.fn(async () => pluginEnabled.value),
}));

// The API trusts the storefront origins in its CORS list. Pin the list before
// the environment module loads, so the test does not depend on the
// environment file of the machine it runs on.
vi.hoisted(() => {
  process.env.CORS_ORIGIN = 'https://shop.example.com,https://mall.example.com';
});

import { systemSettingsService } from '@/core/admin/system-settings/service';
import { TRAFFIC_SESSION_GAP_MS } from '@/core/traffic/traffic-core';
import { DEFAULT_TRAFFIC_RULES } from '@/core/traffic/traffic-default-rules';
import { pruneTraffic, resetTrafficCaches } from '@/core/traffic/service';
import { createAdminWithToken, createUserWithToken, deleteTestUser, type TestUser } from '../helpers/auth';
import { createTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';

const prisma = getTestPrisma();
const API = '/api/v1';
const SHOP = 'https://www.bokmoo.com';
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MINUTE = 60_000;
const T0 = Date.UTC(2026, 10, 24, 17, 0, 0); // 2026-11-24 17:00 UTC, already 11-25 in Beijing
const at = (offsetMs: number) => vi.setSystemTime(T0 + offsetMs);

const pageview = (overrides: Record<string, unknown> = {}) => ({ v: 1, h: 'www.bokmoo.com', p: '/en', ...overrides });
const from = (lastOctet: number) => ({ 'x-jiffoo-client-ip': `203.0.113.${lastOctet}` });

interface Sent { ip: string; userAgent: string }

let app: FastifyInstance;
let admin: { user: TestUser; token: string };
let shopper: { user: TestUser; token: string };

async function beacon(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: `${API}/traffic/collect`,
    headers: {
      'content-type': 'text/plain',
      origin: SHOP,
      'x-forwarded-host': 'www.bokmoo.com',
      'user-agent': CHROME,
      'x-jiffoo-client-ip': '203.0.113.9',
      ...headers,
    },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function send(visit: Sent, overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const response = await beacon(pageview(overrides), { 'x-jiffoo-client-ip': visit.ip, 'user-agent': visit.userAgent, ...headers });
  expect(response.statusCode).toBe(204);
  return response;
}

const config = () => app.inject({ method: 'GET', url: `${API}/traffic/config` });
const adminGet = (path: string, token = admin.token) => app.inject({ method: 'GET', url: `${API}/admin/traffic${path}`, headers: { authorization: `Bearer ${token}` } });
const adminPut = (body: unknown, token = admin.token) => app.inject({
  method: 'PUT',
  url: `${API}/admin/traffic/rules`,
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  payload: body as Record<string, unknown>,
});

interface StoredVisit {
  host: string; visitorKey: string; startedAt: bigint; lastSeenAt: bigint; views: number; landingPath: string;
  referrerHost: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  utmContent: string | null; utmTerm: string | null; clickIds: string | null; country: string | null; device: string;
}
const visits = async (): Promise<Array<Omit<StoredVisit, 'startedAt' | 'lastSeenAt'> & { startedAt: number; lastSeenAt: number }>> =>
  (await prisma.trafficSession.findMany({ orderBy: { startedAt: 'asc' } })).map((row) => ({ ...row, startedAt: Number(row.startedAt), lastSeenAt: Number(row.lastSeenAt) }));
const pages = () => prisma.trafficPageDaily.findMany({ orderBy: [{ day: 'asc' }, { path: 'asc' }] });

/** Eight visitors, one per channel plus one extra search visit on the other storefront host. */
async function seedVisits(): Promise<void> {
  // [minutes after T0, address, pageview overrides, user agent]
  const pageviews: Array<[number, string, Record<string, unknown>, string]> = [
    [0, '203.0.113.1', { r: 'https://chatgpt.com/c/abc' }, CHROME],
    [2, '203.0.113.1', { p: '/en/products/japan' }, CHROME],
    [60, '203.0.113.2', { r: 'https://www.google.co.uk/search?q=esim' }, CHROME],
    [120, '203.0.113.3', { r: 'https://m.facebook.com/', w: 390 }, IPHONE],
    [180, '203.0.113.4', { p: '/en?utm_source=NL&utm_medium=Newsletter&utm_campaign=BF-2026' }, CHROME],
    [240, '203.0.113.5', { p: '/en?utm_source=bing&utm_medium=cpc' }, CHROME],
    [300, '203.0.113.6', {}, CHROME],
    [360, '203.0.113.7', { r: 'https://news.example.org/story' }, CHROME],
    [420, '203.0.113.8', { h: 'esim.bokmoo.com', p: '/plans', r: 'https://www.baidu.com/s?wd=esim' }, IPHONE],
  ];
  for (const [minutes, ip, overrides, userAgent] of pageviews) {
    at(minutes * MINUTE);
    await send({ ip, userAgent }, overrides);
  }
  at(0);
}

const REPORT = '/report?from=20261124&to=20261125&tz=0';
const data = async (response: { json: () => Promise<Record<string, unknown>> }) => (await response.json()).data as Record<string, unknown>;

beforeAll(async () => {
  app = await createTestApp();
  admin = await createAdminWithToken();
  shopper = await createUserWithToken();
});

afterAll(async () => {
  await deleteTestUser(admin.user.id);
  await deleteTestUser(shopper.user.id);
  await app.close();
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(0);
  resetTrafficCaches();
  pluginEnabled.value = true;
  vi.spyOn(systemSettingsService, 'getBoolean').mockResolvedValue(true);
  await prisma.$transaction([prisma.trafficSession.deleteMany(), prisma.trafficPageDaily.deleteMany(), prisma.trafficChannelRules.deleteMany()]);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('traffic on the self-hosted line: the switch', () => {
  it('is off until the Traffic Analytics plugin is installed', async () => {
    pluginEnabled.value = false;
    expect((await config()).json()).toEqual({ success: true, data: { enabled: false } });
    expect((await beacon(pageview())).statusCode).toBe(204);
    expect(await visits()).toEqual([]);
  });

  it('is on once the plugin is enabled, unless the merchant paused it', async () => {
    expect((await config()).json()).toEqual({ success: true, data: { enabled: true } });
    resetTrafficCaches();
    vi.mocked(systemSettingsService.getBoolean).mockResolvedValue(false);
    expect(await (await config()).json()).toMatchObject({ data: { enabled: false } });
    expect((await beacon(pageview())).statusCode).toBe(204);
    expect(await visits()).toEqual([]);
  });
});

describe('traffic on the self-hosted line: what a beacon must look like', () => {
  it('needs the storefront origin, and it must match the proxy that forwarded it', async () => {
    expect((await beacon(pageview(), { origin: '' })).statusCode).toBe(403);
    expect((await beacon(pageview(), { 'sec-fetch-site': 'cross-site' })).statusCode).toBe(403);
    expect((await beacon(pageview(), { 'x-forwarded-host': 'evil.example' })).statusCode).toBe(403);
    // A storefront the API already serves across origins is trusted by its origin alone, wherever on the list it is.
    for (const trustedOrigin of ['https://shop.example.com', 'https://mall.example.com']) {
      expect((await beacon(pageview(), { origin: trustedOrigin, 'x-forwarded-host': '', 'sec-fetch-site': 'cross-site' })).statusCode).toBe(204);
    }
    // A storefront on another site that is not on the list is not.
    expect((await beacon(pageview(), { origin: 'https://stranger.example', 'x-forwarded-host': '', 'sec-fetch-site': 'cross-site' })).statusCode).toBe(403);
    resetTrafficCaches();
    await prisma.trafficSession.deleteMany();
    // A storefront that calls the API directly is trusted by its origin alone.
    expect((await beacon(pageview(), { 'x-forwarded-host': '' })).statusCode).toBe(204);
    expect(await visits()).toHaveLength(1);
  });

  it('is dropped silently for machines', async () => {
    for (const userAgent of [
      'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'curl/8.4.0',
      '',
    ]) {
      expect((await beacon(pageview(), { 'user-agent': userAgent })).statusCode).toBe(204);
    }
    expect(await visits()).toEqual([]);
  });

  it('is refused when it is not a pageview', async () => {
    expect((await beacon('not json')).statusCode).toBe(400);
    expect((await beacon({ v: 1, h: 'www.bokmoo.com' })).statusCode).toBe(400);
    expect((await beacon(pageview({ p: 'en' }))).statusCode).toBe(400);
    expect((await beacon('x'.repeat(5000))).statusCode).toBe(413);
    expect(await visits()).toEqual([]);
  });

  it('is limited by volume per address', async () => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      expect((await beacon(pageview(), from(1))).statusCode).toBe(204);
    }
    expect((await beacon(pageview(), from(1))).statusCode).toBe(429);
    expect((await beacon(pageview(), from(2))).statusCode).toBe(204);
  }, 60_000);
});

describe('traffic on the self-hosted line: visits', () => {
  it('opens a visit with the fields that say where it came from', async () => {
    await send(
      { ip: '203.0.113.7', userAgent: IPHONE },
      {
        p: '/en/products/japan?utm_source=chatgpt.com&utm_medium=ref&utm_campaign=bf&gclid=1&fbclid=x&not-a-known-param=1#reviews',
        r: 'https://www.chatgpt.com/c/abc',
        w: 390,
        z: 480,
      },
      { 'x-jiffoo-client-country': 'cn' },
    );

    const [visit] = await visits();
    expect(visit).toMatchObject({
      host: 'www.bokmoo.com',
      startedAt: T0,
      lastSeenAt: T0,
      views: 1,
      landingPath: '/en/products/japan',
      referrerHost: 'chatgpt.com',
      utmSource: 'chatgpt.com',
      utmMedium: 'ref',
      utmCampaign: 'bf',
      utmContent: null,
      utmTerm: null,
      clickIds: 'gclid,fbclid',
      country: 'CN',
      device: 'mobile',
    });
    expect(visit?.visitorKey).toMatch(/^[0-9a-f]{32}$/);
    // The viewer's zone decides which day a page view belongs to.
    expect(await pages()).toEqual([{ day: 20261125, host: 'www.bokmoo.com', path: '/en/products/japan', views: 1 }]);
  });

  it('continues a visit while the visitor keeps browsing, then opens a new one', async () => {
    const visitor = { ip: '203.0.113.1', userAgent: CHROME };
    await send(visitor, { r: 'https://www.google.com/' });
    at(10 * MINUTE);
    await send(visitor, { p: '/en/cart' });
    let stored = await visits();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ views: 2, startedAt: T0, lastSeenAt: T0 + 10 * MINUTE });
    expect(await pages()).toEqual([
      { day: 20261124, host: 'www.bokmoo.com', path: '/en', views: 1 },
      { day: 20261124, host: 'www.bokmoo.com', path: '/en/cart', views: 1 },
    ]);

    at(10 * MINUTE + TRAFFIC_SESSION_GAP_MS + 1);
    await send(visitor, { p: '/en/cart' });
    stored = await visits();
    expect(stored).toHaveLength(2);
    // The later page views of a visit never overwrite where it came from.
    expect(stored[1]).toMatchObject({ views: 1, landingPath: '/en/cart', referrerHost: null });
    expect((await pages())[1]).toMatchObject({ path: '/en/cart', views: 2 });
  });

  it('tells visitors apart by address and browser', async () => {
    await send({ ip: '203.0.113.1', userAgent: CHROME });
    await send({ ip: '203.0.113.2', userAgent: CHROME });
    await send({ ip: '203.0.113.1', userAgent: IPHONE });
    expect(new Set((await visits()).map((visit) => visit.visitorKey)).size).toBe(3);
  });

  it('gives a visitor a new key every month', async () => {
    const visitor = { ip: '203.0.113.1', userAgent: CHROME };
    vi.setSystemTime(Date.UTC(2026, 10, 30, 23, 50));
    await send(visitor);
    vi.setSystemTime(Date.UTC(2026, 11, 1, 0, 5)); // fifteen minutes later, new month
    await send(visitor);
    expect(await visits()).toHaveLength(2);
  });

  it('does not record the site itself as a source', async () => {
    await send({ ip: '203.0.113.1', userAgent: CHROME }, { r: 'https://esim.bokmoo.com/plans' });
    await send({ ip: '203.0.113.2', userAgent: CHROME }, { r: 'android-app://com.google.android.googlequicksearchbox/https/www.google.com' });
    expect((await visits()).map((visit) => visit.referrerHost)).toEqual([null, 'google.com']);
  });
});

describe('traffic on the self-hosted line: retention and admin gate', () => {
  it('drops visits and per-day rows older than the retention window', async () => {
    await send({ ip: '203.0.113.1', userAgent: CHROME });
    const cutoff = T0 + 401 * 24 * 60 * MINUTE;
    vi.setSystemTime(cutoff + MINUTE);
    await send({ ip: '203.0.113.2', userAgent: CHROME });

    expect(await pruneTraffic()).toEqual({ sessions: 1, days: 1 });
    expect((await visits()).map((visit) => visit.startedAt)).toEqual([cutoff + MINUTE]);
    expect(await pages()).toHaveLength(1);
    expect(await pruneTraffic()).toEqual({ sessions: 0, days: 0 });
  });

  it('refuses reports and rules without an administrator', async () => {
    expect((await adminGet(REPORT, '')).statusCode).toBe(401);
    expect((await adminGet('/rules', '')).statusCode).toBe(401);
    expect((await adminGet(REPORT, shopper.token)).statusCode).toBe(403);
    expect((await adminPut(DEFAULT_TRAFFIC_RULES, shopper.token)).statusCode).toBe(403);
  });
});

describe('traffic on the self-hosted line: channel rules', () => {
  it('starts from the built-in lists', async () => {
    const reply = await adminGet('/rules');
    expect(reply.statusCode).toBe(200);
    expect(await data(reply)).toMatchObject({ rules: DEFAULT_TRAFFIC_RULES, updatedAt: null });
  });

  it('stores a valid document and refuses anything else', async () => {
    expect((await adminPut({ ...DEFAULT_TRAFFIC_RULES, version: 0 })).statusCode).toBe(400);
    expect((await adminPut({ ...DEFAULT_TRAFFIC_RULES, ai: ['not a host'] })).statusCode).toBe(400);
    expect((await adminPut({ ai: ['chatgpt.com'] })).statusCode).toBe(400);

    const replaced = await adminPut({ ...DEFAULT_TRAFFIC_RULES, version: 2, ai: [...DEFAULT_TRAFFIC_RULES.ai, 'news.example.org'] });
    expect(replaced.statusCode).toBe(200);
    const stored = await data(await adminGet('/rules'));
    expect(stored.rules).toMatchObject({ version: 2 });
    expect((stored.rules as { ai: string[] }).ai).toContain('news.example.org');
    expect(typeof stored.updatedAt).toBe('string');
  });
});

describe('traffic on the self-hosted line: reports', () => {
  beforeEach(async () => {
    await seedVisits();
  });

  it('sums the period and names the channel of every visit', async () => {
    const reply = await data(await adminGet(REPORT));
    expect(reply.period).toEqual({ from: '2026-11-24', to: '2026-11-25' });
    expect(reply.summary).toEqual({ visitors: 8, visits: 8, views: 9, bounceRate: 0.875, avgVisitSeconds: 15 });
    expect(reply.daily).toEqual([
      { day: '2026-11-24', visitors: 7, visits: 7, views: 8 },
      { day: '2026-11-25', visitors: 1, visits: 1, views: 1 },
    ]);
    const channels = reply.channels as Array<Record<string, unknown>>;
    expect(channels.map((channel) => channel.channel)).toEqual(['paid', 'ai', 'search', 'social', 'email', 'campaign', 'referral', 'direct']);
    const byChannel = Object.fromEntries(channels.map((channel) => [channel.channel, channel]));
    expect(byChannel.ai).toMatchObject({ visitors: 1, visits: 1, views: 2, bounceRate: 0, avgVisitSeconds: 120 });
    expect(byChannel.search).toMatchObject({ visitors: 2, visits: 2, views: 2, bounceRate: 1, avgVisitSeconds: 0 });
    expect(byChannel.social).toMatchObject({ visits: 1, bounceRate: 1 });
    expect(byChannel.email).toMatchObject({ visits: 1 });
    expect(byChannel.paid).toMatchObject({ visits: 1 });
    expect(byChannel.referral).toMatchObject({ visits: 1 });
    expect(byChannel.direct).toMatchObject({ visits: 1 });
    expect(byChannel.campaign).toMatchObject({ visits: 0, bounceRate: 0 });
    expect(reply).toMatchObject({ rulesVersion: 1, rulesUpdatedAt: null, host: null });
  });

  it('counts a day in the viewer’s zone and can narrow to one storefront host', async () => {
    const beijing = await data(await adminGet('/report?from=2026-11-25&to=2026-11-25&tz=480'));
    expect(beijing.daily).toEqual([{ day: '2026-11-25', visitors: 8, visits: 8, views: 9 }]);
    const esim = await data(await adminGet(`${REPORT}&host=esim.bokmoo.com`));
    expect(esim.summary).toMatchObject({ visitors: 1, visits: 1, views: 1 });
    expect(esim.host).toBe('esim.bokmoo.com');
  });

  it('shows an empty period', async () => {
    const reply = await data(await adminGet('/report?from=20260101&to=20260103'));
    expect(reply.summary).toEqual({ visitors: 0, visits: 0, views: 0, bounceRate: 0, avgVisitSeconds: 0 });
    expect(reply.daily).toEqual([
      { day: '2026-01-01', visitors: 0, visits: 0, views: 0 },
      { day: '2026-01-02', visitors: 0, visits: 0, views: 0 },
      { day: '2026-01-03', visitors: 0, visits: 0, views: 0 },
    ]);
  });

  it('breaks visits down by any acquisition dimension', async () => {
    const referrers = await data(await adminGet(`/breakdown?dim=referrer&from=20261124&to=20261125`));
    expect(referrers).toMatchObject({ dimension: 'referrer', channel: null, total: 5 });
    expect(referrers.rows).toEqual([
      { value: 'chatgpt.com', channel: 'ai', visitors: 1, visits: 1, views: 2, bounceRate: 0, avgVisitSeconds: 120 },
      { value: 'baidu.com', channel: 'search', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: 'google.co.uk', channel: 'search', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: 'm.facebook.com', channel: 'social', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: 'news.example.org', channel: 'referral', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
    ]);

    const sources = await data(await adminGet(`/breakdown?dim=source&from=20261124&to=20261125`));
    expect((sources.rows as Array<{ value: string }>).map((row) => row.value)).toEqual([
      'chatgpt.com', 'baidu.com', 'bing', 'google.co.uk', 'm.facebook.com', 'news.example.org', 'nl',
    ]);

    const landing = await data(await adminGet(`/breakdown?dim=landing&from=20261124&to=20261125`));
    expect(landing.rows).toEqual([
      { value: '/en', channel: null, visitors: 7, visits: 7, views: 8, bounceRate: 0.8571, avgVisitSeconds: 17 },
      { value: '/plans', channel: 'search', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
    ]);

    const pageViews = await data(await adminGet(`/breakdown?dim=page&from=20261124&to=20261125`));
    expect(pageViews).toMatchObject({ dimension: 'page', channel: null, total: 3 });
    expect(pageViews.rows).toEqual([
      { value: '/en', views: 7 },
      { value: '/en/products/japan', views: 1 },
      { value: '/plans', views: 1 },
    ]);
  });

  it('filters a breakdown to one channel and pages through it', async () => {
    const search = await data(await adminGet(`/breakdown?dim=referrer&channel=search&from=20261124&to=20261125`));
    expect(search).toMatchObject({ channel: 'search', total: 2 });
    expect((search.rows as Array<{ value: string }>).map((row) => row.value)).toEqual(['baidu.com', 'google.co.uk']);

    const ai = await data(await adminGet(`/breakdown?dim=landing&channel=ai&from=20261124&to=20261125`));
    expect(ai.rows).toEqual([{ value: '/en', channel: 'ai', visitors: 1, visits: 1, views: 2, bounceRate: 0, avgVisitSeconds: 120 }]);

    const page = await data(await adminGet(`/breakdown?dim=source&from=20261124&to=20261125&limit=2&offset=1`));
    expect(page).toMatchObject({ total: 7 });
    expect((page.rows as Array<{ value: string }>).map((row) => row.value)).toEqual(['baidu.com', 'bing']);
  });

  it('refuses queries it cannot answer', async () => {
    expect((await adminGet('/report?from=20261125&to=20261124')).statusCode).toBe(400);
    expect((await adminGet('/report?from=20260231&to=20260301')).statusCode).toBe(400);
    expect((await adminGet(`${REPORT}&host=not+a+host`)).statusCode).toBe(400);
    expect((await adminGet('/breakdown?dim=nothing&from=20261124&to=20261125')).statusCode).toBe(400);
    expect((await adminGet(`/breakdown?dim=referrer&channel=nothing&from=20261124&to=20261125`)).statusCode).toBe(400);
  });

  it('reclassifies history when the rules change', async () => {
    expect((await adminPut({ ...DEFAULT_TRAFFIC_RULES, version: 2, ai: [...DEFAULT_TRAFFIC_RULES.ai, 'news.example.org'] })).statusCode).toBe(200);

    const reply = await data(await adminGet(REPORT));
    const channels = Object.fromEntries((reply.channels as Array<Record<string, unknown>>).map((channel) => [channel.channel, channel]));
    expect(channels.ai).toMatchObject({ visits: 2 });
    expect(channels.referral).toMatchObject({ visits: 0 });
    expect(reply).toMatchObject({ rulesVersion: 2 });
  });
});
