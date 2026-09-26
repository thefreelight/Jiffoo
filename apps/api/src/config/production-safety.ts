export interface ProductionSafetyConfig {
  NODE_ENV: string;
  JWT_SECRET: string;
  RATE_LIMITER_FAIL_CLOSED: boolean;
  CORS_ORIGIN: string;
  STOREFRONT_URL: string;
  ADMIN_URL: string;
}

function insecureUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return true;
  }
}

export function productionSafetyViolations(
  config: ProductionSafetyConfig,
  disableRateLimiter: string | undefined,
): string[] {
  if (config.NODE_ENV !== 'production') return [];
  const violations: string[] = [];
  if (disableRateLimiter === 'true') violations.push('DISABLE_RATE_LIMITER=true');
  if (!config.RATE_LIMITER_FAIL_CLOSED) violations.push('RATE_LIMITER_FAIL_CLOSED=false');
  if (config.JWT_SECRET.length < 32) violations.push('JWT_SECRET must be at least 32 characters');
  if (config.CORS_ORIGIN.includes('*')) violations.push('CORS_ORIGIN must not contain a wildcard');
  if (!config.STOREFRONT_URL || insecureUrl(config.STOREFRONT_URL)) {
    violations.push('STOREFRONT_URL must use HTTPS except loopback');
  }
  if (!config.ADMIN_URL || insecureUrl(config.ADMIN_URL)) {
    violations.push('ADMIN_URL must use HTTPS except loopback');
  }
  return violations;
}

export function assertProductionSafety(
  config: ProductionSafetyConfig,
  disableRateLimiter: string | undefined,
): void {
  const violations = productionSafetyViolations(config, disableRateLimiter);
  if (violations.length) throw new Error(`Unsafe production configuration:\n${violations.join('\n')}`);
}
