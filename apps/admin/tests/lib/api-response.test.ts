import { describe, expect, it } from 'vitest';

import {
  AdminApiError,
  isAdminApiError,
  unwrapApiResponse,
} from '../../lib/api';

describe('Admin API response unwrap', () => {
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
        details: { missing: ['core-update-manifest.json'] },
      },
    })).toThrow(AdminApiError);

    try {
      unwrapApiResponse({
        success: false,
        error: {
          code: 'MISSING_RELEASE_ASSETS',
          message: 'Release assets are missing',
          details: { missing: ['core-update-manifest.json'] },
        },
      });
    } catch (error) {
      expect(isAdminApiError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'MISSING_RELEASE_ASSETS',
        message: 'Release assets are missing',
        details: { missing: ['core-update-manifest.json'] },
      });
    }
  });

  it('normalizes string and message-only failures', () => {
    expect(() => unwrapApiResponse({
      success: false,
      error: 'Feed did not converge',
    } as any)).toThrow('Feed did not converge');

    expect(() => unwrapApiResponse({
      success: false,
      message: 'Runtime verifier failed',
    })).toThrow('Runtime verifier failed');
  });
});
