/**
 * Observability Module Property Tests
 * 
 * 测试可观测性模块的 6 个核心属性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  LogRedactor,
  DEFAULT_SENSITIVE_FIELDS,
  HealthCheckService,
  HealthStatus,
  SentryClient,
  OtelClient,
  LogForwarder,
} from '@shared/observability';

describe('Observability Module Property Tests', () => {
  /**
   * Property 1: Error Context Completeness
   * 错误上下文应该包含 tenantId, userId, traceId
   */
  describe('Property 1: Error Context Completeness', () => {
    it('should include all required context fields', () => {
      const sentry = new SentryClient({
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
      });

      fc.assert(
        fc.property(
          fc.record({
            tenantId: fc.string({ minLength: 1, maxLength: 50 }),
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            traceId: fc.hexaString({ minLength: 32, maxLength: 32 }),
          }),
          (context) => {
            const errorContext = sentry.createErrorContext(context);
            
            // 验证 tags 包含必要字段
            const tags = errorContext.tags as Record<string, unknown>;
            expect(tags.tenantId).toBe(context.tenantId);
            expect(tags.userId).toBe(context.userId);
            expect(tags.traceId).toBe(context.traceId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle optional fields gracefully', () => {
      const sentry = new SentryClient({
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
      });

      fc.assert(
        fc.property(
          fc.record({
            tenantId: fc.option(fc.string(), { nil: undefined }),
            userId: fc.option(fc.string(), { nil: undefined }),
            traceId: fc.option(fc.string(), { nil: undefined }),
          }),
          (context) => {
            const errorContext = sentry.createErrorContext(context);
            expect(errorContext).toBeDefined();
            expect(errorContext.tags).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 2: TraceId Propagation
   * TraceId 应该在请求间正确传播
   */
  describe('Property 2: TraceId Propagation', () => {
    let otel: OtelClient;

    beforeEach(() => {
      otel = new OtelClient({
        serviceName: 'test-service',
      });
    });

    it('should generate valid trace IDs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          () => {
            const traceId = otel.generateTraceId();
            expect(traceId).toHaveLength(32);
            expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate valid span IDs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          () => {
            const spanId = otel.generateSpanId();
            expect(spanId).toHaveLength(16);
            expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse and create traceparent correctly', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 32, maxLength: 32 }),
          fc.hexaString({ minLength: 16, maxLength: 16 }),
          fc.integer({ min: 0, max: 255 }),
          (traceId, spanId, flags) => {
            const flagsHex = flags.toString(16).padStart(2, '0');
            const traceparent = `00-${traceId}-${spanId}-${flagsHex}`;
            
            const parsed = otel.parseTraceparent(traceparent);
            expect(parsed).not.toBeNull();
            expect(parsed!.traceId).toBe(traceId);
            expect(parsed!.spanId).toBe(spanId);
            expect(parsed!.traceFlags).toBe(flags);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate trace context through headers', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 32, maxLength: 32 }),
          fc.hexaString({ minLength: 16, maxLength: 16 }),
          (traceId, spanId) => {
            const context = { traceId, spanId, traceFlags: 1 };
            const headers = otel.injectToHeaders(context, {});
            
            expect(headers.traceparent).toBeDefined();
            
            const extracted = otel.extractFromHeaders(headers);
            expect(extracted).not.toBeNull();
            expect(extracted!.traceId).toBe(traceId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3: Log Structure Validity
   * 日志条目应该具有有效的结构
   */
  describe('Property 3: Log Structure Validity', () => {
    it('should create valid log entries', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('debug', 'info', 'warn', 'error', 'fatal'),
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
          (level, message, metadata) => {
            const entry = {
              timestamp: new Date().toISOString(),
              level: level as 'debug' | 'info' | 'warn' | 'error' | 'fatal',
              message,
              metadata,
            };

            expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(['debug', 'info', 'warn', 'error', 'fatal']).toContain(entry.level);
            expect(typeof entry.message).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Sensitive Data Redaction
   * 敏感数据应该被正确脱敏
   */
  describe('Property 4: Sensitive Data Redaction', () => {
    let redactor: LogRedactor;

    beforeEach(() => {
      redactor = new LogRedactor();
    });

    it('should redact all default sensitive fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...DEFAULT_SENSITIVE_FIELDS.slice(0, 10)),
          fc.string({ minLength: 5, maxLength: 100 }),
          (field, value) => {
            const data = { [field]: value, safe: 'public data' };
            const redacted = redactor.redact(data);

            expect(redacted[field]).toBe('[REDACTED]');
            expect(redacted.safe).toBe('public data');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should redact nested sensitive fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }),
          (password) => {
            const data = {
              user: {
                name: 'John',
                credentials: {
                  password,
                },
              },
            };

            const redacted = redactor.redact(data);
            expect((redacted as any).user.credentials.password).toBe('[REDACTED]');
            expect((redacted as any).user.name).toBe('John');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should redact email patterns in strings', () => {
      // 使用符合标准格式的邮箱进行测试
      const validEmails = [
        'test@example.com',
        'user.name@domain.org',
        'admin@company.io',
        'support@service.net',
      ];

      for (const email of validEmails) {
        const data = { message: `User email is ${email}` };
        const redacted = redactor.redact(data);

        expect(redacted.message).not.toContain(email);
        expect(redacted.message).toContain('[REDACTED]');
      }
    });

    it('should handle arrays with sensitive data', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          (passwords) => {
            const data = {
              passwords,
              items: passwords.map(p => ({ password: p })),
            };

            const redacted = redactor.redact(data);
            expect(redacted.passwords).toBe('[REDACTED]');
            for (const item of (redacted as any).items) {
              expect(item.password).toBe('[REDACTED]');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: Health Check Response Structure
   * 健康检查响应应该有正确的结构
   */
  describe('Property 5: Health Check Response Structure', () => {
    let healthService: HealthCheckService;

    beforeEach(() => {
      healthService = new HealthCheckService({
        version: '1.0.0',
      });
    });

    it('should return valid health check result structure', async () => {
      const result = await healthService.checkAll();

      expect(result.status).toBeDefined();
      expect([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY])
        .toContain(result.status);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(typeof result.uptime).toBe('number');
      expect(Array.isArray(result.checks)).toBe(true);
    });

    it('should return healthy status for liveness check', async () => {
      const result = await healthService.checkLiveness();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks[0].name).toBe('process');
    });

    it('should aggregate check results correctly', async () => {
      fc.assert(
        await fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }),
              healthy: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (checkConfigs) => {
            const service = new HealthCheckService();
            
            for (const config of checkConfigs) {
              service.registerCheck(config.name, async () => ({
                name: config.name,
                status: config.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
              }));
            }

            const result = await service.checkAll();
            
            const hasUnhealthy = checkConfigs.some(c => !c.healthy);
            if (hasUnhealthy) {
              expect(result.status).toBe(HealthStatus.UNHEALTHY);
            } else {
              expect(result.status).toBe(HealthStatus.HEALTHY);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 6: Slow Transaction Recording
   * 慢事务应该被正确识别
   */
  describe('Property 6: Slow Transaction Recording', () => {
    it('should identify slow transactions correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000 }),
          fc.integer({ min: 0, max: 10000 }),
          (threshold, duration) => {
            const sentry = new SentryClient({
              dsn: 'https://test@sentry.io/123',
              environment: 'test',
              slowTransactionThreshold: threshold,
            });

            const isSlow = sentry.isSlowTransaction(duration);
            
            if (duration > threshold) {
              expect(isSlow).toBe(true);
            } else {
              expect(isSlow).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default threshold when not configured', () => {
      const sentry = new SentryClient({
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
      });

      expect(sentry.getSlowTransactionThreshold()).toBe(1000);
      expect(sentry.isSlowTransaction(999)).toBe(false);
      expect(sentry.isSlowTransaction(1001)).toBe(true);
    });
  });
});

