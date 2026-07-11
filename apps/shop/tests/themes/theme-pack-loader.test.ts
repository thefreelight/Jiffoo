import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCache,
  fetchThemeManifest,
  fetchPageTemplate,
  getThemeBaseUrl,
  resolveAssetUrl,
} from '@/lib/theme-pack/loader';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('theme pack loader versioned source of truth', () => {
  beforeEach(() => {
    clearCache();
    vi.unstubAllGlobals();
  });

  it('loads versioned manifests from slug + version without falling back to the legacy slug path', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/extensions/themes/shop/.versions/modelsfind/0.1.4/theme.json?v=0.1.4') {
        return jsonResponse({
          schemaVersion: 1,
          slug: 'modelsfind',
          name: 'ModelsFind',
          version: '0.1.4',
          target: 'shop',
        });
      }

      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const manifest = await fetchThemeManifest('modelsfind', '0.1.4');

    expect(manifest?.version).toBe('0.1.4');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getThemeBaseUrl('modelsfind', '0.1.4')).toBe(
      '/extensions/themes/shop/.versions/modelsfind/0.1.4',
    );
  });

  it('does not silently use legacy same-slug assets when the requested version is missing', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/extensions/themes/shop/.versions/modelsfind/0.1.4/theme.json?v=0.1.4') {
        return new Response(null, { status: 404 });
      }

      if (url.startsWith('/extensions/themes/shop/modelsfind/')) {
        throw new Error(`legacy fallback should not be requested: ${url}`);
      }

      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const manifest = await fetchThemeManifest('modelsfind', '0.1.4');

    expect(manifest).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects stale manifests whose declared version does not match the active installed version', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => jsonResponse({
      schemaVersion: 1,
      slug: 'modelsfind',
      name: 'ModelsFind',
      version: '0.1.3',
      target: 'shop',
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const manifest = await fetchThemeManifest('modelsfind', '0.1.4');

      expect(manifest).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring manifest version mismatch for modelsfind'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not cache a rejected versioned manifest', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let requestCount = 0;
    const fetchMock = vi.fn(async () => {
      requestCount += 1;
      return jsonResponse({
        schemaVersion: 1,
        slug: 'modelsfind',
        name: 'ModelsFind',
        version: requestCount === 1 ? '0.1.3' : '0.1.4',
        target: 'shop',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(fetchThemeManifest('modelsfind', '0.1.4')).resolves.toBeNull();
      await expect(fetchThemeManifest('modelsfind', '0.1.4')).resolves.toMatchObject({
        slug: 'modelsfind',
        version: '0.1.4',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rejects manifests whose declared slug does not match the active installed slug', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => jsonResponse({
      schemaVersion: 1,
      slug: 'other-theme',
      name: 'Other Theme',
      version: '0.1.4',
      target: 'shop',
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const manifest = await fetchThemeManifest('modelsfind', '0.1.4');

      expect(manifest).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring manifest slug mismatch for modelsfind'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('keeps versioned template requests pinned to the resolved versioned base URL', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/extensions/themes/shop/.versions/modelsfind/0.1.4/templates/home.json?v=0.1.4') {
        return jsonResponse({
          schemaVersion: 1,
          page: 'home',
          blocks: [],
        });
      }

      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const template = await fetchPageTemplate(
      'modelsfind',
      'home',
      { schemaVersion: 1, slug: 'modelsfind', name: 'ModelsFind', version: '0.1.4', target: 'shop' },
      '0.1.4',
    );

    expect(template?.page).toBe('home');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves theme assets from the active installed version path', () => {
    expect(
      resolveAssetUrl(
        'modelsfind',
        'thumbnail.svg',
        {
          schemaVersion: 1,
          slug: 'modelsfind',
          name: 'ModelsFind',
          version: '0.1.4',
          target: 'shop',
          entry: {
            assetsDir: 'assets',
          },
        },
        '0.1.4',
      ),
    ).toBe('/extensions/themes/shop/.versions/modelsfind/0.1.4/assets/thumbnail.svg');
  });
});
