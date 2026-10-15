import { describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('shared', async importOriginal => ({
  ...await importOriginal<typeof import('shared')>(),
  createAdminClient: () => transport,
}));

import {
  AdminApiError,
  isAdminApiError,
  unwrapApiResponse,
  authApi,
} from '../../lib/api';

describe('Admin API response unwrap', () => {
  it('rejects failed invitation acceptance instead of reporting completion', async () => {
    transport.post.mockResolvedValue({
      success: false,
      error: { code: 'INVALID_INVITE_TOKEN', message: 'Invalid invite token.' },
    });
    try {
      await expect(authApi.acceptInvite('consumed-token', 'StaffPassword123!')).rejects.toMatchObject({
        code: 'INVALID_INVITE_TOKEN', message: 'Invalid invite token.',
      });
    } finally {
      transport.post.mockReset();
    }
  });
  it('returns successful response data', () => {
    expect(unwrapApiResponse({
      success: true,
      data: { currentVersion: '1.0.37' },
    })).toEqual({ currentVersion: '1.0.37' });
  });

  it('throws a typed error with code and details for structured API errors', () => {
    expect(() => unwrapApiResponse({
      success: false,
      error: {
        code: 'MISSING_RELEASE_ASSETS',
        message: 'Release assets are missing',
        details: { missing: ['release-manifest.json'] },
      },
    })).toThrow(AdminApiError);

    try {
      unwrapApiResponse({
        success: false,
        httpStatus: 503,
        error: {
          code: 'MISSING_RELEASE_ASSETS',
          message: 'Release assets are missing',
          details: { missing: ['release-manifest.json'] },
        },
      });
    } catch (error) {
      expect(isAdminApiError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'MISSING_RELEASE_ASSETS',
        message: 'Release assets are missing',
        details: { missing: ['release-manifest.json'] },
        status: 503,
      });
    }
  });

  it('sanitizes noncanonical string and message-only failures', () => {
    expect(() => unwrapApiResponse({
      success: false,
      error: 'Feed did not converge',
    } as any)).toThrow('Request failed');

    expect(() => unwrapApiResponse({
      success: false,
      message: 'Runtime verifier failed',
    })).toThrow('Request failed');
  });
});
