'use client';

import React from 'react';

export interface CardsRowProps {
  /** Child cards */
  children: React.ReactNode;
  /** Gap between cards (default: 6 = 24px) */
  gap?: 4 | 6 | 8;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CardsRow - Horizontal row container for ContentCard components
 * 
 * Responsive flex layout that switches to vertical on mobile.
 * Based on Jiffoo Blue Minimal design system.
 */
export function CardsRow({
  children,
  gap = 6,
  className = '',
}: CardsRowProps) {
  const gapClasses = {
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8',
  };

  return (
    <div 
      className={`
        flex flex-col lg:flex-row
        ${gapClasses[gap]}
        ${className}
      `}
    >
      {React.Children.map(children, (child) => (
        <div className="flex-1">{child}</div>
      ))}
    </div>
  );
}

export default CardsRow;

