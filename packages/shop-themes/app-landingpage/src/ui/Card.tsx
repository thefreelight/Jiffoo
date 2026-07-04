import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = React.memo(function Card({ children, className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface-raised)] shadow-[var(--esim-shadow-tight)]',
        {
          'transition duration-300 ease-out hover:-translate-y-1 hover:border-[var(--esim-line-strong)]': hover,
        },
        className,
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
    <div className={clsx('border-b border-[var(--esim-line)] p-6 pb-5', className)}>
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
    <div className={clsx('p-6', className)}>
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
    <div className={clsx('border-t border-[var(--esim-line)] p-6 pt-5', className)}>
      {children}
    </div>
  );
});
