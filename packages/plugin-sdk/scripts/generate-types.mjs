import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const shared = path.join(root, 'packages/shared/src');
const files = [
  'extensions/plugin-contract.ts', 'events/registry.ts',
  ...['payment', 'shipping', 'tax', 'fulfillment', 'notification'].map(name => `extensions/contracts/${name}-v1.ts`),
].map(name => path.join(shared, name));
const lifecyclePath = path.join(root, 'apps/api/src/core/admin/plugin-management/lifecycle-hooks.ts');
const runtimePath = path.join(root, 'apps/api/src/core/admin/extension-installer/contract-v1-runtime.ts');

export function generateSnapshot() {
  const program = ts.createProgram([...files, lifecyclePath, runtimePath], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10, strict: true, skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const source = filename => program.getSourceFile(filename);
  const declaration = (filename, name) => {
    const result = source(filename).statements.find(node => node.name?.text === name);
    if (!result) throw new Error(`Missing canonical declaration: ${name}`);
    return result;
  };
  const variable = (filename, name) => {
    for (const statement of source(filename).statements) {
      if (ts.isVariableStatement(statement)) {
        const result = statement.declarationList.declarations.find(node => node.name.getText() === name);
        if (result) return result;
      }
    }
    throw new Error(`Missing canonical variable: ${name}`);
  };
  const render = type => checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias);
  const properties = (filename, name) => checker.getTypeAtLocation(variable(filename, name).name).getProperties();
  const outputType = (symbol, location) => {
    const schema = checker.getTypeOfSymbolAtLocation(symbol, location);
    const output = schema.getProperty('_output');
    if (!output) throw new Error(`Missing canonical schema output: ${symbol.name}`);
    return render(checker.getTypeOfSymbolAtLocation(output, location));
  };
  const lines = ['// Generated from canonical Core contracts. Do not edit.', ''];
  const eventSource = files[1];
  const events = properties(eventSource, 'eventRegistry');
  lines.push('export interface EventPayloadMap {');
  for (const event of events) lines.push(`  ${JSON.stringify(event.name)}: ${outputType(event, source(eventSource))};`);
  lines.push('}', 'declare const eventRegistry: { readonly [K in keyof EventPayloadMap]: { _output: EventPayloadMap[K] } };',
    'export type EventKey = keyof typeof eventRegistry;', "export type EventPayload<K extends EventKey> = (typeof eventRegistry)[K]['_output'];");
  for (const name of ['EventSubscription', 'PluginEvent', 'PluginEventHandler']) lines.push(declaration(eventSource, name).getText());
  for (const name of ['PluginContext', 'PluginEntryModule', 'PluginBusinessErrorResponse']) lines.push(declaration(files[0], name).getText());
  lines.push(declaration(lifecyclePath, 'LifecycleContext').getText());
  const hooks = checker.getTypeAtLocation(variable(files[0], 'PLUGIN_LIFECYCLE_HOOKS').name);
  lines.push('export interface PluginLifecycleExports {');
  for (const hook of checker.getTypeArguments(hooks)) {
    if (!hook.isStringLiteral()) throw new Error('Invalid canonical lifecycle hook');
    lines.push(`  __lifecycle_${hook.value}?(context: LifecycleContext): void | Promise<void>;`);
  }
  lines.push('}', 'export type PluginModule = PluginEntryModule & PluginLifecycleExports;');
  const required = variable(runtimePath, 'requiredMethods').initializer;
  if (!ts.isObjectLiteralExpression(required)) throw new Error('Invalid canonical required methods');
  for (const name of ['payment', 'shipping', 'tax', 'fulfillment', 'notification']) {
    const filename = path.join(shared, `extensions/contracts/${name}-v1.ts`);
    const title = name[0].toUpperCase() + name.slice(1);
    const methods = properties(filename, `${name}V1Methods`);
    for (const direction of ['input', 'output']) {
      lines.push(`export interface ${title}V1${direction === 'input' ? 'Input' : 'Output'}Map {`);
      for (const method of methods) {
        const pair = checker.getTypeOfSymbolAtLocation(method, source(filename));
        lines.push(`  ${method.name}: ${outputType(pair.getProperty(direction), source(filename))};`);
      }
      lines.push('}');
    }
    lines.push(`export type ${title}V1Method = keyof ${title}V1InputMap;`,
      `export type ${title}V1Input<M extends ${title}V1Method> = ${title}V1InputMap[M];`,
      `export type ${title}V1Output<M extends ${title}V1Method> = ${title}V1OutputMap[M];`,
      `export interface ${title}V1Contract {`);
    const requiredProperty = required.properties.find(property => property.name.getText() === name);
    if (!requiredProperty || !ts.isArrayLiteralExpression(requiredProperty.initializer)) throw new Error(`Missing required methods: ${name}`);
    const requiredNames = requiredProperty.initializer.elements.map(node => node.text);
    for (const method of methods) {
      lines.push(`  ${method.name}${requiredNames.includes(method.name) ? '' : '?'}(input: ${title}V1Input<'${method.name}'>): ${title}V1Output<'${method.name}'> | Promise<${title}V1Output<'${method.name}'>>;`);
    }
    lines.push('}');
  }
  return `${lines.join('\n').replace(/\r\n/g, '\n')}\n`;
}

const output = path.join(root, 'packages/plugin-sdk/dist/template-types/index.d.ts');
if (process.argv[2] === '--check') {
  if (await readFile(process.argv[3] || output, 'utf8') !== generateSnapshot()) throw new Error('TYPE_SNAPSHOT_MISMATCH');
  console.log('Type snapshot matches canonical sources');
} else {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, generateSnapshot(), 'utf8');
  console.log('Generated canonical plugin type snapshot');
}
