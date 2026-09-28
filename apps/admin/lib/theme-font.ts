import { themeFontFaces, themeTokensToCss, type ThemeFontFace } from 'shared';

export const adminThemeCss = (tokens: Record<string, unknown>, fonts: ThemeFontFace[] = []): string =>
  themeTokensToCss('admin', tokens, (id) =>
    fonts.find((font) => font.id === id)?.family ?? (id === 'outfit' ? 'var(--font-outfit)' : undefined));

export const adminThemeStyle = (theme: { tokens: Record<string, unknown>; fonts: ThemeFontFace[] }): string =>
  `${themeFontFaces(theme.fonts)}\n:root{\n${adminThemeCss(theme.tokens, theme.fonts)}\n}`;
