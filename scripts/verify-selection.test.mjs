import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseSelection, quickRequirements, mandatorySuites, mandatoryAdditions, plannedSuiteLines, ciOnlyScriptTests, ciOnlyVitestWrappers, localQuickVitestExclusions } from './verify-selection.mjs';
import { localSteps, executableStepArgs } from './verify-steps.mjs';

test('Vitest execution uses the real Node executable and retains long selections verbatim', () => {
  const files = Array.from({ length: 169 }, (_, index) => `tests/core/long-command-selection-with-workspace-spaces-${index}.test.ts`);
  const args = ['--filter', 'api', 'exec', 'vitest', 'run', ...localQuickVitestExclusions('api'), ...files];
  const original = [...args];
  const node = 'C:\\Program Files\\nodejs\\node.exe';
  const entry = 'C:\\workspace with spaces\\node_modules\\vitest\\vitest.mjs';
  const command = executableStepArgs(args, app => { assert.equal(app, 'api'); return entry; }, node);
  assert.ok(args.join(' ').length > 8192);
  assert.deepEqual(command.slice(0, 5), ['--filter', 'api', 'exec', node, entry]);
  assert.deepEqual(command.slice(5), args.slice(4));
  assert.deepEqual(args, original);
  assert.equal(command.includes('vitest'), false);
  assert.equal(command.some(arg => /^(?:cmd(?:\.exe)?|vitest\.cmd)$/i.test(arg)), false);
  assert.equal(executableStepArgs(args, () => entry)[3], process.execPath);
});

test('Vitest list uses the same launcher and preserves CI catalogue output arguments', () => {
  const args = ['--filter', 'api', 'exec', 'vitest', 'list', '--filesOnly', '--json=C:\\workspace with spaces\\api-files.json'];
  assert.deepEqual(executableStepArgs(args, () => 'vitest.mjs').slice(5), args.slice(4));
  assert.equal(executableStepArgs(args, () => 'vitest.mjs')[4], 'vitest.mjs');
});

test('Vitest command accepts the real binary resolved from each workspace package', () => {
  for (const app of ['api', 'admin', 'shop']) {
    const workspaceRequire = createRequire(new URL(`../apps/${app}/package.json`, import.meta.url));
    const manifest = workspaceRequire.resolve('vitest/package.json');
    const entry = resolve(dirname(manifest), workspaceRequire(manifest).bin.vitest);
    assert.equal(entry.endsWith('vitest.mjs'), true);
    assert.match(readFileSync(entry, 'utf8'), /import '\.\/dist\/cli\.js'/);
    const args = ['--filter', app, 'exec', 'vitest', 'run', 'tests/example with spaces.test.ts'];
    assert.deepEqual(executableStepArgs(args, () => entry), ['--filter', app, 'exec', process.execPath, entry, ...args.slice(4)]);
  }
});

test('non-Vitest verification commands remain unchanged', () => {
  for (const args of [['--filter', 'api', 'exec', 'prisma', 'generate'], ['exec', 'turbo', 'run', 'type-check'], ['verify:e2e']]) {
    assert.equal(executableStepArgs(args), args);
  }
});

const select = args => parseSelection(['--quick', ...args], () => true);
test('admin and shop scopes skip all API service steps, API keeps them', () => {
  for (const app of ['admin', 'shop', 'api']) {
    const selection = select([`--scope=${app}`, `--test-files=apps/${app}/tests/example.test.ts`]);
    const requirements = quickRequirements(selection);
    assert.equal(requirements.database, app === 'api');
    const names = localSteps('url', true, ['selected'], selection.files, { ...requirements, drift: true }).map(([name]) => name);
    for (const name of ['Prisma generate', 'Reset test database', 'Check Prisma migration drift']) assert.equal(names.includes(name), app === 'api');
    assert.ok(names.includes('Type-check selected scope and shared'));
  }
});
test('audited script-only selection is service-free; CI-only tests cannot enter quick', () => {
  const selection = select(['--test-files=scripts/lane-config.test.mjs']);
  const requirements = quickRequirements(selection);
  assert.equal(requirements.database, false);
  assert.deepEqual(localSteps(undefined, true, ['selected'], selection.files, { ...requirements, drift: true }), [['Run script tests', [['__node_test__', 'scripts/lane-config.test.mjs']]]]);
  for (const file of ciOnlyScriptTests) assert.throws(() => select([`--test-files=${file}`]), /CI-only/);
  for (const file of ciOnlyVitestWrappers) assert.throws(() => select([`--test-files=${file}`]), /CI-only and cannot run through local quick verification/);
  for (const file of ['scripts/unreviewed.test.mjs', 'scripts/../outside.test.mjs']) assert.throws(() => select([`--test-files=${file}`]));
  assert.throws(() => select(['--scope=wrong']));
  assert.throws(() => select(['--scope=admin', '--test-files=apps/api/tests/example.test.ts']));
});

