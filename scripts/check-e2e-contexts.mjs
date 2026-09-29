import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export function assertObservedContexts(source, file = 'sample.spec.ts') {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      let callee = node.expression;
      while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
      const direct = ts.isPropertyAccessExpression(callee) && callee.name.text === 'newContext';
      const indexed = ts.isElementAccessExpression(callee)
        && (ts.isStringLiteral(callee.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(callee.argumentExpression))
        && callee.argumentExpression.text === 'newContext';
      if (direct || indexed) {
        const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
        violations.push(`${file}:${line + 1}: use newObservedContext instead of direct newContext`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (violations.length) throw new Error(violations.join('\n'));
}

function specs(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? specs(path) : entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = specs(resolve('e2e'));
  for (const file of files) assertObservedContexts(readFileSync(file, 'utf8'), relative(process.cwd(), file));
  console.log(`E2E context guard: PASS (${files.length} specs checked)`);
}
