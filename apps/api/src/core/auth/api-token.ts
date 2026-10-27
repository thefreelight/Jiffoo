/**
 * API Token Middleware
 *
 * Lightweight scoped API token authentication for MCP server and
 * other machine-to-machine integrations.
 *
 * Tokens live in their own `api_tokens` table. Every row contains:
 *   - id: unique identifier (`tok_` + 12 hex characters)
 *   - tokenHash: SHA-256 hash of the raw token (never store plaintext)
 *   - label: human-readable label (e.g. "MCP Server - Claude Desktop")
 *   - scopes: array of scope strings (e.g. ["catalog:read", "cart:write"])
 *   - createdAt: creation timestamp
 *   - lastUsedAt: timestamp of the last successful validation
 *   - revokedAt: revocation timestamp (null while the token is active)
 *   - revokedBy: the id of the administrator who revoked the token, written
 *     together with `revokedAt` by the same conditional update (null when the
 *     revocation was not attributed to an administrator)
 *
 * Every write is a conditional single-row update, so a concurrent create
 * cannot lose a token, a concurrent revocation cannot be lost, and the
 * `lastUsedAt` write can never carry a stale `revokedAt` back over a
 * revocation. The table is the only storage of the tokens: the settings
 * blob no longer holds a token list.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { logger } from '@/core/logger/logger';
import { sendError } from '@/utils/response';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiTokenScope =
  | 'catalog:read'
  | 'cart:write'
  | 'checkout:create'
  | 'orders:read'
  | '*';

export interface ApiTokenRecord {
  id: string;
  tokenHash: string;
  label: string;
  scopes: ApiTokenScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ApiTokenIdentity {
  tokenId: string;
  label: string;
  scopes: ApiTokenScope[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The prefix the auth middleware uses to route a request to the token path. */
const TOKEN_PREFIX = 'jiffoo_';

/** 32 random bytes = 256 bits of entropy for every issued token. */
const TOKEN_ENTROPY_BYTES = 32;

/** How often a token is re-generated when its hash collides with a stored one. */
const TOKEN_HASH_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Token Utilities
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a raw token from a cryptographic random source. The `jiffoo_`
 * prefix is part of the token: `core/auth/middleware.ts` uses it to route a
 * request to the API-token path instead of the JWT path.
 */
function generateRawToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_ENTROPY_BYTES).toString('hex')}`;
}

/** A unique-violation on `api_tokens.tokenHash` is a hash collision. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toScopes(value: Prisma.JsonValue | null | undefined): ApiTokenScope[] {
  return Array.isArray(value) ? (value as ApiTokenScope[]) : [];
}

/** Map a stored row onto the public record shape of the admin API. */
function toRecord(row: {
  id: string;
  tokenHash: string;
  label: string;
  scopes: Prisma.JsonValue;
  createdAt: Date | string;
  lastUsedAt?: Date | string | null;
  revokedAt?: Date | string | null;
}): ApiTokenRecord {
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    label: row.label,
    scopes: toScopes(row.scopes),
    createdAt: toIso(row.createdAt)!,
    lastUsedAt: toIso(row.lastUsedAt ?? null),
    revokedAt: toIso(row.revokedAt ?? null),
  };
}

// ---------------------------------------------------------------------------
// Token Service (Admin API)
// ---------------------------------------------------------------------------

export const ApiTokenService = {
  /**
   * Create a new API token.
   * Returns the raw token (only time it is available in plaintext).
   */
  async createToken(label: string, scopes: ApiTokenScope[]): Promise<{ token: string; record: ApiTokenRecord }> {
    for (let attempt = 1; attempt <= TOKEN_HASH_ATTEMPTS; attempt += 1) {
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);
      try {
        const row = await prisma.apiToken.create({
          data: {
            id: `tok_${tokenHash.slice(0, 12)}`,
            tokenHash,
            label,
            scopes: scopes as unknown as Prisma.InputJsonValue,
          },
        });
        const record = toRecord(row);
        logger.info({
          event: 'api_token_created',
          tokenId: record.id,
          label,
          scopes,
        });
        return { token: rawToken, record };
      } catch (error) {
        // A hash collision is practically impossible, but a unique violation
        // must not surface as a raw Prisma error: issue a fresh token instead.
        if (isUniqueConstraintViolation(error) && attempt < TOKEN_HASH_ATTEMPTS) continue;
        throw error;
      }
    }
    throw new Error('api_token_creation_failed: the token hash collided on every attempt');
  },

  /**
   * List all tokens (without the raw token value).
   */
  async listTokens(): Promise<ApiTokenRecord[]> {
    const rows = await prisma.apiToken.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  },

  /**
   * Revoke a token by ID. The write is conditional, so a second revocation
   * of the same token is idempotent and a concurrent `lastUsedAt` write can
   * never undo it.
   *
   * @param tokenId The id of the token to revoke
   * @param actorId The id of the administrator who revokes the token. It is
   *   optional so that a caller without an attributed actor keeps working;
   *   when it is given, the actor and the revocation timestamp are written by
   *   the same conditional update and therefore always agree.
   */
  async revokeToken(tokenId: string, actorId?: string): Promise<void> {
    const revoked = await prisma.apiToken.updateMany({
      where: { id: tokenId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        ...(actorId ? { revokedBy: actorId } : {}),
      },
    });
    if (revoked.count === 0) {
      // Either the token does not exist or it was revoked before. A repeated
      // revocation stays successful; an unknown token is a NOT_FOUND.
      const existing = await prisma.apiToken.findUnique({
        where: { id: tokenId },
        select: { id: true },
      });
      if (!existing) throw new ApiError('NOT_FOUND');
      return;
    }
    logger.info({
      event: 'api_token_revoked',
      tokenId,
      actorId: actorId ?? null,
    });
  },

  /**
   * Validate a raw token string.
   * Returns the token identity on success, or null on failure.
   */
  async validateToken(rawToken: string): Promise<ApiTokenIdentity | null> {
    if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) {
      return null;
    }

    const tokenHash = hashToken(rawToken);
    const row = await prisma.apiToken.findUnique({ where: { tokenHash } });

    if (!row || row.revokedAt !== null) {
      return null;
    }

    // The `lastUsedAt` write touches one column of one row and carries the
    // `revokedAt: null` predicate, so it can never write a stale revocation
    // state back over a revocation that happened in the meantime. A token
    // revoked between the read and the write is therefore rejected.
    let touched = 1;
    try {
      const updated = await prisma.apiToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { lastUsedAt: new Date() },
      });
      touched = updated.count;
    } catch (error) {
      // The usage stamp is not worth failing an authentication over.
      logger.warn({
        event: 'api_token_lastUsedAt_update_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (touched === 0) return null;

    return {
      tokenId: row.id,
      label: row.label,
      scopes: toScopes(row.scopes),
    };
  },
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Check if a scope is satisfied by the granted scopes.
 * '*' grants all scopes.
 */
function hasScope(granted: ApiTokenScope[], required: ApiTokenScope): boolean {
  if (granted.includes('*')) return true;
  return granted.includes(required);
}

/**
 * Create a middleware that requires an API token with specific scopes.
 *
 * Usage:
 *   fastify.get('/products', { preHandler: requireApiTokenScope('catalog:read') }, handler)
 */
export function requireApiTokenScope(...requiredScopes: ApiTokenScope[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(reply, 401, 'UNAUTHORIZED', 'Missing API token. Use Authorization: Bearer <token>');
      return;
    }

    const rawToken = authHeader.substring(7);
    const identity = await ApiTokenService.validateToken(rawToken);

    if (!identity) {
      sendError(reply, 401, 'INVALID_TOKEN', 'API token is invalid or revoked');
      return;
    }

    // Check scopes
    for (const scope of requiredScopes) {
      if (!hasScope(identity.scopes, scope)) {
        sendError(
          reply,
          403,
          'INSUFFICIENT_SCOPE',
          `Token lacks required scope: ${scope}. Granted scopes: ${identity.scopes.join(', ')}`,
        );
        return;
      }
    }

    // Attach token identity to request
    (request as any).apiToken = identity;
  };
}
