/**
 * Breadcrumb Component
 * Hardcore digital network infrastructure style navigation
 */

import React from 'react';
import { ChevronRight, Activity } from 'lucide-react';

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
    <nav className={`flex items-center space-x-2 font-mono text-[10px] uppercase tracking-widest ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-3 w-3 text-[#bdbdbd] flex-shrink-0" />
          )}
          {index === items.length - 1 ? (
            // Last item - no link
            <span className="text-[#eaeaea] font-bold truncate max-w-[200px] bg-[#1c1c1c] border border-[#2a2a2a] px-2 py-1">
              {item.label}
            </span>
          ) : (
            // Link item
            <button
              onClick={item.onClick}
              className="text-[#bdbdbd] hover:opacity-100 hover:text-[#eaeaea] transition-colors flex items-center gap-2"
            >
              {index === 0 && <Activity className="h-3 w-3" />}
              <span className="truncate max-w-[150px]">{item.label}</span>
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

