export function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function normalizePrefix(prefix: string): string {
  if (!prefix) return '';
  const withLeading = prefix.startsWith('/') ? prefix : `/${prefix}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}

export function buildPathWithQuery(
  path: string,
  query?: Record<string, unknown>
): string {
  if (!query || Object.keys(query).length === 0) return path;

  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item !== undefined && item !== null) params.append(key, String(item));
      }
      continue;
    }
    params.append(key, String(raw));
  }

  const queryString = params.toString();
  if (!queryString) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${queryString}`;
}

export function resolveApiPath(apiPrefix: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalizedPath = normalizePath(path);
  if (!apiPrefix) return normalizedPath;
  if (normalizedPath.startsWith(`${apiPrefix}/`) || normalizedPath === apiPrefix) {
    return normalizedPath;
  }
  return `${apiPrefix}${normalizedPath}`;
}

export function shouldUseJsonBody(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false;
  return true;
}
