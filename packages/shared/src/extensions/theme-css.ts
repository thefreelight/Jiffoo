import {
  SHOP_COLOR_ROLES, ADMIN_COLOR_ROLES, SHOP_LENGTH_ROLES, type ThemeTarget,
} from './theme-contract';

const shopDefaults: Record<string, string> = {
  background: '#f5f7f4', surface: '#ffffff', text: '#18312d',
  'text-muted': '#64716d', border: '#d9e2db', primary: '#166b52',
  'primary-foreground': '#ffffff', accent: '#e4efcd',
  'radius-md': '0.375rem', 'card-radius': '0.375rem',
};
const adminDefaults: Record<string, string> = {
  background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A',
  'text-muted': '#64748B', border: '#E2E8F0', primary: '#3B82F6',
  'primary-foreground': '#FFFFFF', 'sidebar-bg': '#FFFFFF',
  'sidebar-text': '#64748B', 'sidebar-active-bg': '#EFF6FF',
  'sidebar-active-text': '#3B82F6', success: '#16A34A',
  warning: '#D97706', danger: '#DC2626', info: '#2563EB',
  'radius-sm': '4px', 'radius-md': '8px', 'radius-lg': '12px',
};
const colors = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const lengths = /^(?:0|[1-9][0-9]{0,3})(?:\.[0-9]{1,4})?(?:px|rem)$/;
const valid = (target: ThemeTarget, key: string, value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if ((target === 'shop' ? SHOP_COLOR_ROLES : ADMIN_COLOR_ROLES as readonly string[]).includes(key))
    return colors.test(value);
  if ((target === 'shop' ? SHOP_LENGTH_ROLES as readonly string[] : ['radius-sm', 'radius-md', 'radius-lg']).includes(key))
    return lengths.test(value) && Number.parseFloat(value) <= (key === 'container-width' ? 1600 : 128);
  return false;
};

export function themeTokensToCss(target: ThemeTarget, tokens: Record<string, unknown>): string {
  const defaults = target === 'shop' ? shopDefaults : adminDefaults;
  const keys = new Set([
    ...(target === 'shop' ? SHOP_COLOR_ROLES : ADMIN_COLOR_ROLES),
    ...(target === 'shop' ? SHOP_LENGTH_ROLES : ['radius-sm', 'radius-md', 'radius-lg']),
  ]);
  return [...keys].flatMap((key) => {
    const value = valid(target, key, tokens[key]) ? tokens[key] : defaults[key];
    return value && valid(target, key, value) ? [`--${target}-${key}: ${value};`] : [];
  }).join('\n');
}

export const themeCoreDefaults = { shop: shopDefaults, admin: adminDefaults };
