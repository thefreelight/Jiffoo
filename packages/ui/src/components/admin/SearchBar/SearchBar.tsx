'use client';

import React, { useState } from 'react';

export interface SearchBarProps {
  /** Placeholder text */
  placeholder?: string;
  /** Initial value */
  defaultValue?: string;
  /** Controlled value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Submit handler (on Enter key) */
  onSubmit?: (value: string) => void;
  /** Width variant */
  width?: 'sm' | 'md' | 'lg' | 'full';
  /** Additional CSS classes */
  className?: string;
}

/**
 * SearchBar - Search input component for admin dashboard
 * 
 * Search input with icon and consistent styling.
 * Based on Jiffoo Blue Minimal design system.
 */
export function SearchBar({
  placeholder = 'Search...',
  defaultValue = '',
  value: controlledValue,
  onChange,
  onSubmit,
  width = 'md',
  className = '',
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const widthClasses = {
    sm: 'w-40',
    md: 'w-60',
    lg: 'w-80',
    full: 'w-full',
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSubmit?.(value);
    }
  };

  return (
    <div className={`relative ${widthClasses[width]} ${className}`}>
      {/* Search Icon */}
      <svg 
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
        />
      </svg>

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="
          w-full pl-9 pr-3 py-2
          border border-[#E2E8F0] rounded-md
          bg-[#F8FAFC] text-sm text-[#0F172A]
          placeholder:text-[#64748B]
          focus:outline-none focus:border-[#3B82F6]
          transition-colors duration-150
        "
      />
    </div>
  );
}

export default SearchBar;

