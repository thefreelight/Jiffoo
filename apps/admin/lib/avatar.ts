export function resolveAvatarSrc(src?: string | null): string | null {
  if (!src) {
    return null;
  }

  const normalized = src.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('/')) {
    return normalized;
  }

  if (normalized.startsWith('data:image/')) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return normalized;
    }
  } catch {
    return null;
  }

  return null;
}

export function getAvatarFallbackText(name?: string | null, username?: string | null): string {
  const label = (name || username || '').trim();
  if (!label) {
    return 'U';
  }

  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) || 'U').toUpperCase();
}
