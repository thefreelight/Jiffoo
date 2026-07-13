/**
 * API Token Middleware
 *
 * Lightweight scoped API token authentication for MCP server and
 * other machine-to-machine integrations.
 *
 * Tokens are stored in SystemSettings.settings.apiTokens as a JSON array.
 * Each token record contains:
 *   - id: unique identifier (cuid)
 *   - tokenHash: SHA-256 hash of the raw token (never store plaintext)
 *   - label: human-readable label (e.g. "MCP Server - Claude Desktop")
 *   - scopes: array of scope strings (e.g. ["catalog:read", "cart:write", "checkout:create"])
 *   - createdAt: ISO timestamp
 *   - lastUsedAt: ISO timestamp (updated on each request)
 *   - revokedAt: ISO timestamp (null if active)
 *
 * This approach avoids a new database migration by reusing the
 * SystemSettings JSON field.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { logger } from '@/core/logger/logger';
import { sendError } from '@/utils/response';

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

const CACHE_KEY = 'api-tokens:active';
const CACHE_TTL = 30; // 30 seconds

// ---------------------------------------------------------------------------
// Token Utilities
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateRawToken(): string {
  // Generate a URL-safe random token: jiffoo_<32 hex chars>
  const bytes = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 32);
  return `jiffoo_${bytes}`;
}

// ---------------------------------------------------------------------------
// Storage (SystemSettings JSON field)
// ---------------------------------------------------------------------------

async function getTokenRecords(): Promise<ApiTokenRecord[]> {
  const cached = await CacheService.get<ApiTokenRecord[]>(CACHE_KEY);
  if (cached) return cached;

  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' },
  });

  if (!settings?.settings) return [];

  try {
    const raw = typeof settings.settings === 'string'
      ? JSON.parse(settings.settings)
      : settings.settings;
    const tokens = raw?.apiTokens;
    if (!Array.isArray(tokens)) return [];
    return tokens as ApiTokenRecord[];
  } catch {
    return [];
  }
}

async function saveTokenRecords(records: ApiTokenRecord[]): Promise<void> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' },
  });

  const current = settings?.settings
    ? (typeof settings.settings === 'string'
        ? JSON.parse(settings.settings)
        : settings.settings)
    : {};

  current.apiTokens = records;

  await prisma.systemSettings.update({
    where: { id: 'system' },
    data: { settings: JSON.stringify(current) },
  });

  // Invalidate cache
  await CacheService.delete(CACHE_KEY);
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
    const records = await getTokenRecords();
    const rawToken = generateRawToken();
    const record: ApiTokenRecord = {
      id: `tok_${createHash('sha256').update(rawToken).digest('hex').slice(0, 12)}`,
      tokenHash: hashToken(rawToken),
      label,
      scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };

    records.push(record);
    await saveTokenRecords(records);

    logger.info({
      event: 'api_token_created',
      tokenId: record.id,
      label,
      scopes,
    });

    return { token: rawToken, record };
  },

  /**
   * List all tokens (without the raw token value).
   */
  async listTokens(): Promise<ApiTokenRecord[]> {
    const records = await getTokenRecords();
    return records.filter((r) => r.revokedAt === null);
  },

  /**
   * Revoke a token by ID.
   */
  async revokeToken(tokenId: string): Promise<void> {
    const records = await getTokenRecords();
    const record = records.find((r) => r.id === tokenId);
    if (!record) {
      throw Object.assign(new Error(`Token "${tokenId}" not found`), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }
    record.revokedAt = new Date().toISOString();
    await saveTokenRecords(records);

    logger.info({
      event: 'api_token_revoked',
      tokenId,
      label: record.label,
    });
  },

  /**
   * Validate a raw token string.
   * Returns the token identity on success, or null on failure.
   */
  async validateToken(rawToken: string): Promise<ApiTokenIdentity | null> {
    if (!rawToken || !rawToken.startsWith('jiffoo_')) {
      return null;
    }

    const tokenHash = hashToken(rawToken);
    const records = await getTokenRecords();
    const record = records.find((r) => r.tokenHash === tokenHash);

    if (!record || record.revokedAt !== null) {
      return null;
    }

    // Update lastUsedAt (fire-and-forget)
    record.lastUsedAt = new Date().toISOString();
    saveTokenRecords(records).catch((err) => {
      logger.warn({ event: 'api_token_lastUsedAt_update_failed', error: err.message });
    });

    return {
      tokenId: record.id,
      label: record.label,
      scopes: record.scopes,
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
