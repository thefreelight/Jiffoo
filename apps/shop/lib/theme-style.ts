import { themeFontFaces, themeTokenStyle } from 'shared';
import type { ShopTheme } from './theme';
import { shopFontTokens } from './theme-fonts';

export function themeStyle(theme: ShopTheme | null): string {
  if (!theme) return '';
  return `${themeFontFaces(theme.fonts)}\n${themeTokenStyle('shop', shopFontTokens(theme.tokens), theme.darkTokens && shopFontTokens(theme.darkTokens),
    (id) => theme.fonts.find((font) => font.id === id)?.family)}`
    .replace(/:root\[data-color-mode=/g, ':root[data-shop-dark-available="true"][data-color-mode=');
}
