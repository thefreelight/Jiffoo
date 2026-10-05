export const DEFAULT_GATEWAY_TIMEOUT_MS = 10000;
export const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024;
export const CIRCUIT_BREAKER_CONFIG = {
  windowMs: 60000, minSamples: 10, failureRateThreshold: 0.5, openDurationMs: 30000,
} as const;
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
