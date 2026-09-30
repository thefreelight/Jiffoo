import { describe, expect, it } from 'vitest';
import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';

function createManifestWithSchema(configSchema: Record<string, unknown>): string {
  return JSON.stringify({
    schemaVersion: 1,
    slug: 'test-gateway',
    name: 'Test Gateway',
    version: '1.0.0',
    description: 'Test payment plugin',
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
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
      entryModule: 'dist/index.js',
      permissions: [],
    });

    const readiness = evaluatePluginConfigReadiness(manifest, {});

    expect(readiness.requiresConfiguration).toBe(false);
    expect(readiness.ready).toBe(true);
    expect(readiness.missingFields).toEqual([]);
  });

  it('detects missing required fields for a payment schema', () => {
    const manifest = createManifestWithSchema({
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['test', 'live'] },
        test: { type: 'string' },
        live: { type: 'string' },
      },
      required: ['mode', 'test', 'live'],
    });

    const readiness = evaluatePluginConfigReadiness(manifest, {
      mode: 'test',
      test: '',
    });

    expect(readiness.requiresConfiguration).toBe(true);
    expect(readiness.ready).toBe(false);
    expect(readiness.missingFields).toContain('test');
    expect(readiness.missingFields).toContain('live');
  });

  it('marks ready when required fields are all present', () => {
    const manifest = createManifestWithSchema({
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['test', 'live'] },
        test: { type: 'string' },
        live: { type: 'string' },
      },
      required: ['mode', 'test', 'live'],
    });

    const readiness = evaluatePluginConfigReadiness(manifest, {
      mode: 'test',
      test: 'sk_test_123',
      live: 'sk_live_123',
    });

    expect(readiness.requiresConfiguration).toBe(true);
    expect(readiness.ready).toBe(true);
    expect(readiness.missingFields).toEqual([]);
  });
});
