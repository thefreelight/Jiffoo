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

  it('falls back to builtin-default when neither manifest nor theme slugs map to a known renderer', () => {
    expect(
      resolveThemeRendererSlug({
        activeThemeSlug: 'unknown-market-theme',
        serverThemeSlug: 'still-unknown',
      }),
    ).toBe('builtin-default');
  });
});
