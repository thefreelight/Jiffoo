/**
 * Protection parameters of the plugin gateway.
 *
 * These are the plugin-scoped parameters: the request timeout of a gateway
 * call, the maximum response size it accepts and the rate limit the gateway
 * applies. The platform-wide circuit breaker parameters are not plugin
 * specific and live in `core/shared/config.ts`.
 */

export const DEFAULT_GATEWAY_TIMEOUT_MS = 10000;
/**
 * Deadline of a plugin registration.
 *
 * A plugin that never resolves its `register()` call must not hold a request
 * forever, so the registration fails with a timeout instead.
 */
export const PLUGIN_REGISTER_TIMEOUT_MS = 5000;
export const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024;
export const RATE_LIMIT_CONFIG = { defaultLimitPerMinute: 60, windowMs: 60000 } as const;

export function getPluginTimeoutMs(config?: Record<string, unknown>): number {
  const value = config?.timeoutMs;
  return typeof value === 'number' && value > 0 && value <= 60000 ? value : DEFAULT_GATEWAY_TIMEOUT_MS;
}

export function isResponseTooLarge(contentLength: string | null | undefined): boolean {
  if (!contentLength) return false;
  const length = Number.parseInt(contentLength, 10);
  return Number.isFinite(length) && length > MAX_RESPONSE_SIZE_BYTES;
}
