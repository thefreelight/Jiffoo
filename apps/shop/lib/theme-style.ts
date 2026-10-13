import { themeFontFaces, themeTokenStyle } from 'shared';
import type { ShopTheme } from './theme';

export function themeStyle(theme: ShopTheme | null): string {
  if (!theme) return '';
  return `${themeFontFaces(theme.fonts)}\n${themeTokenStyle('shop', theme.tokens, theme.darkTokens,
    (id) => theme.fonts.find((font) => font.id === id)?.family)}`;
}
