'use client';

import React from 'react';

export interface StatCardProps {
  /** Stat label/title */
  label: string;
  /** Stat value (number or formatted string) */
  value: string | number;
  /** Description text */
  description?: string;
  /** Icon element */
  icon?: React.ReactNode;
  /** Status type for styling */
  status?: 'success' | 'warning' | 'error' | 'default';
  /** Status text (e.g., "All Systems Operational") */
  statusText?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatCard - Statistics display card for admin dashboard
 * 
 * Displays a single stat with label, value, optional description, and icon.
 * Based on Jiffoo Blue Minimal design system.
 */
export function StatCard({
  label,
  value,
  description,
  icon,
  status = 'default',
  statusText,
  className = '',
}: StatCardProps) {
  const statusClasses = {
    success: 'text-[#166534]',
    warning: 'text-[#854D0E]',
    error: 'text-[#991B1B]',
    default: 'text-[#0F172A]',
  };

  return (
    <div 
      className={`
        bg-white border border-[#E2E8F0] rounded-xl p-6
        flex justify-between items-start
        ${className}
      `}
    >
      {/* Content */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[#64748B]">{label}</span>
        
        {statusText ? (
          <span className={`text-lg font-semibold ${statusClasses[status]}`}>
            {statusText}
          </span>
        ) : (
          <span className="text-3xl font-semibold text-[#0F172A] leading-tight">
            {value}
          </span>
        )}
        
        {description && (
          <span className="text-sm text-[#64748B]">{description}</span>
        )}
      </div>

      {/* Icon */}
      {icon && (
        <div className="text-[#64748B] text-xl">
          {icon}
        </div>
      )}
    </div>
  );
}

export default StatCard;

