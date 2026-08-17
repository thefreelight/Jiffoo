import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { normalizePublicApiRequest } = await import('./index');

describe('legacy public API compatibility', () => {
  it('normalizes legacy auth refresh requests before native handling or fallback proxying', async () => {
    const request = new Request('https://api.example/api/auth/refresh?source=app', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: 'expired' }),
    });
    const normalized = normalizePublicApiRequest(request);
    expect(new URL(normalized.url).pathname).toBe('/api/v1/auth/refresh');
    expect(new URL(normalized.url).search).toBe('?source=app');
    await expect(normalized.json()).resolves.toEqual({ refresh_token: 'expired' });
  });
});
