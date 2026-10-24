/**
 * Recovery test control (moved to `src/infra/recovery-test-control.ts`).
 *
 * The module is infrastructure: it is a test-only control surface, not an
 * admin feature. This re-export keeps the existing import path working for
 * the callers that still live in the installer module.
 */
export * from '@/infra/recovery-test-control';
