'use client';

import React from 'react';

export interface StatsGridProps {
  /** Child stat cards */
  children: React.ReactNode;
  /** Number of columns (default: 3) */
  columns?: 1 | 2 | 3 | 4;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatsGrid - Grid container for StatCard components
 * 
 * Responsive grid layout that switches to single column on mobile.
 * Based on Jiffoo Blue Minimal design system.
 */
export function StatsGrid({
  children,
  columns = 3,
  className = '',
}: StatsGridProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div 
      className={`
        grid gap-6
        ${gridClasses[columns]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default StatsGrid;

