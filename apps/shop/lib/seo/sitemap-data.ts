/**
 * Storefront sitemap data.
 *
 * Product URLs for /sitemap.xml come from the runtime-local SEO surface:
 * - Cloudflare-native: `/api/v1/plugins/seo/store/sitemap` (projects the
 *   `/api/v1/products` snapshot payload — native instances keep no product
 *   table);
 * - Node self-hosted: `/api/seo/store/sitemap` (Prisma Product query).
 *
 * Neither surface answers → the sitemap falls back to static routes only.
 */

export interface SitemapProductEntry {
  id: string;
  lastmod?: string;
}

export interface StorefrontSitemapResult {
  items: SitemapProductEntry[];
  truncated: boolean;
}

export const STOREFRONT_SITEMAP_CAP = 5000;

interface SitemapItemPayload {
  id?: unknown;
  lastmod?: unknown;
}

function parseSitemapItems(payload: unknown): SitemapProductEntry[] | null {
  const data = payload as { items?: unknown; truncated?: unknown } | null;
  if (!Array.isArray(data?.items)) return null;
  const items: SitemapProductEntry[] = [];
  for (const item of data.items as SitemapItemPayload[]) {
    if (typeof item?.id !== 'string' || item.id.length === 0) continue;
    items.push({
      id: item.id,
      ...(typeof item.lastmod === 'string' && item.lastmod ? { lastmod: item.lastmod } : {}),
    });
  }
  return items;
}

async function fetchSurface(url: string): Promise<StorefrontSitemapResult | null> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; data?: unknown };
    if (body?.success !== true) return null;
    const items = parseSitemapItems(body.data);
    if (items === null) return null;
    const truncated = (body.data as { truncated?: boolean } | null)?.truncated === true;
    return { items, truncated };
  } catch {
    return null;
  }
}

export async function fetchStorefrontSitemapItems(
  origin: string
): Promise<StorefrontSitemapResult> {
  const surfaces = [
    `${origin}/api/v1/plugins/seo/store/sitemap`,
    `${origin}/api/seo/store/sitemap`,
  ];
  for (const url of surfaces) {
    const result = await fetchSurface(url);
    if (result !== null) {
      return result;
    }
  }
  return { items: [], truncated: false };
}
