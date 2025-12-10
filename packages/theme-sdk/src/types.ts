/**
 * Jiffoo Theme SDK - Type Definitions
 */

/**
 * Theme manifest structure
 */
export interface ThemeManifest {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: ThemeCategory;
  thumbnail: string;
  screenshots?: string[];
  features?: string[];
  tags?: string[];
  compatibility?: {
    minVersion?: string;
    maxVersion?: string;
  };
  tokens?: ThemeTokens;
  components?: ThemeComponents;
}

/**
 * Theme categories
 */
export type ThemeCategory =
  | 'general'
  | 'fashion'
  | 'electronics'
  | 'food'
  | 'home'
  | 'beauty'
  | 'sports'
  | 'minimal'
  | 'luxury';

/**
 * Design tokens
 */
export interface ThemeTokens {
  colors?: ColorTokens;
  typography?: TypographyTokens;
  spacing?: SpacingTokens;
  borderRadius?: BorderRadiusTokens;
  shadows?: ShadowTokens;
  animations?: AnimationTokens;
}

/**
 * Color tokens
 */
export interface ColorTokens {
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
  destructive?: string;
  destructiveForeground?: string;
  success?: string;
  successForeground?: string;
  warning?: string;
  warningForeground?: string;
  [key: string]: string | undefined;
}

/**
 * Typography tokens
 */
export interface TypographyTokens {
  fontFamily?: {
    sans?: string;
    serif?: string;
    mono?: string;
  };
  fontSize?: {
    xs?: string;
    sm?: string;
    base?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
    '3xl'?: string;
    '4xl'?: string;
  };
  fontWeight?: {
    light?: number;
    normal?: number;
    medium?: number;
    semibold?: number;
    bold?: number;
  };
  lineHeight?: {
    tight?: string;
    normal?: string;
    relaxed?: string;
  };
}

/**
 * Spacing tokens
 */
export interface SpacingTokens {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  '2xl'?: string;
  '3xl'?: string;
}

/**
 * Border radius tokens
 */
export interface BorderRadiusTokens {
  none?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  full?: string;
}

/**
 * Shadow tokens
 */
export interface ShadowTokens {
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
}

/**
 * Animation tokens
 */
export interface AnimationTokens {
  duration?: {
    fast?: string;
    normal?: string;
    slow?: string;
  };
  easing?: {
    default?: string;
    in?: string;
    out?: string;
    inOut?: string;
  };
}

/**
 * Theme components configuration
 */
export interface ThemeComponents {
  header?: ComponentConfig;
  footer?: ComponentConfig;
  productCard?: ComponentConfig;
  button?: ComponentConfig;
  input?: ComponentConfig;
  [key: string]: ComponentConfig | undefined;
}

/**
 * Component configuration
 */
export interface ComponentConfig {
  variant?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, string>;
}

/**
 * Theme configuration (user customizations)
 */
export interface ThemeConfig {
  tokens?: Partial<ThemeTokens>;
  components?: Partial<ThemeComponents>;
  custom?: Record<string, unknown>;
}

