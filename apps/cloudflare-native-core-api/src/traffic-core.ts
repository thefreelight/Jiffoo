/**
 * Traffic collection — pure, dependency-free core.
 *
 * The native worker does not import workspace packages, so this file is
 * mirrored byte-for-byte instead of shared:
 *   apps/cloudflare-native-core-api/src/traffic-core.ts
 *   apps/api/src/core/traffic/traffic-core.ts
 * A guard test in each package fails when the two copies drift. Edit one,
 * copy it over the other, and run both test suites.
 *
 * Nothing here touches the network, the database or the clock. It only
 * decides what a pageview means: which fields are worth keeping, whether a
 * request is a machine, and which channel a visit came from.
 */

export const TRAFFIC_SETTING_KEY = 'traffic.collection.enabled';
export const TRAFFIC_SESSION_GAP_MS = 30 * 60 * 1000;
export const TRAFFIC_DEFAULT_RETENTION_DAYS = 400;
export const TRAFFIC_RULES_MAX_BYTES = 64 * 1024;
export const TRAFFIC_PAYLOAD_MAX_BYTES = 4 * 1024;
export const TRAFFIC_LIST_MAX_ENTRIES = 600;
export const TRAFFIC_RULES_MAX_ENTRIES = 3000;

/**
 * Query parameters the tracker reports by name when present on a landing
 * URL. Whether a parameter means "paid" is a rule decision, not a code one.
 */
export const TRAFFIC_CLICK_PARAMS = [
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'ttclid',
  'twclid',
  'fbclid',
  'igshid',
  'li_fat_id',
  'mc_eid',
  'mc_cid',
  '_bta_tid',
  'yclid',
  'rb_clickid',
] as const;

export const TRAFFIC_CHANNELS = [
  'paid',
  'ai',
  'search',
  'social',
  'email',
  'campaign',
  'referral',
  'direct',
] as const;

export type TrafficChannel = (typeof TRAFFIC_CHANNELS)[number];

export type TrafficDevice = 'mobile' | 'tablet' | 'desktop' | 'other';

/**
 * Channel rules are data. The core ships empty rules (everything external is
 * a referral); an analytics plugin supplies the search / AI / social lists
 * through the admin rules endpoint, so a list update needs no core release.
 */
export interface TrafficChannelRules {
  version: number;
  /** Referrer hosts and bare `utm_source` values of AI assistants. */
  ai: string[];
  /** Referrer hosts of search engine result pages. */
  search: string[];
  /** Hosts under `search` that are not result pages (webmail, translators). */
  searchExclude: string[];
  /** Referrer hosts of social networks, communities and video platforms. */
  social: string[];
  /** Referrer hosts of webmail clients. */
  email: string[];
  /** `utm_medium` values that mark a paid placement. */
  paidMediums: string[];
  /** Query parameters whose presence marks a paid click. */
  paidClickParams: string[];
  /** `utm_medium` values that mark e-mail. */
  emailMediums: string[];
  /** `utm_medium` values that mark a social post. */
  socialMediums: string[];
}

export const EMPTY_TRAFFIC_RULES: TrafficChannelRules = {
  version: 0,
  ai: [],
  search: [],
  searchExclude: [],
  social: [],
  email: [],
  paidMediums: [],
  paidClickParams: [],
  emailMediums: [],
  socialMediums: [],
};

const RULE_LIST_KEYS = [
  'ai',
  'search',
  'searchExclude',
  'social',
  'email',
  'paidMediums',
  'paidClickParams',
  'emailMediums',
  'socialMediums',
] as const;

export interface TrafficPageview {
  host: string;
  path: string;
  /** External page the visit came from; own-site and unusable referrers are null. */
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** Comma-joined names of the click parameters present on the landing URL. */
  clickIds: string | null;
  viewportWidth: number | null;
  /** The viewer's zone offset in minutes east of UTC, when the tracker sent it. */
  zoneOffsetMinutes: number | null;
}

function parseZoneOffset(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return Math.abs(value) <= 14 * 60 ? value : null;
}

export interface TrafficAcquisition {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  clickIds: readonly string[];
}

