/**
 * Platform-wide configuration constants.
 *
 * These values are not plugin specific: they configure the shared request
 * protection of the platform (rate limit and circuit breaker) and are used by
 * the infrastructure layer. Plugin-scoped gateway parameters live in
 * `core/extensions/runtime/gateway-protection.ts`.
 */

export const CIRCUIT_BREAKER_CONFIG = {
  windowMs: 60000, minSamples: 10, failureRateThreshold: 0.5, openDurationMs: 30000,
} as const;
