import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatStoreDate } from 'shared'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Removed translation function - using direct English text instead

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: string | Date, locale: string, timezone: string) {
  return formatStoreDate(date, locale, timezone, true)
}

export function formatDateTime(date: string | Date, locale: string, timezone: string) {
  return formatStoreDate(date, locale, timezone)
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('en-US').format(num)
}

export function truncateText(text: string, length: number) {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
