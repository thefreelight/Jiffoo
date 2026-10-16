import { themeTokenStyle } from 'shared';
import type { ShopTheme } from './theme';
import { shopFontTokens } from './theme-fonts';

export function themeStyle(theme: ShopTheme | null): string {
  if (!theme) return '';
  return `\n${themeTokenStyle('shop', shopFontTokens(theme.tokens), theme.darkTokens && shopFontTokens(theme.darkTokens))}`
    .replaceAll('system-ui, -apple-system, sans-serif', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif')
    .replaceAll('Menlo, Consolas, monospace', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace')
    .replace(/:root\[data-color-mode=/g, ':root[data-shop-dark-available="true"][data-color-mode=');
}
