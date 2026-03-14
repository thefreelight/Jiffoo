/**
 * Plugin Service Token Service (Phase 2, Section 4.6)
 *
 * Manages JWT-based service tokens for plugin instances, enabling
 * authenticated plugin-to-platform API calls with permission scoping.
 *
 * Token lifecycle: issue -> (refresh | suspend <-> resume) -> revoke
 * Storage: SHA-256 hash of each JWT is stored in PluginServiceToken table.
 */

import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { logger } from '@/core/logger/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginTokenPayload {
  sub: string;            // installationId
  pluginSlug: string;
  grantedPermissions: string[];
  iss: string;            // 'jiffoo-platform'
  type: string;           // 'plugin-service'
}

export interface PluginIdentity {
  installationId: string;
  pluginSlug: string;
  grantedPermissions: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY = '24h';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parsePermissions(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Issue a new service token for a plugin installation.
 *
 * 1. Looks up the PluginInstallation to read pluginSlug & grantedPermissions.
 * 2. Revokes any previously active token for this installation.
 * 3. Signs a JWT with plugin-specific claims.
 * 4. Stores the SHA-256 hash in PluginServiceToken with status='active'.
 *
 * @returns The raw JWT string (only time it is available in plaintext).
 */
async function issueToken(installationId: string): Promise<string> {
  // Fetch installation (must exist and not be deleted)
  const installation = await prisma.pluginInstallation.findUnique({
    where: { id: installationId },
  });

  if (!installation) {
    throw Object.assign(new Error(`Installation "${installationId}" not found`), {
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  }

  if (installation.deletedAt) {
    throw Object.assign(new Error(`Installation "${installationId}" has been deleted`), {
      statusCode: 400,
      code: 'INSTALLATION_DELETED',
    });
  }

  const grantedPermissions = parsePermissions(installation.grantedPermissions);

  // Revoke any existing active token for this installation
  await prisma.pluginServiceToken.updateMany({
    where: {
      installationId,
      status: 'active',
    },
    data: { status: 'revoked' },
  });

  // Build JWT payload
  const payload: PluginTokenPayload = {
    sub: installationId,
    pluginSlug: installation.pluginSlug,
    grantedPermissions,
    iss: 'jiffoo-platform',
    type: 'plugin-service',
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });

  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Persist token hash
  await prisma.pluginServiceToken.create({
    data: {
      installationId,
      tokenHash,
      status: 'active',
      expiresAt,
    },
  });

  logger.info({
    event: 'plugin_token_issued',
    installationId,
    pluginSlug: installation.pluginSlug,
    expiresAt: expiresAt.toISOString(),
  });

  return token;
}

/**
 * Refresh a service token: verify the current active token is not expired,
 * revoke it, and issue a brand-new token.
 *
 * @returns The new raw JWT string.
 */
async function refreshToken(installationId: string): Promise<string> {
  // Find the current active token record
  const active = await prisma.pluginServiceToken.findFirst({
    where: {
      installationId,
      status: 'active',
    },
    orderBy: { issuedAt: 'desc' },
  });

  if (!active) {
    throw Object.assign(new Error(`No active token found for installation "${installationId}"`), {
      statusCode: 404,
      code: 'TOKEN_NOT_FOUND',
    });
  }

  if (active.expiresAt < new Date()) {
    // Expired tokens cannot be refreshed -- revoke and force re-issue
    await prisma.pluginServiceToken.update({
      where: { id: active.id },
      data: { status: 'revoked' },
    });
    throw Object.assign(new Error('Token has expired. Please issue a new token.'), {
      statusCode: 400,
      code: 'TOKEN_EXPIRED',
    });
  }

  // Revoke old, issue new
  await prisma.pluginServiceToken.update({
    where: { id: active.id },
    data: { status: 'revoked' },
  });

  logger.info({
    event: 'plugin_token_refreshed',
    installationId,
    previousTokenId: active.id,
  });

  return issueToken(installationId);
}

/**
 * Suspend the active token for an installation.
 * Suspended tokens can be resumed later.
 */
async function suspendToken(installationId: string): Promise<void> {
  const result = await prisma.pluginServiceToken.updateMany({
    where: {
      installationId,
      status: 'active',
    },
    data: { status: 'suspended' },
  });

  if (result.count === 0) {
    throw Object.assign(new Error(`No active token found for installation "${installationId}"`), {
      statusCode: 404,
      code: 'TOKEN_NOT_FOUND',
    });
  }

  logger.info({ event: 'plugin_token_suspended', installationId });
}

/**
 * Permanently revoke a token. Cannot be undone.
 */
async function revokeToken(installationId: string): Promise<void> {
  const result = await prisma.pluginServiceToken.updateMany({
    where: {
      installationId,
      status: { in: ['active', 'suspended'] },
    },
    data: { status: 'revoked' },
  });

  if (result.count === 0) {
    throw Object.assign(new Error(`No active or suspended token found for installation "${installationId}"`), {
      statusCode: 404,
      code: 'TOKEN_NOT_FOUND',
    });
  }

  logger.info({ event: 'plugin_token_revoked', installationId });
}

/**
 * Resume a previously suspended token back to 'active'.
 */
async function resumeToken(installationId: string): Promise<void> {
  const suspended = await prisma.pluginServiceToken.findFirst({
    where: {
      installationId,
      status: 'suspended',
    },
    orderBy: { issuedAt: 'desc' },
  });

  if (!suspended) {
    throw Object.assign(new Error(`No suspended token found for installation "${installationId}"`), {
      statusCode: 404,
      code: 'TOKEN_NOT_FOUND',
    });
  }

  // If the suspended token has expired, revoke instead
  if (suspended.expiresAt < new Date()) {
    await prisma.pluginServiceToken.update({
      where: { id: suspended.id },
      data: { status: 'revoked' },
    });
    throw Object.assign(new Error('Suspended token has expired. Please issue a new token.'), {
      statusCode: 400,
      code: 'TOKEN_EXPIRED',
    });
  }

  await prisma.pluginServiceToken.update({
    where: { id: suspended.id },
    data: { status: 'active' },
  });

  logger.info({ event: 'plugin_token_resumed', installationId });
}

/**
 * Validate a raw JWT token:
 *  1. Verify JWT signature and expiration.
 *  2. Confirm payload type is 'plugin-service'.
 *  3. Look up the token hash in DB and confirm status is 'active'.
 *  4. Update lastUsedAt timestamp.
 *
 * @returns The plugin identity on success, or null on any failure.
 */
async function validateToken(token: string): Promise<PluginIdentity | null> {
  // Step 1: Verify JWT
  let payload: PluginTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as PluginTokenPayload;
  } catch {
    return null;
  }

  // Step 2: Confirm token type
  if (payload.type !== 'plugin-service') {
    return null;
  }

  // Step 3: Look up token hash in DB
  const tokenHash = hashToken(token);
  const record = await prisma.pluginServiceToken.findFirst({
    where: { tokenHash },
  });

  if (!record) {
    return null;
  }

  if (record.status !== 'active') {
    return null;
  }

  if (record.expiresAt < new Date()) {
    // Token expired in DB terms -- mark as revoked
    await prisma.pluginServiceToken.update({
      where: { id: record.id },
      data: { status: 'revoked' },
    });
    return null;
  }

  // Step 4: Update lastUsedAt (fire-and-forget to avoid latency)
  prisma.pluginServiceToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch((err) => {
    logger.warn({ event: 'plugin_token_lastUsedAt_update_failed', error: err.message });
  });

  return {
    installationId: payload.sub,
    pluginSlug: payload.pluginSlug,
    grantedPermissions: payload.grantedPermissions,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const PluginTokenService = {
  issueToken,
  refreshToken,
  suspendToken,
  revokeToken,
  resumeToken,
  validateToken,
};