const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const RULE_ENTRY_PATTERN = /^[a-z0-9._-]+$/;
const FAMILY_LABEL_PATTERN = /^[a-z]{2,24}$/;
const MAX_HOST_LENGTH = 253;
const MAX_FIELD_LENGTH = 200;
const MAX_RULE_ENTRY_LENGTH = 80;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanField(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  if (CONTROL_CHARACTERS.test(trimmed)) return null;
  return trimmed;
}

export function normalizeTrafficHost(value: unknown): string | null {
  const host = cleanField(value, MAX_HOST_LENGTH);
  if (host === null) return null;
  const lower = host.toLowerCase().replace(/\.$/, '');
  return HOST_PATTERN.test(lower) ? lower : null;
}

/** `a.example.com` and `b.example.com` share the last two labels. */
function isSameSite(host: string, otherHost: string): boolean {
  if (host === otherHost) return true;
  const labels = host.split('.');
  const otherLabels = otherHost.split('.');
  if (labels.length < 2 || otherLabels.length < 2) return false;
  return labels.slice(-2).join('.') === otherLabels.slice(-2).join('.');
}

/**
 * Reads a referrer URL down to its hostname. Only http(s) referrers count,
 * the query string and fragment are dropped here and never stored, and a
 * referrer from the site itself is not a source.
 */
export function normalizeTrafficReferrer(value: unknown, ownHost: string): string | null {
  const raw = cleanField(value, 2048);
  if (raw === null) return null;
  // Android apps name themselves as android-app://<package>/https/<site>; the site is what matters.
  const androidApp = raw.match(/^android-app:\/\/[a-z0-9_.]+\/(https?)\/(.+)$/i);
  const candidate = androidApp ? `${androidApp[1]}://${androidApp[2]}` : raw;
  let hostname: string;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    hostname = parsed.hostname;
  } catch {
    return null;
  }
  let host = hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  if (ownHost !== '' && isSameSite(host, ownHost)) return null;
  return HOST_PATTERN.test(host) ? host : null;
}

const SECOND_LEVEL_LABELS = new Set(['com', 'co', 'net', 'org', 'gov', 'edu', 'ac', 'mil', 'sch']);

/**
 * `base` ends with a dot (`google.`); the rest must be one plain label
 * (`google.com`) or a common second-level label plus a two-letter country
 * (`www.google.co.uk`), so `googleusercontent.com` and `google.complex.io`
 * stay out.
 */
function matchesFamily(host: string, base: string): boolean {
  let index = host.indexOf(base);
  while (index !== -1) {
    if (index === 0 || host[index - 1] === '.') {
      const labels = host.slice(index + base.length).split('.');
      const plain = labels.length === 1 && FAMILY_LABEL_PATTERN.test(labels[0]);
      const country = labels.length === 2
        && SECOND_LEVEL_LABELS.has(labels[0])
        && /^[a-z]{2}$/.test(labels[1]);
      if (plain || country) return true;
    }
    index = host.indexOf(base, index + 1);
  }
  return false;
}

/**
 * Matches a hostname against rule entries.
 *  - `example.com` matches the host and any subdomain.
 *  - `example.*` matches `example.<tld>` and any subdomain of it.
 *  - a bare token is compared as-is (`utm_source=chatgpt`).
 */
export function trafficHostMatches(host: string, entries: readonly string[]): boolean {
  const value = host.toLowerCase();
  for (const raw of entries) {
    const entry = raw.trim().toLowerCase();
    if (entry.endsWith('.*')) {
      if (matchesFamily(value, entry.slice(0, -1))) return true;
    } else if (!entry.includes('.')) {
      if (value === entry) return true;
    } else if (value === entry || value.endsWith('.' + entry)) {
      return true;
    }
  }
  return false;
}

function parseRuleList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > TRAFFIC_LIST_MAX_ENTRIES) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const entry = item.trim().toLowerCase();
    const hasStar = entry.includes('*');
    const wellFormedStar = !hasStar || (entry.endsWith('.*') && entry.indexOf('*') === entry.length - 1);
    if (entry.length === 0 || entry.length > MAX_RULE_ENTRY_LENGTH) return null;
    if (!RULE_ENTRY_PATTERN.test(entry.replace(/\.\*$/, '')) || !wellFormedStar) return null;
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}

