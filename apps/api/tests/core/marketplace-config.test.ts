import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const apiDirectory = path.resolve(__dirname, '../..');

function startup(nodeEnv: string, url: string) {
  return spawnSync(process.execPath, [
    '--import', 'tsx', '-e', 'require("./src/config/env.ts")',
  ], {
    cwd: apiDirectory,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: nodeEnv,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test',
      JWT_SECRET: 'a-production-test-secret-of-32-characters',
      CORS_ORIGIN: 'https://admin.example.com',
      STOREFRONT_URL: 'https://store.example.com',
      ADMIN_URL: 'https://admin.example.com',
      EXTENSION_MARKETPLACE_URL: url,
      DISABLE_RATE_LIMITER: 'false',
    },
  });
}

describe('Marketplace process startup configuration', () => {
  it.each(['production', 'development'])('I refuses HTTP in %s', (environment) => {
    const result = startup(environment, 'http://127.0.0.1:12345/catalog');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('EXTENSION_MARKETPLACE_URL requires HTTPS');
  });

  it('I permits exact HTTP loopback under test', () => {
    const result = startup('test', 'http://127.0.0.1:12345/catalog');
    expect(result.status).toBe(0);
  });

  it.each(['https://user:pass@example.com/catalog', 'https://example.com/catalog#fragment'])(
    'I refuses credentials or fragments in %s', (url) => {
      const result = startup('production', url);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('EXTENSION_MARKETPLACE_URL requires HTTPS');
    },
  );
});
