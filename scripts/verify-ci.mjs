import { spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { localSteps, ciSteps } from './verify-steps.mjs';

if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.RUNNER_TEMP) throw new Error('CI runner requires GitHub Actions and RUNNER_TEMP.');
const [group, shard] = process.argv.slice(2);
const directory = join(process.env.RUNNER_TEMP, 'verification');
mkdirSync(directory, { recursive: true });
if (group === '--initialize') {
  writeFileSync(join(directory, 'verify-summary.txt'), '=== Final test summary ===\nVerification has not completed.\n');
  writeFileSync(join(directory, 'stdout-stderr.log'), 'Verification artifacts initialized.\n');
  process.exit(0);
}
ciSteps(process.env.DATABASE_URL_TEST, group, shard);
const url = new URL(process.env.DATABASE_URL_TEST);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== 'jiffoo_core_test') throw new Error('CI requires exactly jiffoo_core_test.');
const rawLog = join(directory, 'stdout-stderr.log');
const testLog = join(directory, 'test-raw.log');
const env = { ...process.env, RUNNER_TEMP: directory, VERIFY_RAW_OUTPUT_LOG: testLog };

async function run(command, args) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const [source, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      source.on('data', chunk => { appendFileSync(rawLog, chunk); target.write(chunk); });
    }
    child.once('error', reject);
    child.once('close', code => done(code ?? 1));
  });
}

// Bootstrap from the same catalogue before the verifier imports installed libraries.
const install = localSteps(process.env.DATABASE_URL_TEST).find(([name]) => name === 'Install dependencies')[1][0];
let status = await run('pnpm', install);
if (status === 0) status = await run(process.execPath, ['--test', 'scripts/verify-ci.test.mjs']);
if (status === 0) status = await run(process.execPath, ['scripts/verify.mjs', `--ci-group=${group}`, ...(shard ? [`--ci-shard=${shard}`] : [])]);
try { copyFileSync('verify-summary.txt', join(directory, 'verify-summary.txt')); } catch (error) {
  appendFileSync(rawLog, `Summary unavailable: ${error.message}\n`);
  status = 1;
}
process.exitCode = status;
