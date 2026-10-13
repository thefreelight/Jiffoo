import {
  CORE_COLOR_ROLES, CORE_LENGTH_ROLES, CORE_FONT_ROLES,
  ADMIN_EXTRA_COLOR_ROLES, SHOP_EXTRA_COLOR_ROLES, SHOP_EXTRA_LENGTH_ROLES,
  type ThemeTarget, type ThemeTokens, type ThemeDarkTokens,
} from './theme-contract';
const bridge: Record<ThemeTarget, Record<string, string>> = require('./theme-bridge.json');
export const themeDefaultTokens: Record<ThemeTarget, ThemeTokens> = require('./theme-defaults.json');

export const builtinFontStacks = {
  'system-sans': 'system-ui, -apple-system, sans-serif',
  'system-serif': 'Georgia, "Times New Roman", serif',
  'system-mono': 'Menlo, Consolas, monospace',
  outfit: '"Outfit", system-ui, sans-serif',
  geist: 'var(--font-geist-sans, system-ui), "Noto Sans SC", system-ui, sans-serif',
  'geist-mono': 'var(--font-geist-mono, monospace), "Noto Sans SC", monospace',
  'noto-sans-sc': '"Noto Sans SC", system-ui, sans-serif',
} as const;
export type FontResolver = (id: string) => string | undefined;
const colors = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$(?![\s\S])/;
const lengths = /^(?:0|[1-9][0-9]{0,3})(?:\.[0-9]{1,4})?(?:px|rem)$/;
const signedLength = /^-?(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,4})?(?:px|rem)$/;
export function mergeThemeTokens(tokens: ThemeTokens, dark?: ThemeDarkTokens): ThemeTokens {
  return { core: { ...tokens.core, ...dark?.core }, extras: { ...tokens.extras, ...dark?.extras } };
}
function serialize(target: ThemeTarget, group: string, role: string, value: unknown, resolveFont: FontResolver): string | null {
  const colorRoles: readonly string[] = group === 'core' ? CORE_COLOR_ROLES
    : target === 'admin' ? ADMIN_EXTRA_COLOR_ROLES : SHOP_EXTRA_COLOR_ROLES;
  if (colorRoles.includes(role)) return typeof value === 'string' && colors.test(value) ? value : null;
  const lengthRoles: readonly string[] = group === 'core' ? CORE_LENGTH_ROLES : target === 'shop' ? SHOP_EXTRA_LENGTH_ROLES : [];
  if (lengthRoles.includes(role)) return typeof value === 'string' && lengths.test(value)
    && Number.parseFloat(value) <= (role === 'container-width' && value.endsWith('px') ? 1600 : 128) ? value : null;
  if (group === 'core' && (CORE_FONT_ROLES as readonly string[]).includes(role)) {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value)) return null;
    const family = resolveFont(value);
    if (value === 'outfit' && family === 'var(--font-outfit)') return 'var(--font-outfit), system-ui, sans-serif';
    if (Object.prototype.hasOwnProperty.call(builtinFontStacks, value)) return builtinFontStacks[value as keyof typeof builtinFontStacks];
    return family && /^[A-Za-z][A-Za-z0-9 -]{0,99}$/.test(family) ? `"${family}", sans-serif` : null;
  }
  if (target !== 'shop' || group !== 'extras') return null;
  if (role === 'type-scale') return typeof value === 'number' && value >= 1 && value <= 2 && Number.isFinite(value) ? String(value) : null;
  if (role === 'heading-weight') return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 900 ? String(value) : null;
  if (role === 'button-style') return value === 'solid' || value === 'outline' ? value : null;
  if (role === 'card-shadow' && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(',') !== 'blur,color,spread,x,y') return null;
    if (!['x', 'y', 'spread'].every((name) => typeof record[name] === 'string' && signedLength.test(record[name]) && Math.abs(Number.parseFloat(record[name])) <= 128)
      || typeof record.blur !== 'string' || !lengths.test(record.blur) || Number.parseFloat(record.blur) > 128
      || typeof record.color !== 'string' || !colors.test(record.color)) return null;
    return `${record.x} ${record.y} ${record.blur} ${record.spread} ${record.color}`;
  }
  return null;
}

// Temporary presentation bridge only: remove aliases as Admin/Shop pages adopt v2 roles.
// This does not accept or serialize v1 manifests. See docs/agentra-003-theme-format.md.
export function themeTokensToCss(target: ThemeTarget, tokens: ThemeTokens, resolveFont: FontResolver = () => undefined): string {
  tokens = mergeThemeTokens(themeDefaultTokens[target], tokens);
  const declarations: string[] = [];
  const serialized = new Set<string>();
  for (const group of ['core', 'extras'] as const) for (const [role, raw] of Object.entries(tokens[group])) {
    const value = serialize(target, group, role, raw, resolveFont)
      ?? serialize(target, group, role, themeDefaultTokens[target][group][role], resolveFont);
    if (value === null) continue;
    serialized.add(`${group}.${role}`);
    declarations.push(`--${target}-${group}-${role}: ${value};`);
  }
  for (const [alias, tokenPath] of Object.entries(bridge[target])) {
    if (!serialized.has(tokenPath)) continue;
    const [group, role] = tokenPath.split('.');
    declarations.push(`--${target}-${alias}: var(--${target}-${group}-${role});`);
  }
  return declarations.join('\n');
}
export function themeTokenStyle(target: ThemeTarget, tokens: ThemeTokens, darkTokens?: ThemeDarkTokens, resolveFont: FontResolver = () => undefined): string {
  const light = `:root{\n${themeTokensToCss(target, tokens, resolveFont)}\n}`;
  if (!darkTokens) return light;
  const dark = themeTokensToCss(target, mergeThemeTokens(tokens, darkTokens), resolveFont);
  return `${light}\n@media (prefers-color-scheme: dark) { :root[data-color-mode="system"] {\n${dark}\n} }\n:root[data-color-mode="dark"] {\n${dark}\n}`;
}
