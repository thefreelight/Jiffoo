import { describe, expect, it } from 'vitest';
import {
  getEmbeddedRendererSlug,
  resolveThemeRendererSlug,
  shouldLoadThemePackResources,
} from '@/lib/theme-pack/rendering-mode';

describe('theme pack rendering mode contract', () => {
  it('keeps loading theme pack resources for official-market themes even when the slug matches a builtin renderer', () => {
    expect(
      shouldLoadThemePackResources(
        {
          slug: 'esim-mall',
          version: '1.0.0',
          source: 'official-market',
          config: {},
          activatedAt: new Date().toISOString(),
        },
      ),
    ).toBe(true);
  });

  it('skips theme pack resource loading for builtin themes unless preview mode is active', () => {
    const activeTheme = {
      slug: 'builtin-default',
      version: '1.0.0',
      source: 'builtin' as const,
      config: {},
      activatedAt: new Date().toISOString(),
    };

    expect(shouldLoadThemePackResources(activeTheme)).toBe(false);
    expect(shouldLoadThemePackResources(activeTheme, 'esim-mall')).toBe(true);
  });

  it('treats builtin-default as builtin even when older APIs omit the source field', () => {
    expect(
      shouldLoadThemePackResources(
        {
          slug: 'builtin-default',
          version: '1.0.0',
          source: undefined as any,
          config: {},
          activatedAt: new Date().toISOString(),
        },
      ),
    ).toBe(false);
  });

  it('resolves embedded renderer slugs from theme manifests', () => {
    expect(
      getEmbeddedRendererSlug({
        schemaVersion: 1,
        slug: 'official-esim-market',
        name: 'Official eSIM Market',
        version: '1.0.0',
        target: 'shop',
        'x-jiffoo-renderer-mode': 'embedded',
        'x-jiffoo-renderer-slug': 'esim-mall',
      }),
    ).toBe('esim-mall');
  });

  it('rejects embedded renderer slugs that are not on the compatibility allowlist', () => {
    expect(
      getEmbeddedRendererSlug({
        schemaVersion: 1,
        slug: 'modelsfind',
        name: 'ModelsFind',
        version: '0.1.0',
        target: 'shop',
        'x-jiffoo-renderer-mode': 'embedded',
        'x-jiffoo-renderer-slug': 'modelsfind',
      }),
    ).toBeNull();
  });

  it('prefers manifest-declared embedded renderers over raw active theme slugs', () => {
    expect(
      resolveThemeRendererSlug({
        manifest: {
          schemaVersion: 1,
          slug: 'official-esim-market',
          name: 'Official eSIM Market',
          version: '1.0.0',
          target: 'shop',
          'x-jiffoo-renderer-mode': 'embedded',
          'x-jiffoo-renderer-slug': 'esim-mall',
        },
        activeThemeSlug: 'official-esim-market',
        serverThemeSlug: 'builtin-default',
      }),
    ).toBe('esim-mall');
  });

  it('preserves the active theme slug so the provider can wait for a packaged runtime', () => {
    expect(
      resolveThemeRendererSlug({
        activeThemeSlug: 'modelsfind',
        serverThemeSlug: 'builtin-default',
      }),
    ).toBe('modelsfind');
  });

  it('preserves the server theme slug when the client theme pack has not loaded yet', () => {
    expect(
      resolveThemeRendererSlug({
        serverThemeSlug: 'imagic-studio',
      }),
    ).toBe('imagic-studio');
  });

  it('prefers packaged runtimes over embedded fallback metadata', () => {
    expect(
      resolveThemeRendererSlug({
        manifest: {
          schemaVersion: 1,
          slug: 'modelsfind',
          name: 'ModelsFind',
          version: '0.1.10',
          target: 'shop',
          entry: {
            runtimeJS: 'runtime/theme-runtime.js',
          },
          'x-jiffoo-renderer-mode': 'embedded',
          'x-jiffoo-renderer-slug': 'modelsfind',
        },
        activeThemeSlug: 'modelsfind',
        serverThemeSlug: 'builtin-default',
      }),
    ).toBe('modelsfind');
  });

  it('still falls back to builtin-default when nothing provides a theme slug', () => {
    expect(resolveThemeRendererSlug({})).toBe('builtin-default');
  });
});
