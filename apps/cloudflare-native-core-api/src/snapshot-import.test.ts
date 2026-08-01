import { describe, expect, it } from 'vitest';
import { isAllowedSnapshotPath } from './snapshot-import';

describe('snapshot import path policy', () => {
  it('allows product list and detail snapshots', () => {
    expect(isAllowedSnapshotPath('/api/v1/products')).toBe(true);
    expect(isAllowedSnapshotPath('/api/v1/products/sku-123?locale=en')).toBe(true);
  });

  it('rejects arbitrary paths and origins', () => {
    expect(isAllowedSnapshotPath('/api/v1/store/context')).toBe(false);
    expect(isAllowedSnapshotPath('https://example.com/api/v1/products')).toBe(false);
    expect(isAllowedSnapshotPath('/api/v1/products/../../admin')).toBe(false);
  });
});
