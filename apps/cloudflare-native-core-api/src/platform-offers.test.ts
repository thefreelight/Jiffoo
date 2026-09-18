import { describe, expect, it } from 'vitest';
import { tryNativePlatformOffers } from './platform-offers';

describe('native platform offers', () => {
  it('answers the dashboard feed with an explicit empty offer list', async () => {
    const response = await tryNativePlatformOffers(new Request('https://api.example/api/v1/platform-offers'));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-platform-offers');
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { offers: [] } });
  });

  it('passes non-offers routes through untouched', async () => {
    expect(await tryNativePlatformOffers(new Request('https://api.example/api/v1/platform-offers', { method: 'POST' }))).toBeNull();
    expect(await tryNativePlatformOffers(new Request('https://api.example/api/v1/platform-offers/other'))).toBeNull();
  });
});
