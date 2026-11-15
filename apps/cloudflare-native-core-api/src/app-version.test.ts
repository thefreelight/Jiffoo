import { describe, expect, it, vi } from 'vitest';
import { handleAppVersionLatest } from './app-version';

function dbWithValue(value: string | null) {
  return {
    DB: {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => (sql.includes('runtime_metadata') ? (value === null ? null : { value }) : null),
        }),
      }),
    } as never,
  };
}

function request(query: string): Request {
  return new Request(`https://api.example/api/v1/app/version/latest?${query}`);
}

describe('app version latest endpoint', () => {
  it('rejects an unknown platform', async () => {
    const response = await handleAppVersionLatest(request('platform=windows&build=1'), dbWithValue(null));
    expect(response.status).toBe(400);
  });

  it('reports an update when the configured latest build is newer', async () => {
    const config = JSON.stringify({
      latestVersion: '0.0.11',
      latestBuild: 65,
      minBuild: 60,
      releaseNotes: 'Bug fixes',
      storeUrl: 'https://apps.apple.com/app/id1',
      apkUrl: 'https://bokmoo.com/downloads/bokmoo-latest.apk',
    });
    const response = await handleAppVersionLatest(request('platform=ios&build=64'), dbWithValue(config));
    expect(response.status).toBe(200);
    const body = await (response as Response).json() as { data: { updateAvailable: boolean; forceUpdate: boolean; latestVersion: string; apkUrl: string | null } };
    expect(body.data.updateAvailable).toBe(true);
    expect(body.data.forceUpdate).toBe(false);
    expect(body.data.latestVersion).toBe('0.0.11');
    expect(body.data.apkUrl).toBe('https://bokmoo.com/downloads/bokmoo-latest.apk');
  });

  it('forces an update below the minimum supported build', async () => {
    const config = JSON.stringify({ latestVersion: '0.0.11', latestBuild: 65, minBuild: 63 });
    const response = await handleAppVersionLatest(request('platform=android&build=62'), dbWithValue(config));
    const body = await (response as Response).json() as { data: { updateAvailable: boolean; forceUpdate: boolean } };
    expect(body.data.updateAvailable).toBe(true);
    expect(body.data.forceUpdate).toBe(true);
  });

  it('stays silent when the channel is not configured or unparseable', async () => {
    for (const value of [null, 'not-json']) {
      const response = await handleAppVersionLatest(request('platform=ios&build=64'), dbWithValue(value));
      const body = await (response as Response).json() as { data: { configured: boolean; updateAvailable: boolean; forceUpdate: boolean } };
      expect(body.data.configured).toBe(false);
      expect(body.data.updateAvailable).toBe(false);
      expect(body.data.forceUpdate).toBe(false);
    }
  });

  it('treats an up-to-date build as no update', async () => {
    const config = JSON.stringify({ latestVersion: '0.0.10', latestBuild: 64 });
    const response = await handleAppVersionLatest(request('platform=ios&build=64'), dbWithValue(config));
    const body = await (response as Response).json() as { data: { updateAvailable: boolean } };
    expect(body.data.updateAvailable).toBe(false);
  });
});
