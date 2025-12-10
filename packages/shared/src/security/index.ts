/**
 * Security Module - 安全模块统一导出
 */

// Rate Limiter
export {
  RateLimiter,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  RateLimitPresets,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitStore,
} from './rate-limiter';

// Security Headers
export {
  generateSecurityHeaders,
  validateSecurityHeaders,
  DefaultSecurityConfig,
  type SecurityHeadersConfig,
  type SecurityHeaders,
} from './security-headers';

// CORS Manager
export {
  CorsManager,
  createDevCorsConfig,
  createProdCorsConfig,
  type CorsConfig,
  type CorsResult,
} from './cors-manager';

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './circuit-breaker';

// Retry Handler
export {
  RetryHandler,
  RetryPresets,
  type RetryConfig,
  type RetryResult,
} from './retry-handler';

// Webhook Verifier
export {
  WebhookVerifier,
  StripeWebhookVerifier,
  type WebhookVerifierConfig,
  type VerificationResult,
} from './webhook-verifier';

// Input Validator
export {
  InputValidator,
  validateFileType,
  validateFileSize,
  ALLOWED_FILE_TYPES,
  type ValidationResult,
  type InputValidatorConfig,
} from './input-validator';

