import { describe, expect, it } from 'vitest';
import { tryNativeGatewayFallbacks } from './gateway-fallbacks';

function get(path: string): Response | null {
  return tryNativeGatewayFallbacks(new Request(`https://api.example.com${path}`));
}

describe('native gateway fallbacks', () => {
  it('reports unavailable social-auth providers with a fast structured status', () => {
    for (const slug of ['google-auth', 'apple-auth']) {
      const response = get(`/api/extensions/plugin/${slug}/api/status`);
      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
    }
  });

  it('declines social-auth authorize calls with a structured 503 instead of hanging', async () => {
    const response = get('/api/extensions/plugin/google-auth/api/authorize?redirect_url=https://x.test/cb');
    expect(response?.status).toBe(503);
    const body = await response?.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PLUGIN_GATEWAY_UNAVAILABLE');
  });

  it('fails fast for hermes-bridge workspace calls (campaigns list)', async () => {
    const response = get('/api/extensions/plugin/hermes-bridge/api/api/campaigns?limit=100');
    expect(response?.status).toBe(503);
    const body = await response?.json() as { error: { code: string } };
    expect(body.error.code).toBe('PLUGIN_GATEWAY_UNAVAILABLE');
  });

  it('answers personalized recommendations with an empty page instead of self-looping', async () => {
    for (const path of ['/api/recommendations/personalized', '/api/v1/recommendations/personalized']) {
      const response = get(`${path}?sessionId=s1&limit=8`);
      expect(response?.status).toBe(200);
      const body = await response?.json() as { success: boolean; data: { type: string; products: unknown[]; totalCount: number } };
      expect(body.success).toBe(true);
      expect(body.data.products).toEqual([]);
      expect(body.data.totalCount).toBe(0);
    }
  });

  it('leaves every other route untouched', () => {
    expect(get('/api/extensions/plugin/remoteradar-jobs/api/status')).toBeNull();
    expect(get('/api/v1/auth/me')).toBeNull();
    expect(get('/api/extensions/theme-extensions/embeds')).toBeNull();
    expect(tryNativeGatewayFallbacks(new Request('https://api.example.com/api/extensions/plugin/google-auth/api/status', { method: 'PUT' }))).toBeNull();
  });
});
