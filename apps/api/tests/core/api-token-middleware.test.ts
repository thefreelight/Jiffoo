/**
 * API Token Middleware Integration Tests
 *
 * Tests the dualAuthMiddleware and ApiTokenService lifecycle against the
 * `api_tokens` table:
 * - Token creation, validation, revocation
 * - The conditional writes that make a revocation final
 * - dualAuthMiddleware with API token (jiffoo_ prefix)
 * - dualAuthMiddleware with JWT (falls back to standard auth)
 * - Scope enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';

// Mock dependencies before importing
vi.mock('@/config/database', () => ({
  prisma: {
    apiToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/core/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/jwt', () => ({
  JwtUtils: {
    verify: vi.fn(),
  },
}));

import { prisma } from '@/config/database';
import { ApiTokenService } from '@/core/auth/api-token';
import { dualAuthMiddleware } from '@/core/auth/middleware';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * The rows of the `api_tokens` table of the test double. The double answers
 * the same queries the real client answers, including the conditional
 * `updateMany` predicate, so the test observes the write shapes of the module.
 */
type TokenRow = {
  id: string;
  tokenHash: string;
  label: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

const rows: TokenRow[] = [];

function matches(row: TokenRow, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value);
}

const mockApiToken = prisma.apiToken as unknown as {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makeMockReply() {
  const reply: any = {
    statusCode: 200,
    sent: false,
    code(c: number) { this.statusCode = c; return this; },
    status(c: number) { this.statusCode = c; return this; },
    send(data: any) { this.sent = true; this.body = data; return this; },
    header() { return this; },
  };
  return reply as unknown as FastifyReply;
}

function makeMockRequest(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return { headers } as unknown as FastifyRequest;
}

describe('ApiTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows.length = 0;

    mockApiToken.create.mockImplementation(async ({ data }: any) => {
      const row: TokenRow = {
        id: data.id,
        tokenHash: data.tokenHash,
        label: data.label,
        scopes: data.scopes,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      };
      rows.push(row);
      return { ...row };
    });
    mockApiToken.findUnique.mockImplementation(async ({ where }: any) => {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    });
    mockApiToken.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((candidate) => matches(candidate, where)).map((row) => ({ ...row })));
    mockApiToken.updateMany.mockImplementation(async ({ where, data }: any) => {
      const matched = rows.filter((candidate) => matches(candidate, where));
      matched.forEach((row) => Object.assign(row, data));
      return { count: matched.length };
    });
  });

  it('creates a token and returns the raw value', async () => {
    const result = await ApiTokenService.createToken('Test Token', ['catalog:read', 'cart:write']);

    expect(result.token).toMatch(/^jiffoo_/);
    expect(result.record.id).toMatch(/^tok_/);
    expect(result.record.label).toBe('Test Token');
    expect(result.record.scopes).toEqual(['catalog:read', 'cart:write']);
    expect(result.record.revokedAt).toBeNull();
    expect(result.record.tokenHash).toBeTruthy();

    // The row is stored in the table and the plaintext token is not.
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(result.token));
    expect(rows[0].tokenHash).not.toBe(result.token);
  });

  it('issues a token with more entropy than the previous timestamp seed', async () => {
    const first = await ApiTokenService.createToken('Entropy', ['catalog:read']);
    const second = await ApiTokenService.createToken('Entropy', ['catalog:read']);

    expect(first.token).not.toBe(second.token);
    // 32 random bytes rendered as hex.
    expect(first.token).toMatch(/^jiffoo_[0-9a-f]{64}$/);
    expect(first.record.id).not.toBe(second.record.id);
  });

  it('validates a created token and stamps its usage with a conditional single-column update', async () => {
    const { token, record } = await ApiTokenService.createToken('Valid Token', ['catalog:read']);

    const identity = await ApiTokenService.validateToken(token);

    expect(identity).not.toBeNull();
    expect(identity!.label).toBe('Valid Token');
    expect(identity!.scopes).toEqual(['catalog:read']);
    expect(identity!.tokenId).toBe(record.id);

    // The usage stamp is a conditional update of one column, never a write of
    // a whole token row.
    expect(mockApiToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(rows[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it('rejects a revoked token', async () => {
    const { token, record } = await ApiTokenService.createToken('Revoke Test', ['catalog:read']);

    await ApiTokenService.revokeToken(record.id);

    // The revocation is a conditional update, so it cannot be lost and a
    // concurrent usage stamp cannot undo it.
    expect(mockApiToken.updateMany).toHaveBeenCalledWith({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(rows[0].revokedAt).toBeInstanceOf(Date);

    const identity = await ApiTokenService.validateToken(token);
    expect(identity).toBeNull();
  });

  it('answers NOT_FOUND for an unknown token and stays idempotent for a revoked one', async () => {
    const { record } = await ApiTokenService.createToken('Idempotent', ['catalog:read']);

    await expect(ApiTokenService.revokeToken('tok_unknown')).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await ApiTokenService.revokeToken(record.id);
    const revokedAt = rows[0].revokedAt;
    await expect(ApiTokenService.revokeToken(record.id)).resolves.toBeUndefined();
    expect(rows[0].revokedAt).toEqual(revokedAt);
  });

  it('lists only non-revoked tokens', async () => {
    rows.push(
      { id: 'tok_1', label: 'Active', scopes: ['catalog:read'], tokenHash: 'h1', createdAt: new Date(), lastUsedAt: null, revokedAt: null },
      { id: 'tok_2', label: 'Revoked', scopes: ['*'], tokenHash: 'h2', createdAt: new Date(), lastUsedAt: null, revokedAt: new Date() },
    );

    const active = await ApiTokenService.listTokens();
    expect(active).toHaveLength(1);
    expect(active[0].label).toBe('Active');
    expect(active[0].revokedAt).toBeNull();
  });
});

describe('dualAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows.length = 0;

    mockApiToken.create.mockImplementation(async ({ data }: any) => {
      const row: TokenRow = {
        id: data.id,
        tokenHash: data.tokenHash,
        label: data.label,
        scopes: data.scopes,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      };
      rows.push(row);
      return { ...row };
    });
    mockApiToken.findUnique.mockImplementation(async ({ where }: any) => {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    });
    mockApiToken.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((candidate) => matches(candidate, where)).map((row) => ({ ...row })));
    mockApiToken.updateMany.mockImplementation(async ({ where, data }: any) => {
      const matched = rows.filter((candidate) => matches(candidate, where));
      matched.forEach((row) => Object.assign(row, data));
      return { count: matched.length };
    });
  });

  it('authenticates with API token (jiffoo_ prefix)', async () => {
    const { token } = await ApiTokenService.createToken('MCP Server', ['catalog:read', 'cart:write']);

    const request = makeMockRequest(`Bearer ${token}`);
    const reply = makeMockReply();

    const middleware = dualAuthMiddleware('cart:write');
    await middleware(request, reply);

    expect(request.user).toBeDefined();
    expect(request.user!.id).toMatch(/^api:tok_/);
    expect(request.user!.role).toBe('CUSTOMER');
    expect((request as any).apiToken).toBeDefined();
    expect((request as any).apiToken.label).toBe('MCP Server');
  });

  it('rejects API token with insufficient scope', async () => {
    const { token } = await ApiTokenService.createToken('Limited', ['catalog:read']);

    const request = makeMockRequest(`Bearer ${token}`);
    const reply = makeMockReply();

    const middleware = dualAuthMiddleware('cart:write');
    await middleware(request, reply);

    expect((reply as any).statusCode).toBe(403);
    expect((reply as any).body).toMatchObject({
      error: { code: 'INSUFFICIENT_SCOPE' },
    });
  });

  it('rejects invalid API token', async () => {
    const request = makeMockRequest('Bearer jiffoo_invalid_token');
    const reply = makeMockReply();

    const middleware = dualAuthMiddleware('catalog:read');
    await middleware(request, reply);

    expect((reply as any).statusCode).toBe(401);
    expect((reply as any).body).toMatchObject({
      error: { code: 'INVALID_TOKEN' },
    });
  });

  it('rejects missing authorization header', async () => {
    const request = makeMockRequest();
    const reply = makeMockReply();

    const middleware = dualAuthMiddleware('catalog:read');
    await middleware(request, reply);

    expect((reply as any).statusCode).toBe(401);
  });

  it('allows wildcard scope to pass any check', async () => {
    const { token } = await ApiTokenService.createToken('Admin Token', ['*']);

    const request = makeMockRequest(`Bearer ${token}`);
    const reply = makeMockReply();

    const middleware = dualAuthMiddleware('cart:write', 'checkout:create');
    await middleware(request, reply);

    expect(request.user).toBeDefined();
    expect((reply as any).sent).toBe(false);
  });
});
