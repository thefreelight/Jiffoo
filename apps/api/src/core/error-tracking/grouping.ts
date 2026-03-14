/**
 * Error Grouping Module
 *
 * Handles error grouping by similarity hash to group similar errors together.
 * This enables better error tracking and analysis by identifying recurring patterns.
 */

import crypto from 'crypto';

/**
 * Options for error hash generation
 */
export interface ErrorHashOptions {
  /** Error message */
  message: string;
  /** Stack trace (optional) */
  stack?: string;
  /** Request path */
  path: string;
  /** HTTP status code */
  statusCode: number;
  /** Number of stack frames to include (default: 3) */
  stackFrameCount?: number;
}

/**
 * Generate a hash for error grouping
 * Groups similar errors together based on message, stack trace pattern, path, and status code
 *
 * The hash is designed to group errors that have the same root cause while ignoring
 * transient details like line numbers and absolute file paths.
 *
 * @param options - Error hash generation options
 * @returns SHA-256 hash string for grouping similar errors
 *
 * @example
 * ```ts
 * const hash = generateErrorHash({
 *   message: 'Cannot read property "foo" of undefined',
 *   stack: error.stack,
 *   path: '/api/products/123',
 *   statusCode: 500
 * });
 * ```
 */
export function generateErrorHash(options: ErrorHashOptions): string {
  const {
    message,
    stack,
    path,
    statusCode,
    stackFrameCount = 3
  } = options;

  // Normalize stack trace by removing line numbers and local paths
  let normalizedStack = '';
  if (stack) {
    // Extract top N stack frames for grouping (include error message + N frames)
    const frames = stack.split('\n').slice(0, stackFrameCount + 1);
    normalizedStack = frames
      .map(frame => {
        // Remove line numbers (e.g., :123:45)
        let normalized = frame.replace(/:\d+:\d+/g, '');
        // Remove absolute paths, keep relative structure
        // Captures last 3 path segments: /some/path/to/file.js -> to/file.js
        normalized = normalized.replace(/\(.*?\/([^/]+\/[^/]+\/[^/]+)\)/g, '($1)');
        return normalized;
      })
      .join('\n');
  }

  // Create hash from message + normalized stack + path + status code
  const hashInput = `${message}|${normalizedStack}|${path}|${statusCode}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Normalize a stack trace for comparison
 * Removes line numbers, column numbers, and absolute paths
 *
 * @param stack - Raw stack trace string
 * @param frameCount - Number of frames to include (default: 3)
 * @returns Normalized stack trace string
 */
export function normalizeStackTrace(stack: string, frameCount: number = 3): string {
  const frames = stack.split('\n').slice(0, frameCount + 1);
  return frames
    .map(frame => {
      // Remove line numbers (e.g., :123:45)
      let normalized = frame.replace(/:\d+:\d+/g, '');
      // Remove absolute paths, keep relative structure
      normalized = normalized.replace(/\(.*?\/([^/]+\/[^/]+\/[^/]+)\)/g, '($1)');
      return normalized;
    })
    .join('\n');
}

/**
 * Check if two errors are similar based on their hash
 *
 * @param error1 - First error options
 * @param error2 - Second error options
 * @returns True if errors have the same hash (are similar)
 */
export function areErrorsSimilar(
  error1: ErrorHashOptions,
  error2: ErrorHashOptions
): boolean {
  const hash1 = generateErrorHash(error1);
  const hash2 = generateErrorHash(error2);
  return hash1 === hash2;
}

/**
 * Extract the top N functions from a stack trace
 * Useful for displaying a summary of the error location
 *
 * @param stack - Stack trace string
 * @param count - Number of functions to extract (default: 3)
 * @returns Array of function names/locations
 */
export function extractStackFrames(stack: string, count: number = 3): string[] {
  const lines = stack.split('\n').slice(1); // Skip first line (error message)
  const frames: string[] = [];

  for (let i = 0; i < Math.min(count, lines.length); i++) {
    const line = lines[i].trim();
    // Extract function name and location from stack frame
    // Examples: "at functionName (file.js:123:45)" or "at file.js:123:45"
    const match = line.match(/at\s+(?:(\S+)\s+\()?([^)]+)\)?/);
    if (match) {
      const funcName = match[1] || 'anonymous';
      const location = match[2];
      frames.push(`${funcName} (${location})`);
    } else {
      frames.push(line);
    }
  }

  return frames;
}
