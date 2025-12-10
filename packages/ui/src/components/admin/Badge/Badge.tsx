'use client';

import React from 'react';

export type BadgeVariant = 'active' | 'neutral' | 'warning' | 'error' | 'info' | 'primary';

export interface AdminBadgeProps {
  /** Badge variant for styling */
  variant?: BadgeVariant;
  /** Badge content */
  children: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/**
 * AdminBadge - Status badge component for admin dashboard
 * 
 * Pill-shaped badge with various color variants.
 * Based on Jiffoo Blue Minimal design system.
 */
export function AdminBadge({
  variant = 'neutral',
  children,
  size = 'md',
  className = '',
}: AdminBadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    active: 'bg-[#DCFCE7] text-[#166534]',
    neutral: 'bg-[#F1F5F9] text-[#64748B]',
    warning: 'bg-[#FEF9C3] text-[#854D0E]',
    error: 'bg-[#FEE2E2] text-[#991B1B]',
    info: 'bg-[#DBEAFE] text-[#1E40AF]',
    primary: 'bg-[#EFF6FF] text-[#3B82F6]',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span 
      className={`
        inline-flex items-center rounded-full
        font-semibold uppercase tracking-wide
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export default AdminBadge;

