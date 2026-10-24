/**
 * Plugin state reset registry (moved to
 * `core/extensions/runtime/plugin-state.ts`).
 *
 * This re-export keeps every existing import path working and points at the
 * same module instance, so the reset registry stays a single
 * registry-wide singleton.
 */
export * from '@/core/extensions/runtime/plugin-state';
