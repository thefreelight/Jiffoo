/**
 * Jiffoo Design System
 *
 * A modern, minimalist design system for e-commerce applications.
 * Inspired by Apple and Stripe design language.
 *
 * @packageDocumentation
 */

// Components
export {
  Button,
  ProductCard,
  Input,
  Navigation,
  ProductGrid,
} from './components';

export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  ProductCardProps,
  CardBadge,
  CardAspectRatio,
  InputProps,
  NavigationProps,
  NavItem,
  ProductGridProps,
} from './components';

// Admin Components (Jiffoo Blue Minimal)
export {
  AdminLayout,
  Sidebar,
  TopHeader,
  StatCard,
  StatsGrid,
  ContentCard,
  CardsRow,
  PluginItem,
  AdminBadge,
  AdminTabs,
  SearchBar,
} from './components/admin';

export type {
  AdminLayoutProps,
  SidebarProps,
  NavItem as AdminNavItem,
  TopHeaderProps,
  HeaderAction,
  StatCardProps,
  StatsGridProps,
  ContentCardProps,
  CardsRowProps,
  PluginItemProps,
  AdminBadgeProps,
  BadgeVariant,
  AdminTabsProps,
  TabItem,
  SearchBarProps,
} from './components/admin';

// Tokens
export {
  colors,
  spacing,
  spacingValues,
  typography,
  shadows,
  borderRadius,
  animation,
  motionVariants,
} from './tokens';

export type {
  Colors,
  ColorScale,
  SemanticColor,
  Spacing,
  SpacingKey,
  Typography,
  Shadows,
  BorderRadius,
  Animation,
  MotionVariants,
} from './tokens';

// Hooks
export {
  useAnimation,
  useResponsive,
  breakpoints,
} from './hooks';

export type {
  UseAnimationOptions,
  Breakpoint,
} from './hooks';

// Utilities
export {
  cn,
  calculateContrastRatio,
  meetsContrastAA,
  meetsContrastAAA,
  validateTouchTarget,
  hasAccessibleName,
  prefersReducedMotion,
} from './utils';

