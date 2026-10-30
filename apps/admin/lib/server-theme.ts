import { cache } from 'react';
import { isStoreTimezone, type ThemeFontFace, type ThemeTokens, type ThemeDarkTokens } from 'shared';

/** The default deadline of the headers of the Core. */
const DEFAULT_EDGE_TIMEOUT_MS = 30000;
/** The default deadline of the body of the Core, which is longer than the deadline of the headers. */
const DEFAULT_EDGE_BODY_TIMEOUT_MS = 300000;

/** The event of every degradation of the edge, so the records can be aggregated. */
const EDGE_DEGRADED_EVENT = 'edge_core_degraded';

/**
 * A positive integer of the environment, or the fallback.
 *
 * A value that is not a positive integer falls back, so a mistyped variable
 * cannot remove the deadline of the edge.
 */
function positiveInteger(value: string | undefined, fallback: number): number {
  const raw = (value ?? '').trim();
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** The deadline of the headers of the Core. */
function edgeTimeoutMs(): number {
  return positiveInteger(process.env.CORE_EDGE_TIMEOUT_MS, DEFAULT_EDGE_TIMEOUT_MS);
}

/** The deadline of the body of the Core. */
function edgeBodyTimeoutMs(): number {
  return positiveInteger(process.env.CORE_EDGE_BODY_TIMEOUT_MS, DEFAULT_EDGE_BODY_TIMEOUT_MS);
}

/**
 * The record of a degradation of the edge.
 *
 * Every degradation of the edge writes one structured record with the same
 * event, so the operator can aggregate the degradations of the Admin and the
 * Shop by their event, their surface and their reason.
 */
function logEdgeDegraded(record: {
  surface: string;
  reason: string;
  path: string;
  headerDeadlineMs: number;
  bodyDeadlineMs: number;
  upstreamStatus: number | null;
  elapsedMs: number;
}): void {
  console.error(JSON.stringify({ event: EDGE_DEGRADED_EVENT, ...record }));
}

/** The Core did not answer within the deadline of the edge. */
class EdgeTimeoutError extends Error {
  constructor(readonly reason: 'header_timeout' | 'body_timeout' | 'core_error', message: string) { super(message); }
}

/**
 * Arm the deadlines of an exchange with the Core.
 *
 * The exchange has two phases with two deadlines: the headers of the answer
 * must arrive within the deadline of the headers, and the body of the answer
 * must arrive within the longer deadline of the body. A Core that answers the
 * headers and then stalls the body therefore fails the call at the deadline
 * of the body, and the caller falls back to its default.
 */
type EdgeDeadline = {
  /** The signal that reaches the request of the Core and the body of its answer. */
  signal: AbortSignal;
  /** The failure of the deadline of the headers. */
  headerFailure: Promise<never>;
  /** Whether the deadline of the headers passed. */
  headerExpired: () => boolean;
  /** The failure of the deadline of the body. */
  bodyFailure: Promise<never>;
  /** Whether the deadline of the body passed. */
  bodyExpired: () => boolean;
  /** The end of the phase of the headers, which hands the exchange to the body. */
  endHeader: () => void;
  /** The end of the exchange, which disarms both deadlines. */
  release: () => void;
};

function createEdgeDeadline(headerMs: number, bodyMs: number): EdgeDeadline {
  const controller = new AbortController();
  let headerExpired = false;
  let bodyExpired = false;
  let failHeader: (error: Error) => void = () => {};
  let failBody: (error: Error) => void = () => {};
  const headerFailure = new Promise<never>((_, reject) => { failHeader = reject; });
  const bodyFailure = new Promise<never>((_, reject) => { failBody = reject; });
  headerFailure.catch(() => { /* The caller of the deadline observes the failure. */ });
  bodyFailure.catch(() => { /* The caller of the deadline observes the failure. */ });
  const headerTimer = setTimeout(() => {
    headerExpired = true;
    const error = new EdgeTimeoutError('header_timeout', 'The Core API did not answer the headers within the edge deadline');
    controller.abort(error);
    failHeader(error);
  }, headerMs);
  let bodyTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    signal: controller.signal,
    headerFailure,
    headerExpired: () => headerExpired,
    bodyFailure,
    bodyExpired: () => bodyExpired,
    endHeader: () => {
      clearTimeout(headerTimer);
      bodyTimer = setTimeout(() => {
        bodyExpired = true;
        const error = new EdgeTimeoutError('body_timeout', 'The Core API did not send the body within the edge deadline');
        controller.abort(error);
        failBody(error);
      }, bodyMs);
    },
    release: () => {
      clearTimeout(headerTimer);
      if (bodyTimer) clearTimeout(bodyTimer);
    },
  };
}

/**
 * Read the answer of the Core under the deadlines of the edge.
 *
 * The body of the answer belongs to the exchange: it is read under the
 * deadline of the body, which is longer than the deadline of the headers, so
 * a Core that answers the headers and then stalls the body fails the call at
 * the deadline of the body, and the caller falls back to its default instead
 * of waiting for a body that never arrives.
 */
