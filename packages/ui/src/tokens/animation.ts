/**
 * Jiffoo Design System - Animation Tokens
 */

export const animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // CSS transition durations
  transitionDuration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },

  // Bezier curves for Framer Motion
  easing: {
    easeOut: [0.0, 0.0, 0.2, 1] as const,
    easeIn: [0.4, 0.0, 1, 1] as const,
    easeInOut: [0.4, 0.0, 0.2, 1] as const,
  },

  // CSS timing functions
  timingFunction: {
    easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
    easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
} as const;

// Framer Motion variants
export const motionVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },

  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },

  // Button interactions
  button: {
    hover: { scale: 1.02 },
    tap: { scale: 0.98 },
  },

  // Card interactions
  card: {
    hover: { y: -8 },
    tap: { scale: 0.98 },
  },
} as const;

export type Animation = typeof animation;
export type MotionVariants = typeof motionVariants;

