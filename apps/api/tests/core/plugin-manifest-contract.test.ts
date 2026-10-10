import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPluginManifestIssues } from '@jiffoo/shared';
import { validatePluginManifest } from '../../src/core/admin/extension-installer/utils';

const inProcessManifest = {
  schemaVersion: 1,
  slug: 'travel-upsell',
  name: 'Travel Upsell',
  version: '1.2.0',
  description: 'Adds upsell blocks and storefront tracking',
  runtimeType: 'internal-fastify',
  hostProtocol: 'internal-fastify-v1',
  entryModule: 'dist/index.js',
  permissions: [],
  category: 'integration',
  contracts: [],
  minApiVersion: 'v1',
  sdkVersion: '1.2.0',
  requiredApiVersion: { min: '0.2.0' },
};

describe('Plugin manifest contract', () => {
  it('accepts third-party in-process packages with lifecycle declarations', () => {
    const issues = getPluginManifestIssues({
      ...inProcessManifest,
      lifecycle: { onInstall: true, onEnable: true },
    });

    expect(issues).toEqual([]);
  });

  it('rejects unsupported runtime types', () => {
    expect(() => validatePluginManifest({
      ...inProcessManifest,
      runtimeType: 'remote-service',
    } as never)).toThrow(/internal-fastify/i);
  });

  it('requires the in-process host protocol and entry module', () => {
    const issues = getPluginManifestIssues({
      ...inProcessManifest,
      hostProtocol: undefined,
      entryModule: undefined,
    });

    expect(issues).toContainEqual(expect.objectContaining({ path: 'hostProtocol', code: 'MISSING_HOST_PROTOCOL' }));
    expect(issues).toContainEqual(expect.objectContaining({ path: 'entryModule', code: 'MISSING_ENTRY_MODULE' }));
  });

  it('rejects a manifest-declared trust tier', () => {
    const issues = getPluginManifestIssues({ ...inProcessManifest, trustLevel: 'unsigned' });

    expect(issues).toContainEqual(expect.objectContaining({ path: 'trustLevel', code: 'MANIFEST_TRUST_LEVEL_NOT_ALLOWED' }));
  });

  it('explains that Core decides the trust tier', () => {
    const issues = getPluginManifestIssues({ ...inProcessManifest, trustLevel: 'builtin' });

    expect(issues).toContainEqual(expect.objectContaining({
      path: 'trustLevel',
      message: 'Core decides the trust tier; manifest trustLevel is not allowed',
    }));
  });

  it('rejects the removed capabilities field', () => {
    const issues = getPluginManifestIssues({ ...inProcessManifest, capabilities: ['payment'] });

    expect(issues).toContainEqual(expect.objectContaining({ path: 'capabilities', code: 'MANIFEST_FIELD_REMOVED' }));
  });

  it('requires the payment v1 contract for payment-category manifests', () => {
    const issues = getPluginManifestIssues({ ...inProcessManifest, category: 'payment', contracts: [] });

    expect(issues).toContainEqual(expect.objectContaining({ path: 'contracts', code: 'MISSING_CATEGORY_CONTRACT' }));
  });

  it('rejects multiple single-provider contracts but accepts payment with shipping', () => {
    expect(getPluginManifestIssues({ ...inProcessManifest, contracts: [{ name: 'tax', version: 1 }, { name: 'notification', version: 1 }] })).toContainEqual(expect.objectContaining({ code: 'MANIFEST_MULTIPLE_SINGLE_PROVIDER_CONTRACTS' }));
    expect(getPluginManifestIssues({ ...inProcessManifest, contracts: [{ name: 'payment', version: 2 }, { name: 'shipping', version: 1 }] })).toEqual([]);
  });

  it('rejects unknown top-level and nested contract, API range and lifecycle fields by path', () => {
    const manifest = {
      ...inProcessManifest,
      storefrontScript: '/script.js',
      contracts: [{ name: 'payment', version: 2, browserRoute: '/pay' }],
      requiredApiVersion: { min: 'v1', unexpected: true },
      lifecycle: { onEnable: true, onLaunch: true },
    };
    expect(getPluginManifestIssues(manifest)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'storefrontScript', code: 'UNKNOWN_MANIFEST_FIELD' }),
      expect.objectContaining({ path: 'contracts[0].browserRoute', code: 'UNKNOWN_MANIFEST_FIELD' }),
      expect.objectContaining({ path: 'requiredApiVersion.unexpected', code: 'UNKNOWN_MANIFEST_FIELD' }),
      expect.objectContaining({ path: 'lifecycle.onLaunch', code: 'UNKNOWN_MANIFEST_FIELD' }),
    ]));
  });

  it('rejects unsupported config descriptors, nested fields, secret flags and invalid defaults', () => {
    const schema = {
      type: 'object',
      properties: {
        token: { type: 'secret', properties: { unsupported: { type: 'string' } } },
        count: { type: 'number', minimum: 2, default: 1 },
        mode: { type: 'string', enum: ['test'], default: 'live' },
        bad: { type: 'date', required: true },
        extra: { type: 'string', browserScript: '/script.js' },
        nested: { type: 'object', properties: { key: { type: 'string', sensitive: true } } },
      },
    };
    expect(getPluginManifestIssues({ ...inProcessManifest, configSchema: schema })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'configSchema.properties.token.type' }),
      expect.objectContaining({ path: 'configSchema.properties.count.default' }),
      expect.objectContaining({ path: 'configSchema.properties.mode.default' }),
      expect.objectContaining({ path: 'configSchema.properties.bad.type' }),
      expect.objectContaining({ path: 'configSchema.properties.extra.browserScript' }),
      expect.objectContaining({ path: 'configSchema.properties.nested.type' }),
    ]));
  });

  it('accepts supported JSON config descriptors and rejects invalid dependency metadata', () => {
    expect(getPluginManifestIssues({
      ...inProcessManifest,
      dependencies: { '@jiffoo/payment': '^1.2.0' },
      configSchema: {
        type: 'object',
        properties: {
          token: { type: 'string', sensitive: true, title: 'Token' },
          enabled: { type: 'boolean', default: false },
          mode: { type: 'string', enum: ['test', 'live'], default: 'test' },
        },
        required: ['token'],
      },
    })).toEqual([]);
    expect(getPluginManifestIssues({
      ...inProcessManifest,
      dependencies: { 'payment-plugin': 123 },
    })).toContainEqual(expect.objectContaining({ path: 'dependencies.payment-plugin', code: 'INVALID_DEPENDENCY' }));
  });

  it('accepts all five shipped builtin manifests', async () => {
    for (const slug of ['console-email', 'free-shipping', 'manual-fulfillment', 'manual-payment', 'zero-tax']) {
      const manifest = JSON.parse(await fs.readFile(path.resolve('builtin-plugins', slug, 'manifest.json'), 'utf8'));
      expect(getPluginManifestIssues(manifest), slug).toEqual([]);
    }
  });
});
