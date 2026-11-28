import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Storefront traffic collection (migration 0089) on a real SQLite engine: the
// on/off switch, the origin and volume guards, how visits open and continue,
// the per-month visitor key, retention, the admin gate, channel rules, and the
// generic reports an analytics UI is built from.
const { authenticateNativeAdmin, getNativeJwtSecret } = vi.hoisted(() => ({
  authenticateNativeAdmin: vi.fn(),
  getNativeJwtSecret: vi.fn(),
}));
vi.mock('./auth', () => ({ authenticateNativeAdmin, getNativeJwtSecret }));

import { TRAFFIC_SESSION_GAP_MS, TRAFFIC_CHANNELS } from './traffic-core';
import { DEFAULT_TRAFFIC_RULES } from './traffic-default-rules';
import { pruneNativeTraffic, resetNativeTrafficCaches, tryNativeTraffic } from './traffic';

const migrations = resolve(import.meta.dirname, '../migrations');
// The schema marker, core tables, plugin instances, system settings, the admin
// membership tables, then this module's own tables.
const SCHEMA = [
  '0001_native_platform.sql',
  '0002_native_core.sql',
  '0003_native_auth.sql',
  '0020_native_plugin_settings.sql',
  '0057_native_settings.sql',
  '0058_native_admin_staff.sql',
  '0089_native_traffic.sql',
];

interface Statement { sql: string; args: unknown[] }

