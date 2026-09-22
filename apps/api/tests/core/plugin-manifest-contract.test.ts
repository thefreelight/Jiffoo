import { describe, expect, it } from 'vitest';
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
    expect(getPluginManifestIssues({ ...inProcessManifest, contracts: [{ name: 'payment', version: 1 }, { name: 'shipping', version: 1 }] })).toEqual([]);
  });
});