test('conservative selection excludes every CI-only wrapper and inventory rejects unregistered wrappers', () => {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'apps'], { encoding: 'utf8' }).split('\0').filter(file => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
  const wrappers = files.filter(file => {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    return /\b(?:spawn|spawnSync|execFile|execFileSync|fork)\s*\(/.test(source) && [...ciOnlyScriptTests].some(script => source.includes(script));
  });
  assert.deepEqual([...new Set(wrappers)].sort(), [...ciOnlyVitestWrappers].sort());
  const selected = mandatorySuites(['packages/shared/src/index.ts'], ['api'], files).map(item => item.file);
  for (const wrapper of ciOnlyVitestWrappers) assert.equal(selected.includes(wrapper), false);
  assert.ok(selected.includes('apps/api/tests/core/local-trial.test.ts') === false);
});

test('default and scoped quick invocations exclude wrappers while full verification remains complete', () => {
  const files = { api: ['tests/example.test.ts'], admin: [], shop: [], scripts: [] };
  for (const plan of [localSteps('url', true), localSteps('url', true, ['selected'], files, { apps: ['api'], database: true })]) {
    const command = plan.flatMap(([, commands]) => commands).find(args => args.includes('vitest') && args.includes('api'));
    assert.ok(command);
    for (const wrapper of ciOnlyVitestWrappers) assert.ok(command.includes(`--exclude=${wrapper.slice('apps/api/'.length)}`));
  }
  assert.equal(localSteps('url').flatMap(([, commands]) => commands).flat().some(arg => arg.startsWith('--exclude=')), false);
});
test('mandatory planner expands contract, shared, auth and migration coverage', () => {
  const catalogue = ['apps/api/tests/contract/api-standards.test.ts', 'apps/api/tests/contract/openapi-contract.test.ts', 'apps/api/tests/routes/auth.test.ts', 'apps/api/tests/core/core-migrations.test.ts', 'apps/admin/tests/session.test.tsx', 'apps/shop/tests/example.test.ts'];
  assert.equal(mandatorySuites(['apps/api/src/routes/orders.ts'], ['api'], catalogue).length, 2);
  assert.equal(mandatorySuites(['apps/api/src/schemas/order.ts'], ['api'], catalogue).length, 2);
  assert.equal(mandatorySuites(['packages/shared/src/index.ts'], ['shop'], catalogue).length, catalogue.length);
  assert.deepEqual(mandatorySuites(['packages/shared/src/index.ts'], ['shop'], catalogue, ['shop']).map(item => item.file), [catalogue[5]]);
  assert.equal(mandatorySuites(['apps/api/src/core/auth/service.ts'], ['api'], catalogue).length, 2);
  assert.equal(mandatorySuites(['apps/api/prisma/schema/order.prisma'], ['api'], catalogue)[0].file, catalogue[3]);
  assert.equal(mandatorySuites(['apps/api/prisma/migrations/new/migration.sql'], ['api'], catalogue).length, 1);
  assert.deepEqual(mandatorySuites(['docs/example.md'], [], catalogue), []);
});
test('the diagnostic mode is refused without --quick, with --shards and without a selection', () => {
  assert.throws(() => parseSelection(['--diagnostic', '--scope=admin'], () => true), /--diagnostic requires --quick/);
  assert.throws(() => parseSelection(['--quick', '--diagnostic', '--shards=2', '--scope=admin'], () => true), /--diagnostic cannot be combined with --shards/);
  assert.throws(() => parseSelection(['--quick', '--diagnostic'], () => true), /--diagnostic requires --scope= and\/or --test-files=/);
});
test('a diagnostic selection keeps exactly the named files and adds no planner suite', () => {
  const catalogue = ['apps/api/tests/contract/api-standards.test.ts', 'apps/admin/tests/example.test.ts'];
  const changed = ['packages/shared/src/index.ts'];
  const certifying = parseSelection(['--quick', '--scope=admin', '--test-files=apps/admin/tests/example.test.ts'], () => true);
  const diagnostic = parseSelection(['--quick', '--diagnostic', '--scope=admin', '--test-files=apps/admin/tests/example.test.ts'], () => true);
  assert.equal(certifying.diagnostic, false);
  assert.equal(diagnostic.diagnostic, true);
  assert.deepEqual(diagnostic.scopes, ['admin']);
  assert.deepEqual(diagnostic.files.admin, ['tests/example.test.ts']);
  assert.deepEqual(diagnostic.files.api, []);
  assert.deepEqual(diagnostic.files.scripts, []);
  assert.deepEqual(quickRequirements(diagnostic), { apps: ['admin'], database: false, scriptOnly: false });
  const planned = mandatorySuites(changed, certifying.scopes, catalogue);
  assert.deepEqual(planned.map(item => item.file), catalogue);
  assert.deepEqual(mandatoryAdditions(certifying, planned).map(item => item.file), ['apps/api/tests/contract/api-standards.test.ts']);
  assert.deepEqual(mandatoryAdditions(diagnostic, planned), []);
});
test('the diagnostic mode keeps the scope and the file validation of the certifying selection', () => {
  assert.throws(() => parseSelection(['--quick', '--diagnostic', '--scope=wrong'], () => true), /Unknown verification scope/);
  assert.throws(() => parseSelection(['--quick', '--diagnostic', '--test-files=scripts/../outside.test.mjs'], () => true), /Invalid explicit test file/);
  assert.throws(() => parseSelection(['--quick', '--diagnostic', '--test-files=apps/api/tests/core/local-trial.test.ts'], () => true), /CI-only/);
  assert.throws(() => parseSelection(['--quick', '--diagnostic', '--scope=admin', '--test-files=apps/api/tests/example.test.ts'], () => true), /outside the requested scope/);
});
test('the diagnostic planner listing names every suite with its reason', () => {
  const lines = plannedSuiteLines([
    { file: 'apps/api/tests/contract/api-standards.test.ts', reason: 'API contract surface changed' },
    { file: 'apps/admin/tests/session.test.tsx', reason: 'Authentication or permissions changed' },
  ]);
  assert.equal(lines[0], 'Certifying gate would also run 2 planner-mandated suite(s): API contract surface changed; Authentication or permissions changed');
  assert.deepEqual(lines.slice(1), [
    '  Certifying gate would also run: apps/api/tests/contract/api-standards.test.ts (API contract surface changed)',
    '  Certifying gate would also run: apps/admin/tests/session.test.tsx (Authentication or permissions changed)',
  ]);
  assert.deepEqual(plannedSuiteLines([]), ['Certifying gate would also run 0 planner-mandated suite(s)']);
});
test('existing default quick and explicit application catalogues are unchanged', () => {
  assert.deepEqual(localSteps('url', true).map(([name]) => name), ['Prisma generate', 'Type-check API, Admin, Shop and shared', 'Lint Shop', 'Reset test database', 'Run changed API tests', 'Run Shop tests']);
  const files = { api: ['tests/example.test.ts'], admin: [], shop: [] };
  const plan = localSteps('url', true, ['selected'], files);
  assert.deepEqual(plan.at(-1), ['Run API tests', [['--filter', 'api', 'exec', 'vitest', 'run', ...localQuickVitestExclusions('api'), 'tests/example.test.ts']]]);
  assert.deepEqual(quickRequirements(select([])), { apps: ['api', 'admin', 'shop'], database: true, scriptOnly: false });
});
test('existing invocation catalogues retain their committed behavior', async () => {
  const original = execFileSync('git', ['show', 'HEAD:scripts/verify-steps.mjs'], { encoding: 'utf8' });
  const executable = original.replace(/^import \{ localQuickVitestExclusions \} from '\.\/verify-selection\.mjs';\r?\n/m, '');
  const previous = await import(`data:text/javascript;base64,${Buffer.from('const localQuickVitestExclusions = () => [];\n' + executable).toString('base64')}`);
  const withoutExclusions = plan => plan.map(([name, commands]) => [name, commands.map(args => args.filter(arg => !arg.startsWith('--exclude=')))]);
  assert.deepEqual(localSteps('url'), previous.localSteps('url'));
  assert.deepEqual(withoutExclusions(localSteps('url', true)), withoutExclusions(previous.localSteps('url', true)));
  for (const app of ['api', 'admin', 'shop']) {
    const files = { api: [], admin: [], shop: [] };
    files[app].push('tests/example.test.ts');
    assert.deepEqual(withoutExclusions(localSteps('url', true, ['selected'], files)), withoutExclusions(previous.localSteps('url', true, ['selected'], files)));
  }
});
test('CI workflow changes only the push branch list and retains manual trigger', () => {
  const require = createRequire(import.meta.url);
  const workflow = require('yaml').parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on, { push: { branches: ['codex/core-extension-boundary', 'codex/lane-*'] }, workflow_dispatch: null });
  assert.ok(workflow.jobs.api && workflow.jobs.quality && workflow.jobs.e2e);
  const original = require('yaml').parse(execFileSync('git', ['show', 'HEAD:.github/workflows/ci.yml'], { encoding: 'utf8' }));
  original.on.push.branches = ['codex/core-extension-boundary', 'codex/lane-*'];
  assert.deepEqual(workflow, original);
});
