'use client';

import React from 'react';

export interface NavItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component or element */
  icon?: React.ReactNode;
  /** Navigation URL */
  href: string;
}

export interface SidebarProps {
  /** Logo configuration */
  logo: {
    /** Logo icon/element */
    icon?: React.ReactNode;
    /** Brand name */
    name: string;
  };
  /** Navigation items */
  navItems: NavItem[];
  /** Current active item ID */
  activeItem: string;
  /** User profile info */
  user?: {
    name: string;
    email?: string;
    avatar?: string | React.ReactNode;
  };
  /** Click handler for nav items */
  onNavClick?: (item: NavItem) => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom nav link renderer (for Next.js Link, etc.) */
  renderNavLink?: (item: NavItem, isActive: boolean, children: React.ReactNode) => React.ReactNode;
}

/**
 * Sidebar - Admin dashboard sidebar navigation
 * 
 * Fixed-width sidebar with logo, navigation links, and user profile.
 * Based on Jiffoo Blue Minimal design system.
 */
export function Sidebar({
  logo,
  navItems,
  activeItem,
  user,
  onNavClick,
  className = '',
  renderNavLink,
}: SidebarProps) {
  const renderNavItem = (item: NavItem) => {
    const isActive = item.id === activeItem;
    
    const content = (
      <>
        {item.icon && (
          <span className="w-5 flex justify-center text-current">
            {item.icon}
          </span>
        )}
        <span>{item.label}</span>
      </>
    );
    
    const baseClasses = `
      flex items-center gap-3 px-3 py-3 rounded-lg font-medium
      transition-all duration-150 cursor-pointer
      ${isActive 
        ? 'bg-[#EFF6FF] text-[#3B82F6]' 
        : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
      }
    `.trim();
    
    if (renderNavLink) {
      return renderNavLink(item, isActive, content);
    }
    
    return (
      <a
        key={item.id}
        href={item.href}
        className={baseClasses}
        onClick={(e) => {
          if (onNavClick) {
            e.preventDefault();
            onNavClick(item);
          }
        }}
      >
        {content}
      </a>
    );
  };

  return (
    <aside 
      className={`
        w-[260px] h-screen bg-white border-r border-[#E2E8F0]
        p-6 flex flex-col flex-shrink-0
        ${className}
      `}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 mb-8">
        {logo.icon ? (
          <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center text-white font-semibold">
            {logo.icon}
          </div>
        ) : (
          <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center text-white font-semibold">
            {logo.name.charAt(0)}
          </div>
        )}
        <span className="font-semibold text-lg text-[#0F172A]">{logo.name}</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(renderNavItem)}
      </nav>

      {/* User Profile */}
      {user && (
        <div className="mt-auto pt-6 border-t border-[#E2E8F0] flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center font-medium text-[#64748B]">
            {typeof user.avatar === 'string' ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : user.avatar ? (
              user.avatar
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-[#0F172A] truncate">{user.name}</p>
            {user.email && (
              <p className="text-xs text-[#64748B] truncate">{user.email}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;

