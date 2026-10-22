import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertObservedContexts } from './check-e2e-contexts.mjs';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

test('Every numbered acceptance spec runs exactly once in the complete browser gate', () => {
  const expected = readdirSync(resolve('e2e')).filter(name => /^\d+-.*\.spec\.ts$/.test(name)).map(name => name.replace('.spec.ts', '')).sort();
  const config = readFileSync(resolve('e2e/playwright.config.ts'), 'utf8');
  const tree = ts.createSourceFile('playwright.config.ts', config, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const areas = tree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(tree) === 'areas');
  assert.ok(areas?.initializer);
  const registered = JSON.parse(JSON.stringify(vm.runInNewContext(areas.initializer.getText(tree))));
  assert.deepEqual(registered.sort(), expected, 'Every acceptance spec must have a Playwright project');
  const runner = readFileSync(resolve('scripts/verify-e2e.mjs'), 'utf8');
  const scheduling = runner.slice(runner.indexOf('const playwrightGroups ='), runner.indexOf('\nfunction step('));
  const groups = vm.runInNewContext(scheduling + '\nJSON.stringify(playwrightGroups.flat())', { visual: false, review: false, process: { env: {} } });
  assert.deepEqual(JSON.parse(groups).sort(), expected, 'The default complete runner must schedule every acceptance project exactly once');
});

test('A rejects direct context creation in specs while accepting observed factories and non-code text', () => {
  for (const source of [
    'await browser.newContext();',
    'await browser\n.newContext();',
    'await browser?.newContext?.();',
    'await browser["newContext"]();',
    'await context.browser()!.newContext();',
    'await (browser.newContext)();',
  ]) {
    assert.throws(
      () => assertObservedContexts(`async function sample() {\n${source}\n}`),
      /sample\.spec\.ts:\d+: use newObservedContext/,
      source,
    );
  }
  assert.doesNotThrow(() => assertObservedContexts(
    '// browser.newContext()\nconst text = "browser.newContext()"; await newObservedContext();',
  ));
  try {
    assertObservedContexts('async function sample() { await browser.newContext(); }');
  } catch (error) {
    console.log(`E2E context guard: sample rejected: ${error.message}`);
  }
});

test('B includes a failed Playwright group in totals and preserves its non-zero failure', async () => {
  const source = readFileSync(resolve('scripts/verify-e2e.mjs'), 'utf8');
  const tree = ts.createSourceFile('verify-e2e.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declaration = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'runPlaywrightGroup');
  assert.ok(declaration, 'Runner exposes the group operation for its static self-test');
  const directory = mkdtempSync(resolve(os.tmpdir(), 'jiffoo-group-counts-'));
  const report = resolve(directory, 'playwright-report.json');
  const playwrightCounts = { expected: 69, unexpected: 0, skipped: 0 };
  const failure = new Error('Playwright exited with 1');
  try {
    writeFileSync(report, JSON.stringify({ stats: { expected: 999, unexpected: 999, skipped: 999 } }));
    const run = vm.runInNewContext(`(${declaration.getText(tree)})`, {
      resolve, resultsDir: directory, existsSync, unlinkSync, readFileSync, playwrightCounts,
      asyncCommand: async () => {
        assert.equal(existsSync(report), false, 'Previous group report cannot be counted again');
        writeFileSync(report, JSON.stringify({ stats: { expected: 4, unexpected: 1, skipped: 2 } }));
        throw failure;
      },
    });
    await assert.rejects(run(['exec', 'playwright', 'test']), (error) => error === failure);
    assert.deepEqual(playwrightCounts, { expected: 73, unexpected: 1, skipped: 2 });
    console.log('E2E aggregate self-test: 73 passed, 1 failed, 2 skipped; failure preserved');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
