/**
 * Builtin plugin slug parity (WP-D2 / D-5).
 *
 * The reserved builtin slugs exist once, in the shared plugin contract. The
 * Core installer, the Core upload validator and the plugin SDK scaffold must all
 * read that constant instead of carrying a copy of the list.
 *
 * The check is source-level: it reads the three consumer files and the shared
 * contract. It needs no database, no Redis instance and no network.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SHARED_CONTRACT = path.resolve(__dirname, '../../../../packages/shared/src/extensions/plugin-contract.ts');
const CORE_INSTALLER = path.resolve(__dirname, '../../src/core/admin/extension-installer/plugin-fs-installer.ts');
const CORE_UPLOAD = path.resolve(__dirname, '../../src/core/admin/extension-installer/plugin-upload.ts');
const SDK_SCAFFOLD = path.resolve(__dirname, '../../../../packages/plugin-sdk/src/create.ts');

const EXPECTED_SLUGS = ['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email'];

/** The shared contract must declare exactly the reserved builtin slugs. */
function sharedSlugs(): string[] {
  const source = readFileSync(SHARED_CONTRACT, 'utf8');
  const declaration = /export const BUILTIN_PLUGIN_SLUGS = \[([\s\S]*?)\] as const;/.exec(source);
  expect(declaration, `${SHARED_CONTRACT} must export BUILTIN_PLUGIN_SLUGS`).toBeTruthy();
  return [...declaration![1].matchAll(/'([^']+)'/g)].map(match => match[1]);
}

/** A consumer file must not carry a copy of a reserved slug literal. */
function literalSlugLists(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return EXPECTED_SLUGS.filter(slug => source.includes(`'${slug}'`) || source.includes(`"${slug}"`));
}

describe('builtin plugin slug parity', () => {
  it('declares the reserved builtin slugs once, in the shared contract', () => {
    expect(sharedSlugs()).toEqual(EXPECTED_SLUGS);
  });

  it('makes the Core installer read the shared constant', () => {
    const source = readFileSync(CORE_INSTALLER, 'utf8');
    expect(source).toMatch(/import\s*\{[^}]*BUILTIN_PLUGIN_SLUGS[^}]*\}\s*from\s*'@jiffoo\/shared'/);
    expect(literalSlugLists(CORE_INSTALLER)).toEqual([]);
  });

  it('makes the Core upload validator read the shared constant', () => {
    const source = readFileSync(CORE_UPLOAD, 'utf8');
    expect(source).toMatch(/import\s*\{[^}]*BUILTIN_PLUGIN_SLUGS[^}]*\}\s*from\s*'@jiffoo\/shared'/);
    expect(literalSlugLists(CORE_UPLOAD)).toEqual([]);
  });

  it('makes the plugin SDK scaffold read the shared constant', () => {
    const source = readFileSync(SDK_SCAFFOLD, 'utf8');
    expect(source).toMatch(/import\s*\{[^}]*BUILTIN_PLUGIN_SLUGS[^}]*\}\s*from\s*'\.\.\/\.\.\/shared\/src\/extensions\/plugin-contract'/);
    expect(literalSlugLists(SDK_SCAFFOLD)).toEqual([]);
  });
});
