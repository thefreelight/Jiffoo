import { themeTokensToCss } from 'shared';

export const adminThemeCss = (tokens: Record<string, unknown>): string =>
  themeTokensToCss('admin', tokens, (id) => id === 'outfit' ? 'var(--font-outfit)' : undefined);
