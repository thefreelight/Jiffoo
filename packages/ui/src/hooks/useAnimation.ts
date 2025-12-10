'use client';

import { useMemo } from 'react';
import { prefersReducedMotion } from '../utils/a11y';
import { animation, motionVariants } from '../tokens/animation';

export interface UseAnimationOptions {
  /** Override the reduced motion check */
  forceAnimation?: boolean;
}

/**
 * Hook for managing animations with reduced motion support
 */
export function useAnimation(options: UseAnimationOptions = {}) {
  const { forceAnimation = false } = options;

  const reducedMotion = useMemo(() => {
    if (forceAnimation) return false;
    return prefersReducedMotion();
  }, [forceAnimation]);

  const getTransition = useMemo(
    () =>
      (
        type: 'fast' | 'normal' | 'slow' = 'normal',
        easing: 'easeOut' | 'easeIn' | 'easeInOut' = 'easeOut'
      ) => {
        if (reducedMotion) {
          return { duration: 0 };
        }
        return {
          duration: animation.duration[type] / 1000,
          ease: animation.easing[easing],
        };
      },
    [reducedMotion]
  );

  const getVariants = useMemo(
    () =>
      <K extends keyof typeof motionVariants>(
        variant: K
      ): typeof motionVariants[K] | Record<string, object> => {
        if (reducedMotion) {
          return {
            initial: {},
            animate: {},
            exit: {},
          };
        }
        return motionVariants[variant];
      },
    [reducedMotion]
  );

  const getHoverAnimation = useMemo(
    () =>
      (scale: number = 1.02) => {
        if (reducedMotion) return undefined;
        return { scale };
      },
    [reducedMotion]
  );

  const getTapAnimation = useMemo(
    () =>
      (scale: number = 0.98) => {
        if (reducedMotion) return undefined;
        return { scale };
      },
    [reducedMotion]
  );

  return {
    reducedMotion,
    getTransition,
    getVariants,
    getHoverAnimation,
    getTapAnimation,
    variants: motionVariants,
    duration: animation.duration,
    easing: animation.easing,
  };
}

