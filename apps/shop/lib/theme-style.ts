import { themeTokensToCss } from 'shared';
import type { ShopTheme } from './theme';

export function themeStyle(theme: ShopTheme | null): string {
  if (!theme) return '';
  const fonts = theme.fonts.flatMap((font) => {
    if (!/^[A-Za-z][A-Za-z0-9 -]{0,99}$/.test(font.family)
      || !/^\/api\/v1\/themes\/[a-z][a-z0-9-]+\/[0-9]+\.[0-9]+\.[0-9]+\/fonts\/[a-zA-Z0-9_/-]+\.woff2$/.test(font.url)
      || !Number.isInteger(font.weight) || font.weight < 100 || font.weight > 900
      || !['normal', 'italic'].includes(font.style)) return [];
    return [`@font-face{font-family:"${font.family}";src:url("${font.url}") format("woff2");font-weight:${font.weight};font-style:${font.style};font-display:swap;}`];
  });
  return `${fonts.join('\n')}\n:root{\n${themeTokensToCss('shop', theme.tokens,
    (id) => theme.fonts.find((font) => font.id === id)?.family)}\n}`;
}
