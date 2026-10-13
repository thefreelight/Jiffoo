export type ColorMode = 'system' | 'light' | 'dark';
export const COLOR_MODE_COOKIE = 'jiffoo_admin_color_mode';
export const SIDEBAR_COOKIE = 'jiffoo_admin_sidebar_collapsed';
export function parseColorMode(value: string | undefined): ColorMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function effectiveColorMode(mode: ColorMode, darkAvailable: boolean): ColorMode {
  return mode === 'dark' && !darkAvailable ? 'light' : mode;
}
export function parseSidebarCollapsed(value: string | undefined): boolean { return value === '1'; }
export function preferenceCookie(name: typeof COLOR_MODE_COOKIE | typeof SIDEBAR_COOKIE, value: string, secure: boolean): string {
  return name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=31536000; SameSite=Lax' + (secure ? '; Secure' : '');
}
