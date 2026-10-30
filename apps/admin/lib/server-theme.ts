import { cache } from 'react';
import { isStoreTimezone, type ThemeFontFace, type ThemeTokens, type ThemeDarkTokens } from 'shared';

/** The default deadline of a call from the Admin edge to the Core. */
const DEFAULT_EDGE_TIMEOUT_MS = 30000;

/**
 * The deadline of a call from the Admin edge to the Core.
 *
 * The deadline comes from the environment, and a value that is not a positive
 * integer falls back to the default, so a mistyped variable cannot remove the
 * deadline of the edge.
 */
function edgeTimeoutMs(): number {
  const raw = (process.env.CORE_EDGE_TIMEOUT_MS ?? '').trim();
  if (!/^\d+$/.test(raw)) return DEFAULT_EDGE_TIMEOUT_MS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_EDGE_TIMEOUT_MS;
}

/** The Core did not answer within the deadline of the edge. */
class EdgeTimeoutError extends Error {}

/**
 * Arm the deadline of an exchange with the Core.
 *
 * The deadline covers the whole exchange: the request of the Core, the headers
 * of its answer and the body of that answer. A Core that answers the headers
 * and then stalls the body therefore cannot hold the render of the page, and
 * the caller disarms the deadline when the answer is complete.
 */
type EdgeDeadline = {
  /** The signal that reaches the request of the Core and the body of its answer. */
  signal: AbortSignal;
  /** The failure of the deadline, for the caller that waits for the Core. */
  failure: Promise<never>;
  /** Whether the deadline passed. */
  expired: () => boolean;
  /** The end of the exchange, which disarms the deadline. */
  release: () => void;
};

function armEdgeDeadline(timeoutMs: number): EdgeDeadline {
  const controller = new AbortController();
  let expired = false;
  let fail: (error: Error) => void = () => {};
  const failure = new Promise<never>((_, reject) => { fail = reject; });
  failure.catch(() => { /* The caller of the deadline observes the failure. */ });
  const timer = setTimeout(() => {
    expired = true;
    const error = new EdgeTimeoutError('The Core API did not answer within the edge deadline');
    controller.abort(error);
    fail(error);
  }, timeoutMs);
  return {
    signal: controller.signal,
    failure,
    expired: () => expired,
    release: () => clearTimeout(timer),
  };
}

/**
 * Read the answer of the Core under the deadline of the edge.
 *
 * The body of the answer belongs to the exchange: it is read under the same
 * deadline as the headers, so a Core that answers the headers and then stalls
 * the body rejects the call, and the caller falls back to its default instead
 * of waiting for a body that never arrives.
 */
async function fetchCoreJson(url: URL): Promise<{ ok: boolean; data: unknown }> {
  const deadline = armEdgeDeadline(edgeTimeoutMs());
  try {
    const response = await Promise.race([
      fetch(url, { cache: 'no-store', signal: deadline.signal }),
      deadline.failure,
    ]);
    const data = await Promise.race([response.json(), deadline.failure]);
    return { ok: response.ok, data };
  } finally {
    deadline.release();
  }
}

export async function getStoreTimezone(): Promise<string> {
  if (!process.env.API_SERVICE_URL) return 'UTC';
  try {
    const answer = await fetchCoreJson(new URL('/api/v1/store/context', process.env.API_SERVICE_URL));
    if (!answer.ok) return 'UTC';
    const body = answer.data as { data?: { timezone?: unknown } };
    const timezone = body?.data?.timezone;
    return isStoreTimezone(timezone) ? timezone : 'UTC';
  } catch { return 'UTC'; }
}

export type AdminTheme = {
  schemaVersion: 2;
  tokens: ThemeTokens;
  darkAvailable: boolean;
  darkTokens?: ThemeDarkTokens;
  fonts: ThemeFontFace[];
  logo: string | null;
  loginBackground: string | null;
};

const assetPath = /^\/api\/v1\/themes\/[a-z][a-z0-9-]+\/[a-f0-9]{64}\/assets\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)$/;
const fontPath = /^\/api\/v1\/themes\/[a-z][a-z0-9-]+\/[a-f0-9]{64}\/fonts\/[a-zA-Z0-9_/-]+\.woff2$/;

function parseAdminTheme(value: unknown): AdminTheme | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const theme = value as Record<string, unknown>;
  if (theme.schemaVersion !== 2 || typeof theme.darkAvailable !== 'boolean' || theme.target !== 'admin' || typeof theme.slug !== 'string'
    || typeof theme.version !== 'string' || typeof theme.packageHash !== 'string' || !/^[a-f0-9]{64}$/.test(theme.packageHash) || !theme.tokens || typeof theme.tokens !== 'object'
    || Array.isArray(theme.tokens) || !Array.isArray(theme.fonts)) return null;
  const tokens = theme.tokens as Record<string, unknown>;
  if (!tokens.core || typeof tokens.core !== 'object' || Array.isArray(tokens.core)
    || !tokens.extras || typeof tokens.extras !== 'object' || Array.isArray(tokens.extras)) return null;
  if (theme.darkAvailable !== (theme.darkTokens !== undefined)) return null;
  if (theme.darkTokens !== undefined && (!theme.darkTokens || typeof theme.darkTokens !== 'object' || Array.isArray(theme.darkTokens))) return null;
  const prefix = `/api/v1/themes/${theme.slug}/${theme.packageHash}/`;
  const asset = (item: unknown) => item === null || (typeof item === 'string' && assetPath.test(item) && item.startsWith(prefix));
  if (!asset(theme.logo) || !asset(theme.loginBackground)) return null;
  if (!theme.fonts.every((font) => font && typeof font === 'object'
    && typeof font.id === 'string' && typeof font.family === 'string' && typeof font.url === 'string' && fontPath.test(font.url) && font.url.startsWith(prefix)
    && Number.isInteger(font.weight) && ['normal', 'italic'].includes(font.style))) return null;
  return theme as AdminTheme;
}

export const getAdminTheme = cache(async (locale: string): Promise<AdminTheme | null> => {
  const base = process.env.API_SERVICE_URL;
  if (!base) return null;
  try {
    const url = new URL('/api/v1/store/theme', base);
    url.searchParams.set('target', 'admin');
    url.searchParams.set('locale', locale);
    const answer = await fetchCoreJson(url);
    if (!answer.ok) return null;
    const body = answer.data as { data?: unknown };
    return parseAdminTheme(body?.data);
  } catch {
    return null;
  }
});

export function getAdminStoreUrl(locale: string): string {
  return new URL('/' + locale, process.env.STOREFRONT_URL || 'http://localhost:3003').href;
}

export async function getAdminStoreName(): Promise<string> {
  if (!process.env.API_SERVICE_URL) return '';
  try {
    const answer = await fetchCoreJson(new URL('/api/v1/store/context', process.env.API_SERVICE_URL));
    if (!answer.ok) return '';
    const body = answer.data as { data?: { storeName?: unknown } };
    const storeName = body?.data?.storeName;
    return typeof storeName === 'string' ? storeName : '';
  } catch { return ''; }
}
