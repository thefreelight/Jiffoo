import type { ThemeTokens, ThemeDarkTokens } from 'shared';

// Resolve built-in system defaults locally without changing the theme package contract.
export function shopFontTokens<T extends ThemeTokens | ThemeDarkTokens>(tokens: T): T {
  return { ...tokens, core: Object.fromEntries(Object.entries(tokens.core ?? {}).map(([role, value]) => [
    role, role.startsWith('font-') ? (role === 'font-mono' ? 'system-mono' : 'system-sans') : value,
  ])) };
}
