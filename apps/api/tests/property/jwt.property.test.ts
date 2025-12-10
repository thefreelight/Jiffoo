/**
 * JWT Property-Based Tests
 * 
 * Uses fast-check for property-based testing to verify JWT round-trip encoding/decoding.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-property-tests';

describe('JWT Property Tests', () => {
  describe('Round-trip Property', () => {
    it('should encode and decode any valid payload (100+ iterations)', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constantFrom('USER', 'TENANT_ADMIN', 'ADMIN', 'SUPER_ADMIN'),
            tenantId: fc.integer({ min: 1, max: 10000 }),
          }),
          (payload) => {
            const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
            const decoded = jwt.verify(token, TEST_SECRET) as typeof payload;
            
            expect(decoded.userId).toBe(payload.userId);
            expect(decoded.email).toBe(payload.email);
            expect(decoded.role).toBe(payload.role);
            expect(decoded.tenantId).toBe(payload.tenantId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve string properties across encode/decode', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (userId, email) => {
            const payload = { userId, email };
            const token = jwt.sign(payload, TEST_SECRET);
            const decoded = jwt.verify(token, TEST_SECRET) as typeof payload;
            
            expect(decoded.userId).toBe(userId);
            expect(decoded.email).toBe(email);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve numeric properties across encode/decode', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
          (tenantId) => {
            const payload = { tenantId };
            const token = jwt.sign(payload, TEST_SECRET);
            const decoded = jwt.verify(token, TEST_SECRET) as typeof payload;
            
            expect(decoded.tenantId).toBe(tenantId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Token Structure Property', () => {
    it('should always produce a three-part token', () => {
      fc.assert(
        fc.property(
          fc.record({
            data: fc.string({ minLength: 1 }),
          }),
          (payload) => {
            const token = jwt.sign(payload, TEST_SECRET);
            const parts = token.split('.');
            expect(parts).toHaveLength(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always include iat in decoded token', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: fc.string({ minLength: 1 }),
          }),
          (payload) => {
            const token = jwt.sign(payload, TEST_SECRET);
            const decoded = jwt.verify(token, TEST_SECRET) as { iat: number };
            expect(decoded.iat).toBeDefined();
            expect(typeof decoded.iat).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Security Property', () => {
    it('should fail verification with wrong secret', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: fc.uuid(),
          }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (payload, wrongSecret) => {
            const token = jwt.sign(payload, TEST_SECRET);
            
            // Only test when secrets are different
            if (wrongSecret !== TEST_SECRET) {
              expect(() => jwt.verify(token, wrongSecret)).toThrow();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

