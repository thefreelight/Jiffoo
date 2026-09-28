import { themeFontFaces, themeTokensToCss } from 'shared';
import type { ShopTheme } from './theme';

export function themeStyle(theme: ShopTheme | null): string {
  if (!theme) return '';
  return `${themeFontFaces(theme.fonts)}\n:root{\n${themeTokensToCss('shop', theme.tokens,
    (id) => theme.fonts.find((font) => font.id === id)?.family)}\n}`;
}
