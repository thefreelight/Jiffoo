import { describe, expect, it } from 'vitest';
import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';

function createManifestWithSchema(configSchema: Record<string, unknown>): string {
  return JSON.stringify({
    schemaVersion: 1,
    slug: 'stripe',
    name: 'Stripe',
    version: '1.0.0',
    description: 'Stripe payment plugin',
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
    trustLevel: 'unsigned',
    entryModule: 'dist/index.js',
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
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      trustLevel: 'unsigned',
      entryModule: 'dist/index.js',
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
