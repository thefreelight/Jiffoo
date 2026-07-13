/**
 * Card Component
 * Hardcore digital network infrastructure style container
 */

import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'yevbi-card bg-[#141414] relative',
        {
          'hover:border-[var(--c-eae)] transition-colors': hover,
        },
        className
      )}
      {...props}
    >
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[var(--c-eae)] -mt-px -mr-px pointer-events-none"></div>
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={clsx('p-6 pb-4 border-b border-[#2a2a2a] mb-4', className)}>
      {children}
    </div>
  );
}

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={clsx('p-6 pt-0', className)}>
      {children}
    </div>
  );
}

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={clsx('p-6 pt-4 border-t border-[#2a2a2a] mt-4', className)}>
      {children}
    </div>
  );
}