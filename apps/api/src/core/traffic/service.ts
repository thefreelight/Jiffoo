/**
 * Storefront traffic collection on the self-hosted line: the Node twin of the
 * native worker's traffic.ts. What a visit is, which beacon counts and which
 * channel a visit belongs to all live in traffic-core.ts, mirrored into both
 * lines; this file only owns the database work and the two instance-level
 * switches (the plugin is enabled, the merchant has not paused collection).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { isPluginEnabled } from '@/core/admin/plugin-management/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import {
  TRAFFIC_CHANNELS,
  TRAFFIC_DEFAULT_RETENTION_DAYS,
  TRAFFIC_SESSION_GAP_MS,
  TRAFFIC_SETTING_KEY,
  classifyTraffic,
  parseTrafficRules,
  trafficDayKey,
  type TrafficChannel,
  type TrafficChannelRules,
  type TrafficDevice,
  type TrafficPageview,
} from './traffic-core';
import { DEFAULT_TRAFFIC_RULES } from './traffic-default-rules';

// Collection belongs to the Traffic Analytics plugin.
export const TRAFFIC_PLUGIN_SLUG = 'traffic-analytics';

const DAY_MS = 86_400_000;

// Beacons arrive in bursts; the two reads behind the switch are cached briefly.
const ENABLED_CACHE_MS = 10_000;

// Storefront writes are anonymous, so the only abuse worth limiting is volume.
// The budget is generous because many people can share one address.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;

// Old rows are removed now and then from the write path: an instance that
// gets traffic prunes itself, and one that gets none has nothing new to prune.
const PRUNE_CHANCE = 1 / 2000;

// ── switches ────────────────────────────────────────────────────────────────

let enabledCache: { at: number; value: boolean } | null = null;

/**
 * On while the Traffic Analytics plugin is installed and enabled and the
 * merchant has not paused it. An unreadable state is off, never on.
 */
export async function isTrafficCollectionEnabled(): Promise<boolean> {
  const now = Date.now();
  if (enabledCache && now - enabledCache.at < ENABLED_CACHE_MS) return enabledCache.value;
  let enabled = false;
  try {
    enabled = await isPluginEnabled(TRAFFIC_PLUGIN_SLUG, 'default')
      && await systemSettingsService.getBoolean(TRAFFIC_SETTING_KEY, true);
  } catch {
    enabled = false;
  }
  enabledCache = { at: now, value: enabled };
  return enabled;
}

/** Why page views are or are not being counted, for the report to say. */
export async function trafficCollectionState(): Promise<'on' | 'paused' | 'plugin-off'> {
  let installed = false;
  try {
    installed = await isPluginEnabled(TRAFFIC_PLUGIN_SLUG, 'default');
  } catch {
    installed = false;
  }
  if (!installed) return 'plugin-off';
  return (await isTrafficCollectionEnabled()) ? 'on' : 'paused';
}

// ── rate limit (per process; a cheap volume guard, not a security boundary) ──

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
export function resetTrafficCaches(): void {
  enabledCache = null;
  rateBuckets.clear();
}

/** Whether an address still may send beacons in this window. */
export function trafficBeaconAllowed(ip: string, now = Date.now()): boolean {
  return takeRateLimitBudget(ip, now);
}

// ── writes ──────────────────────────────────────────────────────────────────

/**
 * Opens a visit, or continues the visitor's open one, and counts the page.
 * The day a page view belongs to is the viewer's, so daily totals line up
 * with the visits they come from.
 */
