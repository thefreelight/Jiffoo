/**
 * Security Module Property Tests
 * 
 * 验证安全模块的核心属性:
 * - Property 1: Rate Limit Enforcement
 * - Property 2: Security Headers Presence
 * - Property 3: CORS Origin Validation
 * - Property 4: Circuit Breaker State Transition
 * - Property 5: Retry Exponential Backoff
 * - Property 6: Webhook Signature Verification
 * - Property 7: Input Sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  RateLimiter,
  MemoryRateLimitStore,
  generateSecurityHeaders,
  validateSecurityHeaders,
  CorsManager,
  CircuitBreaker,
  CircuitState,
  RetryHandler,
  WebhookVerifier,
  InputValidator,
} from '@shared/security';

describe('Security Module Property Tests', () => {
  // ===== Property 1: Rate Limit Enforcement =====
  describe('Property 1: Rate Limit Enforcement', () => {
    it('should enforce rate limit after maxRequests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1000, max: 60000 }),
          async (maxRequests, windowMs) => {
            const store = new MemoryRateLimitStore(1000);
            const limiter = new RateLimiter({ maxRequests, windowMs }, store);
            const identifier = `test-${Date.now()}-${Math.random()}`;

            // 发送 maxRequests 次请求
            for (let i = 0; i < maxRequests; i++) {
              const result = await limiter.check(identifier);
              expect(result.limited).toBe(false);
              expect(result.remaining).toBe(maxRequests - i - 1);
            }

            // 下一次请求应该被限流
            const limitedResult = await limiter.check(identifier);
            expect(limitedResult.limited).toBe(true);
            expect(limitedResult.remaining).toBe(0);
            expect(limitedResult.retryAfter).toBeGreaterThan(0);

            store.destroy();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly report remaining requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          async (maxRequests, requestCount) => {
            const actualRequests = Math.min(requestCount, maxRequests);
            const store = new MemoryRateLimitStore(1000);
            const limiter = new RateLimiter({ maxRequests, windowMs: 60000 }, store);
            const identifier = `test-${Date.now()}-${Math.random()}`;

            for (let i = 0; i < actualRequests; i++) {
              const result = await limiter.check(identifier);
              expect(result.remaining).toBe(Math.max(0, maxRequests - i - 1));
            }

            store.destroy();
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // ===== Property 2: Security Headers Presence =====
  describe('Property 2: Security Headers Presence', () => {
    it('should always include required security headers', () => {
      fc.assert(
        fc.property(
          fc.record({
            contentTypeOptions: fc.boolean(),
            xssProtection: fc.boolean(),
          }),
          (config) => {
            const headers = generateSecurityHeaders(config);
            const required = ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection'];
            
            for (const header of required) {
              if (config.contentTypeOptions !== false && header === 'X-Content-Type-Options') {
                expect(headers[header]).toBeDefined();
              }
              if (config.xssProtection !== false && header === 'X-XSS-Protection') {
                expect(headers[header]).toBeDefined();
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should validate headers correctly', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.constantFrom('X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection'), { minLength: 0, maxLength: 3 }),
          (missingHeaders) => {
            const allHeaders = generateSecurityHeaders();
            const testHeaders: Record<string, string | undefined> = { ...allHeaders };

            for (const h of missingHeaders) {
              delete testHeaders[h];
            }

            const result = validateSecurityHeaders(testHeaders);

            if (missingHeaders.length === 0) {
              expect(result.valid).toBe(true);
            } else {
              // 使用唯一数组后，missing 数量应该等于删除的数量
              expect(result.missing.length).toBe(missingHeaders.length);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ===== Property 3: CORS Origin Validation =====
  describe('Property 3: CORS Origin Validation', () => {
    it('should allow only whitelisted origins', () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
          fc.webUrl(),
          (allowedOrigins, testOrigin) => {
            const cors = new CorsManager({ allowedOrigins });
            const result = cors.handleRequest(testOrigin);

            if (allowedOrigins.includes(testOrigin)) {
              expect(result.allowed).toBe(true);
              expect(result.headers['Access-Control-Allow-Origin']).toBe(testOrigin);
            } else {
              expect(result.allowed).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle wildcard origin correctly', () => {
      const cors = new CorsManager({ allowedOrigins: ['*'] });
      
      fc.assert(
        fc.property(fc.webUrl(), (origin) => {
          const result = cors.handleRequest(origin);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 20 }
      );
    });
  });

  // ===== Property 4: Circuit Breaker State Transition =====
  describe('Property 4: Circuit Breaker State Transition', () => {
    it('should transition CLOSED -> OPEN after failureThreshold failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (failureThreshold) => {
            const breaker = new CircuitBreaker({
              failureThreshold,
              successThreshold: 2,
              timeout: 1000,
            });

            expect(breaker.getState()).toBe(CircuitState.CLOSED);

            // 触发足够的失败
            for (let i = 0; i < failureThreshold; i++) {
              try {
                await breaker.execute(async () => { throw new Error('fail'); });
              } catch { /* expected */ }
            }

            expect(breaker.getState()).toBe(CircuitState.OPEN);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject requests when OPEN', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 10000,
      });

      // 触发熔断
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch { /* expected */ }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // 后续请求应该被拒绝
      await expect(breaker.execute(async () => 'success')).rejects.toThrow('Circuit breaker is OPEN');
    });
  });

  // ===== Property 5: Retry Exponential Backoff =====
  describe('Property 5: Retry Exponential Backoff', () => {
    it('should increase delay exponentially', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 2, max: 4 }),
          (initialDelay, multiplier) => {
            const handler = new RetryHandler({
              maxRetries: 5,
              initialDelay,
              maxDelay: 60000,
              backoffMultiplier: multiplier,
              jitter: false,
            });

            let prevDelay = 0;
            for (let attempt = 0; attempt < 4; attempt++) {
              const delay = handler.getDelay(attempt);
              expect(delay).toBeGreaterThan(prevDelay);
              prevDelay = delay;
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not exceed maxDelay', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 1000, max: 5000 }),
          (initialDelay, maxDelay) => {
            const handler = new RetryHandler({
              maxRetries: 10,
              initialDelay,
              maxDelay,
              backoffMultiplier: 3,
              jitter: false,
            });

            for (let attempt = 0; attempt < 10; attempt++) {
              const delay = handler.getDelay(attempt);
              expect(delay).toBeLessThanOrEqual(maxDelay);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // ===== Property 6: Webhook Signature Verification =====
  describe('Property 6: Webhook Signature Verification', () => {
    it('should verify signatures correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 16, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          (secret, payload) => {
            const verifier = new WebhookVerifier(secret);
            const signature = verifier.sign(payload);
            const result = verifier.verify(payload, signature);

            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject tampered payloads', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 16, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          (secret, originalPayload, tamperedPayload) => {
            fc.pre(originalPayload !== tamperedPayload);

            const verifier = new WebhookVerifier(secret);
            const signature = verifier.sign(originalPayload);
            const result = verifier.verify(tamperedPayload, signature);

            expect(result.valid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject wrong secrets', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 16, maxLength: 64 }),
          fc.string({ minLength: 16, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          (secret1, secret2, payload) => {
            fc.pre(secret1 !== secret2);

            const verifier1 = new WebhookVerifier(secret1);
            const verifier2 = new WebhookVerifier(secret2);
            const signature = verifier1.sign(payload);
            const result = verifier2.verify(payload, signature);

            expect(result.valid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ===== Property 7: Input Sanitization =====
  describe('Property 7: Input Sanitization', () => {
    it('should detect SQL injection patterns', () => {
      const validator = new InputValidator({ detectSqlInjection: true });
      const sqlInjectionInputs = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "admin'--",
        "UNION SELECT * FROM users",
        "'; DELETE FROM orders WHERE '1'='1",
      ];

      for (const input of sqlInjectionInputs) {
        const result = validator.validate(input);
        expect(result.threats.some(t => t.includes('SQL'))).toBe(true);
      }
    });

    it('should detect XSS patterns', () => {
      const validator = new InputValidator({ detectXss: true });
      const xssInputs = [
        '<script>alert("XSS")</script>',
        '<img onerror="alert(1)" src="x">',
        'javascript:alert(1)',
        '<iframe src="evil.com">',
      ];

      for (const input of xssInputs) {
        const result = validator.validate(input);
        expect(result.threats.some(t => t.includes('XSS'))).toBe(true);
      }
    });

    it('should sanitize HTML entities', () => {
      const validator = new InputValidator({ sanitizeHtml: true });

      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (input) => {
          const result = validator.validate(input);
          if (result.sanitized) {
            expect(result.sanitized).not.toContain('<');
            expect(result.sanitized).not.toContain('>');
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should enforce max length', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (maxLength, input) => {
            const validator = new InputValidator({ maxLength });
            const result = validator.validate(input);

            if (input.length > maxLength) {
              expect(result.valid).toBe(false);
              expect(result.threats).toContain('Input exceeds maximum length');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

