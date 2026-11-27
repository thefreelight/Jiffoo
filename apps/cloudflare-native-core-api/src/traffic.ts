/**
 * Native storefront traffic collection: the collection half of traffic
 * analytics, kept free of any one analytics product.
 *
 * While collection is on, the storefront posts one small beacon per page view
 * here. A visit opens on the first page view and continues until 30 minutes
 * pass without another; its referrer host and UTM fields are stored raw and
 * read back through generic reports that group by any acquisition dimension.
 * Which referrer means which channel is data, not code: the channel lists sit
 * in native_traffic_rules, can be replaced through the admin endpoint, and
 * are applied at read time, so a list update reclassifies history.
 *
 * Nothing personal is stored. A visitor is an HMAC of the client address and
 * user agent under a key that rotates monthly; no address, cookie or device
 * identifier is written (migration 0089).
 *
 * Routes:
 *   - storefront:  GET  /api/v1/traffic/config
 *                  POST /api/v1/traffic/collect
 *   - admin:       GET  /api/v1/admin/traffic/{report,breakdown,rules}
 *                  PUT  /api/v1/admin/traffic/rules
 */

import { type NativeAuthEnv, getNativeJwtSecret } from './auth';
import { requireAdminPermission } from './admin-access';
import { ADMIN_PERMISSIONS } from './native-rbac';
import { isNativePluginEnabled } from './plugin-enabled';
import {
  TRAFFIC_CHANNELS,
  TRAFFIC_DEFAULT_RETENTION_DAYS,
  TRAFFIC_PAYLOAD_MAX_BYTES,
  TRAFFIC_RULES_MAX_BYTES,
  TRAFFIC_SESSION_GAP_MS,
  TRAFFIC_SETTING_KEY,
  classifyTraffic,
  isTrafficDimension,
  looksLikeTrafficBot,
  parseTrafficPageview,
  parseTrafficReportQuery,
  parseTrafficRules,
  trafficClientCountry,
  trafficClientIp,
  trafficDayKey,
  trafficDevice,
  trafficOriginHost,
  trafficVisitorKey,
  type TrafficChannel,
  type TrafficChannelRules,
  type TrafficDevice,
  type TrafficDimension,
  type TrafficPageview,
  type TrafficReportQuery,
} from './traffic-core';
import { DEFAULT_TRAFFIC_RULES } from './traffic-default-rules';

type TrafficEnv = NativeAuthEnv & { DB: D1Database };

// Collection belongs to the Traffic Analytics plugin: it runs while that
// plugin is installed and enabled, unless the merchant switched it off.
const PLUGIN_SLUG = 'traffic-analytics';
const RUNTIME = 'cloudflare-native-traffic';
const RUNTIME_HEADERS = { 'x-jiffoo-runtime': RUNTIME };
const CONFIG_PATH = '/api/v1/traffic/config';
const COLLECT_PATH = '/api/v1/traffic/collect';
const ADMIN_MOUNT = '/api/v1/admin/traffic';

// Storefront writes are anonymous, so the only abuse worth limiting is volume.
// The budget is generous because many people can share one address.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;
// Old rows are removed now and then from the write path: an instance that gets
// traffic prunes itself, and one that gets none has nothing new to prune.
const PRUNE_CHANCE = 1 / 2000;
// The switch costs two database reads; beacons arrive in bursts.
const ENABLED_CACHE_MS = 10_000;

const DAY_MS = 86_400_000;

// ── is collection on? ────────────────────────────────────────────────────────

let enabledCache: { at: number; value: boolean } | null = null;

