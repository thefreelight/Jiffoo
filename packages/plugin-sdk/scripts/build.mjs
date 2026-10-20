import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sdk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
await rm(path.join(sdk, 'dist'), { recursive: true, force: true });
for (const [entry, args] of [
  [require.resolve('typescript/bin/tsc'), ['-p', path.join(sdk, 'tsconfig.json')]],
  [path.join(sdk, 'scripts/generate-types.mjs'), []],
]) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: sdk, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Preserve tsc's relative module graph, including only imported shared modules.
await cp(path.join(sdk, 'dist/template-types'), path.join(sdk, 'dist/internal/plugin-sdk/src/template-types'), { recursive: true });
await mkdir(path.join(sdk, 'dist'), { recursive: true });
await writeFile(path.join(sdk, 'dist/cli.js'), '#!/usr/bin/env node\nrequire("./internal/plugin-sdk/src/cli.js");\n', { mode: 0o755 });