export async function recordTrafficPageview(
  pageview: TrafficPageview,
  visitorKey: string,
  country: string | null,
  device: TrafficDevice,
  now: number,
): Promise<void> {
  const last = await prisma.trafficSession.findFirst({
    where: { visitorKey },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, lastSeenAt: true },
  });
  const pageDaily = Prisma.sql`
    INSERT INTO "traffic_page_daily" ("day", "host", "path", "views")
    VALUES (${trafficDayKey(now, pageview.zoneOffsetMinutes ?? 0)}, ${pageview.host}, ${pageview.path}, 1)
    ON CONFLICT ("day", "host", "path") DO UPDATE SET "views" = "traffic_page_daily"."views" + 1`;

  if (last && now - Number(last.lastSeenAt) <= TRAFFIC_SESSION_GAP_MS) {
    await prisma.$transaction([
      prisma.trafficSession.update({
        where: { id: last.id },
        data: { views: { increment: 1 }, lastSeenAt: BigInt(now) },
      }),
      prisma.$executeRaw(pageDaily),
    ]);
    return;
  }

  await prisma.$transaction([
    prisma.trafficSession.create({
      data: {
        id: crypto.randomUUID(),
        host: pageview.host,
        visitorKey,
        startedAt: BigInt(now),
        lastSeenAt: BigInt(now),
        landingPath: pageview.path,
        referrerHost: pageview.referrerHost,
        utmSource: pageview.utmSource,
        utmMedium: pageview.utmMedium,
        utmCampaign: pageview.utmCampaign,
        utmContent: pageview.utmContent,
        utmTerm: pageview.utmTerm,
        clickIds: pageview.clickIds,
        country,
        device,
      },
    }),
    prisma.$executeRaw(pageDaily),
  ]);
  if (Math.random() < PRUNE_CHANCE) await pruneTraffic(now);
}

/** Drops visits and per-day rows older than the retention window. */
export async function pruneTraffic(now = Date.now()): Promise<{ sessions: number; days: number }> {
  const cutoff = now - TRAFFIC_DEFAULT_RETENTION_DAYS * DAY_MS;
  const [sessions, days] = await prisma.$transaction([
    prisma.trafficSession.deleteMany({ where: { startedAt: { lt: BigInt(cutoff) } } }),
    prisma.trafficPageDaily.deleteMany({ where: { day: { lt: trafficDayKey(cutoff, 0) } } }),
  ]);
  return { sessions: sessions.count, days: days.count };
}

// ── channel rules ───────────────────────────────────────────────────────────

export interface StoredRules {
  rules: TrafficChannelRules;
  updatedAt: string | null;
}