// Minimal faithful D1 surface over node:sqlite. A batch is one transaction,
// like on D1, and reports per-statement changes.
function d1(sqlite: DatabaseSync) {
  const changes = (sql: string, args: unknown[]) => Number(sqlite.prepare(sql).run(...(args as never[])).changes);
  const execute = (bound: Statement) => ({
    sql: bound.sql, args: bound.args,
    first: async <T,>() => (sqlite.prepare(bound.sql).get(...(bound.args as never[])) ?? null) as T | null,
    all: async <T,>() => ({ results: sqlite.prepare(bound.sql).all(...(bound.args as never[])) as T[] }),
    run: async () => ({ success: true, results: [], meta: { changes: changes(bound.sql, bound.args) } }),
  });
  const prepare = (sql: string) => {
    const base = execute({ sql, args: [] });
    return { ...base, bind: (...args: unknown[]) => execute({ sql, args }) };
  };
  return {
    prepare,
    batch: async (statements: Statement[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => ({ success: true, results: [], meta: { changes: changes(statement.sql, statement.args) } }));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

type Harness = { sqlite: DatabaseSync; DB: ReturnType<typeof d1>; env: { DB: unknown } };

function open(options: { installed?: boolean; switchedOff?: boolean } = {}): Harness {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of SCHEMA) sqlite.exec(readFileSync(resolve(migrations, file), 'utf8'));
  if (options.installed !== false) {
    sqlite.prepare(`INSERT INTO native_plugin_instances
      (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, created_at, updated_at)
      VALUES ('pi-traffic', 'traffic-analytics', 'default', 1, '{}', '{}', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z')`).run();
  }
  if (options.switchedOff) {
    // The migration already seeds the `system` row; replace its settings.
    sqlite.prepare(`INSERT OR REPLACE INTO native_settings (id, settings, updated_at)
      VALUES ('system', '{"traffic.collection.enabled":false}', '2026-11-01T00:00:00.000Z')`).run();
  }
  const DB = d1(sqlite);
  return { sqlite, DB, env: { DB } };
}

interface Reply { success: boolean; data?: Record<string, unknown>; error?: { code: string } }
const json = async (response: Response | null): Promise<Reply> => {
  if (!response) throw new Error('expected a response');
  return (await response.json()) as Reply;
};

const API = 'https://api.bokmoo.example';
const SHOP = 'https://www.bokmoo.com';
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** An empty header value means "leave this header out". */
const beacon = (body: unknown, headers: Record<string, string> = {}) => {
  const merged: Record<string, string> = {
    'content-type': 'text/plain',
    origin: SHOP,
    'x-forwarded-host': 'www.bokmoo.com',
    'user-agent': CHROME,
    ...headers,
  };
  const sent = new Headers();
  for (const [name, value] of Object.entries(merged)) if (value !== '') sent.set(name, value);
  return new Request(`${API}/api/v1/traffic/collect`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: sent,
  });
};
const pageview = (overrides: Record<string, unknown> = {}) => ({ v: 1, h: 'www.bokmoo.com', p: '/en', ...overrides });
const from = (lastOctet: number) => ({ 'x-jiffoo-client-ip': `203.0.113.${lastOctet}` });
const config = () => new Request(`${API}/api/v1/traffic/config`);
const admin = (h: Harness, path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('authorization', 'Bearer admin');
  return tryNativeTraffic(new Request(`${API}/api/v1/admin/traffic${path}`, { ...init, headers }), h.env as never);
};
const collect = (h: Harness, body: unknown, headers: Record<string, string> = {}) =>
  tryNativeTraffic(beacon(body, headers), h.env as never);

const sessions = (h: Harness) => h.sqlite.prepare(
  `SELECT host, visitor_key, started_at, last_seen_at, views, landing_path, referrer_host, utm_source, utm_medium,
          utm_campaign, utm_content, utm_term, click_ids, country, device
   FROM native_traffic_sessions ORDER BY started_at`,
).all() as Record<string, unknown>[];
const pages = (h: Harness) => h.sqlite.prepare(
  'SELECT day, host, path, views FROM native_traffic_page_daily ORDER BY day, path',
).all() as Record<string, unknown>[];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const T0 = Date.UTC(2026, 10, 24, 17, 0, 0); // 2026-11-24 17:00 UTC, already 11-25 in Beijing
const at = (offsetMs: number) => vi.setSystemTime(T0 + offsetMs);

function addMembership(h: Harness, role: string) {
  h.sqlite.prepare(`INSERT INTO native_users (id, email, username, role, password_salt, password_hash, updated_at)
    VALUES ('u-admin', 'admin@example.com', 'admin', 'ADMIN', 'salt', 'hash', '2026-11-24T00:00:00Z')`).run();
  h.sqlite.prepare(`INSERT INTO native_admin_memberships (id, user_id, role, status, revoked_permissions, created_at, updated_at)
    VALUES ('m-1', 'u-admin', ?1, 'ACTIVE', '[]', '2026-11-24T00:00:00Z', '2026-11-24T00:00:00Z')`).run(role);
}

/** Eight visitors, one per channel plus one extra search visit on the other storefront host. */
async function seedVisits(h: Harness): Promise<void> {
  // [minutes after T0, address, pageview overrides, user agent]
  const pageviews: Array<[number, number, Record<string, unknown>, string]> = [
    [0, 1, { r: 'https://chatgpt.com/c/abc' }, CHROME],
    [2, 1, { p: '/en/products/japan' }, CHROME],
    [60, 2, { r: 'https://www.google.co.uk/search?q=esim' }, CHROME],
    [120, 3, { r: 'https://m.facebook.com/', w: 390 }, IPHONE],
    [180, 4, { p: '/en?utm_source=NL&utm_medium=Newsletter&utm_campaign=BF-2026' }, CHROME],
    [240, 5, { p: '/en?utm_source=bing&utm_medium=cpc' }, CHROME],
    [300, 6, {}, CHROME],
    [360, 7, { r: 'https://news.example.org/story' }, CHROME],
    [420, 8, { h: 'esim.bokmoo.com', p: '/plans', r: 'https://www.baidu.com/s?wd=esim' }, IPHONE],
  ];
  for (const [minutes, address, overrides, userAgent] of pageviews) {
    at(minutes * MINUTE);
    const response = await collect(h, pageview(overrides), { ...from(address), 'user-agent': userAgent });
    expect(response?.status).toBe(204);
  }
  at(0);
}

const REPORT = '/report?from=20261124&to=20261125&tz=0';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(0);
  resetNativeTrafficCaches();
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue(null);
  getNativeJwtSecret.mockReset();
  getNativeJwtSecret.mockResolvedValue('unit-test-secret');
});

afterEach(() => vi.useRealTimers());

describe('native traffic: schema', () => {
  it('applies migration 0089: three tables and the schema marker', () => {
    const h = open();
    const tables = h.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'native_traffic_%' ORDER BY name",
    ).all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual([
      'native_traffic_page_daily',
      'native_traffic_rules',
      'native_traffic_sessions',
    ]);
    expect(h.sqlite.prepare("SELECT value FROM runtime_metadata WHERE key = 'core_schema_version'").get()).toEqual({ value: '0089' });
  });
});

