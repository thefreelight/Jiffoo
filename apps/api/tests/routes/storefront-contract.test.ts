/**
 * Storefront route contract tests.
 *
 * The storefront client (apps/shop, apiClient base `/api/v1`) calls a fixed
 * set of API paths. This suite guards the shop↔API contract: every path the
 * storefront calls must be REGISTERED by the API. A 404 with Fastify's
 * "Route ... not found" body means the contract is broken (prefix drift,
 * removed route), which is exactly how the homepage recommendations widget
 * shipped a storefront-facing error card (see PR #307).
 *
 * The assertions are deliberately registration-only: runtime failures (500s
 * from missing plugins/DB in the unit environment) still prove the route
 * exists and are acceptable here.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';

/** Storefront-called API paths (mirrors apps/shop lib/api.ts + services). */
const STOREFRONT_CONTRACT_PATHS = [
  '/api/v1/store/context',
  '/api/v1/themes/active',
  '/api/v1/recommendations/personalized?sessionId=contract&limit=8',
  '/api/v1/recommendations/customers-also-bought?productId=contract&limit=8',
];

function isRouteMissing(statusCode: number, body: unknown): boolean {
  if (statusCode !== 404) return false;
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? String((body as { message?: unknown }).message ?? '')
      : '';
  return message.includes('not found');
}

describe('Storefront route contract', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  for (const path of STOREFRONT_CONTRACT_PATHS) {
    it(`registers ${path.split('?')[0]}`, async () => {
      const response = await app.inject({ method: 'GET', url: path });
      const body = response.json();
      expect(
        isRouteMissing(response.statusCode, body),
        `Storefront contract broken: ${path} is not registered (404). ` +
          `The shop calls this path; register it in apps/api/src/routes/index.ts.`,
      ).toBe(false);
    });
  }
});
