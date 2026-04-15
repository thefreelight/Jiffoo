const ARTIFACT_HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;
const artifactHealthCache = new Map<string, { ok: boolean; expiresAt: number; error?: string }>();

function readCache(url: string): { ok: boolean; expiresAt: number; error?: string } | null {
  const cached = artifactHealthCache.get(url);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    artifactHealthCache.delete(url);
    return null;
  }
  return cached;
}

function writeCache(url: string, ok: boolean, error?: string): boolean {
  artifactHealthCache.set(url, {
    ok,
    error,
    expiresAt: Date.now() + ARTIFACT_HEALTH_CACHE_TTL_MS,
  });
  return ok;
}

export async function checkOfficialArtifactReachable(url: string | null | undefined): Promise<boolean> {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  const normalizedUrl = url.trim();
  const cached = readCache(normalizedUrl);
  if (cached) {
    return cached.ok;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(normalizedUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    if (response.ok) {
      return writeCache(normalizedUrl, true);
    }

    return writeCache(normalizedUrl, false, `HTTP ${response.status}`);
  } catch (error) {
    return writeCache(normalizedUrl, false, error instanceof Error ? error.message : 'Request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export async function assertOfficialArtifactReachable(url: string | null | undefined): Promise<void> {
  const ok = await checkOfficialArtifactReachable(url);
  if (ok) {
    return;
  }

  const normalizedUrl = typeof url === 'string' ? url.trim() : '';
  const cached = normalizedUrl ? readCache(normalizedUrl) : null;
  const suffix = cached?.error ? ` (${cached.error})` : '';
  const error = new Error(`Official artifact is currently unavailable${suffix}`);
  Object.assign(error, {
    statusCode: 502,
    code: 'OFFICIAL_ARTIFACT_UNAVAILABLE',
    details: normalizedUrl ? { packageUrl: normalizedUrl, cause: cached?.error || null } : undefined,
  });
  throw error;
}
