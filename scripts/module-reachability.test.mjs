import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImportGraph, affectedSuites, affectedTests } from './module-reachability.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A small workspace: a shared barrel, a shared leaf, and two API suites. */
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jiffoo-reachability-'));
  const write = async (file, content) => {
    await mkdir(path.join(root, path.dirname(file)), { recursive: true });
    await writeFile(path.join(root, file), content, 'utf8');
  };
  await write('packages/shared/tsconfig.json', JSON.stringify({ compilerOptions: { rootDir: '..', outDir: './dist' } }));
  await write('packages/shared/index.ts', "export * from './src/index';\n");
  await write('packages/shared/src/index.ts', "export * from './leaf';\n");
  await write('packages/shared/src/leaf.ts', 'export const leaf = 1;\n');
  await write('packages/shared/src/other.ts', 'export const other = 2;\n');
  await write('packages/shared/dist/shared/index.d.ts', 'export {};\n');
  await write('packages/shared/dist/shared/src/index.d.ts', 'export {};\n');
  await write('apps/api/tsconfig.json', JSON.stringify({ compilerOptions: {
    baseUrl: '.', paths: { '@/*': ['./src/*'], '@jiffoo/shared': ['../../packages/shared/dist/shared/index'] },
  } }));
  await write('apps/api/src/core/leaf-user.ts', "import { leaf } from '@jiffoo/shared';\nexport const used = leaf;\n");
  await write('apps/api/src/core/other-user.ts', "import { other } from '../../../../packages/shared/src/other';\nexport const used = other;\n");
  await write('apps/api/tests/core/leaf.test.ts', "import { used } from '../../src/core/leaf-user';\nvoid used;\n");
  await write('apps/api/tests/core/other.test.ts', "import { used } from '../../src/core/other-user';\nvoid used;\n");
  await write('apps/admin/tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } } }));
  await write('apps/admin/tests/only.test.ts', 'void 0;\n');
  return root;
}

test('a suite reaches a shared module through the package barrel and through a direct import', async () => {
  const root = await fixture();
  try {
    const graph = buildImportGraph(root);
    const catalogue = ['apps/api/tests/core/leaf.test.ts', 'apps/api/tests/core/other.test.ts', 'apps/admin/tests/only.test.ts'];
    assert.deepEqual(affectedTests(graph, ['packages/shared/src/leaf.ts'], catalogue), ['apps/api/tests/core/leaf.test.ts']);
    assert.deepEqual(affectedTests(graph, ['packages/shared/src/other.ts'], catalogue), ['apps/api/tests/core/other.test.ts']);
    assert.deepEqual(affectedTests(graph, ['packages/shared/src/leaf.ts'], catalogue), affectedTests(graph, ['packages/shared/index.ts'], catalogue));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a changed module that no suite reaches selects no suite', async () => {
  const root = await fixture();
  try {
    const graph = buildImportGraph(root);
    const catalogue = ['apps/api/tests/core/leaf.test.ts', 'apps/api/tests/core/other.test.ts'];
    await writeFile(path.join(root, 'packages/shared/src/orphan.ts'), 'export const orphan = 3;\n', 'utf8');
    assert.deepEqual(affectedTests(buildImportGraph(root), ['packages/shared/src/orphan.ts'], catalogue), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an unresolved import keeps its application conservative', async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, 'apps/api/src/core/dynamic.ts'), "export const dynamic = await import('./missing-at-runtime');\n", 'utf8');
    const graph = buildImportGraph(root);
    const catalogue = ['apps/api/tests/core/leaf.test.ts', 'apps/admin/tests/only.test.ts'];
    const suites = affectedSuites(graph, ['packages/shared/src/leaf.ts'], catalogue);
    // The API owns the unresolved import, so its suite keeps the conservative coverage.
    assert.equal(suites.get('apps/api/tests/core/leaf.test.ts'), 'an unresolved import');
    assert.equal(suites.get('apps/admin/tests/only.test.ts'), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('bundled package declarations map to source and missing source imports remain unresolved', async () => {
  const root = await fixture();
  try {
    await mkdir(path.join(root, 'packages/plugin-sdk/dist/template-types'), { recursive: true });
    await mkdir(path.join(root, 'packages/plugin-sdk/src'), { recursive: true });
    await writeFile(path.join(root, 'packages/plugin-sdk/dist/template-types/index.d.ts'), 'export {};');
    await writeFile(path.join(root, 'packages/plugin-sdk/src/index.ts'), "export * from './missing';");
    await writeFile(path.join(root, 'apps/api/tsconfig.json'), JSON.stringify({ compilerOptions: {
      baseUrl: '.', paths: { '@jiffoo-core/plugin-sdk': ['../../packages/plugin-sdk/dist/template-types/index'] },
    } }));
    await writeFile(path.join(root, 'apps/api/tests/core/sdk.test.ts'), "import '@jiffoo-core/plugin-sdk';");
    const graph = buildImportGraph(root);
    assert.ok(graph.imports.get('apps/api/tests/core/sdk.test.ts').has('packages/plugin-sdk/src/index.ts'));
    assert.ok(graph.unresolved.includes('packages/plugin-sdk/src/index.ts -> ./missing'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the workspace graph resolves every TypeScript import of the applications and the packages', { timeout: 600_000 }, () => {
  const graph = buildImportGraph(workspace);
  const unresolvedTypescript = graph.unresolved.filter(entry => /\.(?:ts|tsx|mts|cts)(?:\s|$)/.test(entry));
  assert.deepEqual(unresolvedTypescript, []);
  assert.ok(graph.files.length > 500);
});

test('the API reads the record labels and not the assembled message catalogue', { timeout: 600_000 }, () => {
  const graph = buildImportGraph(workspace);
  const importers = new Map();
  for (const [file, targets] of graph.imports) {
    for (const target of targets) {
      const set = importers.get(target) ?? new Set();
      set.add(file);
      importers.set(target, set);
    }
  }
  // The catalogue is assembled per locale, so a source file that imports it reaches every label of
  // every namespace. The API reads the labels of the records it exports through a module of their
  // own, so a change to a merchant label does not select the suites that boot the API.
  for (const target of ['packages/shared/src/i18n/index.ts', 'packages/shared/src/i18n/messages/index.ts']) {
    const apiImporters = [...(importers.get(target) ?? [])].filter(file => file.startsWith('apps/api/src/')).sort();
    assert.deepEqual(apiImporters, [], `the API must not import ${target}`);
  }
  // The label module of the exported records is read by the API directly.
  const readers = [...(importers.get('packages/shared/src/i18n/messages/admin-record-labels.ts') ?? [])].sort();
  assert.ok(readers.includes('apps/api/src/core/admin/order-management/export.ts'));
  assert.ok(readers.includes('apps/api/src/core/admin/product-management/batch.ts'));
  assert.ok(readers.includes('apps/api/src/core/admin/user-management/export.ts'));
});
