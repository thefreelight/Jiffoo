// Explicitly reviewed tests only. New script tests must be audited for side effects before registration.
export const localScriptTests = new Set([
  'scripts/check-e2e-contexts.test.mjs', 'scripts/backup.test.mjs',
  'scripts/compose-volumes.test.mjs', 'scripts/verify-compose.test.mjs',
  'scripts/upload-test-storage.test.mjs', 'scripts/upload-test-image-identity.test.mjs',
  'scripts/release-identity.test.mjs', 'scripts/lane-config.test.mjs',
  'scripts/lane-provision.test.mjs', 'scripts/verify-selection.test.mjs',
  'scripts/storage-secret.test.mjs',
]);
export const ciOnlyScriptTests = new Set(['scripts/verify-ci.test.mjs', 'scripts/update.test.mjs', 'scripts/local-trial.test.mjs']);

export function parseSelection(args, exists) {
  const selections = args.filter(arg => arg.startsWith('--test-files='));
  const scopeArgs = args.filter(arg => arg.startsWith('--scope='));
  if (selections.length > 1 || (selections.length || scopeArgs.length) && !args.includes('--quick')) throw new Error('Local selection requires --quick and at most one --test-files.');
  const scopes = [...new Set(scopeArgs.flatMap(arg => arg.slice(8).split(',')))];
  if (scopes.some(scope => !['api', 'admin', 'shop'].includes(scope))) throw new Error('Unknown verification scope.');
  const files = { api: [], admin: [], shop: [], scripts: [] };
  for (const file of selections.length ? selections[0].slice(13).split(',') : []) {
    if (file.split('/').some(part => part === '.' || part === '..') || !exists(file)) throw new Error(`Invalid explicit test file: ${file}`);
    if (/^scripts\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.test\.mjs$/.test(file)) {
      if (ciOnlyScriptTests.has(file)) throw new Error(`${file} is CI-only and cannot run through local quick verification.`);
      if (!localScriptTests.has(file)) throw new Error(`${file} has not been audited for database/container-free local execution.`);
      files.scripts.push(file);
    } else {
      const match = file.match(/^apps\/(api|admin|shop)\/(tests\/[A-Za-z0-9_./-]+\.(?:test|spec)\.[cm]?[jt]sx?)$/);
      if (!match) throw new Error(`Invalid explicit test file: ${file}`);
      if (scopes.length && !scopes.includes(match[1])) throw new Error(`Selected file is outside the requested scope: ${file}`);
      files[match[1]].push(match[2]);
    }
  }
  return { scopes, files, explicit: selections.length > 0 };
}

export function mandatorySuites(changed, scopes, catalogue, sharedConsumerApps = ['api', 'admin', 'shop']) {
  const additions = new Map();
  const add = (file, reason) => {
    if (!additions.has(file)) additions.set(file, { file, reason });
  };
  // Cross-scope mandatory suites intentionally expand the requested scope. Conservative matching
  // can over-select; a conservative shared-import grep selects every suite in each consumer
  // application because indirect imports and re-exports make per-test matching incomplete.
  // This deliberately treats any shared module as potentially affecting every shared consumer.
  if (changed.some(file => /^apps\/api\/(?!prisma\/).*(?:routes?\/|schemas?\/|openapi|error.code)/i.test(file))) {
    for (const file of catalogue.filter(file => file.startsWith('apps/api/tests/contract/'))) add(file, 'API contract surface changed');
  }
  if (changed.some(file => file.startsWith('packages/shared/'))) {
    for (const file of catalogue.filter(file => sharedConsumerApps.includes(file.split('/')[1]))) add(file, 'Shared package changed; conservative transitive-import coverage');
  }
  if (changed.some(file => /(?:auth|permission|session|account-recovery|admin-removal|user-management|password-reset|rbac)/i.test(file))) {
    for (const file of catalogue.filter(file => /(?:auth|session|account-recovery|admin-removal)/i.test(file))) add(file, 'Authentication or permissions changed');
  }
  if (changed.some(file => /^apps\/api\/prisma\/(?:schema(?:\/|\.)|migrations\/)/.test(file))) {
    for (const file of catalogue.filter(file => /migration/i.test(file))) add(file, 'Prisma schema or migration changed');
  }
  return [...additions.values()];
}

export function quickRequirements(selection) {
  const scriptOnly = selection.explicit && selection.files.scripts.length > 0 && !['api', 'admin', 'shop'].some(app => selection.files[app].length) && !selection.scopes.length;
  const apps = scriptOnly ? [] : [...new Set([...(selection.scopes.length ? selection.scopes : ['api', 'admin', 'shop']), ...['api', 'admin', 'shop'].filter(app => selection.files[app].length)])];
  return { apps, database: apps.includes('api'), scriptOnly };
}
