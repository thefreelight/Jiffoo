import { describe, expect, it, vi } from 'vitest';
import { nativeSiteName } from './site-name';

function env(stored: string | null, configured?: string) {
  return {
    DB: {
      prepare: vi.fn(() => ({
        first: vi.fn(async () => stored === null ? null : { value: stored }),
      })),
    } as unknown as D1Database,
    ...(configured === undefined ? {} : { SITE_NAME: configured }),
  };
}

describe('nativeSiteName', () => {
  it('prefers the installed site name', async () => {
    await expect(nativeSiteName(env('RemoteRadar', 'Configured'))).resolves.toBe('RemoteRadar');
  });

  it('uses instance configuration before the install flow completes', async () => {
    await expect(nativeSiteName(env(null, 'RemoteRadar'))).resolves.toBe('RemoteRadar');
  });

  it('falls back to the neutral Jiffoo brand', async () => {
    await expect(nativeSiteName(env(null))).resolves.toBe('Jiffoo');
  });
});
