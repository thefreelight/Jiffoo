import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

it('checks trial resource boundaries and operator commands through the approved quick runner', () => {
  const result = spawnSync(process.execPath, ['--test', 'scripts/local-trial.test.mjs'], { cwd: path.resolve('../..'), encoding: 'utf8', windowsHide: true });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
