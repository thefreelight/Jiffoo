import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

it('checks backup integrity, maintenance proofs and required CI reconciliation through the approved runner', () => {
  const result = spawnSync(process.execPath, ['--test', 'scripts/backup.test.mjs', 'scripts/compose-volumes.test.mjs', 'scripts/release-identity.test.mjs', 'scripts/verify-ci.test.mjs'], {
    cwd: path.resolve('../..'), encoding: 'utf8', windowsHide: true,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
