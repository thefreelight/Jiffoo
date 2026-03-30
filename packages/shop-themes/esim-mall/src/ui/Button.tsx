/**
 * Button Component for Yevbi Theme
 * Hardcore digital network infrastructure style
 */

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
  primary: 'bg-[var(--c-fff)] text-[var(--c-000)] hover:bg-[var(--c-eae)] active:bg-[var(--c-fff)] border border-[var(--c-fff)] font-bold',
  secondary: 'bg-[#1c1c1c] text-[#eaeaea] hover:bg-[#141414] active:bg-[#1c1c1c] border border-[#2a2a2a]',
  ghost: 'bg-transparent text-[#bdbdbd] hover:bg-[#1c1c1c] hover:text-[#eaeaea] active:bg-transparent',
  outline: 'bg-transparent border border-[#2a2a2a] text-[#bdbdbd] hover:border-[var(--c-eae)] hover:text-[#eaeaea] active:bg-transparent',
  destructive: 'bg-transparent border border-[#2a2a2a] text-[#bdbdbd] hover:bg-[#1c1c1c] active:bg-transparent uppercase',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
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
        // Base styles
        'inline-flex items-center justify-center font-mono uppercase tracking-widest transition-all duration-150 rounded-none',
        'focus:outline-none focus:ring-1 focus:ring-[var(--c-eae)]',
        'disabled: disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:bg-transparent',
        // Variant styles
        variantStyles[variant],
        // Size styles
        sizeStyles[size],
        // Custom className
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
