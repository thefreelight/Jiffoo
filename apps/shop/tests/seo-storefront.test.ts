import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildRedirectTarget,
  countRedirectHit,
  fetchStorefrontRedirects,
  isRedirectCandidate,
  matchStorefrontRedirect,
  normalizeRedirectPath,
  type StorefrontRedirect,
} from '@/lib/seo/redirects';
import { fetchStorefrontSitemapItems } from '@/lib/seo/sitemap-data';
import { fetchStoreName } from '@/lib/seo/store-context';
import { generateProductMetaTags, generateProductStructuredData } from '@/lib/seo-utils';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('product SEO utils: locale-prefixed canonical', () => {
  const base = 'https://bokmoo.com';

  it('builds the canonical from the locale-prefixed path, not a double products prefix', () => {
    const metaTags = generateProductMetaTags({
      name: 'BOKMOO Gold Card',
      description: 'Official BOKMOO gold smart card.',
      slug: 'p1',
      path: '/en/products/p1',
      baseUrl: base,
    });
    expect(metaTags.canonical).toBe(`${base}/en/products/p1`);
    expect(metaTags.ogUrl).toBe(`${base}/en/products/p1`);
  });

  it('falls back to /products/{slug} when no path is given', () => {
    const metaTags = generateProductMetaTags({
      name: 'X',
      slug: 'legacy-slug',
      baseUrl: base,
    });
    expect(metaTags.canonical).toBe(`${base}/products/legacy-slug`);
  });

  it('truncates the meta description to the 155-char SERP budget', () => {
    const metaTags = generateProductMetaTags({
      name: 'X',
      description: 'word '.repeat(60),
      slug: 'p1',
      path: '/en/products/p1',
      baseUrl: base,
    });
    expect(metaTags.description.length).toBeLessThanOrEqual(158); // 155 + ellipsis
    expect(metaTags.description.endsWith('...')).toBe(true);
  });

  it('emits the locale-prefixed URL in Product JSON-LD', () => {
    const json = JSON.parse(generateProductStructuredData({
      name: 'BOKMOO Gold Card',
      slug: 'p1',
      path: '/zh-Hant/products/p1',
      baseUrl: base,
      brand: 'BOKMOO',
    }));
    expect(json.url).toBe(`${base}/zh-Hant/products/p1`);
    expect(json.brand).toEqual({ '@type': 'Brand', name: 'BOKMOO' });
  });
});

describe('normalizeRedirectPath', () => {  it('decodes escapes and strips trailing slashes', () => {
    expect(normalizeRedirectPath('/old-page/')).toBe('/old-page');
    expect(normalizeRedirectPath('/a%20b')).toBe('/a b');
    expect(normalizeRedirectPath('/')).toBe('/');
    expect(normalizeRedirectPath('')).toBe('/');
  });
});

describe('isRedirectCandidate', () => {
  it('only considers page-like navigations', () => {
    expect(isRedirectCandidate('/old', 'GET')).toBe(true);
    expect(isRedirectCandidate('/old', 'HEAD')).toBe(true);
    expect(isRedirectCandidate('/old', 'POST')).toBe(false);
    expect(isRedirectCandidate('/', 'GET')).toBe(false);
    expect(isRedirectCandidate('/_next/static/chunk.js', 'GET')).toBe(false);
    expect(isRedirectCandidate('/files/catalog.pdf', 'GET')).toBe(false);
    expect(isRedirectCandidate('/en/products/x', 'GET')).toBe(true);
  });
});

describe('matchStorefrontRedirect', () => {
  const list: StorefrontRedirect[] = [
    { fromPath: '/old-page', toPath: '/en/products/new', statusCode: 301 },
    { fromPath: '/legacy', toPath: 'https://bokmoo.com/en', statusCode: 308 },
  ];

  it('matches exact normalized paths', () => {
    expect(matchStorefrontRedirect(list, '/old-page')?.statusCode).toBe(301);
    expect(matchStorefrontRedirect(list, '/old-page/')?.statusCode).toBe(301);
    expect(matchStorefrontRedirect(list, '/OLD-PAGE')).toBeNull();
    expect(matchStorefrontRedirect(list, '/missing')).toBeNull();
  });
});

describe('buildRedirectTarget', () => {
  it('resolves relative targets against the origin and carries query params', () => {
    const target = buildRedirectTarget(
      { fromPath: '/old', toPath: '/en/products/new', statusCode: 301 },
      '?utm_source=mail&utm_source=mail2&id=7',
      'https://bokmoo.com'
    );
    // Repeated incoming keys keep their first value; keys are carried once.
    expect(target).toBe('https://bokmoo.com/en/products/new?utm_source=mail&id=7');
  });

  it('does not override query keys the target already defines', () => {
    const target = buildRedirectTarget(
      { fromPath: '/old', toPath: '/en?ref=site', statusCode: 301 },
      '?ref=legacy',
      'https://bokmoo.com'
    );
    expect(target).toBe('https://bokmoo.com/en?ref=site');
  });

  it('keeps absolute external targets', () => {
    const target = buildRedirectTarget(
      { fromPath: '/legacy', toPath: 'https://bokmoo.com/en', statusCode: 308 },
      '',
      'https://other.example'
    );
    expect(target).toBe('https://bokmoo.com/en');
  });
});

