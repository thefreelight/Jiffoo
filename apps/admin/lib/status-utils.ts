/**
 * Status Utilities for Admin Frontend
 * 
 * 统一状态文案与样式映射：
 * - TENANT_STATUS_LABELS: 租户状态（PENDING/ACTIVE/SUSPENDED/TERMINATED）
 * - USER_STATUS_LABELS: 用户有效状态（ACTIVE/INACTIVE）
 */

// 租户状态枚举
export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

// 用户有效状态枚举（基于 effectiveStatus）
export type UserEffectiveStatus = 'ACTIVE' | 'INACTIVE';

// 状态标签配置
export interface StatusLabelConfig {
  label: string;
  color: string;       // Tailwind CSS 类名
  bgColor: string;     // 背景色
  textColor: string;   // 文字色
}

// 租户状态标签映射
export const TENANT_STATUS_LABELS: Record<TenantStatus, StatusLabelConfig> = {
  PENDING: {
    label: 'Pending',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  ACTIVE: {
    label: 'Active',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  SUSPENDED: {
    label: 'Suspended',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
  TERMINATED: {
    label: 'Terminated',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
  },
};

// 用户有效状态标签映射
export const USER_STATUS_LABELS: Record<UserEffectiveStatus, StatusLabelConfig> = {
  ACTIVE: {
    label: 'Active',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  INACTIVE: {
    label: 'Inactive',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
  },
};

// 获取租户状态标签配置
export function getTenantStatusConfig(status: string): StatusLabelConfig {
  return TENANT_STATUS_LABELS[status as TenantStatus] || TENANT_STATUS_LABELS.PENDING;
}

// 获取用户状态标签配置
export function getUserStatusConfig(effectiveStatus: string): StatusLabelConfig {
  return USER_STATUS_LABELS[effectiveStatus as UserEffectiveStatus] || USER_STATUS_LABELS.INACTIVE;
}

// 获取状态徽章样式类名
export function getStatusBadgeClass(config: StatusLabelConfig): string {
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`;
}

