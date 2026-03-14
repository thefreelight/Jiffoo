import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_APP_HEALTH_CHECK_PATH,
  DEFAULT_THEME_APP_HEALTH_CHECK_RETRIES,
  DEFAULT_THEME_APP_HEALTH_CHECK_RETRY_INTERVAL,
  DEFAULT_THEME_APP_HEALTH_CHECK_TIMEOUT,
  getThemeAppManifestIssues,
  resolveThemeAppHealthCheck,
  type ThemeAppManifest,
} from '../../src/core/admin/theme-app-runtime/contract';

function createManifest(overrides: Partial<ThemeAppManifest> = {}): ThemeAppManifest {
  return {
    schemaVersion: 1,
    type: 'theme-app',
    slug: 'modern-travel',
    name: 'Modern Travel',
    version: '1.0.0',
    target: 'shop',
    runtime: {
      kind: 'next-standalone',
      entry: 'server.js',
      healthPath: '/api/health',
    },
    ...overrides,
  };
}

describe('Theme App contract', () => {
  it('accepts a valid next-standalone theme-app manifest', () => {
    const issues = getThemeAppManifestIssues(createManifest({
      healthCheck: {
        timeout: 7000,
        retries: 2,
        retryInterval: 500,
      },
      env: {
        LOG_LEVEL: 'info',
      },
      tags: ['travel'],
    }));

    expect(issues).toEqual([]);
  });

  it('rejects unsupported runtime kinds', () => {
    const issues = getThemeAppManifestIssues(createManifest({
      runtime: {
        kind: 'microservice' as never,
        entry: 'server.js',
      },
    }));

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'runtime.kind',
      code: 'INVALID_RUNTIME',
    }));
  });

  it('resolves health checks from manifest overrides with sane defaults', () => {
    const healthCheck = resolveThemeAppHealthCheck(createManifest({
      runtime: {
        kind: 'next-standalone',
        entry: 'server.js',
        healthPath: '/runtime-health',
      },
    }));

    expect(healthCheck).toEqual({
      path: '/runtime-health',
      timeout: DEFAULT_THEME_APP_HEALTH_CHECK_TIMEOUT,
      retries: DEFAULT_THEME_APP_HEALTH_CHECK_RETRIES,
      retryInterval: DEFAULT_THEME_APP_HEALTH_CHECK_RETRY_INTERVAL,
    });

    const overriddenHealthCheck = resolveThemeAppHealthCheck(createManifest({
      healthCheck: {
        path: '/readyz',
        timeout: 9000,
        retries: 1,
        retryInterval: 250,
      },
    }));

    expect(overriddenHealthCheck).toEqual({
      path: '/readyz',
      timeout: 9000,
      retries: 1,
      retryInterval: 250,
    });

    const defaultHealthCheck = resolveThemeAppHealthCheck(createManifest({
      runtime: {
        kind: 'next-standalone',
        entry: 'server.js',
      },
    }));

    expect(defaultHealthCheck.path).toBe(DEFAULT_THEME_APP_HEALTH_CHECK_PATH);
  });
});