describe('native traffic: the switch', () => {
  it('is off until the Traffic Analytics plugin is installed', async () => {
    const response = await tryNativeTraffic(config(), open({ installed: false }).env as never);
    expect(await json(response)).toEqual({ success: true, data: { enabled: false } });
  });

  it('is on once the plugin is enabled, unless the merchant switched it off', async () => {
    expect((await json(await tryNativeTraffic(config(), open().env as never)))?.data).toEqual({ enabled: true });
    resetNativeTrafficCaches();
    expect((await json(await tryNativeTraffic(config(), open({ switchedOff: true }).env as never)))?.data).toEqual({ enabled: false });
  });

  it('collects nothing while off', async () => {
    const h = open({ installed: false });
    expect((await collect(h, pageview({ r: 'https://chatgpt.com/' })))?.status).toBe(204);
    expect(sessions(h)).toEqual([]);
    expect(pages(h)).toEqual([]);
  });

  it('only answers GET on the config route', async () => {
    const request = new Request(`${API}/api/v1/traffic/config`, { method: 'POST' });
    expect((await tryNativeTraffic(request, open().env as never))?.status).toBe(405);
  });
});

describe('native traffic: what a beacon must look like', () => {
  it('needs the storefront origin, and it must match the proxy that forwarded it', async () => {
    const h = open();
    expect((await collect(h, pageview(), { origin: '' }))?.status).toBe(403);
    expect((await collect(h, pageview(), { 'sec-fetch-site': 'cross-site' }))?.status).toBe(403);
    expect((await collect(h, pageview(), { 'x-forwarded-host': 'evil.example' }))?.status).toBe(403);
    // A storefront that calls the API directly is trusted by its origin alone.
    expect((await collect(h, pageview(), { 'x-forwarded-host': '' }))?.status).toBe(204);
    expect(sessions(h)).toHaveLength(1);
  });

  it('is dropped silently for machines', async () => {
    const h = open();
    const machines = [
      'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'curl/8.4.0',
      '',
    ];
    for (const userAgent of machines) {
      expect((await collect(h, pageview(), { 'user-agent': userAgent }))?.status).toBe(204);
    }
    expect(sessions(h)).toEqual([]);
  });

  it('is refused when it is not a pageview', async () => {
    const h = open();
    expect((await collect(h, 'not json'))?.status).toBe(400);
    expect((await collect(h, { v: 1, h: 'www.bokmoo.com' }))?.status).toBe(400);
    expect((await collect(h, pageview({ p: 'en' })))?.status).toBe(400);
    expect((await collect(h, 'x'.repeat(5000)))?.status).toBe(413);
    expect(sessions(h)).toEqual([]);
  });

  it('is limited by volume per address', async () => {
    const h = open();
    for (let attempt = 0; attempt < 300; attempt += 1) {
      expect((await collect(h, pageview(), from(1)))?.status).toBe(204);
    }
    expect((await collect(h, pageview(), from(1)))?.status).toBe(429);
    // Another address is not affected.
    expect((await collect(h, pageview(), from(2)))?.status).toBe(204);
  }, 20_000);
});

