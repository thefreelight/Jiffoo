/**
 * API Token Management Routes (Admin)
 *
 * CRUD endpoints for managing scoped API tokens.
 * These are admin-only routes for creating, listing, and revoking tokens.
 *
 * POST   /api/v1/admin/api-tokens          — Create a new token
 * GET    /api/v1/admin/api-tokens          — List all active tokens
 * DELETE /api/v1/admin/api-tokens/:tokenId — Revoke a token
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { ApiTokenService, type ApiTokenScope } from '@/core/auth/api-token';

export async function apiTokenRoutes(fastify: FastifyInstance) {
  // All routes require admin authentication
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Create a new API token
  fastify.post('/', {
    schema: {
      tags: ['admin', 'api-tokens'],
      summary: 'Create API token',
      description: 'Generate a new scoped API token for MCP server or other integrations. Returns the raw token (only shown once).',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['label', 'scopes'],
        properties: {
          label: {
            type: 'string',
            description: 'Human-readable label for this token (e.g. "Claude Desktop - Personal")',
            minLength: 1,
            maxLength: 100,
          },
          scopes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['catalog:read', 'cart:write', 'checkout:create', 'orders:read', '*'],
            },
            description: 'Permission scopes granted to this token',
            minItems: 1,
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { label, scopes } = request.body as { label: string; scopes: ApiTokenScope[] };
      const result = await ApiTokenService.createToken(label, scopes);

      return sendSuccess(reply, {
        token: result.token,
        id: result.record.id,
        label: result.record.label,
        scopes: result.record.scopes,
        createdAt: result.record.createdAt,
        message: 'Save this token securely — it will not be shown again.',
      }, 'Token created successfully', 201);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // List all active tokens
  fastify.get('/', {
    schema: {
      tags: ['admin', 'api-tokens'],
      summary: 'List API tokens',
      description: 'List all active (non-revoked) API tokens. Does not return the raw token value.',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => {
    try {
      const tokens = await ApiTokenService.listTokens();
      return sendSuccess(reply, tokens);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Revoke a token
  fastify.delete('/:tokenId', {
    schema: {
      tags: ['admin', 'api-tokens'],
      summary: 'Revoke API token',
      description: 'Permanently revoke an API token. The token can no longer be used for authentication.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['tokenId'],
        properties: {
          tokenId: { type: 'string', description: 'Token ID to revoke' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { tokenId } = request.params as { tokenId: string };
      await ApiTokenService.revokeToken(tokenId);
      return sendSuccess(reply, { tokenId, revoked: true }, 'Token revoked successfully');
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'NOT_FOUND') {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