async function resolveCollectionEnabled(env: TrafficEnv): Promise<boolean> {
  const now = Date.now();
  if (enabledCache && now - enabledCache.at < ENABLED_CACHE_MS) return enabledCache.value;
  let enabled = await isNativePluginEnabled(env, PLUGIN_SLUG);
  if (enabled) {
    const row = await env.DB.prepare('SELECT settings FROM native_settings WHERE id = ?1')
      .bind('system')
      .first<{ settings: string }>();
    if (row) {
      try {
        const parsed: unknown = JSON.parse(row.settings);
        const switchedOff = !!parsed && typeof parsed === 'object'
          && (parsed as Record<string, unknown>)[TRAFFIC_SETTING_KEY] === false;
        if (switchedOff) enabled = false;
      } catch {
        // An unreadable settings document leaves the switch alone.
      }
    }
  }
  enabledCache = { at: now, value: enabled };
  return enabled;
}

// ── rate limit (per isolate; a cheap volume guard, not a security boundary) ──

const rateBuckets = new Map<string, { startedAt: number; count: number }>();

function takeRateLimitBudget(ip: string, now: number): boolean {
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    if (rateBuckets.size > 5000) {
      for (const [key, entry] of rateBuckets) {
        if (now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
      }
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX_REQUESTS;
}

/** Test hook: forget the cached switch and the rate-limit buckets. */
export function resetNativeTrafficCaches(): void {
  enabledCache = null;
  rateBuckets.clear();
}

// ── responses ────────────────────────────────────────────────────────────────

function failure(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'cache-control': 'no-store', ...RUNTIME_HEADERS },
  });
}

function success(data: unknown): Response {
  return Response.json({ success: true, data }, {
    headers: { 'cache-control': 'no-store', ...RUNTIME_HEADERS },
  });
}

/**
 * In production beacons arrive same-origin through the storefront proxy. A
 * storefront on another origin (local development) gets its own origin echoed
 * back, provided it passes the same origin check a beacon has to pass.
 */
