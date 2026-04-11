/**
 * Utility Functions for eSIM Mall Theme
 */

import clsx, { type ClassValue } from 'clsx';

/**
 * Combines class names conditionally
 * A utility for constructing className strings conditionally
 *
 * @example
 * cn('base', condition && 'conditional', { 'object-syntax': true })
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
