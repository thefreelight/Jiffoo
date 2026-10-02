import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_ROOT_PUBLIC_KEY } from 'shared/plugin-signing';
import { testRoot, untrustedRoot } from '../fixtures/plugin-signing-keys';

const cwd = path.resolve(__dirname, '../..');
function start(target: 'api' | 'worker', mode: string | undefined, root: string | undefined, extra: NodeJS.ProcessEnv = {}) {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: process.env.DATABASE_URL_TEST,
    JWT_SECRET: 'a-production-test-secret-of-32-characters',
    PLUGIN_SECRETS_KEY: Buffer.alloc(32, 17).toString('base64'),
    CORS_ORIGIN: 'https://admin.example.com',
    STOREFRONT_URL: 'https://store.example.com',
    ADMIN_URL: 'https://admin.example.com',
    API_PORT: '0',
    WORKER_HEALTH_PORT: '0',
    REDIS_URL: 'redis://localhost:6379/15',
    DISABLE_RATE_LIMITER: 'false',
    EXTENSION_MARKETPLACE_URL: undefined,
    EXTENSION_TEST_SIGNING_MODE: mode,
    JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY: root,
    JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE: undefined,
    JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY: undefined,
    ...extra,
  };
  return spawnSync(process.execPath, ['--import', 'tsx', 'tests/helpers/signing-mode-start-child.ts', target], {
    cwd, env: environment, encoding: 'utf8',
  });
}

describe('test signing production startup', () => {
  it.each(['api', 'worker'] as const)('A %s defaults off and starts without a test root', (target) => {
    const result = start(target, undefined, undefined);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toContain('Test signing mode is enabled');
  });
  it.each(['api', 'worker'] as const)('A %s rejects invalid mode values', (target) => {
    const result = start(target, 'yes', testRoot.publicKey);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('EXTENSION_TEST_SIGNING_MODE');
  });
  it.each(['api', 'worker'] as const)('A %s rejects mode on without a key', (target) => {
    const result = start(target, 'true', undefined);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('distinct test root public key');
  });
  it.each(['api', 'worker'] as const)('A %s rejects a key while the mode is off', (target) => {
    const result = start(target, 'false', testRoot.publicKey);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('requires EXTENSION_TEST_SIGNING_MODE=true');
  });
  it.each(['api', 'worker'] as const)('A %s rejects the official root as test root', (target) => {
    const result = start(target, 'true', OFFICIAL_ROOT_PUBLIC_KEY);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('distinct test root public key');
  });
  it.each(['api', 'worker'] as const)('A %s rejects an invalid Ed25519 test root', (target) => {
    const result = start(target, 'true', 'invalid-key');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('valid Ed25519 test root public key');
  });
  it.each([
    ['api', 'production', 'flag'], ['worker', 'production', 'flag'],
    ['api', 'development', 'flag'], ['worker', 'development', 'flag'],
    ['api', 'production', 'key'], ['worker', 'production', 'key'],
    ['api', 'development', 'key'], ['worker', 'development', 'key'],
  ] as const)('A %s refuses the official override %s environment %s input', (target, nodeEnv, input) => {
    const result = start(target, 'false', undefined, {
      NODE_ENV: nodeEnv,
      ...(input === 'flag' ? { JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE: 'true' } : { JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY: untrustedRoot.publicKey }),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Official root override is allowed only under NODE_ENV=test');
  });
  it.each(['api', 'worker'] as const)('A %s starts in production and warns in test signing mode', (target) => {
    const result = start(target, 'true', testRoot.publicKey);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr + result.stdout).toContain('Test signing mode is enabled');
  });
});
