/**
 * Security Headers Tests
 *
 * Coverage:
 * - Helmet middleware configuration
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - X-XSS-Protection
 * - Strict-Transport-Security
 * - Content-Security-Policy
 * - Cross-Origin-*-Policy headers
 * - Referrer-Policy
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server';

describe('Security Headers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Core Security Headers', () => {
    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options to SAMEORIGIN', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should set X-XSS-Protection header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-xss-protection']).toBeDefined();
      // Helmet sets this to "0" by default in newer versions for compatibility
      // or "1; mode=block" in older configurations
      expect(['0', '1; mode=block']).toContain(response.headers['x-xss-protection']);
    });

    it('should set Strict-Transport-Security (HSTS) header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=');
    });

    it('should set Content-Security-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Additional Security Headers', () => {
    it('should set Referrer-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['referrer-policy']).toBeDefined();
    });

    it('should set X-DNS-Prefetch-Control header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
    });

    it('should set X-Download-Options header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-download-options']).toBeDefined();
    });

    it('should set X-Permitted-Cross-Domain-Policies header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-permitted-cross-domain-policies']).toBeDefined();
    });

    it('should set Cross-Origin-Opener-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cross-origin-opener-policy']).toBeDefined();
    });

    it('should set Cross-Origin-Resource-Policy header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cross-origin-resource-policy']).toBeDefined();
    });
  });

  describe('HSTS Configuration', () => {
    it('should set HSTS max-age to at least 180 days', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toBeDefined();

      // Extract max-age value from header
      const maxAgeMatch = hstsHeader?.match(/max-age=(\d+)/);
      expect(maxAgeMatch).toBeDefined();

      const maxAge = parseInt(maxAgeMatch![1], 10);
      const minAge = 15552000; // 180 days in seconds
      expect(maxAge).toBeGreaterThanOrEqual(minAge);
    });

    it('should include includeSubDomains in HSTS header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toBeDefined();
      expect(hstsHeader?.toLowerCase()).toContain('includesubdomains');
    });
  });

  describe('CSP Configuration', () => {
    it('should set default-src to self', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      expect(cspHeader).toContain("default-src");
      expect(cspHeader).toContain("'self'");
    });

    it('should set object-src to none for security', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      expect(cspHeader).toContain("object-src");
      expect(cspHeader).toContain("'none'");
    });

    it('should allow unsafe-inline for script-src (needed for Swagger/Scalar)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      expect(cspHeader).toContain("script-src");
      // Swagger/Scalar requires unsafe-inline
      expect(cspHeader).toContain("'unsafe-inline'");
    });
  });

  describe('Security Headers on API Endpoints', () => {
    it('should apply security headers to API root endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should apply security headers to 404 responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent-endpoint',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should apply security headers to liveness check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should apply security headers to readiness check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect([200, 503]).toContain(response.statusCode);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('Header Consistency', () => {
    it('should apply security headers consistently across multiple requests', async () => {
      const endpoints = ['/health', '/health/live', '/health/ready', '/'];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: 'GET',
          url: endpoint,
        });

        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.headers['strict-transport-security']).toBeDefined();
        expect(response.headers['content-security-policy']).toBeDefined();
      }
    });

    it('should not leak X-Powered-By header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Cross-Origin Policies', () => {
    it('should set appropriate Cross-Origin-Resource-Policy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const corpHeader = response.headers['cross-origin-resource-policy'];
      expect(corpHeader).toBeDefined();
      // Should be 'cross-origin' based on server.ts configuration
      expect(corpHeader).toBe('cross-origin');
    });

    it('should set appropriate Cross-Origin-Opener-Policy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const coopHeader = response.headers['cross-origin-opener-policy'];
      expect(coopHeader).toBeDefined();
      // Should be 'same-origin-allow-popups' based on server.ts configuration
      expect(coopHeader).toBe('same-origin-allow-popups');
    });

    it('should not set Cross-Origin-Embedder-Policy (disabled)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      // This is explicitly disabled in server.ts for API compatibility
      expect(response.headers['cross-origin-embedder-policy']).toBeUndefined();
    });
  });
});