function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get('origin');
  const host = trafficOriginHost(origin, request.headers.get('x-forwarded-host'), request.headers.get('sec-fetch-site'));
  if (!origin || host === null) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.append('vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

function preflight(request: Request): Response {
  // Content-Type is the only header a browser adds; a beacon sends its body as text/plain.
  const headers = new Headers({
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    ...RUNTIME_HEADERS,
  });
  return withCors(request, new Response(null, { status: 204, headers }));
}

// ── entry ────────────────────────────────────────────────────────────────────

export async function tryNativeTraffic(
  request: Request,
  env: TrafficEnv,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (pathname === CONFIG_PATH) {
    if (request.method === 'OPTIONS') return preflight(request);
    if (request.method !== 'GET') return failure(405, 'METHOD_NOT_ALLOWED', 'Use GET');
    return withCors(request, success({ enabled: await resolveCollectionEnabled(env) }));
  }
  if (pathname === COLLECT_PATH) {
    if (request.method === 'OPTIONS') return preflight(request);
    if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED', 'Use POST');
    return collect(request, env, waitUntil);
  }
  if (pathname === ADMIN_MOUNT || pathname.startsWith(`${ADMIN_MOUNT}/`)) {
    return adminTraffic(request, env, pathname.slice(ADMIN_MOUNT.length + 1));
  }
  return null;
}

// ── storefront: collect ──────────────────────────────────────────────────────

async function collect(
  request: Request,
  env: TrafficEnv,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const accepted = () => new Response(null, { status: 204, headers: RUNTIME_HEADERS });
  if (!(await resolveCollectionEnabled(env))) return accepted();
  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 512);
  if (looksLikeTrafficBot(userAgent)) return accepted();
  const originHost = trafficOriginHost(
    request.headers.get('origin'),
    request.headers.get('x-forwarded-host'),
    request.headers.get('sec-fetch-site'),
  );
  if (originHost === null) return failure(403, 'ORIGIN_NOT_ALLOWED', 'The storefront origin is required');
  const ip = trafficClientIp((name) => request.headers.get(name));
  const now = Date.now();
  if (!takeRateLimitBudget(ip, now)) return failure(429, 'RATE_LIMITED', 'Too many beacons from this address');

  if (Number(request.headers.get('content-length') ?? '0') > TRAFFIC_PAYLOAD_MAX_BYTES) {
    return failure(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  const text = await request.text();
  if (text.length > TRAFFIC_PAYLOAD_MAX_BYTES) return failure(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Reported as a validation error below.
  }
  const pageview = parseTrafficPageview(body, originHost.replace(/:\d+$/, ''));
  if (pageview === null) return failure(400, 'VALIDATION_ERROR', 'The beacon is not a pageview');

  const visitorKey = await trafficVisitorKey(await getNativeJwtSecret(env), ip, userAgent, now);
  const country = trafficClientCountry((name) => request.headers.get(name));
  const device = trafficDevice(userAgent, pageview.viewportWidth);
  const write = recordPageview(env, pageview, visitorKey, country, device, now).catch((error: unknown) => {
    // A failed write must never surface to the visitor; the next beacon starts a fresh visit.
    console.error('[native-traffic] failed to record a pageview', error);
  });
  if (waitUntil) waitUntil(write);
  else await write;
  return accepted();
}

async function recordPageview(
  env: TrafficEnv,
  pageview: TrafficPageview,
  visitorKey: string,
  country: string | null,
  device: TrafficDevice,
  now: number,
): Promise<void> {
  const pageDaily = env.DB.prepare(
    `INSERT INTO native_traffic_page_daily (day, host, path, views) VALUES (CAST(?1 AS INTEGER), ?2, ?3, 1)
     ON CONFLICT(day, host, path) DO UPDATE SET views = views + 1`,
  ).bind(trafficDayKey(now, pageview.zoneOffsetMinutes ?? 0), pageview.host, pageview.path);
  const last = await env.DB.prepare(
    'SELECT id, last_seen_at FROM native_traffic_sessions WHERE visitor_key = ?1 ORDER BY last_seen_at DESC LIMIT 1',
  ).bind(visitorKey).first<{ id: string; last_seen_at: number }>();
  if (last && now - Number(last.last_seen_at) <= TRAFFIC_SESSION_GAP_MS) {
    await env.DB.batch([
      env.DB.prepare('UPDATE native_traffic_sessions SET views = views + 1, last_seen_at = CAST(?2 AS INTEGER) WHERE id = ?1')
        .bind(last.id, now),
      pageDaily,
    ]);
    return;
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO native_traffic_sessions
        (id, host, visitor_key, started_at, last_seen_at, views, landing_path, referrer_host,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_ids, country, device)
       VALUES (?1, ?2, ?3, CAST(?4 AS INTEGER), CAST(?5 AS INTEGER), 1, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
    ).bind(
      crypto.randomUUID(), pageview.host, visitorKey, now, now, pageview.path, pageview.referrerHost,
      pageview.utmSource, pageview.utmMedium, pageview.utmCampaign, pageview.utmContent, pageview.utmTerm,
      pageview.clickIds, country, device,
    ),
    pageDaily,
  ]);
  if (Math.random() < PRUNE_CHANCE) await pruneNativeTraffic(env, now);
}

/** Drops visits and per-day rows older than the retention window. */
export async function pruneNativeTraffic(env: TrafficEnv, now = Date.now()): Promise<{ sessions: number; days: number }> {
  const cutoff = now - TRAFFIC_DEFAULT_RETENTION_DAYS * DAY_MS;
  const [sessions, days] = await env.DB.batch([
    env.DB.prepare('DELETE FROM native_traffic_sessions WHERE started_at < CAST(?1 AS INTEGER)').bind(cutoff),
    env.DB.prepare('DELETE FROM native_traffic_page_daily WHERE day < CAST(?1 AS INTEGER)').bind(trafficDayKey(cutoff, 0)),
  ]);
  return {
    sessions: Number(sessions?.meta?.changes ?? 0),
    days: Number(days?.meta?.changes ?? 0),
  };
}

// ── admin: channel rules ─────────────────────────────────────────────────────

interface RulesRow { rules_json: string; updated_at: string }

interface StoredRules { rules: TrafficChannelRules; updatedAt: string | null }

/** The stored rules, or the built-in defaults when nothing valid was ever stored. */
async function loadRules(env: TrafficEnv): Promise<StoredRules> {
  const row = await env.DB.prepare('SELECT rules_json, updated_at FROM native_traffic_rules WHERE id = 1')
    .first<RulesRow>();
  if (!row) return { rules: DEFAULT_TRAFFIC_RULES, updatedAt: null };
  try {
    return { rules: parseTrafficRules(JSON.parse(row.rules_json)) ?? DEFAULT_TRAFFIC_RULES, updatedAt: row.updated_at };
  } catch {
    return { rules: DEFAULT_TRAFFIC_RULES, updatedAt: row.updated_at };
  }
}

async function replaceRules(request: Request, env: TrafficEnv): Promise<Response> {
  const text = await request.text();
  if (text.length > TRAFFIC_RULES_MAX_BYTES) return failure(413, 'PAYLOAD_TOO_LARGE', 'Rules document is too large');
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Reported as a validation error below.
  }
  const rules = parseTrafficRules(body);
  if (rules === null) return failure(400, 'VALIDATION_ERROR', 'The rules document is not valid');
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_traffic_rules (id, rules_json, updated_at) VALUES (1, ?1, ?2)
     ON CONFLICT(id) DO UPDATE SET rules_json = excluded.rules_json, updated_at = excluded.updated_at`,
  ).bind(JSON.stringify(rules), updatedAt).run();
  return success({ rules, updatedAt, channels: TRAFFIC_CHANNELS });
}

// ── admin: reports ───────────────────────────────────────────────────────────

const AGGREGATE = `COUNT(DISTINCT visitor_key) AS visitors, COUNT(*) AS visits, SUM(views) AS views,
  SUM(CASE WHEN views = 1 THEN 1 ELSE 0 END) AS bounced, SUM(last_seen_at - started_at) AS duration_ms`;

/** One group of visits that share acquisition fields; `value` is the breakdown column. */
interface GroupRow {
  value?: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  click_ids: string | null;
  visitors: number;
  visits: number;
  views: number;
  bounced: number;
  duration_ms: number;
}

interface DailyRow extends GroupRow { day_index: number }

interface Totals {
  visitors: number;
  visits: number;
  views: number;
  bounced: number;
  durationMs: number;
  channels: Set<TrafficChannel>;
}

interface Figures {
  visitors: number;
  visits: number;
  views: number;
  /** Share of visits that left after one page, 0..1. */
  bounceRate: number;
  avgVisitSeconds: number;
}

interface BreakdownRow extends Figures {
  value: string;
  /** The one channel these visits came from, or null when there was more than one. */
  channel: TrafficChannel | null;
}

const DIMENSIONS = {
  source: 'COALESCE(utm_source, referrer_host)',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
  referrer: 'referrer_host',
  landing: 'landing_path',
  country: 'country',
  device: 'device',
  host: 'host',
  page: 'path',
} as const;

type Dimension = TrafficDimension;

function emptyTotals(): Totals {
  return { visitors: 0, visits: 0, views: 0, bounced: 0, durationMs: 0, channels: new Set() };
}

function addVisits(totals: Totals, row: GroupRow, channel: TrafficChannel | null): void {
  totals.visitors += Number(row.visitors ?? 0);
  totals.visits += Number(row.visits ?? 0);
  totals.views += Number(row.views ?? 0);
  totals.bounced += Number(row.bounced ?? 0);
  totals.durationMs += Number(row.duration_ms ?? 0);
  if (channel !== null) totals.channels.add(channel);
}

function figures(totals: Totals): Figures {
  return {
    visitors: totals.visitors,
    visits: totals.visits,
    views: totals.views,
    bounceRate: totals.visits > 0 ? Number((totals.bounced / totals.visits).toFixed(4)) : 0,
    avgVisitSeconds: totals.visits > 0 ? Math.round(totals.durationMs / totals.visits / 1000) : 0,
  };
}

function channelOf(row: GroupRow, rules: TrafficChannelRules): TrafficChannel {
  return classifyTraffic({
    referrerHost: row.referrer_host,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    clickIds: row.click_ids ? row.click_ids.split(',') : [],
  }, rules);
}

function formatDay(dayKey: number): string {
  const digits = String(dayKey);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** `started_at` inside the queried days, narrowed to one storefront host when asked. */
function sessionWhere(query: TrafficReportQuery): { sql: string; args: unknown[] } {
  const args: unknown[] = [query.range[0], query.range[1]];
  let sql = 'started_at >= ?1 AND started_at < ?2';
  if (query.host !== null) {
    args.push(query.host);
    sql += ` AND host = ?${args.length}`;
  }
  return { sql, args };
}

function periodOf(query: TrafficReportQuery): { from: string; to: string } {
  return {
    from: formatDay(trafficDayKey(query.range[0], query.tz)),
    to: formatDay(trafficDayKey(query.range[1] - 1, query.tz)),
  };
}

function byWeight(a: Figures, b: Figures): number {
  return b.visits - a.visits || b.views - a.views;
}

async function report(env: TrafficEnv, query: TrafficReportQuery): Promise<Response> {
  const where = sessionWhere(query);
  const stored = await loadRules(env);
  const zoneParameter = where.args.length + 1;
  const [summaryRow, channelGroups, dailyGroups] = await Promise.all([
    env.DB.prepare(`SELECT ${AGGREGATE} FROM native_traffic_sessions WHERE ${where.sql}`)
      .bind(...where.args).first<GroupRow>(),
    env.DB.prepare(`SELECT referrer_host, utm_source, utm_medium, utm_campaign, click_ids, ${AGGREGATE}
      FROM native_traffic_sessions WHERE ${where.sql}
      GROUP BY referrer_host, utm_source, utm_medium, utm_campaign, click_ids`)
      .bind(...where.args).all<GroupRow>(),
    env.DB.prepare(`SELECT CAST((started_at + CAST(?${zoneParameter} AS INTEGER)) / 86400000 AS INTEGER) AS day_index, ${AGGREGATE}
      FROM native_traffic_sessions WHERE ${where.sql} GROUP BY day_index`)
      .bind(...where.args, query.tz * 60_000).all<DailyRow>(),
  ]);

  const summary = emptyTotals();
  if (summaryRow) addVisits(summary, summaryRow, null);

  const channelTotals = new Map<TrafficChannel, Totals>(TRAFFIC_CHANNELS.map((channel) => [channel, emptyTotals()]));
  for (const row of channelGroups.results) {
    const totals = channelTotals.get(channelOf(row, stored.rules));
    if (totals) addVisits(totals, row, null);
  }

  // Every day of the period appears, also the quiet ones. A day index counts
  // local midnights, so the zone offset is added back to the period's start.
  const byDay = new Map(dailyGroups.results.map((row) => [Number(row.day_index), row]));
  const daily: Array<{ day: string; visitors: number; visits: number; views: number }> = [];
  for (let start = query.range[0]; start < query.range[1]; start += DAY_MS) {
    const row = byDay.get((start + query.tz * 60_000) / DAY_MS);
    daily.push({
      day: formatDay(trafficDayKey(start, query.tz)),
      visitors: Number(row?.visitors ?? 0),
      visits: Number(row?.visits ?? 0),
      views: Number(row?.views ?? 0),
    });
  }

  return success({
    period: periodOf(query),
    host: query.host,
    rulesVersion: stored.rules.version,
    rulesUpdatedAt: stored.updatedAt,
    summary: figures(summary),
    daily,
    channels: TRAFFIC_CHANNELS.map((channel) => ({ channel, ...figures(channelTotals.get(channel) ?? emptyTotals()) })),
  });
}

async function breakdown(env: TrafficEnv, query: TrafficReportQuery, dimension: Dimension): Promise<Response> {
  if (dimension === 'page') {
    const days: unknown[] = [
      trafficDayKey(query.range[0], query.tz),
      trafficDayKey(query.range[1] - 1, query.tz),
    ];
    let sql = 'day >= CAST(?1 AS INTEGER) AND day <= CAST(?2 AS INTEGER)';
    if (query.host !== null) {
      days.push(query.host);
      sql += ' AND host = ?3';
    }
    const pages = await env.DB.prepare(
      `SELECT path AS value, SUM(views) AS views FROM native_traffic_page_daily WHERE ${sql} GROUP BY path`,
    ).bind(...days).all<{ value: string; views: number }>();
    const rows = pages.results
      .map((row) => ({ value: row.value, views: Number(row.views) }))
      .sort((a, b) => b.views - a.views || a.value.localeCompare(b.value));
    return success({
      dimension,
      period: periodOf(query),
      host: query.host,
      channel: null,
      total: rows.length,
      rows: rows.slice(query.offset, query.offset + query.limit),
    });
  }

  const column = DIMENSIONS[dimension];
  const where = sessionWhere(query);
  const stored = await loadRules(env);
  const groups = await env.DB.prepare(
    `SELECT ${column} AS value, referrer_host, utm_source, utm_medium, utm_campaign, click_ids, ${AGGREGATE}
     FROM native_traffic_sessions WHERE ${where.sql} AND ${column} IS NOT NULL
     GROUP BY ${column}, referrer_host, utm_source, utm_medium, utm_campaign, click_ids`,
  ).bind(...where.args).all<GroupRow>();

  // Visits are grouped by channel first, so a channel filter is exact and
  // each row can say which channel it came from.
  const folded = new Map<string, Totals>();
  for (const row of groups.results) {
    const channel = channelOf(row, stored.rules);
    if (query.channel !== null && channel !== query.channel) continue;
    const value = String(row.value ?? '');
    const totals = folded.get(value) ?? emptyTotals();
    addVisits(totals, row, channel);
    folded.set(value, totals);
  }
  const rows: BreakdownRow[] = [...folded]
    .map(([value, totals]) => ({
      value,
      channel: totals.channels.size === 1 ? [...totals.channels][0] : null,
      ...figures(totals),
    }))
    .sort((a, b) => byWeight(a, b) || a.value.localeCompare(b.value));
  return success({
    dimension,
    period: periodOf(query),
    host: query.host,
    channel: query.channel,
    total: rows.length,
    rows: rows.slice(query.offset, query.offset + query.limit),
  });
}

async function adminTraffic(request: Request, env: TrafficEnv, route: string): Promise<Response> {
  const method = request.method;
  const reads = route === 'report' || route === 'breakdown' || route === 'rules';
  if (!((method === 'GET' && reads) || (method === 'PUT' && route === 'rules'))) {
    return failure(404, 'NOT_FOUND', 'Unknown traffic admin route');
  }
  const gate = await requireAdminPermission(
    request,
    env,
    method === 'PUT' ? ADMIN_PERMISSIONS.SETTINGS_WRITE : ADMIN_PERMISSIONS.DASHBOARD_READ,
  );
  if (!gate.ok) return gate.response;
  if (route === 'rules') {
    if (method === 'PUT') return replaceRules(request, env);
    const stored = await loadRules(env);
    return success({ ...stored, channels: TRAFFIC_CHANNELS });
  }
  const url = new URL(request.url);
  const parsed = parseTrafficReportQuery(url.searchParams);
  if (parsed === null) return failure(400, 'VALIDATION_ERROR', 'The report query is not valid');
  if (route === 'report') return report(env, parsed);
  const dimension = url.searchParams.get('dim') ?? url.searchParams.get('dimension');
  if (!isTrafficDimension(dimension)) return failure(400, 'VALIDATION_ERROR', 'Unknown dimension');
  return breakdown(env, parsed, dimension);
}
