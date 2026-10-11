import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { AcceptanceChecks } from '../deploy/compose/checks.mjs';
import { makeRelease } from '../deploy/release/prepare.mjs';
import { roles } from '../deploy/release/identity.mjs';

async function main() {
  assert.equal(process.env.DATABASE_URL_TEST, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  const started = new Date().toISOString(), start = performance.now(), project = 'jiffoo-release-' + randomUUID();
  const temporary = mkdtempSync(join(tmpdir(), project + '-')); chmodSync(temporary, 0o755);
  const inspections = join(temporary, 'inspection'); mkdirSync(inspections, { mode: 0o755 });
  const evidence = resolve(process.env.GITHUB_ACTIONS === 'true' ? join(process.env.RUNNER_TEMP, 'verification') : join('e2e/test-results', project));
  mkdirSync(evidence, { recursive: true });
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const version = JSON.parse(readFileSync('package.json')).version.replace(/-opensource$/, '');
  const checks = new AcceptanceChecks(), commands = [], tags = [];
  const docker = (args, allowFailure = false) => new Promise((done, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.once('error', reject); child.once('close', code => {
      const output = stdout + stderr; commands.push({ args, code, output });
      if (code !== 0 && !allowFailure) reject(new Error(`docker ${args.slice(0, 3).join(' ')}: ${output}`)); else done({ code, stdout, output });
    });
  });
  const inspect = async (role, reference) => {
    const result = await docker(['image', 'inspect', reference]);
    writeFileSync(join(inspections, role + '.json'), result.stdout, { mode: 0o644 });
    return JSON.parse(result.stdout)[0].Id;
  };
  const verify = async (directory, expected = commit) => {
    if (process.platform !== 'win32') {
      const result = spawnSync('sh', [join(directory, 'bin/jiffoo-host'), 'verify', directory, expected, '--acceptance'], {
        encoding: 'utf8', env: { ...process.env, JIFFOO_VERIFY_PROJECT: project }, maxBuffer: 8 * 1024 * 1024,
      });
      const output = (result.stdout ?? '') + (result.stderr ?? ''); commands.push({ command: 'host verify', code: result.status, output });
      return { code: result.status, output };
    }
    // Windows acceptance drives the same container verifier with native Docker CLI.
    // The POSIX host entrypoint is exercised by the Linux CI acceptance job.
    const manifest = JSON.parse(readFileSync(join(directory, 'release.json')));
    const meta = join(temporary, 'verify-' + randomUUID()); mkdirSync(meta, { mode: 0o755 });
    const bootstrap = await docker(['image', 'inspect', manifest.verifierImage], true);
    if (bootstrap.code !== 0) return bootstrap;
    writeFileSync(join(meta, 'backend.json'), bootstrap.stdout);
    const helper = command => docker(['run', '--rm', '--label', `com.docker.compose.project=${project}`, '--network', 'none', '--read-only', '--user', '1000:1000', '--tmpfs', '/tmp', '--entrypoint', 'node',
      '--mount', `type=bind,source=${directory},target=/release,readonly`, '--mount', `type=bind,source=${meta},target=/inspection,readonly`, manifest.verifierImage,
      '/app/deploy/release/verify.mjs', command, '/release', expected, '/inspection', 'acceptance'], true);
    const plan = await helper('plan'); if (plan.code !== 0) return plan;
    for (const line of plan.stdout.trim().split('\n')) {
      const [role, reference] = line.split('\t'); const result = await docker(['image', 'inspect', reference], true);
      if (result.code !== 0) return result; writeFileSync(join(meta, role + '.json'), result.stdout);
    }
    return helper('verify');
  };
  let bundle, manifest;
  try {
    await checks.run('Build local release images', [], async () => {
      for (const role of ['backend', 'admin', 'shop']) {
        const tag = `${project}-${role}`; tags.push(tag);
        const result = await docker(['build', '--platform', 'linux/amd64', '-f', 'deploy/compose/Dockerfile', '--target', role, '--build-arg', `REVISION=${commit}`, '--build-arg', `RELEASE_VERSION=${version}`, '-t', tag, '.']);
        process.stdout.write(result.output.split(/\r?\n/).slice(-5).join('\n') + '\n'); await inspect(role, tag);
      }
      const compose = readFileSync('deploy/compose/compose.yml', 'utf8');
      for (const role of ['postgres', 'redis', 'silo', 'nginx']) {
        const prefix = role === 'silo' ? 'pgsty/silo' : role;
        const reference = compose.match(new RegExp('image: (' + prefix + ':[^\\s]+@sha256:[a-f0-9]{64})'))[1];
        const cached = await docker(['image', 'inspect', reference], true);
        if (cached.code !== 0) await docker(['pull', '--platform', 'linux/amd64', reference]);
        await inspect(role, reference);
      }
    });
    await checks.run('Generate local acceptance release', ['Build local release images'], () => {
      bundle = join(temporary, 'bundle'); manifest = makeRelease({ root: process.cwd(), output: bundle, inspections, commit, version, mode: 'acceptance' });
    });
    await checks.run('Verify complete local release', ['Generate local acceptance release'], async () => {
      const result = await verify(bundle); assert.equal(result.code, 0, result.output); assert.match(result.output, /Release verification passed/);
    });
    const original = () => writeFileSync(join(bundle, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
    await checks.run('Reject wrong image digest', ['Generate local acceptance release'], async () => {
      const wrong = structuredClone(manifest); wrong.images.shop = { reference: 'sha256:' + 'f'.repeat(64), digest: 'sha256:' + 'f'.repeat(64), platformDigest: 'sha256:' + 'f'.repeat(64) };
      writeFileSync(join(bundle, 'release.json'), JSON.stringify(wrong, null, 2) + '\n');
      try { const result = await verify(bundle); assert.notEqual(result.code, 0, result.output); } finally { original(); }
    });
    await checks.run('Reject wrong source commit', ['Generate local acceptance release'], async () => {
      const wrong = structuredClone(manifest); wrong.sourceCommit = '0'.repeat(40);
      writeFileSync(join(bundle, 'release.json'), JSON.stringify(wrong, null, 2) + '\n');
      try { const result = await verify(bundle); assert.notEqual(result.code, 0); assert.match(result.output, /source commit/); } finally { original(); }
    });
    await checks.run('Reject wrong actual image platform', ['Generate local acceptance release'], async () => {
      const tar = join(temporary, 'empty.tar'); writeFileSync(tar, Buffer.alloc(1024));
      const tag = `${project}-arm-fixture`; tags.push(tag);
      await docker(['image', 'import', '--platform', 'linux/arm64', tar, tag]);
      const actual = JSON.parse((await docker(['image', 'inspect', tag])).stdout)[0];
      const wrong = structuredClone(manifest); wrong.images.shop = { reference: actual.Id, digest: actual.Id, platformDigest: actual.Id };
      writeFileSync(join(bundle, 'release.json'), JSON.stringify(wrong, null, 2) + '\n');
      try { const result = await verify(bundle); assert.notEqual(result.code, 0); assert.match(result.output, /platform mismatch/); } finally { original(); }
    });
    await checks.run('Reject edited deployment file', ['Generate local acceptance release'], async () => {
      const file = join(bundle, 'deploy/compose/api-lb.conf'), bytes = readFileSync(file); writeFileSync(file, Buffer.concat([bytes, Buffer.from('\n# tampered\n')]));
      try { const result = await verify(bundle); assert.notEqual(result.code, 0); assert.match(result.output, /checksum mismatch/); } finally { writeFileSync(file, bytes); }
    });
  } finally {
    await checks.run('Remove owned release images', [], async () => { for (const tag of tags) await docker(['image', 'rm', tag], true); });
    for (const [kind, args] of [['containers', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]], ['images', ['image', 'ls', '-q', '--filter', `reference=${project}-*`]],
      ['networks', ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]], ['volumes', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]]]) {
      await checks.run(`No owned ${kind} remain`, [], async () => assert.equal((await docker(args)).stdout.trim(), ''));
    }
    rmSync(temporary, { recursive: true, force: true });
    writeFileSync(join(evidence, 'commands.json'), JSON.stringify(commands, null, 2));
  }
  const duration = ((performance.now() - start) / 1000).toFixed(2) + 's', counts = checks.counts();
  const summary = `Release start time: ${started}\nRelease results: ${counts.PASS} passed, ${counts.FAIL} failed, ${counts.SKIPPED} skipped\nRelease project: ${project}\nRelease duration: ${duration}\n\n${checks.table()}`;
  const block = `=== Final test summary ===\n${summary}\n| Step | Result | Duration |\n| --- | --- | --- |\n| Run release verification acceptance | ${checks.passed ? 'PASS' : 'FAIL'} | ${duration} |\n`;
  writeFileSync('verify-summary.txt', block); writeFileSync(join(evidence, 'verify-summary.txt'), block);
  writeFileSync(join(evidence, 'verify-result.json'), JSON.stringify({ group: 'release-verify', valid: checks.passed, results: [['Run release verification acceptance', checks.passed ? 'PASS' : 'FAIL', duration]], outputs: [{ name: 'Run release verification acceptance', kind: 'release', output: summary }], apiFiles: [], fullApiFiles: [] }, null, 2));
  process.stdout.write(block); if (!checks.passed) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
