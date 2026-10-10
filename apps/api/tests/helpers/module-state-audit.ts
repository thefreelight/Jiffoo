import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function apiSourceFiles(root = path.resolve('src')): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? apiSourceFiles(file) : /\.[cm]?tsx?$/.test(file) && !file.endsWith('.d.ts') ? [file] : [];
  }).sort();
}

function unwrap(expression: ts.Expression | undefined): ts.Expression | undefined {
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)
    || ts.isParenthesizedExpression(expression) || ts.isTypeAssertionExpression(expression))) expression = expression.expression;
  return expression;
}

/** Enumerate syntax and inferred object types, including persistent class fields. */
export function enumerateModuleState(files: string[], root = path.resolve('src')): string[] {
  const config = ts.readConfigFile(path.resolve('tsconfig.json'), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
  const program = ts.createProgram(files, options), checker = program.getTypeChecker();
  const entries: string[] = [];
  const container = (declaration: ts.VariableDeclaration | ts.PropertyDeclaration) => {
    const expression = unwrap(declaration.initializer);
    if (expression && (ts.isObjectLiteralExpression(expression) || ts.isArrayLiteralExpression(expression)
      || ts.isNewExpression(expression))) return true;
    const type = checker.getTypeAtLocation(declaration);
    const types = type.isUnionOrIntersection() ? type.types : [type];
    if (expression && ts.isCallExpression(expression) && types.some(value =>
      !!(value.flags & (ts.TypeFlags.Object | ts.TypeFlags.Any | ts.TypeFlags.Unknown)))) return true;
    return types.some(value => !!(value.flags & ts.TypeFlags.Object) && !value.getCallSignatures().length);
  };
  for (const file of files) {
    const source = program.getSourceFile(file) ?? ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const visit = (node: ts.Node, moduleScope: boolean) => {
      if (ts.isFunctionLike(node)) return;
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        for (const member of node.members) if (ts.isPropertyDeclaration(member) && (container(member)
          || member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)
            && !member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword))) {
          entries.push(`${relative}:${node.name?.text ?? '<anonymous>'}.${member.name.getText(source)}`);
        }
        return;
      }
      if (moduleScope && ts.isVariableDeclarationList(node)) {
        for (const declaration of node.declarations) {
          if (!(node.flags & ts.NodeFlags.Const) || container(declaration)) entries.push(`${relative}:${declaration.name.getText(source)}`);
        }
        return;
      }
      ts.forEachChild(node, child => visit(child, moduleScope));
    };
    visit(source, true);
  }
  return entries.sort();
}