describe('native traffic: visits', () => {
  it('opens a visit with the fields that say where it came from', async () => {
    const h = open();
    const response = await collect(h, pageview({
      p: '/en/products/japan?utm_source=chatgpt.com&utm_medium=ref&utm_campaign=bf&gclid=1&fbclid=x&not-a-known-param=1#reviews',
      r: 'https://www.chatgpt.com/c/abc',
      w: 390,
      z: 480,
    }), { ...from(7), 'user-agent': IPHONE, 'x-jiffoo-client-country': 'cn' });
    expect(response?.status).toBe(204);

    const [visit] = sessions(h);
    expect(visit).toMatchObject({
      host: 'www.bokmoo.com',
      started_at: T0,
      last_seen_at: T0,
      views: 1,
      landing_path: '/en/products/japan',
      referrer_host: 'chatgpt.com',
      utm_source: 'chatgpt.com',
      utm_medium: 'ref',
      utm_campaign: 'bf',
      utm_content: null,
      utm_term: null,
      click_ids: 'gclid,fbclid',
      country: 'CN',
      device: 'mobile',
    });
    expect(visit?.visitor_key).toMatch(/^[0-9a-f]{32}$/);
    // The viewer's zone decides which day a page view belongs to.
    expect(pages(h)).toEqual([{ day: 20261125, host: 'www.bokmoo.com', path: '/en/products/japan', views: 1 }]);
  });

  it('continues a visit while the visitor keeps browsing, then opens a new one', async () => {
    const h = open();
    expect((await collect(h, pageview({ r: 'https://www.google.com/' }), from(1)))?.status).toBe(204);
    at(10 * MINUTE);
    expect((await collect(h, pageview({ p: '/en/cart' }), from(1)))?.status).toBe(204);
    expect(sessions(h)).toHaveLength(1);
    expect(sessions(h)[0]).toMatchObject({ views: 2, started_at: T0, last_seen_at: T0 + 10 * MINUTE });
    expect(pages(h)).toEqual([
      { day: 20261124, host: 'www.bokmoo.com', path: '/en', views: 1 },
      { day: 20261124, host: 'www.bokmoo.com', path: '/en/cart', views: 1 },
    ]);

    at(10 * MINUTE + TRAFFIC_SESSION_GAP_MS + 1);
    expect((await collect(h, pageview({ p: '/en/cart' }), from(1)))?.status).toBe(204);
    expect(sessions(h)).toHaveLength(2);
    // The later page views of a visit never overwrite where it came from.
    expect(sessions(h)[1]).toMatchObject({ views: 1, landing_path: '/en/cart', referrer_host: null });
    expect(pages(h)[1]).toMatchObject({ path: '/en/cart', views: 2 });
  });

  it('tells visitors apart by address and browser', async () => {
    const h = open();
    await collect(h, pageview(), from(1));
    await collect(h, pageview(), from(2));
    await collect(h, pageview(), { ...from(1), 'user-agent': IPHONE });
    const keys = sessions(h).map((visit) => visit.visitor_key);
    expect(new Set(keys).size).toBe(3);
  });

  it('gives a visitor a new key every month', async () => {
    const h = open();
    vi.setSystemTime(Date.UTC(2026, 10, 30, 23, 50));
    await collect(h, pageview(), from(1));
    vi.setSystemTime(Date.UTC(2026, 11, 1, 0, 5)); // fifteen minutes later, new month
    await collect(h, pageview(), from(1));
    expect(sessions(h)).toHaveLength(2);
  });

  it('does not record the site itself as a source', async () => {
    const h = open();
    await collect(h, pageview({ r: 'https://esim.bokmoo.com/plans' }), from(1));
    await collect(h, pageview({ r: 'android-app://com.google.android.googlequicksearchbox/https/www.google.com' }), from(2));
    expect(sessions(h).map((visit) => visit.referrer_host)).toEqual([null, 'google.com']);
  });

  it('reads the device from the viewport when it can', async () => {
    const h = open();
    await collect(h, pageview({ w: 390 }), { ...from(1), 'user-agent': IPHONE });
    await collect(h, pageview({ w: 1440 }), { ...from(2), 'user-agent': IPHONE });
    await collect(h, pageview(), { ...from(3), 'user-agent': IPHONE });
    expect(sessions(h).map((visit) => visit.device)).toEqual(['mobile', 'desktop', 'mobile']);
  });
});

describe('native traffic: retention', () => {
  it('drops visits and per-day rows older than the retention window', async () => {
    const h = open();
    await collect(h, pageview(), from(1));
    const cutoff = T0 + 401 * 24 * HOUR;
    vi.setSystemTime(cutoff + HOUR);
    await collect(h, pageview(), from(2));

    expect(await pruneNativeTraffic(h.env as never)).toEqual({ sessions: 1, days: 1 });
    expect(sessions(h)).toHaveLength(1);
    expect(sessions(h)[0]?.started_at).toBe(cutoff + HOUR);
    expect(pages(h)).toHaveLength(1);
    // Nothing left to drop the second time.
    expect(await pruneNativeTraffic(h.env as never)).toEqual({ sessions: 0, days: 0 });
  });
});

describe('native traffic: admin gate', () => {
  it('refuses reports and rules without an administrator', async () => {
    const h = open();
    expect((await admin(h, REPORT))?.status).toBe(401);
    expect((await admin(h, '/rules'))?.status).toBe(401);
    // Signed in, but holding a role that grants nothing.
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-stranger', role: 'NOBODY' });
    expect((await admin(h, REPORT))?.status).toBe(403);
    const put = await admin(h, '/rules', { method: 'PUT', body: JSON.stringify(DEFAULT_TRAFFIC_RULES) });
    expect(put?.status).toBe(403);
  });

  it('lets a role that may read the dashboard read reports but not replace the rules', async () => {
    const h = open();
    addMembership(h, 'CATALOG_MANAGER');
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'CATALOG_MANAGER' });
    expect((await admin(h, REPORT))?.status).toBe(200);
    const put = await admin(h, '/rules', { method: 'PUT', body: JSON.stringify(DEFAULT_TRAFFIC_RULES) });
    expect(put?.status).toBe(403);
  });
});

