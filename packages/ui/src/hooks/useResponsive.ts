'use client';

import { useState, useEffect, useMemo } from 'react';

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Hook for responsive design utilities
 */
export function useResponsive() {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial value
    handleResize();

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentBreakpoint = useMemo((): Breakpoint | 'xs' => {
    if (windowWidth >= breakpoints['2xl']) return '2xl';
    if (windowWidth >= breakpoints.xl) return 'xl';
    if (windowWidth >= breakpoints.lg) return 'lg';
    if (windowWidth >= breakpoints.md) return 'md';
    if (windowWidth >= breakpoints.sm) return 'sm';
    return 'xs';
  }, [windowWidth]);

  const isAbove = useMemo(
    () => (breakpoint: Breakpoint) => windowWidth >= breakpoints[breakpoint],
    [windowWidth]
  );

  const isBelow = useMemo(
    () => (breakpoint: Breakpoint) => windowWidth < breakpoints[breakpoint],
    [windowWidth]
  );

  const isMobile = useMemo(() => windowWidth < breakpoints.md, [windowWidth]);
  const isTablet = useMemo(
    () => windowWidth >= breakpoints.md && windowWidth < breakpoints.lg,
    [windowWidth]
  );
  const isDesktop = useMemo(() => windowWidth >= breakpoints.lg, [windowWidth]);

  return {
    windowWidth,
    currentBreakpoint,
    isAbove,
    isBelow,
    isMobile,
    isTablet,
    isDesktop,
    breakpoints,
  };
}