/** Validates a rules document as sent by an admin client; null when anything is off. */
export function parseTrafficRules(raw: unknown): TrafficChannelRules | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) return null;
  if (JSON.stringify(raw).length > TRAFFIC_RULES_MAX_BYTES) return null;
  const rules: Partial<TrafficChannelRules> = { version: raw.version };
  let total = 0;
  for (const key of RULE_LIST_KEYS) {
    const list = parseRuleList(raw[key]);
    if (list === null) return null;
    total += list.length;
    rules[key] = list;
  }
  if (total > TRAFFIC_RULES_MAX_ENTRIES) return null;
  return rules as TrafficChannelRules;
}

function lowercaseOrNull(value: string | null): string | null {
  return value === null ? null : value.toLowerCase();
}

/**
 * Turns a tracker beacon into the fields worth storing. The beacon carries
 * the page as the browser shows it, query string included; the UTM tags and
 * click ids are read from that query and the query itself is then dropped, so
 * no tracking parameter is ever stored. Returns null for anything that is not
 * a well-formed pageview; the caller answers the same either way because
 * nobody is listening to the answer.
 */
export function parseTrafficPageview(body: unknown, fallbackHost: string): TrafficPageview | null {
  if (!isRecord(body)) return null;
  const host = normalizeTrafficHost(body.h) ?? normalizeTrafficHost(fallbackHost);
  const rawPath = typeof body.p === 'string' ? body.p.trim() : '';
  if (host === null) return null;
  if (rawPath.length === 0 || rawPath.length > 2048 || CONTROL_CHARACTERS.test(rawPath)) return null;
  if (!rawPath.startsWith('/') || rawPath.startsWith('//')) return null;
  const withoutHash = rawPath.slice(0, rawPath.indexOf('#') === -1 ? undefined : rawPath.indexOf('#'));
  const question = withoutHash.indexOf('?');
  const path = question === -1 ? withoutHash : withoutHash.slice(0, question);
  const query = new URLSearchParams(question === -1 ? '' : withoutHash.slice(question + 1));
  const clickIds = TRAFFIC_CLICK_PARAMS.filter((name) => query.has(name));
  const width = body.w;
  return {
    host,
    path,
    referrerHost: normalizeTrafficReferrer(body.r, host),
    utmSource: lowercaseOrNull(cleanField(query.get('utm_source'), MAX_FIELD_LENGTH)),
    utmMedium: lowercaseOrNull(cleanField(query.get('utm_medium'), MAX_FIELD_LENGTH)),
    utmCampaign: cleanField(query.get('utm_campaign'), MAX_FIELD_LENGTH),
    utmContent: cleanField(query.get('utm_content'), MAX_FIELD_LENGTH),
    utmTerm: cleanField(query.get('utm_term'), MAX_FIELD_LENGTH),
    clickIds: clickIds.length > 0 ? clickIds.join(',') : null,
    viewportWidth:
      typeof width === 'number' && Number.isInteger(width) && width >= 0 && width <= 20000 ? width : null,
    zoneOffsetMinutes: parseZoneOffset(body.z),
  };
}

/**
 * Ordered the way the simple analytics tools order it: an explicit paid
 * marker wins, then AI assistants (they beat both campaign tags and search
 * lists, since some lists file assistants under search), then search, e-mail
 * and social, then anything tagged, anything external, and finally direct.
 */
export function classifyTraffic(acquisition: TrafficAcquisition, rules: TrafficChannelRules): TrafficChannel {
  const { referrerHost, utmSource, utmMedium } = acquisition;
  const hasClick = acquisition.clickIds.some((name) => rules.paidClickParams.includes(name));
  if (hasClick) return 'paid';
  if (utmMedium !== null && rules.paidMediums.includes(utmMedium)) return 'paid';
  if (
    (referrerHost !== null && trafficHostMatches(referrerHost, rules.ai)) ||
    (utmSource !== null && trafficHostMatches(utmSource, rules.ai))
  ) {
    return 'ai';
  }
  if (
    referrerHost !== null &&
    trafficHostMatches(referrerHost, rules.search) &&
    !trafficHostMatches(referrerHost, rules.searchExclude)
  ) {
    return 'search';
  }
  if (
    (utmMedium !== null && rules.emailMediums.includes(utmMedium)) ||
    (referrerHost !== null && trafficHostMatches(referrerHost, rules.email))
  ) {
    return 'email';
  }
  if (
    (utmMedium !== null && rules.socialMediums.includes(utmMedium)) ||
    (referrerHost !== null && trafficHostMatches(referrerHost, rules.social))
  ) {
    return 'social';
  }
  if (utmSource !== null || utmMedium !== null || acquisition.utmCampaign !== null) {
    return 'campaign';
  }
  return referrerHost !== null ? 'referral' : 'direct';
}

