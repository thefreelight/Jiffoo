import ts from 'typescript';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * The workspace import graph.
 *
 * The gate used to treat any change under `packages/shared/` as a change to
 * every suite of every application that consumes the package, because a
 * suite's relation to a shared module is not visible in its own name. It is
 * visible in the import graph: a suite that cannot reach the changed module
 * cannot be affected by it. This module computes that reachability.
 *
 * The graph is built from the sources the applications compile. A resolved
 * module that points into a built artifact is mapped back to its source, so a
 * change to a shared source file is the change the consumers actually see.
 */

const SOURCE_ROOTS = ['apps/api', 'apps/admin', 'apps/shop', 'packages/shared', 'packages/plugin-sdk', 'packages/plugin-bridge'];
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'out', 'coverage', '.next', '.turbo', 'test-results', 'visual-results', '.git']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx', '.json'];
const PACKAGE_ROOTS = { '@jiffoo/shared': 'packages/shared', '@jiffoo-core/plugin-sdk': 'packages/plugin-sdk', '@jiffoo/plugin-bridge': 'packages/plugin-bridge' };

function isSource(file) {
  return SOURCE_EXTENSIONS.includes(path.extname(file));
}

/** A data file that an import names, such as the default theme tokens. */
function isDataNode(file) {
  return file.endsWith('.json') && !['package.json', 'tsconfig.json'].includes(path.basename(file));
}

function listSources(root, prefix = '', files = []) {
  const directory = path.join(root, prefix);
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); }
  catch { return files; }
  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) listSources(root, relative, files);
    else if (isSource(entry.name)) files.push(relative.split(path.sep).join('/'));
  }
  return files;
}

/** The compiler options of the project that owns a file. */
function projectOptions(root, owner) {
  const configPath = path.join(root, owner, 'tsconfig.json');
  if (!existsSync(configPath)) return {};
  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, ts.sys.readFile).config ?? {},
    ts.sys,
    path.dirname(configPath),
  );
  return parsed.options;
}

/** The project that owns a file. */
function ownerOf(file) {
  if (file.startsWith('apps/') || file.startsWith('packages/')) return file.split('/').slice(0, 2).join('/');
  return '';
}

