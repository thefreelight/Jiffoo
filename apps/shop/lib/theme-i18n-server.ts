import { resolveServerApiOrigin } from '@/lib/server-api-url';
import { pickThemeNamespaces, type ThemeMessageTable } from '@/lib/theme-i18n';

const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 2000;

const cache = new Map<string, { expiresAt: number; table: ThemeMessageTable | null }>();

/**
 * Theme translations for a locale from the Store Localization plugin, cached
 * briefly per server instance. Fails open: a disabled plugin, a timeout or a
 * malformed payload all resolve to null, and the theme's built-in copy stays
 * in charge. Server only — it reads request headers.
 */
export async function getThemeMessages(locale: string, options: { apiOrigin?: string } = {}): Promise<ThemeMessageTable | null> {
  const cached = cache.get(locale);
  if (cached && cached.expiresAt > Date.now()) return cached.table;

  let table: ThemeMessageTable | null = null;
  try {
    const origin = (options.apiOrigin ?? (await resolveServerApiOrigin())).replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${origin}/api/v1/plugins/i18n/messages/${encodeURIComponent(locale)}`,
        { signal: controller.signal, cache: 'no-store', headers: { accept: 'application/json' } },
      );
      if (response.ok) {
        const payload = (await response.json()) as { success?: boolean; data?: Record<string, Record<string, string>> };
        if (payload?.success) table = pickThemeNamespaces(payload.data);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    table = null;
  }

  cache.set(locale, { expiresAt: Date.now() + CACHE_TTL_MS, table });
  return table;
}