/** The stored rules, or the built-in lists when nothing valid was ever stored. */
export async function loadTrafficRules(): Promise<StoredRules> {
  const row = await prisma.trafficChannelRules.findUnique({ where: { id: 1 } });
  if (!row) return { rules: DEFAULT_TRAFFIC_RULES, updatedAt: null };
  try {
    return {
      rules: parseTrafficRules(JSON.parse(row.rulesJson)) ?? DEFAULT_TRAFFIC_RULES,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch {
    return { rules: DEFAULT_TRAFFIC_RULES, updatedAt: row.updatedAt.toISOString() };
  }
}

export async function replaceTrafficRules(rules: TrafficChannelRules): Promise<StoredRules> {
  const row = await prisma.trafficChannelRules.upsert({
    where: { id: 1 },
    update: { rulesJson: JSON.stringify(rules) },
    create: { id: 1, rulesJson: JSON.stringify(rules) },
  });
  return { rules, updatedAt: row.updatedAt.toISOString() };
}

// ── reports ─────────────────────────────────────────────────────────────────

export interface ReportQuery {
  range: [number, number];
  tz: number;
  host: string | null;
  channel: TrafficChannel | null;
  limit: number;
  offset: number;
}

export type TrafficDimension = 'source' | 'medium' | 'campaign' | 'referrer' | 'landing' | 'country' | 'device' | 'host' | 'page';

/** One group of visits that share acquisition fields; `value` is the breakdown column. */
interface GroupRow {
  value?: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  clickIds: string | null;
  visitors: bigint | number | null;
  visits: bigint | number | null;
  views: bigint | number | null;
  bounced: bigint | number | null;
  durationMs: bigint | number | null;
}

interface DailyRow extends GroupRow {
  dayIndex: bigint | number | string | null;
}

export interface Figures {
  visitors: number;
  visits: number;
  views: number;
  /** Share of visits that left after one page, 0..1. */
  bounceRate: number;
  avgVisitSeconds: number;
}

export interface TrafficReport {
  period: { from: string; to: string };
  host: string | null;
  rulesVersion: number;
  rulesUpdatedAt: string | null;
  /** Why page views are or are not being counted right now. */
  collection: 'on' | 'paused' | 'plugin-off';
  summary: Figures;
  daily: Array<{ day: string; visitors: number; visits: number; views: number }>;
  channels: Array<Figures & { channel: TrafficChannel }>;
}

export interface TrafficSourceRow extends Figures {
  value: string;
  /** The one channel these visits came from, or null when there was more than one. */
  channel: TrafficChannel | null;
}

export interface TrafficPageRow {
  value: string;
  views: number;
}

export interface TrafficBreakdown {
  dimension: TrafficDimension;
  period: { from: string; to: string };
  host: string | null;
  channel: TrafficChannel | null;
  total: number;
  /** Page views per path for the `page` dimension; visits for every other one. */
  rows: TrafficSourceRow[] | TrafficPageRow[];
}

const AGGREGATE = Prisma.sql`
  COUNT(DISTINCT "visitorKey") AS "visitors",
  COUNT(*) AS "visits",
  SUM("views") AS "views",
  SUM(CASE WHEN "views" = 1 THEN 1 ELSE 0 END) AS "bounced",
  SUM("lastSeenAt" - "startedAt") AS "durationMs"`;

// Fixed column expressions: never built from request input.
const DIMENSIONS: Record<Exclude<TrafficDimension, 'page'>, Prisma.Sql> = {
  source: Prisma.sql`COALESCE("utmSource", "referrerHost")`,
  medium: Prisma.sql`"utmMedium"`,
  campaign: Prisma.sql`"utmCampaign"`,
  referrer: Prisma.sql`"referrerHost"`,
  landing: Prisma.sql`"landingPath"`,
  country: Prisma.sql`"country"`,
  device: Prisma.sql`"device"`,
  host: Prisma.sql`"host"`,
};

interface Totals {
  visitors: number;
  visits: number;
  views: number;
  bounced: number;
  durationMs: number;
  channels: Set<TrafficChannel>;
}

function emptyTotals(): Totals {
  return { visitors: 0, visits: 0, views: 0, bounced: 0, durationMs: 0, channels: new Set() };
}

function addVisits(totals: Totals, row: GroupRow, channel: TrafficChannel | null): void {
  totals.visitors += Number(row.visitors ?? 0);
  totals.visits += Number(row.visits ?? 0);
  totals.views += Number(row.views ?? 0);
  totals.bounced += Number(row.bounced ?? 0);
  totals.durationMs += Number(row.durationMs ?? 0);
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
    referrerHost: row.referrerHost,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    clickIds: row.clickIds ? row.clickIds.split(',') : [],
  }, rules);
}

