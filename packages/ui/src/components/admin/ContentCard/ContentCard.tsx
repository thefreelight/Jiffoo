'use client';

import React from 'react';

export interface ContentCardProps {
  /** Card title */
  title: string;
  /** Card description */
  description?: string;
  /** Action button configuration */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Custom action renderer (for Next.js Link) */
  renderAction?: (props: { label: string; icon?: React.ReactNode }) => React.ReactNode;
}

/**
 * ContentCard - Content container card for admin dashboard
 * 
 * Card with header (title, description, action) and content area.
 * Based on Jiffoo Blue Minimal design system.
 */
export function ContentCard({
  title,
  description,
  action,
  children,
  className = '',
  renderAction,
}: ContentCardProps) {
  const ActionButton = () => {
    if (!action) return null;

    const buttonContent = (
      <>
        <span>{action.label}</span>
        {action.icon || (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </>
    );

    if (renderAction) {
      return <>{renderAction({ label: action.label, icon: action.icon })}</>;
    }

    if (action.href) {
      return (
        <a
          href={action.href}
          className="
            flex items-center gap-1 px-3 py-1.5
            border border-[#E2E8F0] rounded-md
            text-sm text-[#0F172A]
            hover:border-[#3B82F6] hover:text-[#3B82F6]
            transition-colors duration-150
          "
        >
          {buttonContent}
        </a>
      );
    }

    return (
      <button
        onClick={action.onClick}
        className="
          flex items-center gap-1 px-3 py-1.5
          border border-[#E2E8F0] rounded-md
          text-sm text-[#0F172A]
          hover:border-[#3B82F6] hover:text-[#3B82F6]
          transition-colors duration-150
        "
      >
        {buttonContent}
      </button>
    );
  };

  return (
    <div 
      className={`
        bg-white border border-[#E2E8F0] rounded-xl p-6
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[#0F172A] m-0 mb-1">{title}</h3>
          {description && (
            <p className="text-sm text-[#64748B] m-0">{description}</p>
          )}
        </div>
        <ActionButton />
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}

export default ContentCard;

