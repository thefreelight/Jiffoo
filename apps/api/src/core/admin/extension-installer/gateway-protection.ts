/**
 * Plugin gateway protection parameters (moved to
 * `core/extensions/runtime/gateway-protection.ts`).
 *
 * The platform-wide circuit breaker parameters moved to
 * `core/shared/config.ts`. This re-export keeps every existing import path
 * working.
 */
export * from '@/core/extensions/runtime/gateway-protection';
export { CIRCUIT_BREAKER_CONFIG } from '@/core/shared/config';
