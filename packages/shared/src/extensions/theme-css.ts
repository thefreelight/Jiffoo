import {
  SHOP_COLOR_ROLES, ADMIN_COLOR_ROLES, SHOP_LENGTH_ROLES, type ThemeTarget,
} from './theme-contract';

const shopDefaults: Record<string, unknown> = {
  background: '#f5f7f4', surface: '#ffffff', 'surface-muted': '#edf2ed',
  text: '#18312d', 'text-muted': '#64716d', border: '#d9e2db',
  primary: '#166b52', 'primary-foreground': '#ffffff',
  secondary: '#e4efcd', 'secondary-foreground': '#18312d', accent: '#e4efcd',
  success: '#23774d', warning: '#9a5b12', danger: '#b83232',
  'header-bg': '#ffffff', 'header-text': '#18312d',
  'footer-bg': '#ffffff', 'footer-text': '#18312d',
  'announcement-bg': '#166b52', 'announcement-text': '#ffffff',
  price: '#18312d', 'sale-price': '#b83232',
  'font-body': 'system-sans', 'font-heading': 'system-sans',
  'font-size-base': '1rem', 'radius-sm': '0.25rem', 'radius-md': '0.375rem',
  'radius-lg': '0.5rem', 'button-radius': '0.375rem', 'card-radius': '0.375rem',
  'section-spacing': '3rem', 'container-width': '1280px',
  'type-scale': 1, 'heading-weight': 600, 'button-style': 'solid',
  'card-shadow': { x: '0px', y: '2px', blur: '8px', spread: '0px', color: '#18312d' },
};
const adminDefaults: Record<string, unknown> = {
  background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A',
  'text-muted': '#64748B', border: '#E2E8F0', primary: '#3B82F6',
  'primary-foreground': '#FFFFFF', 'sidebar-bg': '#FFFFFF',
  'sidebar-text': '#64748B', 'sidebar-active-bg': '#EFF6FF',
  'sidebar-active-text': '#3B82F6', success: '#16A34A',
  warning: '#D97706', danger: '#DC2626', info: '#2563EB',
  'radius-sm': '4px', 'radius-md': '8px', 'radius-lg': '12px',
  'surface-muted': '#F1F5F9', 'font-body': 'outfit', density: 'comfortable',
  'card-shadow': { x: '0px', y: '2px', blur: '8px', spread: '0px', color: '#0F172A' },
};
const colors = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const lengths = /^(?:0|[1-9][0-9]{0,3})(?:\.[0-9]{1,4})?(?:px|rem)$/;
const signedLength = /^-?(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,4})?(?:px|rem)$/;
const serialize = (target: ThemeTarget, key: string, value: unknown): string | null => {
  if ((target === 'shop' ? SHOP_COLOR_ROLES : ADMIN_COLOR_ROLES as readonly string[]).includes(key))
    return typeof value === 'string' && colors.test(value) ? value : null;
  if ((target === 'shop' ? SHOP_LENGTH_ROLES as readonly string[] : ['radius-sm', 'radius-md', 'radius-lg']).includes(key))
    return typeof value === 'string' && lengths.test(value)
      && Number.parseFloat(value) <= (key === 'container-width' ? 1600 : 128) ? value : null;
  if (key === 'font-body' || key === 'font-heading')
    return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9 -]{0,99}$/.test(value) ? `"${value}"` : null;
  if (target === 'shop' && key === 'type-scale')
    return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 2 ? String(value) : null;
  if (target === 'shop' && key === 'heading-weight')
    return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 900 ? String(value) : null;
  if (target === 'shop' && key === 'button-style')
    return value === 'solid' || value === 'outline' ? value : null;
  if (target === 'admin' && key === 'density')
    return value === 'compact' || value === 'comfortable' ? value : null;
  if (key === 'card-shadow' && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(',') !== 'blur,color,spread,x,y') return null;
    if (!['x', 'y', 'spread'].every((name) => typeof record[name] === 'string'
      && signedLength.test(record[name]) && Math.abs(Number.parseFloat(record[name])) <= 128)
      || typeof record.blur !== 'string' || !lengths.test(record.blur)
      || Number.parseFloat(record.blur) > 128 || typeof record.color !== 'string'
      || !colors.test(record.color)) return null;
    return `${record.x} ${record.y} ${record.blur} ${record.spread} ${record.color}`;
  }
  return null;
};

export function themeTokensToCss(target: ThemeTarget, tokens: Record<string, unknown>): string {
  const defaults = target === 'shop' ? shopDefaults : adminDefaults;
  const keys = new Set([
    ...(target === 'shop' ? SHOP_COLOR_ROLES : ADMIN_COLOR_ROLES),
    ...(target === 'shop' ? SHOP_LENGTH_ROLES : ['radius-sm', 'radius-md', 'radius-lg']),
    'font-body', ...(target === 'shop' ? ['font-heading'] : []),
    'card-shadow', ...(target === 'shop' ? ['type-scale', 'heading-weight', 'button-style'] : ['density']),
  ]);
  return [...keys].flatMap((key) => {
    const value = serialize(target, key, tokens[key]) ?? serialize(target, key, defaults[key]);
    return value === null ? [] : [`--${target}-${key}: ${value};`];
  }).join('\n');
}

export const themeCoreDefaults = { shop: shopDefaults, admin: adminDefaults };
