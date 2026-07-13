/**
 * API Token Middleware Integration Tests
 *
 * Tests the dualAuthMiddleware and ApiTokenService lifecycle:
 * - Token creation, validation, revocation
 * - dualAuthMiddleware with API token (jiffoo_ prefix)
 * - dualAuthMiddleware with JWT (falls back to standard auth)
 * - Scope enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('@/config/database', () => ({
  prisma: {
    systemSettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
import { CacheService } from '@/core/cache/service';
import { ApiTokenService } from '@/core/auth/api-token';
import { dualAuthMiddleware } from '@/core/auth/middleware';
import type { FastifyRequest, FastifyReply } from 'fastify';

const mockPrismaSettings = prisma.systemSettings as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const mockCache = CacheService as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

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
    mockCache.get.mockResolvedValue(null);
  });

  it('creates a token and returns the raw value', async () => {
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({}),
    });
    mockPrismaSettings.update.mockResolvedValue({});

    const result = await ApiTokenService.createToken('Test Token', ['catalog:read', 'cart:write']);

    expect(result.token).toMatch(/^jiffoo_/);
    expect(result.record.id).toMatch(/^tok_/);
    expect(result.record.label).toBe('Test Token');
    expect(result.record.scopes).toEqual(['catalog:read', 'cart:write']);
    expect(result.record.revokedAt).toBeNull();
    expect(result.record.tokenHash).toBeTruthy();
  });

  it('validates a created token', async () => {
    // First create
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({}),
    });
    mockPrismaSettings.update.mockResolvedValue({});

    const { token } = await ApiTokenService.createToken('Valid Token', ['catalog:read']);

    // Invalidate cache so it reads from "db"
    mockCache.get.mockResolvedValue(null);

    // The update mock was called with the token record, simulate it being stored
    const updateCall = mockPrismaSettings.update.mock.calls[0][0];
    const storedSettings = JSON.parse(updateCall.data.settings);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify(storedSettings),
    });

    const identity = await ApiTokenService.validateToken(token);

    expect(identity).not.toBeNull();
    expect(identity!.label).toBe('Valid Token');
    expect(identity!.scopes).toEqual(['catalog:read']);
  });

  it('rejects a revoked token', async () => {
    // Create a token
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({}),
    });
    mockPrismaSettings.update.mockResolvedValue({});

    const { token, record } = await ApiTokenService.createToken('Revoke Test', ['catalog:read']);

    // Simulate stored state after creation
    const updateCall = mockPrismaSettings.update.mock.calls[0][0];
    const storedSettings = JSON.parse(updateCall.data.settings);

    // Revoke
    mockCache.get.mockResolvedValue(null);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify(storedSettings),
    });

    await ApiTokenService.revokeToken(record.id);

    // Get updated state after revoke
    const revokeCall = mockPrismaSettings.update.mock.calls[1][0];
    const revokedSettings = JSON.parse(revokeCall.data.settings);

    // Try to validate
    mockCache.get.mockResolvedValue(null);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify(revokedSettings),
    });

    const identity = await ApiTokenService.validateToken(token);
    expect(identity).toBeNull();
  });

  it('lists only non-revoked tokens', async () => {
    const tokens = [
      { id: 'tok_1', label: 'Active', scopes: ['catalog:read'], tokenHash: 'h1', createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null },
      { id: 'tok_2', label: 'Revoked', scopes: ['*'], tokenHash: 'h2', createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: new Date().toISOString() },
    ];

    mockCache.get.mockResolvedValue(null);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({ apiTokens: tokens }),
    });

    const active = await ApiTokenService.listTokens();
    expect(active).toHaveLength(1);
    expect(active[0].label).toBe('Active');
  });
});

describe('dualAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
  });

  it('authenticates with API token (jiffoo_ prefix)', async () => {
    // Create a token first
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({}),
    });
    mockPrismaSettings.update.mockResolvedValue({});

    const { token } = await ApiTokenService.createToken('MCP Server', ['catalog:read', 'cart:write']);

    // Simulate stored state
    const updateCall = mockPrismaSettings.update.mock.calls[0][0];
    const storedSettings = JSON.parse(updateCall.data.settings);
    mockCache.get.mockResolvedValue(null);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify(storedSettings),
    });

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
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({}),
    });
    mockPrismaSettings.update.mockResolvedValue({});

    const { token } = await ApiTokenService.createToken('Limited', ['catalog:read']);

    const updateCall = mockPrismaSettings.update.mock.calls[0][0];
    const storedSettings = JSON.parse(updateCall.data.settings);
    mockCache.get.mockResolvedValue(null);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify(storedSettings),
    });

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
    mockCache.get.mockResolvedValue(null);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({ apiTokens: [] }),
    });

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
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify({}),
    });
    mockPrismaSettings.update.mockResolvedValue({});

    const { token } = await ApiTokenService.createToken('Admin Token', ['*']);

    const updateCall = mockPrismaSettings.update.mock.calls[0][0];
    const storedSettings = JSON.parse(updateCall.data.settings);
    mockCache.get.mockResolvedValue(null);
    mockPrismaSettings.findUnique.mockResolvedValue({
      id: 'system',
      settings: JSON.stringify(storedSettings),
    });

    const request = makeMockRequest(`Bearer ${token}`);
    const reply = makeMockReply();

    const middleware = dualAuthMiddleware('cart:write', 'checkout:create');
    await middleware(request, reply);

    expect(request.user).toBeDefined();
    expect((reply as any).sent).toBe(false);
  });
});
