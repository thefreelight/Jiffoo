#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(content, token, label) {
  if (!content.includes(token)) {
    throw new Error(`Missing ${label}: ${token}`);
  }
}

const api = read('apps/admin/lib/api.ts');
const hooks = read('apps/admin/lib/hooks/use-api.ts');
const pluginsManager = read('apps/admin/components/extensions/PluginsManager.tsx');
const themesManager = read('apps/admin/components/extensions/ThemesManager.tsx');
const catalogTest = read('apps/api/tests/core/official-catalog.test.ts');

for (const [content, token, label] of [
  [api, 'getOfficialCatalog', 'official artifact catalog API'],
  [api, 'installOfficialExtension', 'official artifact install API'],
  [hooks, 'useOfficialCatalog', 'official artifact catalog hook'],
  [hooks, 'useInstallOfficialExtension', 'official artifact install hook'],
  [pluginsManager, 'useOfficialCatalog', 'plugin catalog surface'],
  [themesManager, 'useOfficialCatalog', 'theme catalog surface'],
  [catalogTest, 'static artifact index', 'artifact index test coverage'],
]) {
  assertIncludes(content, token, label);
}

console.log('Admin quality gate passed.');
