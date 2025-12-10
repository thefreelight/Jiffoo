'use client';

import React, { useState } from 'react';

export interface HeaderAction {
  /** Unique identifier */
  id: string;
  /** Icon element */
  icon: React.ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Show badge dot */
  badge?: boolean;
  /** Badge count (if provided, shows count instead of dot) */
  badgeCount?: number;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

export interface TopHeaderProps {
  /** Page title */
  title: string;
  /** Subtitle (e.g., current date) */
  subtitle?: string;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Search handler */
  onSearch?: (query: string) => void;
  /** Action buttons */
  actions?: HeaderAction[];
  /** Primary action button */
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
  /** Custom search input */
  searchInput?: React.ReactNode;
}

/**
 * TopHeader - Admin dashboard top header bar
 * 
 * Fixed-height header with title, search bar, and action buttons.
 * Based on Jiffoo Blue Minimal design system.
 */
export function TopHeader({
  title,
  subtitle,
  searchPlaceholder = 'Search...',
  onSearch,
  actions = [],
  primaryAction,
  className = '',
  searchInput,
}: TopHeaderProps) {
  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <header 
      className={`
        h-[70px] bg-white border-b border-[#E2E8F0]
        flex items-center justify-between px-8 flex-shrink-0
        ${className}
      `}
    >
      {/* Left: Title Section */}
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-[#0F172A] m-0">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[#64748B] m-0">{subtitle}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        {searchInput ? (
          searchInput
        ) : (
          <div className="relative">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="
                w-60 pl-9 pr-3 py-2
                border border-[#E2E8F0] rounded-md
                bg-[#F8FAFC] text-sm text-[#0F172A]
                placeholder:text-[#64748B]
                focus:outline-none focus:border-[#3B82F6]
                transition-colors duration-150
              "
            />
          </div>
        )}

        {/* Action Buttons */}
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            aria-label={action.ariaLabel}
            className="
              relative p-2 rounded-md
              bg-transparent text-[#64748B]
              hover:bg-[#F1F5F9] hover:text-[#0F172A]
              transition-colors duration-150
            "
          >
            {action.icon}
            {(action.badge || action.badgeCount) && (
              <span className="
                absolute top-1 right-1 
                min-w-[8px] h-[8px] rounded-full
                bg-red-500 text-white text-[10px] font-medium
                flex items-center justify-center
              ">
                {action.badgeCount && action.badgeCount > 0 ? (
                  <span className="px-1">{action.badgeCount > 99 ? '99+' : action.badgeCount}</span>
                ) : null}
              </span>
            )}
          </button>
        ))}

        {/* Primary Action */}
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="
              flex items-center gap-2 px-4 py-2
              bg-[#3B82F6] text-white rounded-md
              font-semibold text-sm
              hover:bg-[#2563EB]
              transition-colors duration-150
            "
          >
            {primaryAction.icon}
            {primaryAction.label}
          </button>
        )}
      </div>
    </header>
  );
}

export default TopHeader;

