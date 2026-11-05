import { expect, it } from 'vitest';
import { sanitizeData } from 'shared/logger';

it.each(['token', '%74oken', 'other'])('redacts the complete public file query with %s spelling', key => {
  const result = sanitizeData({ url: `/api/v1/plugin-public-files/12345678-1234-4123-8123-123456789abc?${key}=secret-capability&token=second-secret` });
  expect(JSON.stringify(result)).not.toContain('secret-capability');
  expect(JSON.stringify(result)).not.toContain('second-secret');
});
