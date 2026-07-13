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
      trustLevel: 'builtin',
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

  // --- R1.5: trustLevel mounting point tests ---

  it('requires trustLevel for internal-fastify plugins', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'missing-trust-plugin',
      name: 'Missing Trust Plugin',
      version: '1.0.0',
      description: 'Internal plugin without trustLevel',
      runtimeType: 'internal-fastify',
      entryModule: 'server/index.js',
      permissions: [],
    });

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'trustLevel',
      code: 'MISSING_TRUST_LEVEL',
    }));
  });

  it('rejects third-party trustLevel with internal-fastify runtimeType', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'third-party-internal',
      name: 'Third Party Internal',
      version: '1.0.0',
      description: 'Third-party plugin trying internal-fastify',
      runtimeType: 'internal-fastify',
      trustLevel: 'third-party',
      entryModule: 'server/index.js',
      permissions: [],
    });

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'trustLevel',
      code: 'THIRD_PARTY_INTERNAL_NOT_ALLOWED',
    }));
  });

  it('accepts builtin trustLevel with internal-fastify runtimeType', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'builtin-plugin',
      name: 'Builtin Plugin',
      version: '1.0.0',
      description: 'Builtin internal plugin',
      runtimeType: 'internal-fastify',
      trustLevel: 'builtin',
      entryModule: 'server/index.js',
      permissions: [],
    });

    expect(issues).toEqual([]);
  });

  it('accepts official trustLevel with internal-fastify runtimeType', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'official-plugin',
      name: 'Official Plugin',
      version: '1.0.0',
      description: 'Official signed internal plugin',
      runtimeType: 'internal-fastify',
      trustLevel: 'official',
      entryModule: 'server/index.js',
      permissions: [],
    });

    expect(issues).toEqual([]);
  });

  it('accepts external-http without trustLevel (defaults to third-party at install)', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'external-plugin',
      name: 'External Plugin',
      version: '1.0.0',
      description: 'External HTTP plugin',
      runtimeType: 'external-http',
      externalBaseUrl: 'https://example.com/plugin',
      permissions: [],
    });

    expect(issues).toEqual([]);
  });

  it('rejects invalid trustLevel values', () => {
    const issues = getPluginManifestIssues({
      schemaVersion: 1,
      slug: 'bad-trust-plugin',
      name: 'Bad Trust Plugin',
      version: '1.0.0',
      description: 'Plugin with invalid trustLevel',
      runtimeType: 'internal-fastify',
      trustLevel: 'unknown' as any,
      entryModule: 'server/index.js',
      permissions: [],
    });

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'trustLevel',
      code: 'INVALID_TRUST_LEVEL',
    }));
  });
});
