/**
 * Card Component
 * Card container component used internally by the theme with dark mode support
 */

import React from 'react';
import { cn } from '@jiffoo/ui';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = React.memo(function Card({ children, className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50',
        'border-gray-200 dark:border-slate-700',
        {
          'transition-all hover:shadow-md dark:hover:shadow-slate-900/70': hover,
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader = React.memo(function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('p-4 sm:p-6 pb-3 sm:pb-4', className)}>
      {children}
    </div>
  );
});

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent = React.memo(function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('p-4 sm:p-6 pt-0', className)}>
      {children}
    </div>
  );
});

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter = React.memo(function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('p-4 sm:p-6 pt-3 sm:pt-4', className)}>
      {children}
    </div>
  );
});
