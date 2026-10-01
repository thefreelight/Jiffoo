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

  it('maps the bare plugin runtime mount onto the versioned native namespace', () => {
    const storefront = normalizePublicApiRequest(
      new Request('https://api.example/plugins/support-hub/store/config?x=1'),
    );
    expect(new URL(storefront.url).pathname).toBe('/api/v1/plugins/support-hub/store/config');
    expect(new URL(storefront.url).search).toBe('?x=1');

    const admin = normalizePublicApiRequest(
      new Request('https://api.example/plugins/support-hub/admin/settings', { method: 'PUT' }),
    );
    expect(new URL(admin.url).pathname).toBe('/api/v1/plugins/support-hub/admin/settings');

    // Already-versioned and unrelated paths are left untouched.
    const versioned = normalizePublicApiRequest(
      new Request('https://api.example/api/v1/plugins/wallet/store/balance'),
    );
    expect(new URL(versioned.url).pathname).toBe('/api/v1/plugins/wallet/store/balance');
    const page = normalizePublicApiRequest(new Request('https://api.example/en/products'));
    expect(new URL(page.url).pathname).toBe('/en/products');
  });
});
