import type { ShopLocale } from './locale';

export const ACCESS_COOKIE = 'shop_access';
export const REFRESH_COOKIE = 'shop_refresh';
export const REFRESH_SECONDS = 7 * 24 * 60 * 60;
export const ORIGIN_ERROR = 'INVALID_ORIGIN';

export function cookieOptions(storefrontUrl: string, maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/' as const,
    secure: new URL(storefrontUrl).protocol === 'https:',
    maxAge,
  };
}

export function stripTokens(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTokens);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) =>
      !['access_token', 'refresh_token', 'token'].includes(key))
      .map(([key, entry]) => [key, stripTokens(entry)]));
  }
  return value;
}

export function safeNextPath(value: string | null | undefined, locale: ShopLocale): string {
  const fallback = `/${locale}`;
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  let decoded = value;
  try {
    for (let i = 0; i < 5 && decoded.includes('%'); i += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch { return fallback; }
  if (!decoded.startsWith('/') || decoded.startsWith('//') ||
    decoded.includes('\\') || /[\x00-\x1f\x7f]/.test(decoded) ||
    /(?:^|\/)(?:https?|javascript|data):/i.test(decoded) ||
    /%(?:2f|5c|3a|00)/i.test(decoded)) return fallback;
  return value;
}

export function allowedBffRoute(method: string, path: string): boolean {
  if (/(?:%|\\|\/\/|\.\.)/i.test(path)) return false;
  if (/^\/cart\/items\/c[a-z0-9]{24}$/.test(path)) return ['PUT', 'DELETE'].includes(method);
  if (/^\/orders\/c[a-z0-9]{24}$/.test(path)) return method === 'GET';
  if (/^\/orders\/c[a-z0-9]{24}\/cancel$/.test(path)) return method === 'POST';
  if (/^\/orders\/c[a-z0-9]{24}\/tracking-claim$/.test(path)) return method === 'POST';
  if (/^\/payments\/verify\/[a-zA-Z0-9:_-]{1,200}$/.test(path)) return method === 'GET';
  return new Set([
    'POST /auth/login', 'POST /auth/register', 'POST /auth/refresh',
    'POST /auth/logout', 'POST /auth/forgot-password', 'POST /auth/reset-password',
    'POST /auth/resend-verification', 'POST /auth/verify-email/code',
    'GET /auth/verify-email', 'GET /account/profile',
    'PUT /account/profile', 'PUT /account/email',
    'POST /auth/change-password', 'DELETE /account',
    'GET /cart', 'POST /cart/items', 'DELETE /cart',
    'POST /checkout/quote', 'POST /orders', 'GET /orders',
    'GET /payments/available-methods', 'POST /payments/create-session',
  ]).has(`${method} ${path}`);
}
