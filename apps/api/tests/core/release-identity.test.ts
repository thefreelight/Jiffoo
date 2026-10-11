import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

it('checks release identity, publishing gates and full CI summary guards through the local verification runner', () => {
  const result = spawnSync(process.execPath, ['--test', 'scripts/release-identity.test.mjs', 'scripts/verify-ci.test.mjs'], {
    cwd: path.resolve('../..'), encoding: 'utf8', windowsHide: true,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
