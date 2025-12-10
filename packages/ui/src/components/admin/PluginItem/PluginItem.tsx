'use client';

import React from 'react';

export interface PluginItemProps {
  /** Plugin name */
  name: string;
  /** Plugin category */
  category: string;
  /** Plugin icon element */
  icon?: React.ReactNode;
  /** Icon background color */
  iconColor?: 'default' | 'stripe' | 'paypal' | 'wechat' | 'alipay' | string;
  /** Plugin status */
  status: 'active' | 'inactive' | 'free' | 'paid' | 'pending';
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PluginItem - Plugin list item for admin dashboard
 * 
 * Displays plugin info with icon, name, category, and status badge.
 * Based on Jiffoo Blue Minimal design system.
 */
export function PluginItem({
  name,
  category,
  icon,
  iconColor = 'default',
  status,
  onClick,
  className = '',
}: PluginItemProps) {
  // Predefined icon background colors
  const iconBgColors: Record<string, string> = {
    default: 'bg-[#EFF6FF] text-[#3B82F6]',
    stripe: 'bg-[#635BFF] text-white',
    paypal: 'bg-[#003087] text-white',
    wechat: 'bg-[#07C160] text-white',
    alipay: 'bg-[#1677FF] text-white',
  };

  // Status badge colors
  const statusConfig = {
    active: { bg: 'bg-[#DCFCE7]', text: 'text-[#166534]', label: 'Active' },
    inactive: { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', label: 'Inactive' },
    free: { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', label: 'Free' },
    paid: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]', label: 'Paid' },
    pending: { bg: 'bg-[#FEF9C3]', text: 'text-[#854D0E]', label: 'Pending' },
  };

  const iconBgClass = iconBgColors[iconColor] || iconColor.startsWith('bg-') ? iconColor : iconBgColors.default;
  const statusStyle = statusConfig[status];

  return (
    <div 
      className={`
        p-4 border border-[#E2E8F0] rounded-lg mb-3
        flex justify-between items-center
        ${onClick ? 'cursor-pointer hover:border-[#3B82F6] transition-colors duration-150' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Plugin Info */}
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${iconBgClass}`}>
          {icon || name.charAt(0)}
        </div>

        {/* Details */}
        <div>
          <h4 className="font-semibold text-[#0F172A] m-0 mb-0.5">{name}</h4>
          <p className="text-sm text-[#64748B] m-0">{category}</p>
        </div>
      </div>

      {/* Status Badge */}
      <span className={`
        px-3 py-1 rounded-full text-xs font-semibold uppercase
        ${statusStyle.bg} ${statusStyle.text}
      `}>
        {statusStyle.label}
      </span>
    </div>
  );
}

export default PluginItem;