function formatDay(dayKey: number): string {
  const digits = String(dayKey);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** `startedAt` inside the queried days, narrowed to one storefront host when asked. */
function sessionWhere(query: ReportQuery): Prisma.Sql {
  const bounds = Prisma.sql`"startedAt" >= ${BigInt(query.range[0])} AND "startedAt" < ${BigInt(query.range[1])}`;
  return query.host === null ? bounds : Prisma.sql`${bounds} AND "host" = ${query.host}`;
}

function periodOf(query: ReportQuery): { from: string; to: string } {
  return {
    from: formatDay(trafficDayKey(query.range[0], query.tz)),
    to: formatDay(trafficDayKey(query.range[1] - 1, query.tz)),
  };
}

export async function trafficReport(query: ReportQuery): Promise<TrafficReport> {
  const where = sessionWhere(query);
  const stored = await loadTrafficRules();
  const [summaryRows, channelGroups, dailyGroups] = await Promise.all([
    prisma.$queryRaw<GroupRow[]>(Prisma.sql`
      SELECT ${AGGREGATE} FROM "traffic_sessions" WHERE ${where}`),
    prisma.$queryRaw<GroupRow[]>(Prisma.sql`
      SELECT "referrerHost", "utmSource", "utmMedium", "utmCampaign", "clickIds", ${AGGREGATE}
      FROM "traffic_sessions" WHERE ${where}
      GROUP BY "referrerHost", "utmSource", "utmMedium", "utmCampaign", "clickIds"`),
    // A day index counts local midnights, so the zone offset is added before dividing.
    prisma.$queryRaw<DailyRow[]>(Prisma.sql`
      SELECT FLOOR(("startedAt" + ${BigInt(query.tz * 60_000)}) / 86400000)::BIGINT AS "dayIndex", ${AGGREGATE}
      FROM "traffic_sessions" WHERE ${where}
      GROUP BY 1 ORDER BY 1`),
  ]);

  const summary = emptyTotals();
  for (const row of summaryRows) addVisits(summary, row, null);

  const channelTotals = new Map<TrafficChannel, Totals>(TRAFFIC_CHANNELS.map((channel) => [channel, emptyTotals()]));
  for (const row of channelGroups) {
    const totals = channelTotals.get(channelOf(row, stored.rules));
    if (totals) addVisits(totals, row, null);
  }

  // Every day of the period appears, also the quiet ones.
  const byDay = new Map(dailyGroups.map((row) => [Number(row.dayIndex), row]));
  const daily: TrafficReport['daily'] = [];
  for (let start = query.range[0]; start < query.range[1]; start += DAY_MS) {
    const row = byDay.get((start + query.tz * 60_000) / DAY_MS);
    daily.push({
      day: formatDay(trafficDayKey(start, query.tz)),
      visitors: Number(row?.visitors ?? 0),
      visits: Number(row?.visits ?? 0),
      views: Number(row?.views ?? 0),
    });
  }

  return {
    period: periodOf(query),
    host: query.host,
    rulesVersion: stored.rules.version,
    rulesUpdatedAt: stored.updatedAt,
    collection: await trafficCollectionState(),
    summary: figures(summary),
    daily,
    channels: TRAFFIC_CHANNELS.map((channel) => ({ channel, ...figures(channelTotals.get(channel) ?? emptyTotals()) })),
  };
}

export async function trafficBreakdown(query: ReportQuery, dimension: TrafficDimension): Promise<TrafficBreakdown> {
  if (dimension === 'page') {
    const bounds = Prisma.sql`"day" >= ${trafficDayKey(query.range[0], query.tz)} AND "day" <= ${trafficDayKey(query.range[1] - 1, query.tz)}`;
    const where = query.host === null ? bounds : Prisma.sql`${bounds} AND "host" = ${query.host}`;
    const pages = await prisma.$queryRaw<Array<{ value: string; views: bigint | number | null }>>(Prisma.sql`
      SELECT "path" AS "value", SUM("views") AS "views" FROM "traffic_page_daily" WHERE ${where} GROUP BY "path"`);
    const rows: TrafficPageRow[] = pages
      .map((row) => ({ value: row.value, views: Number(row.views) }))
      .sort((a, b) => b.views - a.views || a.value.localeCompare(b.value));
    return {
      dimension,
      period: periodOf(query),
      host: query.host,
      channel: null,
      total: rows.length,
      rows: rows.slice(query.offset, query.offset + query.limit),
    };
  }

  const column = DIMENSIONS[dimension];
  const where = sessionWhere(query);
  const stored = await loadTrafficRules();
  const groups = await prisma.$queryRaw<GroupRow[]>(Prisma.sql`
    SELECT ${column} AS "value", "referrerHost", "utmSource", "utmMedium", "utmCampaign", "clickIds", ${AGGREGATE}
    FROM "traffic_sessions" WHERE ${where} AND ${column} IS NOT NULL
    GROUP BY ${column}, "referrerHost", "utmSource", "utmMedium", "utmCampaign", "clickIds"`);

  // Visits are grouped by channel first, so a channel filter is exact and
  // each row can say which channel it came from.
  const folded = new Map<string, Totals>();
  for (const row of groups) {
    const channel = channelOf(row, stored.rules);
    if (query.channel !== null && channel !== query.channel) continue;
    const value = String(row.value ?? '');
    const totals = folded.get(value) ?? emptyTotals();
    addVisits(totals, row, channel);
    folded.set(value, totals);
  }
  const rows: TrafficSourceRow[] = [...folded]
    .map(([value, totals]) => ({
      value,
      channel: totals.channels.size === 1 ? [...totals.channels][0] : null,
      ...figures(totals),
    }))
    .sort((a, b) => b.visits - a.visits || b.views - a.views || a.value.localeCompare(b.value));
  return {
    dimension,
    period: periodOf(query),
    host: query.host,
    channel: query.channel,
    total: rows.length,
    rows: rows.slice(query.offset, query.offset + query.limit),
  };
}
