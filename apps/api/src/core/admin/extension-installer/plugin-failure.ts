/**
 * Plugin failure recording and redaction (moved to
 * `core/extensions/runtime/failure.ts`).
 *
 * This re-export keeps every existing import path working and points at the
 * same module instance, so the failure-record throttle stays a single
 * registry-wide singleton.
 */
export * from '@/core/extensions/runtime/failure';