// In-app browsers that real people click through (WhatsApp, LINE, Slack,
// Facebook, WeChat…) are deliberately absent: their link-preview fetchers are
// caught by other signatures, and dropping a human to catch a bot is the
// worse trade. "bot", "spider", "crawler" and "scraper" match as word
// endings (Googlebot, GPTBot, Baiduspider) but not inside longer words.
const BOT_SUFFIX_PATTERN = /[a-z]*(?:bot|spider|crawler|scraper)\b/i;
const BOT_WORD_PATTERN =
  /\b(crawl|scrape|slurp|fetcher|fetching|monitoring|monitor|headless\w*|lighthouse|pagespeed|page\s+speed|pingdom|gtmetrix|datadog|archiver|validator|preview|embedly|libwww|httpclient|http-client|okhttp|python|curl|wget|java|go-http-client|node-fetch|axios|facebookexternalhit|vkshare|telegrambot|skypeuripreview|slackbot|bingpreview)\b/i;

/** Conservative: only well-known machine signatures, so real apps are never dropped. */
export function looksLikeTrafficBot(userAgent: string): boolean {
  const value = userAgent.trim();
  if (value.length === 0 || value.length > 512) return true;
  return BOT_SUFFIX_PATTERN.test(value) || BOT_WORD_PATTERN.test(value);
}

const TABLET_PATTERN = /\b(ipad|tablet|playbook|silk|kindle|sm-t\d|gt-p\d)\b/i;
const MOBILE_PATTERN = /\b(mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile|mobile)\b/i;

const DESKTOP_WIDTH = 1200;
const MOBILE_WIDTH = 768;

/**
 * Device class. The viewport width the tracker sends decides when present,
 * because several Android browsers leave "Mobile" out of their user agent;
 * otherwise the user agent decides.
 */
export function trafficDevice(userAgent: string, viewportWidth: number | null): TrafficDevice {
  if (viewportWidth !== null) {
    if (viewportWidth < MOBILE_WIDTH) return 'mobile';
    if (viewportWidth < DESKTOP_WIDTH) return 'tablet';
    return 'desktop';
  }
  if (TABLET_PATTERN.test(userAgent)) return 'tablet';
  if (MOBILE_PATTERN.test(userAgent)) return 'mobile';
  if (/\bandroid\b/i.test(userAgent)) return 'tablet';
  if (/mozilla/i.test(userAgent)) return 'desktop';
  return 'other';
}

/** Calendar day in the viewer's zone as `YYYYMMDD`. */
export function trafficDayKey(timestampMs: number, zoneOffsetMinutes: number): number {
  const shifted = new Date(timestampMs + zoneOffsetMinutes * 60 * 1000);
  return (
    shifted.getUTCFullYear() * 10000 + (shifted.getUTCMonth() + 1) * 100 + shifted.getUTCDate()
  );
}

/** `[start, end)` in epoch milliseconds for whole days `from..to` (inclusive) in the viewer's zone. */
export function trafficDayRange(fromDay: number, toDay: number, zoneOffsetMinutes: number): [number, number] {
  const start = Date.UTC(Math.floor(fromDay / 10000), Math.floor(fromDay / 100) % 100 - 1, fromDay % 100);
  const endDay = toDay + 1;
  const end = Date.UTC(Math.floor(endDay / 10000), Math.floor(endDay / 100) % 100 - 1, endDay % 100);
  return [start - zoneOffsetMinutes * 60 * 1000, end - zoneOffsetMinutes * 60 * 1000];
}

