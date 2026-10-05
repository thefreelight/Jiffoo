/**
 * Security Module - Unified Security Module Exports
 */

// Rate Limiter
export {
  RateLimitPresets,
  type RateLimitConfig,
  type RateLimitResult,
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

// Admin RBAC catalog
