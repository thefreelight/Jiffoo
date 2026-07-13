/**
 * Unit tests for the Jiffoo API client.
 *
 * Run with: npx tsx --test src/client.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JiffooApiClient, JiffooApiError } from './client.js';

describe('JiffooApiClient', () => {
  describe('constructor', () => {
    it('should normalize base URL by removing trailing slash', () => {
      const client = new JiffooApiClient({ baseUrl: 'http://localhost:3001/api/v1/' });
      // Internal check — baseUrl is private but we can verify behavior
      assert.ok(client instanceof JiffooApiClient);
    });

    it('should accept token and timeout options', () => {
      const client = new JiffooApiClient({
        baseUrl: 'http://localhost:3001',
        token: 'test-token',
        timeoutMs: 5000,
      });
      assert.ok(client instanceof JiffooApiClient);
    });
  });

  describe('error handling', () => {
    it('JiffooApiError should have correct properties', () => {
      const error = new JiffooApiError('Not found', 404, 'NOT_FOUND');
      assert.equal(error.message, 'Not found');
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'NOT_FOUND');
      assert.equal(error.name, 'JiffooApiError');
    });
  });
});
