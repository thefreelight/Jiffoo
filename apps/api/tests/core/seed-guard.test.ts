import { describe, expect, it } from 'vitest';
import { assertSeedAllowed } from '../../prisma/seed-guard';

describe('Sample catalog seed guard', () => {
  it('refuses to seed in production', () => {
    expect(() => assertSeedAllowed('production')).toThrow('Sample catalog seed is disabled in production');
  });

  it('allows non-production catalog seeding', () => {
    expect(() => assertSeedAllowed('test')).not.toThrow();
  });
});
