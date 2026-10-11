import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

it('verifies CI reconciliation, pinned upload identity and Compose guard/evidence through the approved quick runner', () => {
  const result = spawnSync(process.execPath, ['--test', 'scripts/verify-ci.test.mjs', 'scripts/upload-test-image-identity.test.mjs', 'scripts/verify-compose.test.mjs'], {
    cwd: path.resolve('../..'), encoding: 'utf8', windowsHide: true,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

it('production logging writes one ISO-timestamped JSON object per stdout line without file transports', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'tests/helpers/production-logger-child.ts'], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'production-log-test-secret-at-least-32-characters',
      STOREFRONT_URL: 'https://shop.example.test', ADMIN_URL: 'https://admin.example.test' },
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const entries = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
  expect(entries).toHaveLength(4);
  for (const entry of entries) expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(entries[0].message).toBe('Startup message\nwith a newline');
  expect(entries[1]).toMatchObject({ event: 'plugin_process_failure', slug: 'probe', level: 'error' });
  expect(entries[2]).toMatchObject({ requestId: 'compose-request', orderId: 'compose-order' });
  expect(result.stderr).toBe('');
  // The subprocess rejects file transports independently of existing development logs.
  expect(existsSync('src/core/logger/log-aggregator.ts')).toBe(false);
});
