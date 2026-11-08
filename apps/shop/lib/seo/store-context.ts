/**
 * Store context reads for SEO metadata.
 *
 * `storeName` (branding.platform_name) replaces the previously hardcoded
 * 'Jiffoo Mall' in product metadata: every page must carry the store's own
 * brand in titles and OpenGraph data, and deployments each have their own
 * brand name.
 */

export async function fetchStoreName(origin: string): Promise<string | null> {
  try {
    const response = await fetch(`${origin}/api/v1/store/context`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      success?: boolean;
      data?: { storeName?: unknown };
    };
    const storeName = body?.data?.storeName;
    if (typeof storeName !== 'string') return null;
    const trimmed = storeName.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
