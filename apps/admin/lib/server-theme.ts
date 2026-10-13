import { cache } from 'react';
import { isStoreTimezone, type ThemeFontFace, type ThemeTokens, type ThemeDarkTokens } from 'shared';

export async function getStoreTimezone(): Promise<string> {
  if (!process.env.API_SERVICE_URL) return 'UTC';
  try {
    const response = await fetch(new URL('/api/v1/store/context', process.env.API_SERVICE_URL), { cache: 'no-store' });
    if (!response.ok) return 'UTC';
    const body = await response.json();
    return isStoreTimezone(body?.data?.timezone) ? body.data.timezone : 'UTC';
  } catch { return 'UTC'; }
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
    && typeof font.id === 'string' && typeof font.family === 'string'
    && typeof font.url === 'string' && fontPath.test(font.url) && font.url.startsWith(prefix)
    && Number.isInteger(font.weight) && ['normal', 'italic'].includes(font.style))) return null;
  return theme as AdminTheme;
}

export const getAdminTheme = cache(async (locale: string): Promise<AdminTheme | null> => {
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
});

export function getAdminStoreUrl(locale: string): string {
  return new URL('/' + locale, process.env.STOREFRONT_URL || 'http://localhost:3003').href;
}

export async function getAdminStoreName(): Promise<string> {
  if (!process.env.API_SERVICE_URL) return '';
  try {
    const response = await fetch(new URL('/api/v1/store/context', process.env.API_SERVICE_URL), { cache: 'no-store' });
    if (!response.ok) return '';
    const body = await response.json();
    return typeof body?.data?.storeName === 'string' ? body.data.storeName : '';
  } catch { return ''; }
}