async function fetchCoreJson(url: URL): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headerDeadlineMs = edgeTimeoutMs();
  const bodyDeadlineMs = edgeBodyTimeoutMs();
  const deadline = createEdgeDeadline(headerDeadlineMs, bodyDeadlineMs);
  const started = Date.now();
  try {
    const response = await Promise.race([
      fetch(url, { cache: 'no-store', signal: deadline.signal }),
      deadline.headerFailure,
    ]);
    deadline.endHeader();
    const data = await Promise.race([response.json(), deadline.bodyFailure]);
    return { ok: response.ok, status: response.status, data };
  } catch {
    const reason = deadline.headerExpired() ? 'header_timeout' : deadline.bodyExpired() ? 'body_timeout' : 'core_error';
    throw new EdgeTimeoutError(reason, 'The Core API did not answer in time');
  } finally {
    deadline.release();
  }
}

export async function getStoreTimezone(): Promise<string> {
  const started = Date.now();
  if (!process.env.API_SERVICE_URL) {
    logEdgeDegraded({
      surface: 'admin_theme',
      reason: 'core_not_configured',
      path: '/api/v1/store/context',
      headerDeadlineMs: edgeTimeoutMs(),
      bodyDeadlineMs: edgeBodyTimeoutMs(),
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    return 'UTC';
  }
  try {
    const answer = await fetchCoreJson(new URL('/api/v1/store/context', process.env.API_SERVICE_URL));
    if (!answer.ok) {
      logEdgeDegraded({
        surface: 'admin_theme',
        reason: 'upstream_status',
        path: '/api/v1/store/context',
        headerDeadlineMs: edgeTimeoutMs(),
        bodyDeadlineMs: edgeBodyTimeoutMs(),
        upstreamStatus: answer.status,
        elapsedMs: Date.now() - started,
      });
      return 'UTC';
    }
    const body = answer.data as { data?: { timezone?: unknown } };
    const timezone = body?.data?.timezone;
    return isStoreTimezone(timezone) ? timezone : 'UTC';
  } catch (error) {
    logEdgeDegraded({
      surface: 'admin_theme',
      reason: error instanceof EdgeTimeoutError ? error.reason : 'core_error',
      path: '/api/v1/store/context',
      headerDeadlineMs: edgeTimeoutMs(),
      bodyDeadlineMs: edgeBodyTimeoutMs(),
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    return 'UTC';
  }
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
  const started = Date.now();
  if (!base) {
    logEdgeDegraded({
      surface: 'admin_theme',
      reason: 'core_not_configured',
      path: '/api/v1/store/theme',
      headerDeadlineMs: edgeTimeoutMs(),
      bodyDeadlineMs: edgeBodyTimeoutMs(),
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    return null;
  }
  try {
    const url = new URL('/api/v1/store/theme', base);
    url.searchParams.set('target', 'admin');
    url.searchParams.set('locale', locale);
    const answer = await fetchCoreJson(url);
    if (!answer.ok) {
      logEdgeDegraded({
        surface: 'admin_theme',
        reason: 'upstream_status',
        path: '/api/v1/store/theme',
        headerDeadlineMs: edgeTimeoutMs(),
        bodyDeadlineMs: edgeBodyTimeoutMs(),
        upstreamStatus: answer.status,
        elapsedMs: Date.now() - started,
      });
      return null;
    }
    const body = answer.data as { data?: unknown };
    return parseAdminTheme(body?.data);
  } catch (error) {
    logEdgeDegraded({
      surface: 'admin_theme',
      reason: error instanceof EdgeTimeoutError ? error.reason : 'core_error',
      path: '/api/v1/store/theme',
      headerDeadlineMs: edgeTimeoutMs(),
      bodyDeadlineMs: edgeBodyTimeoutMs(),
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    return null;
  }
});

export function getAdminStoreUrl(locale: string): string {
  return new URL('/' + locale, process.env.STOREFRONT_URL || 'http://localhost:3003').href;
}

export async function getAdminStoreName(): Promise<string> {
  const started = Date.now();
  if (!process.env.API_SERVICE_URL) {
    logEdgeDegraded({
      surface: 'admin_theme',
      reason: 'core_not_configured',
      path: '/api/v1/store/context',
      headerDeadlineMs: edgeTimeoutMs(),
      bodyDeadlineMs: edgeBodyTimeoutMs(),
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    return '';
  }
  try {
    const answer = await fetchCoreJson(new URL('/api/v1/store/context', process.env.API_SERVICE_URL));
    if (!answer.ok) {
      logEdgeDegraded({
        surface: 'admin_theme',
        reason: 'upstream_status',
        path: '/api/v1/store/context',
        headerDeadlineMs: edgeTimeoutMs(),
        bodyDeadlineMs: edgeBodyTimeoutMs(),
        upstreamStatus: answer.status,
        elapsedMs: Date.now() - started,
      });
      return '';
    }
    const body = answer.data as { data?: { storeName?: unknown } };
    const storeName = body?.data?.storeName;
    return typeof storeName === 'string' ? storeName : '';
  } catch (error) {
    logEdgeDegraded({
      surface: 'admin_theme',
      reason: error instanceof EdgeTimeoutError ? error.reason : 'core_error',
      path: '/api/v1/store/context',
      headerDeadlineMs: edgeTimeoutMs(),
      bodyDeadlineMs: edgeBodyTimeoutMs(),
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    return '';
  }
}
