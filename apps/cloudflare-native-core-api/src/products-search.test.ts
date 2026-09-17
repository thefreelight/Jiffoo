import { describe, expect, it } from 'vitest';
import { matchesQuery, tryNativeProductsSearch } from './products-search';

const CATALOG = {
  success: true,
  data: {
    items: [
      { name: 'ChatGPT', description: 'Conversational assistant', category: { name: 'Chatbots' }, tags: ['chat'], price: 0, rating: 4.9, createdAt: '2026-09-01T00:00:00Z' },
      { name: 'Midjourney', description: 'Image generation', category: { name: 'Image & Design' }, tags: ['image'], price: 10, rating: 4.8, createdAt: '2026-09-02T00:00:00Z' },
      { name: 'Sora', description: 'AI video generation by OpenAI', category: { name: 'Video' }, tags: ['video'], price: 20, rating: 4.7, createdAt: '2026-09-03T00:00:00Z' },
    ],
  },
};

function env(snapshot?: { payload: string; status_code: number }) {
  const rows: Record<string, unknown> = {
    'core:snapshot:/api/v1/products': snapshot,
  };
  return {
    DB: {
      prepare: () => ({
        bind: (key: string) => ({ first: async () => rows[key] ?? null }),
      }),
    },
  } as unknown as { DB: D1Database };
}

const snapshot = { payload: JSON.stringify(CATALOG), status_code: 200 };

describe('native products search', () => {
  it('matches tokens across name, description, category and tags', () => {
    const product = CATALOG.data.items[2];
    expect(matchesQuery(product, ['sora'])).toBe(true);
    expect(matchesQuery(product, ['video', 'openai'])).toBe(true);
    expect(matchesQuery(product, ['chat'])).toBe(false);
    expect(matchesQuery(product, [])).toBe(true);
    expect(matchesQuery(CATALOG.data.items[1], ['image', 'design'])).toBe(true);
  });

  it('filters the dedicated search endpoint and returns the list envelope', async () => {
    const response = await tryNativeProductsSearch(
      new Request('https://native.invalid/api/v1/products/search?q=video&page=1&limit=12'),
      env(snapshot),
    );
    expect(response).not.toBeNull();
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-products-search');
    const body = await response?.json() as {
      success: boolean;
      data: { items: Array<{ name: string }>; total: number; totalPages: number; page: number; limit: number };
    };
    expect(body).toMatchObject({
      success: true,
      data: { total: 1, totalPages: 1, page: 1, limit: 12 },
    });
    expect(body.data.items[0]?.name).toBe('Sora');
  });

  it('honors the search parameter on the plain list path and sorts', async () => {
    const response = await tryNativeProductsSearch(
      new Request('https://native.invalid/api/v1/products?page=1&limit=12&sortBy=price&sortOrder=desc&search=image'),
      env(snapshot),
    );
    const body = await response?.json() as { data: { items: Array<{ name: string }>; total: number } };
    expect(body.data.total).toBe(1);
    expect(body.data.items[0]?.name).toBe('Midjourney');

    // A whitespace-only search term means "no filtering" and falls through to
    // the canonical snapshot read path.
    expect(await tryNativeProductsSearch(
      new Request('https://native.invalid/api/v1/products?page=1&limit=2&sortBy=createdAt&sortOrder=desc&search=   '),
      env(snapshot),
    )).toBeNull();
  });

  it('does not intercept paths without a search term and rejects non-GET', async () => {
    expect(await tryNativeProductsSearch(
      new Request('https://native.invalid/api/v1/products?page=1&limit=12'),
      env(snapshot),
    )).toBeNull();
    expect(await tryNativeProductsSearch(
      new Request('https://native.invalid/api/v1/products/prod-006'),
      env(snapshot),
    )).toBeNull();
    expect(await tryNativeProductsSearch(
      new Request('https://native.invalid/api/v1/products/search?q=sora', { method: 'POST' }),
      env(snapshot),
    )).toBeNull();
  });

  it('reports snapshot unavailability instead of a broken search', async () => {
    const response = await tryNativeProductsSearch(
      new Request('https://native.invalid/api/v1/products/search?q=sora'),
      env(),
    );
    expect(response?.status).toBe(503);
    expect(await response?.json()).toMatchObject({
      success: false,
      error: { code: 'NATIVE_SNAPSHOT_UNAVAILABLE' },
    });
  });
});