function parseDayNumber(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-?\d{2}-?\d{2}$/.test(value)) return null;
  return Number(value.replace(/-/g, ''));
}

/**
 * Accepts `YYYYMMDD` or `YYYY-MM-DD` whole days in the viewer's zone and
 * returns the matching `[start, end)` in epoch milliseconds. Both days must
 * be real calendar days and the span may not exceed the retention window.
 */
export function parseTrafficPeriod(
  from: unknown,
  to: unknown,
  zoneOffsetMinutes: number,
): [number, number] | null {
  const fromDay = parseDayNumber(from);
  const untilDay = parseDayNumber(to);
  if (fromDay === null || untilDay === null) return null;
  const [start, end] = trafficDayRange(fromDay, untilDay, zoneOffsetMinutes);
  if (end <= start) return null;
  // A day like 20260231 rolls over silently in Date.UTC, so round-trip it.
  if (trafficDayKey(start, zoneOffsetMinutes) !== fromDay) return null;
  if (trafficDayKey(end - 1, zoneOffsetMinutes) !== untilDay) return null;
  if (end - start > (TRAFFIC_DEFAULT_RETENTION_DAYS + 1) * 86400000) return null;
  return [start, end];
}

type HeaderReader = (name: string) => string | null | undefined;

function firstHeader(read: HeaderReader, name: string): string | null {
  const value = read(name)?.trim();
  return value ? value.slice(0, 64) : null;
}

/**
 * The address a visitor came from. The storefront proxy forwards the address
 * it saw under a name of its own, because a Worker-to-Worker hop can replace
 * Cloudflare's own header with a shared placeholder; a client that sends the
 * header directly only changes its own visitor key.
 */
export function trafficClientIp(read: HeaderReader): string {
  const forwarded = read('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64);
  return (firstHeader(read, 'x-jiffoo-client-ip') ?? firstHeader(read, 'cf-connecting-ip') ?? forwarded) || 'unknown';
}

/** Two-letter country code when the edge knows it; null otherwise. */
export function trafficClientCountry(read: HeaderReader): string | null {
  const value = (firstHeader(read, 'x-jiffoo-client-country') ?? firstHeader(read, 'cf-ipcountry'))?.toUpperCase();
  return value && /^[A-Z]{2}$/.test(value) ? value : null;
}

/**
 * A beacon counts only when it plausibly comes from a page the storefront
 * served: browsers always send Origin on a POST, Fetch Metadata must not name
 * another site as the initiator, and when the request arrived through the
 * storefront proxy that proxy's host must be the origin itself. Returns the
 * origin host, or null when the beacon should be dropped.
 */
export function trafficOriginHost(
  origin: string | null,
  forwardedHost: string | null,
  fetchSite: string | null,
): string | null {
  if (fetchSite !== null && fetchSite.trim().toLowerCase() === 'cross-site') return null;
  let host: string | null = null;
  try {
    const url = new URL(origin ?? '');
    if (url.protocol === 'http:' || url.protocol === 'https:') host = url.host.toLowerCase();
  } catch {
    return null;
  }
  if (host === null) return null;
  const forwarded = forwardedHost?.trim() || null;
  if (forwarded !== null) {
    try {
      if (new URL(`https://${forwarded.toLowerCase()}`).host !== host) return null;
    } catch {
      return null;
    }
  }
  return host;
}

/**
 * Pseudonymous per-month visitor key: HMAC over client IP and user agent,
 * keyed by a secret derived from the instance secret with the month folded
 * in, so keys rotate every month and the raw address is never kept.
 */
export async function trafficVisitorKey(
  secret: string,
  clientIp: string,
  userAgent: string,
  now: number,
): Promise<string> {
  const month = new Date(now).toISOString().slice(0, 7);
  const encoder = new TextEncoder();
  // The WebCrypto global, present in Workers and in Node 20+; the identity
  // crypto module in this worker uses it the same way.
  const subtle = crypto.subtle;
  const root = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const monthKey = await subtle.sign('HMAC', root, encoder.encode(`jiffoo-traffic-visitor:${month}`));
  const key = await subtle.importKey('raw', monthKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await subtle.sign('HMAC', key, encoder.encode(`${clientIp}|${userAgent}`));
  return [...new Uint8Array(signature)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
