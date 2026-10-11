import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

it('checks no-migration refusal, durable journal, update profiles and full CI reconciliation', () => {
  const result = spawnSync(process.execPath, ['--test', 'scripts/update.test.mjs', 'scripts/backup.test.mjs', 'scripts/compose-volumes.test.mjs', 'scripts/release-identity.test.mjs', 'scripts/verify-ci.test.mjs'], {
    cwd: path.resolve('../..'), encoding: 'utf8', windowsHide: true,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
