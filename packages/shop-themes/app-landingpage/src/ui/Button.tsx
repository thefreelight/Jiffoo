import React from 'react';
import { cn } from '../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'border-[var(--esim-ink)] bg-[var(--esim-ink)] text-[var(--esim-surface-raised)] hover:border-[var(--esim-primary-dark)] hover:bg-[var(--esim-primary-dark)]',
  secondary: 'border-[var(--esim-line-strong)] bg-transparent text-[var(--esim-ink)] hover:border-[var(--esim-primary)] hover:text-[var(--esim-primary-dark)]',
  ghost: 'border-transparent bg-transparent text-[var(--esim-muted)] hover:bg-[var(--esim-surface-cool)] hover:text-[var(--esim-ink)]',
  outline: 'border-[var(--esim-line)] bg-[var(--esim-surface-raised)] text-[var(--esim-ink)] hover:border-[var(--esim-primary)]',
  destructive: 'border-[var(--esim-danger)] bg-transparent text-[var(--esim-danger)] hover:bg-[var(--esim-danger)] hover:text-white',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-xs',
  md: 'px-5 py-3 text-sm',
  lg: 'px-7 py-4 text-base',
};

export const Button = React.memo(function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full border font-bold transition duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-[var(--esim-primary)]/25 focus:ring-offset-2 focus:ring-offset-[var(--esim-surface)]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'hover:-translate-y-0.5 active:translate-y-0',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