/** Every module specifier a file imports, statically or dynamically. */
function specifiersOf(source, fileName) {
  const found = new Set();
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.add(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && ts.isStringLiteral(node.moduleReference.expression)) {
      found.add(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      found.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  void fileName;
  return found;
}

/** The source file behind a resolved module, when the resolution names a build artifact. */
function sourceBehind(resolved, root) {
  const relative = path.relative(root, resolved).split(path.sep).join('/');
  if (relative.includes('/node_modules/')) return null;
  for (const prefix of Object.values(PACKAGE_ROOTS)) {
    const built = `${prefix}/dist/`;
    if (!relative.startsWith(built)) continue;
    // A package compiled with its root above the package directory emits
    // `dist/<package>/<rest>`, so the source is `packages/<package>/<rest>`.
    const rest = relative.slice(built.length).replace(/\.(d\.ts|js|mjs|cjs|jsx)$/, '');
    const candidates = [`packages/${rest}`, `${prefix}/${rest}`];
    if (rest.startsWith('internal/')) candidates.push(`packages/${rest.slice('internal/'.length)}`);
    for (const candidate of candidates) {
      for (const extension of RESOLVE_EXTENSIONS) {
        if (existsSync(path.join(root, candidate + extension))) return candidate + extension;
      }
      for (const extension of RESOLVE_EXTENSIONS) {
        if (existsSync(path.join(root, candidate, `index${extension}`))) return `${candidate}/index${extension}`;
      }
    }
    return null;
  }
  return relative;
}

/** A specifier that can name a file of the workspace graph. */
function isWorkspaceSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('@/')
    || specifier.startsWith('shared/') || specifier.startsWith('@shared/')
    || specifier.startsWith('@jiffoo/') || specifier.startsWith('@jiffoo-core/');
}

/** A specifier that names a file the graph does not hold, such as a stylesheet. */
function isNonSourceSpecifier(specifier) {
  return ['.css', '.scss', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.html',
    '.js', '.mjs', '.cjs', '.jsx', '.json']
    .includes(path.extname(specifier).toLowerCase());
}

/** The source of a workspace package, when the package is not built yet. */
function workspacePackageSource(root, specifier) {
  for (const [name, prefix] of Object.entries(PACKAGE_ROOTS)) {
    if (specifier !== name && !specifier.startsWith(`${name}/`)) continue;
    const rest = specifier.slice(name.length).replace(/^\//, '');
    const candidates = rest ? [`${prefix}/src/${rest}`] : [`${prefix}/src/index`];
    for (const candidate of candidates) {
      for (const extension of RESOLVE_EXTENSIONS) {
        if (existsSync(path.join(root, candidate + extension))) return candidate + extension;
      }
      for (const extension of RESOLVE_EXTENSIONS) {
        if (existsSync(path.join(root, candidate, `index${extension}`))) return `${candidate}/index${extension}`;
      }
    }
  }
  return null;
}

/**
 * Build the import graph of the workspace.
 *
 * The result carries the edges between source files and the specifiers that
 * could not be resolved to a workspace file. A caller that cannot afford an
 * incomplete graph checks `unresolved` before trusting the result.
 */
export function buildImportGraph(root) {
  const files = [];
  for (const prefix of SOURCE_ROOTS) files.push(...listSources(root, prefix));
  const known = new Set(files);
  const imports = new Map();
  const unresolved = new Set();
  const optionCache = new Map();
  for (const file of files) {
    const absolute = path.join(root, file);
    const text = readFileSync(absolute, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const owner = ownerOf(file);
    if (!optionCache.has(owner)) optionCache.set(owner, projectOptions(root, owner));
    const compilerOptions = optionCache.get(owner);
    const edges = new Set();
    for (const specifier of specifiersOf(source, file)) {
      // Only a workspace specifier can name a file of this graph. A bare
      // package name is an external dependency and contributes no edge.
      if (!isWorkspaceSpecifier(specifier)) continue;
      const resolution = ts.resolveModuleName(specifier, absolute, compilerOptions, ts.sys).resolvedModule;
      if (!resolution || !resolution.resolvedFileName) {
        if (isNonSourceSpecifier(specifier)) continue;
        const packageSource = workspacePackageSource(root, specifier);
        if (packageSource) { edges.add(packageSource); continue; }
        unresolved.add(`${file} -> ${specifier}`);
        continue;
      }
      const target = sourceBehind(resolution.resolvedFileName, root);
      if (!target) { unresolved.add(`${file} -> ${specifier}`); continue; }
      if (!known.has(target) && !isDataNode(target)) continue;
      edges.add(target);
    }
    imports.set(file, edges);
  }
  return { imports, unresolved: [...unresolved], files };
}

/**
 * The test files that can reach the changed files through the import graph.
 */
export function affectedTests(graph, changedFiles, testFiles) {
  return [...affectedSuites(graph, changedFiles, testFiles).keys()];
}

/**
 * The suites a change reaches, with the changed file each suite reaches.
 *
 * A suite that cannot reach the changed module cannot be affected by it. An
 * unresolved import can hide a dependency, so the application that owns it
 * keeps the conservative coverage.
 */
export function affectedSuites(graph, changedFiles, catalogue) {
  const importers = new Map();
  for (const [file, targets] of graph.imports) {
    for (const target of targets) {
      const set = importers.get(target) ?? new Set();
      set.add(file);
      importers.set(target, set);
    }
  }
  const reached = new Map();
  const queue = changedFiles.map(file => [file, file]);
  while (queue.length) {
    const [current, origin] = queue.pop();
    for (const importer of importers.get(current) ?? []) {
      if (reached.has(importer)) continue;
      reached.set(importer, origin);
      queue.push([importer, origin]);
    }
  }
  const suites = new Map();
  for (const file of catalogue) {
    const origin = reached.get(file);
    if (origin) suites.set(file, origin);
  }
  const uncertain = new Set(graph.unresolved.map(entry => {
    const owner = entry.split(' -> ')[0].split('/');
    return owner[0] === 'apps' ? owner[1] : '';
  }).filter(Boolean));
  for (const file of catalogue) {
    const app = file.split('/')[1];
    if (uncertain.has(app)) suites.set(file, 'an unresolved import');
  }
  return suites;
}
