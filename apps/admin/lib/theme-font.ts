import { themeFontFaces, themeTokensToCss, themeTokenStyle, type ThemeFontFace, type ThemeTokens, type ThemeDarkTokens } from 'shared';
const fontResolver = (fonts: ThemeFontFace[]) => (id: string) =>
  fonts.find((font) => font.id === id)?.family ?? (id === 'outfit' ? 'var(--font-outfit)' : undefined);
export const adminThemeCss = (tokens: ThemeTokens, fonts: ThemeFontFace[] = []): string =>
  themeTokensToCss('admin', tokens, fontResolver(fonts));
export const adminThemeStyle = (theme: { tokens: ThemeTokens; darkTokens?: ThemeDarkTokens; fonts: ThemeFontFace[] }): string =>
  `${themeFontFaces(theme.fonts)}\n${themeTokenStyle('admin', theme.tokens, theme.darkTokens, fontResolver(theme.fonts))}`
    .replace(/:root\[data-color-mode=/g, ':root[data-admin-dark-available="true"][data-color-mode=');
