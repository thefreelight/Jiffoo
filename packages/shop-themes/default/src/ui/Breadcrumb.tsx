/**
 * Breadcrumb Component
 * Navigation breadcrumb for showing page hierarchy
 */

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav className={`flex items-center space-x-1 text-sm ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-neutral-400 flex-shrink-0" />
          )}
          {index === items.length - 1 ? (
            // Last item - no link
            <span className="text-neutral-900 font-medium truncate max-w-[200px]">
              {item.label}
            </span>
          ) : (
            // Link item
            <button
              onClick={item.onClick}
              className="text-neutral-500 hover:text-brand-600 transition-colors flex items-center gap-1"
            >
              {index === 0 && <Home className="h-4 w-4" />}
              <span className="truncate max-w-[150px]">{item.label}</span>
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

