import type { ThemeFontFace } from 'shared';

export type AdminTheme = {
  tokens: Record<string, unknown>;
  fonts: ThemeFontFace[];
  logo: string | null;
  loginBackground: string | null;
};

const assetPath = /^\/api\/v1\/themes\/[a-z][a-z0-9-]+\/[0-9]+\.[0-9]+\.[0-9]+\/assets\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)$/;
const fontPath = /^\/api\/v1\/themes\/[a-z][a-z0-9-]+\/[0-9]+\.[0-9]+\.[0-9]+\/fonts\/[a-zA-Z0-9_/-]+\.woff2$/;

function parseAdminTheme(value: unknown): AdminTheme | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const theme = value as Record<string, unknown>;
  if (theme.target !== 'admin' || typeof theme.slug !== 'string'
    || typeof theme.version !== 'string' || !theme.tokens || typeof theme.tokens !== 'object'
    || Array.isArray(theme.tokens) || !Array.isArray(theme.fonts)) return null;
  const asset = (item: unknown) => item === null || (typeof item === 'string' && assetPath.test(item));
  if (!asset(theme.logo) || !asset(theme.loginBackground)) return null;
  if (!theme.fonts.every((font) => font && typeof font === 'object'
    && typeof font.id === 'string' && typeof font.family === 'string'
    && typeof font.url === 'string' && fontPath.test(font.url)
    && Number.isInteger(font.weight) && ['normal', 'italic'].includes(font.style))) return null;
  return theme as AdminTheme;
}

export async function getAdminTheme(locale: string): Promise<AdminTheme | null> {
  const base = process.env.API_SERVICE_URL;
  if (!base) return null;
  try {
    const url = new URL('/api/v1/store/theme', base);
    url.searchParams.set('target', 'admin');
    url.searchParams.set('locale', locale);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = await response.json() as { data?: unknown };
    return parseAdminTheme(body?.data);
  } catch {
    return null;
  }
}
