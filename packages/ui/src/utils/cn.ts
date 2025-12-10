/**
 * Jiffoo Design System - className Utility
 * Combines clsx and tailwind-merge for optimal class handling
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS conflict resolution
 * @example
 * cn('px-4 py-2', condition && 'bg-blue-500', 'px-6') // => 'py-2 bg-blue-500 px-6'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

