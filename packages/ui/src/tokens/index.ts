/**
 * Jiffoo Design System - Design Tokens
 */

export { colors } from './colors';
export type { Colors, ColorScale, SemanticColor } from './colors';

export { spacing, spacingValues } from './spacing';
export type { Spacing, SpacingKey } from './spacing';

export { typography } from './typography';
export type { Typography } from './typography';

export { shadows, borderRadius } from './shadows';
export type { Shadows, BorderRadius } from './shadows';

export { animation, motionVariants } from './animation';
export type { Animation, MotionVariants } from './animation';

// Re-export all tokens as a single object
import { colors as _colors } from './colors';
import { spacing as _spacing } from './spacing';
import { typography as _typography } from './typography';
import { shadows as _shadows, borderRadius as _borderRadius } from './shadows';
import { animation as _animation } from './animation';

export const tokens = {
  colors: _colors,
  spacing: _spacing,
  typography: _typography,
  shadows: _shadows,
  borderRadius: _borderRadius,
  animation: _animation,
} as const;

