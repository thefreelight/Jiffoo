import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Marketplace download timeout process configuration', () => {
  it.each(['0', '99', '120001', 'not-a-number', '1.5'])('M refuses an invalid timeout of %s at startup', (value) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', 'require("./src/config/env.ts")'], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test',
        JWT_SECRET: 'test-secret',
        EXTENSION_MARKETPLACE_DOWNLOAD_TIMEOUT_MS: value,
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('EXTENSION_MARKETPLACE_DOWNLOAD_TIMEOUT_MS');
  });
});
