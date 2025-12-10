/**
 * Jiffoo Blue Minimal Design Tokens
 * 
 * Design tokens for the Jiffoo Blue Minimal design system.
 * These tokens define the visual language of the Jiffoo brand.
 */

export const jiffooBlueColors = {
  // Primary Brand Color
  primary: {
    DEFAULT: '#3B82F6',
    hover: '#2563EB',
    light: '#EFF6FF',
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  
  // Background Colors
  background: {
    main: '#F8FAFC',
    card: '#FFFFFF',
  },
  
  // Text Colors
  text: {
    main: '#0F172A',
    muted: '#64748B',
  },
  
  // Border Color
  border: '#E2E8F0',
  
  // Semantic Colors
  success: {
    light: '#DCFCE7',
    DEFAULT: '#22C55E',
    dark: '#15803D',
  },
  warning: {
    light: '#FEF3C7',
    DEFAULT: '#F59E0B',
    dark: '#B45309',
  },
  error: {
    light: '#FEE2E2',
    DEFAULT: '#EF4444',
    dark: '#B91C1C',
  },
} as const;

export const jiffooBlueTypography = {
  fontFamily: {
    sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
    mono: ['SF Mono', 'Monaco', 'Consolas', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1.1' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

export const jiffooBlueShadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  // Jiffoo Blue branded shadows
  button: '0 4px 14px -4px rgba(59, 130, 246, 0.5)',
  'button-hover': '0 6px 20px -4px rgba(59, 130, 246, 0.6)',
  card: '0 25px 50px -12px rgba(59, 130, 246, 0.15)',
} as const;

export const jiffooBlueBorderRadius = {
  none: '0',
  sm: '4px',
  DEFAULT: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const jiffooBlueSpacing = {
  'header-height': '72px',
  'container-width': '1024px',
  'section-padding': '100px',
} as const;

// Export all tokens
export const jiffooBlueTokens = {
  colors: jiffooBlueColors,
  typography: jiffooBlueTypography,
  shadows: jiffooBlueShadows,
  borderRadius: jiffooBlueBorderRadius,
  spacing: jiffooBlueSpacing,
} as const;

export default jiffooBlueTokens;

