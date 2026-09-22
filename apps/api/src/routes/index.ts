/**
 * API Routes (Single Merchant Version)
 */

import { FastifyInstance } from 'fastify';

// Versioned routes
import { registerV1Routes } from './v1';

/**
 * Register all API routes
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Register the canonical API routes.
  await fastify.register(registerV1Routes, { prefix: '/api/v1' });
}
