/**
 * Storefront SEO redirect consumption.
 *
 * The host (shop) enforces admin-configured redirects by reading the
 * redirect table of its own runtime:
 * - Cloudflare-native: the seo-store adapter at
 *   `/api/v1/plugins/seo/store/*` (backed by D1 `native_seo_redirects`);
 * - Node self-hosted: the core SEO module alias at `/api/seo/store/*`
 *   (backed by Prisma SeoRedirect).
 *
 * When neither surface answers, redirects are simply not enforced and the
 * request proceeds unchanged. Callers should cache the fetched list on a
 * TTL (see the middleware) instead of fetching per request.
 */

export interface StorefrontRedirect {
  fromPath: string;
  toPath: string;
  statusCode: number;
}

export type RedirectSurface = 'native' | 'core';

export interface StorefrontRedirectsResult {
  items: StorefrontRedirect[];
  /** Which surface answered; null when neither did (redirects not enforced). */
  surface: RedirectSurface | null;
}

const VALID_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_LIST_SIZE = 500;

export function normalizeRedirectPath(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Keep the raw value when the path carries invalid escapes.
  }
  if (decoded.length > 1 && decoded.endsWith('/')) {
    decoded = decoded.slice(0, -1);
  }
  return decoded || '/';
}

interface RedirectItemPayload {
  fromPath?: unknown;
  toPath?: unknown;
  statusCode?: unknown;
}

function parseRedirectItems(payload: unknown): StorefrontRedirect[] | null {
  const items = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;
  const list: StorefrontRedirect[] = [];
  for (const item of items as RedirectItemPayload[]) {
    const fromPath = typeof item.fromPath === 'string' ? item.fromPath : null;
    const toPath = typeof item.toPath === 'string' ? item.toPath : null;
    const statusCode = Number(item.statusCode);
    if (!fromPath || !toPath || !VALID_STATUS_CODES.has(statusCode)) continue;
    list.push({ fromPath: normalizeRedirectPath(fromPath), toPath, statusCode });
  }
  return list;
}

async function fetchSurface(url: string): Promise<StorefrontRedirect[] | null> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; data?: unknown };
    if (body?.success !== true) return null;
    return parseRedirectItems(body.data);
  } catch {
    return null;
  }
}

/**
 * Fetch the active redirect list from the runtime-local SEO surface.
 * Tries the native adapter first, then the Node core alias; a valid
 * (possibly empty) answer from a surface ends the probe.
 */
export async function fetchStorefrontRedirects(
  origin: string,
  limit = MAX_LIST_SIZE
): Promise<StorefrontRedirectsResult> {
  const capped = Math.min(Math.max(1, Math.trunc(limit)), MAX_LIST_SIZE);
  const surfaces: Array<{ surface: RedirectSurface; url: string }> = [
    { surface: 'native', url: `${origin}/api/v1/plugins/seo/store/redirects?limit=${capped}` },
    { surface: 'core', url: `${origin}/api/seo/store/redirects?limit=${capped}` },
  ];
  for (const { surface, url } of surfaces) {
    const items = await fetchSurface(url);
    if (items !== null) {
      return { items, surface };
    }
  }
  return { items: [], surface: null };
}

export function matchStorefrontRedirect(
  list: StorefrontRedirect[],
  pathname: string
): StorefrontRedirect | null {
  const normalized = normalizeRedirectPath(pathname);
  return list.find((redirect) => redirect.fromPath === normalized) ?? null;
}

/**
 * Only page-ish requests are redirect candidates: navigations only
 * (GET/HEAD), never the app shell (`/_next/*`) and never asset-like
 * paths with a file extension.
 */
export function isRedirectCandidate(pathname: string, method: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (pathname === '/' || pathname.startsWith('/_next/')) return false;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !/\.[a-z0-9]+$/i.test(lastSegment);
}

/**
 * Build the absolute redirect target. Relative `toPath` values resolve
 * against the request origin; incoming query parameters are carried over
 * unless the target already defines the same key (repeated incoming keys
 * keep their first value).
 */
export function buildRedirectTarget(
  match: StorefrontRedirect,
  search: string,
  origin: string
): string {
  const target = match.toPath.startsWith('/')
    ? new URL(match.toPath, origin)
    : new URL(match.toPath);
  if (search) {
    const incoming = new URLSearchParams(search);
    incoming.forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.append(key, value);
    });
  }
  return target.toString();
}

/**
 * Best-effort hit accounting on the surface that served the list.
 * Fire-and-forget: failures must never affect the redirect response.
 */
export async function countRedirectHit(
  origin: string,
  surface: RedirectSurface,
  pathname: string
): Promise<void> {
  const path = encodeURIComponent(normalizeRedirectPath(pathname));
  const url = surface === 'native'
    ? `${origin}/api/v1/plugins/seo/store/redirects/resolve?path=${path}`
    : `${origin}/api/seo/store/redirects/resolve?path=${path}`;
  try {
    await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  } catch {
    // Hit counting is observability only.
  }
}
