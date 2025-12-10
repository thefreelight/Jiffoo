'use client';

import { cn } from '../../utils/cn';

export interface ProductGridProps {
  children: React.ReactNode;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gapStyles = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
};

export function ProductGrid({
  children,
  columns = { sm: 2, md: 3, lg: 4 },
  gap = 'md',
  className,
}: ProductGridProps) {
  // Generate responsive column classes
  const columnClasses = cn(
    'grid-cols-1',
    columns.sm && `sm:grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`
  );

  return (
    <div
      className={cn(
        'grid',
        columnClasses,
        gapStyles[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

ProductGrid.displayName = 'ProductGrid';