describe('fetchStorefrontRedirects', () => {
  it('prefers the native surface when it answers', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/plugins/seo/store/redirects')) {
        return jsonResponse({
          success: true,
          data: { items: [{ fromPath: '/native', toPath: '/n2', statusCode: 301 }] },
        });
      }
      throw new Error('should not probe the core surface');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchStorefrontRedirects('https://bokmoo.com');
    expect(result).toEqual({
      items: [{ fromPath: '/native', toPath: '/n2', statusCode: 301 }],
      surface: 'native',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the core surface when the native adapter is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/seo/store/redirects')) {
        return jsonResponse({
          success: true,
          data: { items: [{ fromPath: '/core', toPath: '/c2', statusCode: 302 }] },
        });
      }
      return jsonResponse({ error: { code: 'NOT_FOUND' } }, 404);
    }));

    const result = await fetchStorefrontRedirects('https://example.com');
    expect(result).toEqual({
      items: [{ fromPath: '/core', toPath: '/c2', statusCode: 302 }],
      surface: 'core',
    });
  });

  it('prefers the plugin gateway surface over the core alias when it answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/extensions/plugin/seo/api/store/redirects')) {
        return jsonResponse({
          success: true,
          data: { items: [{ fromPath: '/plugin', toPath: '/p2', statusCode: 301 }] },
        });
      }
      if (url.includes('/api/seo/store/redirects')) {
        throw new Error('should not probe the core surface');
      }
      return jsonResponse({ error: { code: 'NOT_FOUND' } }, 404);
    }));

    const result = await fetchStorefrontRedirects('https://example.com');
    expect(result).toEqual({
      items: [{ fromPath: '/plugin', toPath: '/p2', statusCode: 301 }],
      surface: 'plugin',
    });
  });

  it('returns an empty list when neither surface answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 500)));
    const result = await fetchStorefrontRedirects('https://example.com');
    expect(result).toEqual({ items: [], surface: null });
  });

  it('treats an empty-but-valid surface answer as final', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/plugins/seo/store/redirects')) {
        return jsonResponse({ success: true, data: { items: [] } });
      }
      throw new Error('should not probe the core surface');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchStorefrontRedirects('https://example.com');
    expect(result.items).toEqual([]);
    expect(result.surface).toBe('native');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('countRedirectHit', () => {
  it('calls the resolve endpoint of the given surface and swallows errors', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/plugins/seo/store/redirects/resolve?path=%2Fold%20page')) {
        return jsonResponse({ success: true, data: { match: true } });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(countRedirectHit('https://example.com', 'native', '/old%20page/')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/v1/plugins/seo/store/redirects/resolve?path=%2Fold%20page',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});

describe('fetchStorefrontSitemapItems', () => {
  it('parses the native surface payload with lastmod and truncated flag', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/plugins/seo/store/sitemap')) {
        return jsonResponse({
          success: true,
          data: {
            items: [
              { id: 'p1', lastmod: '2026-08-24T10:13:56Z' },
              { id: 'p2' },
            ],
            truncated: true,
          },
        });
      }
      return jsonResponse({}, 404);
    }));

    const result = await fetchStorefrontSitemapItems('https://example.com');
    expect(result).toEqual({
      items: [
        { id: 'p1', lastmod: '2026-08-24T10:13:56Z' },
        { id: 'p2' },
      ],
      truncated: true,
    });
  });

  it('falls back to the core surface', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/seo/store/sitemap')) {
        return jsonResponse({ success: true, data: { items: [{ id: 'c1' }] } });
      }
      return jsonResponse({}, 404);
    }));

    const result = await fetchStorefrontSitemapItems('https://example.com');
    expect(result.items).toEqual([{ id: 'c1' }]);
    expect(result.truncated).toBe(false);
  });

  it('returns an empty set when no surface answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const result = await fetchStorefrontSitemapItems('https://example.com');
    expect(result).toEqual({ items: [], truncated: false });
  });
});

describe('fetchStoreName', () => {
  it('reads the trimmed store name from the store context', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      success: true,
      data: { storeName: '  BOKMOO  ' },
    })));
    expect(await fetchStoreName('https://bokmoo.com')).toBe('BOKMOO');
  });

  it('returns null on failure or blank names', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/bad')) throw new Error('down');
      return jsonResponse({ success: true, data: { storeName: '   ' } });
    }));
    expect(await fetchStoreName('https://example.com/bad')).toBeNull();
    expect(await fetchStoreName('https://example.com/blank')).toBeNull();
  });
});
