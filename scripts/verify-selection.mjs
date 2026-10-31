// Explicitly reviewed tests only. New script tests must be audited for side effects before registration.
export const localScriptTests = new Set([
  'scripts/check-e2e-contexts.test.mjs', 'scripts/backup.test.mjs',
  'scripts/compose-volumes.test.mjs', 'scripts/verify-compose.test.mjs',
  'scripts/visual-compare.test.mjs',
  'scripts/upload-test-storage.test.mjs', 'scripts/upload-test-image-identity.test.mjs',
  'scripts/release-identity.test.mjs', 'scripts/lane-config.test.mjs',
  'scripts/lane-provision.test.mjs', 'scripts/verify-selection.test.mjs',
  'scripts/storage-secret.test.mjs',
  'scripts/plugin-sdk-standalone.test.mjs',
  'scripts/maintenance-proof.test.mjs',
  'scripts/verify-lane-shards.test.mjs',
]);
export const ciOnlyScriptTests = new Set(['scripts/verify-ci.test.mjs', 'scripts/update.test.mjs', 'scripts/local-trial.test.mjs']);
export const ciOnlyVitestWrappers = new Set([
  'apps/api/tests/core/backup-delivery.test.ts',
  'apps/api/tests/core/compose-delivery.test.ts',
  'apps/api/tests/core/local-trial.test.ts',
  'apps/api/tests/core/release-identity.test.ts',
  'apps/api/tests/core/update-delivery.test.ts',
]);

export function localQuickVitestExclusions(app) {
  const prefix = `apps/${app}/`;
  return [...ciOnlyVitestWrappers].filter(file => file.startsWith(prefix)).map(file => `--exclude=${file.slice(prefix.length)}`);
}

export function parseSelection(args, exists) {
  const selections = args.filter(arg => arg.startsWith('--test-files='));
  const scopeArgs = args.filter(arg => arg.startsWith('--scope='));
  // The diagnostic mode runs exactly the requested selection and never the planner's mandatory
  // suites. It is a diagnosis tool, not a gate, so it is explicit, local and always marked.
  const diagnostic = args.includes('--diagnostic');
  if (diagnostic && !args.includes('--quick')) throw new Error('--diagnostic requires --quick: the diagnostic mode is a local selection mode (pnpm verify:quick --diagnostic ...).');
  if (diagnostic && args.some(arg => arg.startsWith('--shards='))) throw new Error('--diagnostic cannot be combined with --shards=N: the shard mode is the certifying full-suite run.');
  if (selections.length > 1 || (selections.length || scopeArgs.length) && !args.includes('--quick')) throw new Error('Local selection requires --quick and at most one --test-files.');
  const scopes = [...new Set(scopeArgs.flatMap(arg => arg.slice(8).split(',')))];
  if (scopes.some(scope => !['api', 'admin', 'shop'].includes(scope))) throw new Error('Unknown verification scope.');
  const files = { api: [], admin: [], shop: [], scripts: [] };
  for (const file of selections.length ? selections[0].slice(13).split(',') : []) {
    if (file.split('/').some(part => part === '.' || part === '..') || !exists(file)) throw new Error(`Invalid explicit test file: ${file}`);
    if (ciOnlyVitestWrappers.has(file)) throw new Error(`${file} is CI-only and cannot run through local quick verification.`);
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
  if (diagnostic && !scopes.length && !files.api.length && !files.admin.length && !files.shop.length && !files.scripts.length) {
    throw new Error('--diagnostic requires --scope= and/or --test-files=: a diagnostic run without a selection has no meaning.');
  }
  return { scopes, files, explicit: selections.length > 0, diagnostic };
}

// The planner's mandatory suites that a run adds to the requested selection. A certifying run
// adds all of them that the selection does not already name. A diagnostic run adds none of them:
// it prints them instead, so the operator still sees what the certifying gate would cover.
export function mandatoryAdditions(selection, planned) {
  if (selection.diagnostic) return [];
  return planned.filter(({ file }) => {
    const [, app, ...parts] = file.split('/');
    return !selection.files[app].includes(parts.join('/'));
  });
}

export function mandatorySuites(changed, scopes, catalogue, sharedConsumerApps = ['api', 'admin', 'shop']) {
  const additions = new Map();
  const add = (file, reason) => {
    if (ciOnlyVitestWrappers.has(file)) return;
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

// The lines a diagnostic run prints before it starts: the planner's mandatory suites that the
// certifying gate would add, each with its reason, because the reason is why the certifying
// gate is wide.
export function plannedSuiteLines(suites) {
  const reasons = [...new Set(suites.map(suite => suite.reason))];
  return [
    `Certifying gate would also run ${suites.length} planner-mandated suite(s)${reasons.length ? `: ${reasons.join('; ')}` : ''}`,
    ...suites.map(({ file, reason }) => `  Certifying gate would also run: ${file} (${reason})`),
  ];
}

export function quickRequirements(selection) {
  const scriptOnly = selection.explicit && selection.files.scripts.length > 0 && !['api', 'admin', 'shop'].some(app => selection.files[app].length) && !selection.scopes.length;
  const apps = scriptOnly ? [] : [...new Set([...(selection.scopes.length ? selection.scopes : ['api', 'admin', 'shop']), ...['api', 'admin', 'shop'].filter(app => selection.files[app].length)])];
  return { apps, database: apps.includes('api'), scriptOnly };
}
