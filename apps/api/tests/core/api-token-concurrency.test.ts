/**
 * API token concurrency tests.
 *
 * The API tokens live in their own table, and every write of the module is a
 * conditional single-row update. These tests pin the three races that the
 * settings-blob storage could not survive:
 *
 * - a `lastUsedAt` write that runs while the token is revoked must not
 *   resurrect the revoked token,
 * - a repeated revocation is idempotent,
 * - two concurrent creations do not lose a token.
 *
 * The `api_tokens` table is replaced by an in-memory double that answers the
 * same queries the Prisma client answers - including the conditional
 * `updateMany` predicate - so the test observes the write shapes of the
 * module without a database.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/config/database', () => ({
  prisma: {
    apiToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/core/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from '@/config/database';
import { ApiTokenService } from '@/core/auth/api-token';

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

function createGate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => { open = resolve; });
  return { promise, open };
}

describe('ApiTokenService concurrency', () => {
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
  });

  it('does not resurrect a revoked token with a concurrent usage stamp', async () => {
    const { token, record } = await ApiTokenService.createToken('Concurrent revoke', ['catalog:read']);

    // The usage stamp of the validation blocks until the revocation ran.
    const gate = createGate();
    let entered!: () => void;
    const enteredAtWrite = new Promise<void>((resolve) => { entered = resolve; });
    mockApiToken.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (data && 'lastUsedAt' in data) {
        entered();
        await gate.promise;
      }
      const matched = rows.filter((candidate) => matches(candidate, where));
      matched.forEach((row) => Object.assign(row, data));
      return { count: matched.length };
    });

    const validating = ApiTokenService.validateToken(token);
    await enteredAtWrite;

    // The token is revoked while the validation waits for its write.
    await ApiTokenService.revokeToken(record.id);
    gate.open();

    // The conditional write carries `revokedAt: null`, so it matches no row
    // any more and the revocation stands.
    const usageWrite = mockApiToken.updateMany.mock.calls.find((call) => call[0].data && 'lastUsedAt' in call[0].data);
    expect(usageWrite).toBeDefined();
    expect(usageWrite![0].where).toEqual({ tokenHash: expect.any(String), revokedAt: null });
    expect(rows[0].revokedAt).toBeInstanceOf(Date);
    expect(await validating).toBeNull();
    expect(await ApiTokenService.validateToken(token)).toBeNull();
  });

  it('treats a repeated revocation as idempotent', async () => {
    const { token, record } = await ApiTokenService.createToken('Double revoke', ['catalog:read']);

    await ApiTokenService.revokeToken(record.id);
    const revokedAt = rows[0].revokedAt;

    await expect(ApiTokenService.revokeToken(record.id)).resolves.toBeUndefined();
    expect(rows[0].revokedAt).toEqual(revokedAt);

    const revokeCalls = mockApiToken.updateMany.mock.calls.filter((call) => call[0].data && 'revokedAt' in call[0].data);
    expect(revokeCalls).toHaveLength(2);
    for (const call of revokeCalls) expect(call[0].where).toEqual({ id: record.id, revokedAt: null });

    expect(await ApiTokenService.validateToken(token)).toBeNull();
  });

  it('does not lose a token when two creations run at the same time', async () => {
    const [first, second] = await Promise.all([
      ApiTokenService.createToken('Concurrent A', ['catalog:read']),
      ApiTokenService.createToken('Concurrent B', ['cart:write']),
    ]);

    expect(first.token).not.toBe(second.token);
    expect(first.record.id).not.toBe(second.record.id);
    expect(rows).toHaveLength(2);

    // A creation inserts its own row; it never reads and rewrites a list.
    expect(mockApiToken.findMany).not.toHaveBeenCalled();

    const active = await ApiTokenService.listTokens();
    expect(active.map((record) => record.label).sort()).toEqual(['Concurrent A', 'Concurrent B']);
    expect(await ApiTokenService.validateToken(first.token)).not.toBeNull();
    expect(await ApiTokenService.validateToken(second.token)).not.toBeNull();
  });
});
