import { resolveServerApiOrigin } from '@/lib/server-api-url';

const CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 1500;

let cached: { expiresAt: number; enabled: boolean } | null = null;

/** Test hook: forget the cached switch. */
export function resetTrafficSwitchCache(): void {
  cached = null;
}

/**
 * Whether the storefront should count page views. The switch lives in the
 * Core API — the Traffic Analytics plugin is installed and not paused — and is
 * read once per cache window so page renders do not wait on it. Fails closed:
 * a timeout or an unreachable API means nothing is sent. Server only.
 */
export async function isTrafficCollectionEnabled(options: { apiOrigin?: string; now?: () => number } = {}): Promise<boolean> {
  const now = options.now ?? Date.now;
  if (cached && cached.expiresAt > now()) return cached.enabled;

  let enabled = false;
  try {
    const origin = (options.apiOrigin ?? (await resolveServerApiOrigin())).replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${origin}/api/v1/traffic/config`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      if (response.ok) {
        const payload = (await response.json()) as { success?: boolean; data?: { enabled?: unknown } };
        enabled = payload?.success === true && payload.data?.enabled === true;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    enabled = false;
  }

  cached = { expiresAt: now() + CACHE_TTL_MS, enabled };
  return enabled;
}
