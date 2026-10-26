import { beforeEach, describe, expect, it, vi } from 'vitest';

// The manifest cache lives on the UpgradeService module; assert that repeated
// version-info calls hit the remote manifest feed only once within the TTL.

vi.mock('@/config/database', () => {
  const systemSettings = {
    upsert: vi.fn(async () => ({ id: 'system' })),
    findUnique: vi.fn(async () => ({ id: 'system', version: '1.0.159-opensource' })),
    update: vi.fn(async () => ({ id: 'system' })),
  };
  return { prisma: { systemSettings } };
});

import { UpgradeService } from '@/core/upgrade/service';

const MANIFEST_BODY = {
  latestVersion: '99.0.0-opensource',
  releaseDate: '2026-10-03T00:00:00.000Z',
  deliveryMode: 'source-archive',
  channel: 'stable',
  releaseNotes: 'Test train notes',
};

describe('UpgradeService manifest cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // NODE_ENV=test disables the default public manifest feed; point the
    // env-manifest override at a controlled URL for this test.
    vi.stubEnv('JIFFOO_CORE_UPDATE_MANIFEST_URL', 'https://feed.example.com/releases/core/manifest.json');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches the remote manifest once for repeated version-info calls', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(MANIFEST_BODY), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await UpgradeService.getVersionInfo();
    expect(first.updateAvailable).toBe(true);
    expect(first.latestVersion).toBe('99.0.0-opensource');

    const second = await UpgradeService.getVersionInfo();
    expect(second.updateAvailable).toBe(true);

    // Two version-info reads, one remote manifest fetch (5-minute TTL).
    const manifestFetches = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/manifest'),
    );
    expect(manifestFetches.length).toBe(1);
  });
});