describe('native traffic: channel rules', () => {
  it('starts from the built-in lists', async () => {
    const h = open();
    addMembership(h, 'ADMIN');
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    const reply = await json(await admin(h, '/rules'));
    expect(reply.data?.rules).toEqual(DEFAULT_TRAFFIC_RULES);
    expect(reply.data?.updatedAt).toBeNull();
    expect(reply.data?.channels).toEqual([...TRAFFIC_CHANNELS]);
  });

  it('stores a valid document and refuses anything else', async () => {
    const h = open();
    addMembership(h, 'ADMIN');
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    const put = (body: unknown) => admin(h, '/rules', {
      method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    expect((await put('not json'))?.status).toBe(400);
    expect((await put({ ...DEFAULT_TRAFFIC_RULES, version: 0 }))?.status).toBe(400);
    expect((await put({ ...DEFAULT_TRAFFIC_RULES, ai: ['not a host'] }))?.status).toBe(400);
    expect((await put({ ai: ['chatgpt.com'] }))?.status).toBe(400);

    const replaced = await put({ ...DEFAULT_TRAFFIC_RULES, version: 2, ai: [...DEFAULT_TRAFFIC_RULES.ai, 'news.example.org'] });
    expect(replaced?.status).toBe(200);
    const stored = await json(await admin(h, '/rules'));
    expect(stored.data?.rules).toMatchObject({ version: 2 });
    expect((stored.data?.rules as { ai: string[] }).ai).toContain('news.example.org');
    expect(typeof stored.data?.updatedAt).toBe('string');
  });

  it('is left alone by the routes it does not know', async () => {
    const h = open();
    addMembership(h, 'ADMIN');
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    expect((await admin(h, '/anything-else'))?.status).toBe(404);
    expect((await admin(h, '/report', { method: 'DELETE' }))?.status).toBe(404);
    expect(await tryNativeTraffic(new Request(`${API}/api/v1/traffic/elsewhere`), h.env as never)).toBeNull();
  });
});

describe('native traffic: reports', () => {
  async function ready(): Promise<Harness> {
    const h = open();
    await seedVisits(h);
    addMembership(h, 'ADMIN');
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    return h;
  }

  it('sums the period and names the channel of every visit', async () => {
    const h = await ready();
    const reply = await json(await admin(h, REPORT));
    expect(reply.data?.period).toEqual({ from: '2026-11-24', to: '2026-11-25' });
    expect(reply.data?.summary).toEqual({ visitors: 8, visits: 8, views: 9, bounceRate: 0.875, avgVisitSeconds: 15 });
    expect(reply.data?.daily).toEqual([
      { day: '2026-11-24', visitors: 7, visits: 7, views: 8 },
      { day: '2026-11-25', visitors: 1, visits: 1, views: 1 },
    ]);
    const channels = reply.data?.channels as Array<Record<string, unknown>>;
    expect(channels.map((channel) => channel.channel)).toEqual([...TRAFFIC_CHANNELS]);
    const byChannel = Object.fromEntries(channels.map((channel) => [channel.channel, channel]));
    expect(byChannel.ai).toMatchObject({ visitors: 1, visits: 1, views: 2, bounceRate: 0, avgVisitSeconds: 120 });
    expect(byChannel.search).toMatchObject({ visitors: 2, visits: 2, views: 2, bounceRate: 1, avgVisitSeconds: 0 });
    expect(byChannel.social).toMatchObject({ visits: 1, bounceRate: 1 });
    expect(byChannel.email).toMatchObject({ visits: 1 });
    expect(byChannel.paid).toMatchObject({ visits: 1 });
    expect(byChannel.referral).toMatchObject({ visits: 1 });
    expect(byChannel.direct).toMatchObject({ visits: 1 });
    expect(byChannel.campaign).toMatchObject({ visits: 0, bounceRate: 0 });
    expect(reply.data).toMatchObject({ rulesVersion: 2, rulesUpdatedAt: null, host: null });
  });

  it('says whether page views are being counted, and why not', async () => {
    expect((await json(await admin(await ready(), REPORT)))?.data?.collection).toBe('on');
    // The merchant switched collection off.
    resetNativeTrafficCaches();
    const paused = open({ switchedOff: true });
    await seedVisits(paused);
    addMembership(paused, 'ADMIN');
    expect((await json(await admin(paused, REPORT)))?.data?.collection).toBe('paused');
    // The plugin is not there at all.
    resetNativeTrafficCaches();
    const absent = open({ installed: false });
    addMembership(absent, 'ADMIN');
    expect((await json(await admin(absent, REPORT)))?.data?.collection).toBe('plugin-off');
  });

  it('counts a day in the viewer’s zone and can narrow to one storefront host', async () => {
    const h = await ready();
    // Beijing's 25 November starts at 16:00 UTC on the 24th, so all eight visits fall on that one day.
    const beijing = await json(await admin(h, '/report?from=2026-11-25&to=2026-11-25&tz=480'));
    expect(beijing.data?.daily).toEqual([{ day: '2026-11-25', visitors: 8, visits: 8, views: 9 }]);
    const esim = await json(await admin(h, `${REPORT}&host=esim.bokmoo.com`));
    expect(esim.data?.summary).toMatchObject({ visitors: 1, visits: 1, views: 1 });
    expect(esim.data?.host).toBe('esim.bokmoo.com');
  });

  it('shows quiet days and an empty period', async () => {
    const h = await ready();
    const reply = await json(await admin(h, '/report?from=20260101&to=20260103'));
    expect(reply.data?.summary).toEqual({ visitors: 0, visits: 0, views: 0, bounceRate: 0, avgVisitSeconds: 0 });
    expect(reply.data?.daily).toEqual([
      { day: '2026-01-01', visitors: 0, visits: 0, views: 0 },
      { day: '2026-01-02', visitors: 0, visits: 0, views: 0 },
      { day: '2026-01-03', visitors: 0, visits: 0, views: 0 },
    ]);
  });

  it('breaks visits down by any acquisition dimension', async () => {
    const h = await ready();
    const referrers = await json(await admin(h, `/breakdown?dim=referrer&from=20261124&to=20261125`));
    expect(referrers.data).toMatchObject({ dimension: 'referrer', channel: null, total: 5 });
    expect(referrers.data?.rows).toEqual([
      { value: 'chatgpt.com', channel: 'ai', visitors: 1, visits: 1, views: 2, bounceRate: 0, avgVisitSeconds: 120 },
      { value: 'baidu.com', channel: 'search', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: 'google.co.uk', channel: 'search', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: 'm.facebook.com', channel: 'social', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: 'news.example.org', channel: 'referral', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
    ]);

    const sources = await json(await admin(h, `/breakdown?dim=source&from=20261124&to=20261125`));
    expect((sources.data?.rows as Array<{ value: string }>).map((row) => row.value)).toEqual([
      'chatgpt.com', 'baidu.com', 'bing', 'google.co.uk', 'm.facebook.com', 'news.example.org', 'nl',
    ]);

    const landing = await json(await admin(h, `/breakdown?dim=landing&from=20261124&to=20261125`));
    expect(landing.data?.rows).toEqual([
      { value: '/en', channel: null, visitors: 7, visits: 7, views: 8, bounceRate: 0.8571, avgVisitSeconds: 17 },
      { value: '/plans', channel: 'search', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
    ]);

    const pagesReply = await json(await admin(h, `/breakdown?dim=page&from=20261124&to=20261125`));
    expect(pagesReply.data).toMatchObject({ dimension: 'page', channel: null, total: 3 });
    expect(pagesReply.data?.rows).toEqual([
      { value: '/en', views: 7 },
      { value: '/en/products/japan', views: 1 },
      { value: '/plans', views: 1 },
    ]);
  });

  it('filters a breakdown to one channel and pages through it', async () => {
    const h = await ready();
    const search = await json(await admin(h, `/breakdown?dim=referrer&channel=search&from=20261124&to=20261125`));
    expect(search.data).toMatchObject({ channel: 'search', total: 2 });
    expect((search.data?.rows as Array<{ value: string }>).map((row) => row.value)).toEqual(['baidu.com', 'google.co.uk']);

    const ai = await json(await admin(h, `/breakdown?dim=landing&channel=ai&from=20261124&to=20261125`));
    expect(ai.data?.rows).toEqual([
      { value: '/en', channel: 'ai', visitors: 1, visits: 1, views: 2, bounceRate: 0, avgVisitSeconds: 120 },
    ]);

    const page = await json(await admin(h, `/breakdown?dim=source&from=20261124&to=20261125&limit=2&offset=1`));
    expect(page.data).toMatchObject({ total: 7 });
    expect((page.data?.rows as Array<{ value: string }>).map((row) => row.value)).toEqual(['baidu.com', 'bing']);
  });

  it('refuses queries it cannot answer', async () => {
    const h = await ready();
    expect((await admin(h, '/report?from=20261125&to=20261124'))?.status).toBe(400);
    expect((await admin(h, '/report?from=20260231&to=20260301'))?.status).toBe(400);
    expect((await admin(h, `${REPORT}&host=not+a+host`))?.status).toBe(400);
    expect((await admin(h, '/breakdown?dim=nothing&from=20261124&to=20261125'))?.status).toBe(400);
    expect((await admin(h, `/breakdown?dim=referrer&channel=nothing&from=20261124&to=20261125`))?.status).toBe(400);
  });

  it('reclassifies history when the rules change', async () => {
    const h = await ready();
    const put = await admin(h, '/rules', {
      method: 'PUT',
      body: JSON.stringify({ ...DEFAULT_TRAFFIC_RULES, version: 2, ai: [...DEFAULT_TRAFFIC_RULES.ai, 'news.example.org'] }),
    });
    expect(put?.status).toBe(200);

    const reply = await json(await admin(h, REPORT));
    const channels = Object.fromEntries(
      (reply.data?.channels as Array<Record<string, unknown>>).map((channel) => [channel.channel, channel]),
    );
    expect(channels.ai).toMatchObject({ visits: 2 });
    expect(channels.referral).toMatchObject({ visits: 0 });
    expect(reply.data).toMatchObject({ rulesVersion: 2 });
  });
});

describe('native traffic: affiliate links', () => {
  it("counts a partner's link as its own channel, names the code, and moves nothing else", async () => {
    const h = open();
    await seedVisits(h);
    at(480 * MINUTE);
    // [address, pageview overrides, user agent]
    const pageviews: Array<[number, Record<string, unknown>, string]> = [
      [9, { p: '/en/r/PARTNER1' }, CHROME],
      [10, { p: '/ja/r/CREATOR-9?utm_source=post' }, IPHONE],
      [11, { p: '/en?utm_medium=affiliate&utm_source=partner' }, CHROME],
      // Too short to be a code: this is nobody's partner link.
      [12, { p: '/en/r/ab' }, CHROME],
    ];
    for (const [address, overrides, userAgent] of pageviews) {
      const response = await collect(h, pageview(overrides), { ...from(address), 'user-agent': userAgent });
      expect(response?.status).toBe(204);
    }
    addMembership(h, 'ADMIN');
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });

    const reply = await json(await admin(h, REPORT));
    const byChannel = Object.fromEntries(
      (reply.data?.channels as Array<Record<string, unknown>>).map((channel) => [channel.channel, channel]),
    );
    expect(byChannel.affiliate).toMatchObject({ visitors: 3, visits: 3, views: 3, bounceRate: 1, avgVisitSeconds: 0 });
    // The eight earlier visits keep the channels they had; the short code stays with the pages nobody sent.
    expect(byChannel.campaign).toMatchObject({ visits: 0 });
    expect(byChannel.direct).toMatchObject({ visits: 2 });
    expect(reply.data?.summary).toMatchObject({ visitors: 12, visits: 12, views: 13 });

    // One row per partner: the code is in the landing page's path.
    const links = await json(await admin(h, `/breakdown?dim=landing&from=20261124&to=20261125&channel=affiliate`));
    expect(links.data?.rows).toEqual([
      { value: '/en', channel: 'affiliate', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: '/en/r/PARTNER1', channel: 'affiliate', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
      { value: '/ja/r/CREATOR-9', channel: 'affiliate', visitors: 1, visits: 1, views: 1, bounceRate: 1, avgVisitSeconds: 0 },
    ]);
    const direct = await json(await admin(h, `/breakdown?dim=landing&from=20261124&to=20261125&channel=direct`));
    expect((direct.data?.rows as Array<{ value: string }>).map((row) => row.value)).toEqual(['/en', '/en/r/ab']);
  });
});
