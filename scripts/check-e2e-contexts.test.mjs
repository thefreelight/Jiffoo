import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertObservedContexts } from './check-e2e-contexts.mjs';

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
