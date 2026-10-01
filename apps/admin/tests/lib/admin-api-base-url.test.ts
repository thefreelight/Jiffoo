import { describe, expect, it } from 'vitest';

import { normalizeAdminApiBaseUrl } from '../../../../packages/shared/api/create-client';

describe('Admin API base URL normalization', () => {
  it.each([
    ['/api/v1/admin', '/api/v1'],
    ['/api/v1/admin/', '/api/v1'],
    ['https://api.example.com/api/v1/admin', 'https://api.example.com/api/v1'],
    ['/api/v1', '/api/v1'],
    ['/api', '/api'],
  ])('normalizes %s to %s', (configured, expected) => {
    expect(normalizeAdminApiBaseUrl(configured)).toBe(expected);
  });
});
