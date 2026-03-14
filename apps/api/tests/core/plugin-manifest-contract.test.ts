import { describe, expect, it } from 'vitest';
import { getPluginManifestIssues } from '@jiffoo/shared';
import { validatePluginManifest } from '../../src/core/admin/extension-installer/utils';

describe('Plugin manifest contract', () => {
  it('accepts lifecycle hooks and theme extensions defined by the shared contract', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'travel-upsell',
      name: 'Travel Upsell',
      version: '1.2.0',
      description: 'Adds upsell blocks and storefront tracking',
      runtimeType: 'external-http',
      externalBaseUrl: 'https://plugins.example.com/travel-upsell',
      permissions: [],
      category: 'marketing',
      minApiVersion: 'v1',
      sdkVersion: '1.2.0',
      requiredApiVersion: { min: '0.2.0' },
      lifecycle: {
        onInstall: true,
        onEnable: true,
      },
      themeExtensions: {
        blocks: [
          {
            extensionId: 'upsell-card',
            name: 'Upsell Card',
            dataEndpoint: '/api/upsell-card',
          },
        ],
        embeds: [
          {
            extensionId: 'tracking-pixel',
            name: 'Tracking Pixel',
            targetPosition: 'body-end',
            dataEndpoint: '/api/tracking-pixel',
          },
        ],
      },
    });

    expect(issues).toEqual([]);
  });

  it('rejects external-http manifests without externalBaseUrl', () => {
    expect(() => validatePluginManifest({
      schemaVersion: 1,
      slug: 'broken-http-plugin',
      name: 'Broken HTTP Plugin',
      version: '1.0.0',
      description: 'Invalid plugin',
      runtimeType: 'external-http',
      permissions: [],
    } as any)).toThrow(/externalBaseUrl is required/i);
  });

  it('rejects invalid embed targets and malformed compatibility metadata', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'bad-embed-plugin',
      name: 'Bad Embed Plugin',
      version: '1.0.0',
      description: 'Invalid embed target',
      runtimeType: 'internal-fastify',
      entryModule: 'server/index.js',
      permissions: [],
      sdkVersion: 'invalid',
      requiredApiVersion: { min: 'nope' },
      themeExtensions: {
        embeds: [
          {
            extensionId: 'broken-embed',
            name: 'Broken Embed',
            targetPosition: 'footer' as any,
          },
        ],
      },
    });

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'sdkVersion',
      code: 'INVALID_MANIFEST',
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      path: 'requiredApiVersion.min',
      code: 'INVALID_VERSION_REQUIREMENT',
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      path: 'themeExtensions.embeds[0].targetPosition',
      code: 'INVALID_THEME_EXTENSION',
    }));
  });
});
