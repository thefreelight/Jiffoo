/**
 * Jiffoo Design System - Shadow Tokens
 */

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',

  // Brand shadows with blue tint
  'brand-sm': '0 4px 14px -3px rgba(37, 99, 235, 0.15)',
  'brand-md': '0 10px 30px -10px rgba(37, 99, 235, 0.3)',
  'brand-lg': '0 20px 40px -10px rgba(37, 99, 235, 0.4)',

  // Card hover shadow
  'card-hover': '0 20px 40px -15px rgba(37, 99, 235, 0.15)',
} as const;

export const borderRadius = {
  none: '0',
  sm: '4px',
  DEFAULT: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export type Shadows = typeof shadows;
export type BorderRadius = typeof borderRadius;

