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
 * Priority: localStorage -> cookie
 */
export function createBrowserTokenProvider(
  key: string = 'auth_token'
): ThemeApiTokenProvider {
  return () => {
    if (typeof window === 'undefined') return null;
    const local = window.localStorage.getItem(key);
    if (local) return local;
    return getCookie(key);
  };
}
