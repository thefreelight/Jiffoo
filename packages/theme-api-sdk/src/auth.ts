import type { ThemeApiTokenProvider } from './types';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

/**
 * Browser token provider for theme apps.
 * Priority: localStorage -> cookie. A cookie-found token (parent-domain
 * session sharing from a sibling subdomain) is promoted back into
 * localStorage so localStorage-only readers see the session too.
 */
export function createBrowserTokenProvider(
  key: string = 'auth_token'
): ThemeApiTokenProvider {
  return () => {
    if (typeof window === 'undefined') return null;
    const local = window.localStorage.getItem(key);
    if (local) return local;
    const cookieToken = getCookie(key);
    if (cookieToken) {
      try {
        window.localStorage.setItem(key, cookieToken);
      } catch {
        // Storage may be unavailable; the cookie fallback still works.
      }
    }
    return cookieToken;
  };
}
