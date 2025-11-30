import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'ACTIVE': 'bg-green-100 text-green-800',
    'SUSPENDED': 'bg-red-100 text-red-800',
    'TERMINATED': 'bg-gray-100 text-gray-800',
    'CONFIRMED': 'bg-blue-100 text-blue-800',
    'PAID': 'bg-green-100 text-green-800',
    'PROCESSING': 'bg-blue-100 text-blue-800',
    'COMPLETED': 'bg-green-100 text-green-800',
    'FAILED': 'bg-red-100 text-red-800',
    'CANCELLED': 'bg-gray-100 text-gray-800',
  }
  
  return statusColors[status] || 'bg-gray-100 text-gray-800'
}

export function getAgentLevelColor(level: string): string {
  const levelColors: Record<string, string> = {
    'GLOBAL': 'bg-purple-100 text-purple-800',
    'REGIONAL': 'bg-blue-100 text-blue-800',
    'LOCAL': 'bg-green-100 text-green-800',
  }
  
  return levelColors[level] || 'bg-gray-100 text-gray-800'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// ==================== 缺失的通知函数 ====================

// 成功通知函数
export function showSuccess(message: string): void {
  // 这里可以集成 toast 库，比如 react-hot-toast 或 sonner
  console.log('✅ Success:', message);

  // 如果有全局通知系统，可以在这里调用
  if (typeof window !== 'undefined' && (window as any).showToast) {
    (window as any).showToast(message, 'success');
  }
}

// 错误通知函数
export function showError(message: string): void {
  // 这里可以集成 toast 库，比如 react-hot-toast 或 sonner
  console.error('❌ Error:', message);

  // 如果有全局通知系统，可以在这里调用
  if (typeof window !== 'undefined' && (window as any).showToast) {
    (window as any).showToast(message, 'error');
  }
}

// 警告通知函数
export function showWarning(message: string): void {
  console.warn('⚠️ Warning:', message);

  if (typeof window !== 'undefined' && (window as any).showToast) {
    (window as any).showToast(message, 'warning');
  }
}

// 信息通知函数
export function showInfo(message: string): void {
  console.info('ℹ️ Info:', message);

  if (typeof window !== 'undefined' && (window as any).showToast) {
    (window as any).showToast(message, 'info');
  }
}
