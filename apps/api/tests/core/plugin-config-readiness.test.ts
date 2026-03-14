import { describe, expect, it } from 'vitest';
import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';

function createManifestWithSchema(configSchema: Record<string, unknown>): string {
  return JSON.stringify({
    schemaVersion: 1,
    slug: 'stripe',
    name: 'Stripe',
    version: '1.0.0',
    description: 'Stripe payment plugin',
    runtimeType: 'external-http',
    externalBaseUrl: 'http://127.0.0.1:4211',
    permissions: [],
    configSchema,
  });
}

describe('Plugin Config Readiness', () => {
  it('returns ready when plugin has no configSchema', () => {
    const manifest = JSON.stringify({
      schemaVersion: 1,
      slug: 'simple-plugin',
      name: 'Simple',
      version: '1.0.0',
      description: 'No config plugin',
      runtimeType: 'external-http',
      externalBaseUrl: 'http://127.0.0.1:4211',
      permissions: [],
    });

    const readiness = evaluatePluginConfigReadiness(manifest, {});

    expect(readiness.requiresConfiguration).toBe(false);
    expect(readiness.ready).toBe(true);
    expect(readiness.missingFields).toEqual([]);
  });

  it('detects missing required fields for stripe-like schema', () => {
    const manifest = createManifestWithSchema({
      mode: { type: 'string', required: true, enum: ['test', 'live'] },
      test: { type: 'object', required: true },
      live: { type: 'object', required: true },
    });

    const readiness = evaluatePluginConfigReadiness(manifest, {
      mode: 'test',
      test: {},
    });

    expect(readiness.requiresConfiguration).toBe(true);
    expect(readiness.ready).toBe(false);
    expect(readiness.missingFields).toContain('test');
    expect(readiness.missingFields).toContain('live');
  });

  it('marks ready when required fields are all present', () => {
    const manifest = createManifestWithSchema({
      mode: { type: 'string', required: true, enum: ['test', 'live'] },
      test: { type: 'object', required: true },
      live: { type: 'object', required: true },
    });

    const readiness = evaluatePluginConfigReadiness(manifest, {
      mode: 'test',
      test: { secretKey: 'sk_test_123' },
      live: { secretKey: 'sk_live_123' },
    });

    expect(readiness.requiresConfiguration).toBe(true);
    expect(readiness.ready).toBe(true);
    expect(readiness.missingFields).toEqual([]);
  });
});
