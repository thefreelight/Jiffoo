#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(startDir) {
  let current = startDir;

  for (;;) {
    if (
      fs.existsSync(path.join(current, 'package.json'))
      && fs.existsSync(path.join(current, 'apps', 'admin', 'package.json'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find Jiffoo repo root from ${startDir}`);
    }
    current = parent;
  }
}

const ROOT = findRepoRoot(process.cwd());

const checks = [];

function filePath(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  const target = filePath(relativePath);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing required Admin file: ${relativePath}`);
  }
  return fs.readFileSync(target, 'utf8');
}

function addCheck(name, fn) {
  checks.push({ name, fn });
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertMatches(content, pattern, label) {
  if (!pattern.test(content)) {
    throw new Error(`Missing ${label}: ${pattern}`);
  }
}

function assertAtLeastOccurrences(content, needle, minimum, label) {
  const count = content.split(needle).length - 1;
  if (count < minimum) {
    throw new Error(`Expected at least ${minimum} occurrences of ${label}, found ${count}: ${needle}`);
  }
}

function section(content, startNeedle, endNeedle, label) {
  const start = content.indexOf(startNeedle);
  if (start < 0) {
    throw new Error(`Missing ${label}: ${startNeedle}`);
  }

  if (!endNeedle) {
    return content.slice(start);
  }

  const end = content.indexOf(endNeedle, start + startNeedle.length);
  return end < 0 ? content.slice(start) : content.slice(start, end);
}

addCheck('admin package test command is real', () => {
  const pkg = JSON.parse(read('apps/admin/package.json'));
  const testScript = pkg.scripts?.test;
  if (!testScript || /Tests not implemented yet/.test(testScript)) {
    throw new Error('apps/admin/package.json must expose a real test script.');
  }
  assertIncludes(testScript, 'vitest run', 'Admin Vitest behavior tests');
  assertIncludes(testScript, 'vitest.config.mts', 'Admin Vitest config');
  assertIncludes(testScript, 'verify-admin-quality-gate.mjs', 'Admin quality gate test script');

  const devDependencies = pkg.devDependencies || {};
  if (!devDependencies.vitest) {
    throw new Error('apps/admin/package.json must declare vitest for reproducible Admin tests.');
  }

  for (const testFile of [
    'apps/admin/tests/lib/admin-access.test.ts',
    'apps/admin/tests/lib/admin-api-contract.test.ts',
    'apps/admin/tests/lib/api-response.test.ts',
    'apps/admin/vitest.config.mts',
  ]) {
    read(testFile);
  }
});

addCheck('protected route enforces admin workspace permissions', () => {
  const source = read('apps/admin/components/auth/ProtectedRoute.tsx');
  assertIncludes(source, 'hasAdminWorkspaceAccess', 'admin workspace access check');
  assertIncludes(source, 'getRequiredPermissionsForAdminPath', 'route permission resolution');
  assertIncludes(source, 'canAccessAnyPermission', 'permission check helper');
  assertIncludes(source, 'getFirstAccessibleAdminPath', 'permission-denied fallback navigation');
  assertIncludes(source, 'requiredPermissions', 'explicit permission override prop');
  assertIncludes(source, 'requireAdmin && resolvedPermissions && !hasRequiredPermissions', 'missing-permission denial branch');
});

addCheck('admin path permission map covers ecosystem control surfaces', () => {
  const source = read('apps/admin/lib/admin-access.ts');
  const requiredMappings = [
    ['/staff', 'ADMIN_PERMISSIONS.STAFF_READ'],
    ['/plugins', 'ADMIN_PERMISSIONS.PLUGINS_READ'],
    ['/themes', 'ADMIN_PERMISSIONS.THEMES_READ'],
    ['/package', 'ADMIN_PERMISSIONS.SETTINGS_READ'],
    ['/settings', 'ADMIN_PERMISSIONS.SETTINGS_READ'],
    ['/system/health', 'ADMIN_PERMISSIONS.HEALTH_READ'],
    ['/errors', 'ADMIN_PERMISSIONS.HEALTH_READ'],
  ];

  for (const [route, permission] of requiredMappings) {
    assertIncludes(source, `path.startsWith('${route}')`, `${route} permission route`);
    assertIncludes(source, permission, `${route} permission`);
  }

  assertIncludes(source, 'getFirstAccessibleAdminPath', 'first accessible Admin landing helper');
  assertIncludes(source, 'getSystemNavHref', 'system nav permission helper');
});

addCheck('admin sidebars gate navigation by permissions', () => {
  for (const relativePath of [
    'apps/admin/components/layout/sidebar.tsx',
    'apps/admin/components/layout/blue-minimal-sidebar.tsx',
  ]) {
    const source = read(relativePath);
    for (const permission of [
      'ADMIN_PERMISSIONS.STAFF_READ',
      'ADMIN_PERMISSIONS.PLUGINS_READ',
      'ADMIN_PERMISSIONS.THEMES_READ',
      'ADMIN_PERMISSIONS.HEALTH_READ',
    ]) {
      assertIncludes(source, permission, `${relativePath} ${permission}`);
    }
    assertIncludes(source, 'canAccessAnyPermission', `${relativePath} nav permission filtering`);
    assertIncludes(source, 'getSystemNavHref', `${relativePath} system navigation routing`);
  }
});

addCheck('market, plugin, and theme pages mount the manager surfaces', () => {
  const pluginsPage = read('apps/admin/app/[locale]/plugins/page.tsx');
  const themesPage = read('apps/admin/app/[locale]/themes/page.tsx');
  assertIncludes(pluginsPage, 'PluginsManager', 'plugins manager page');
  assertIncludes(themesPage, 'ThemesManager', 'themes manager page');

  const pluginsManager = read('apps/admin/components/extensions/PluginsManager.tsx');
  const themesManager = read('apps/admin/components/extensions/ThemesManager.tsx');
  assertIncludes(pluginsManager, 'useOfficialCatalog', 'plugins official catalog query');
  assertIncludes(pluginsManager, 'useInstallOfficialExtension', 'plugins official install mutation');
  assertIncludes(themesManager, 'useOfficialCatalog', 'themes official catalog query');
  assertIncludes(themesManager, 'useInstallOfficialExtension', 'themes official install mutation');
  assertIncludes(themesManager, 'useActivateTheme', 'theme activation mutation');
});

addCheck('staff RBAC Admin surfaces are wired', () => {
  const staffPage = read('apps/admin/app/[locale]/staff/page.tsx');
  const detailPage = read('apps/admin/app/[locale]/staff/[id]/page.tsx');
  const hooks = read('apps/admin/lib/hooks/use-api.ts');
  const api = read('apps/admin/lib/api.ts');

  for (const token of [
    'useStaff',
    'useCreateStaff',
    'useUpdateStaff',
    'useRemoveStaff',
    'useResendStaffInvite',
    'useStaffRoles',
    'useStaffPermissions',
  ]) {
    assertIncludes(staffPage, token, `staff list ${token}`);
    assertIncludes(hooks, token, `staff hook ${token}`);
  }

  assertIncludes(detailPage, 'useStaffAuditLogs', 'staff audit log view');
  assertIncludes(detailPage, 'useStaffMember', 'staff detail view');

  for (const endpoint of [
    "'/admin/staff'",
    "'/admin/staff/roles'",
    "'/admin/staff/permissions'",
    '`/admin/staff/${userId}`',
    '`/admin/staff/${userId}/audit`',
    '`/admin/staff/${userId}/invite`',
  ]) {
    assertIncludes(api, endpoint, `staff API endpoint ${endpoint}`);
  }
});

addCheck('system update center exposes release truth and updater state', () => {
  const settingsPage = read('apps/admin/app/[locale]/settings/page.tsx');
  const api = read('apps/admin/lib/api.ts');
  const selfHostedRunbook = read('docs/operations/self-hosted-updater-runbook.md');

  for (const token of [
    'upgradeApi.getVersion',
    'upgradeApi.getStatus',
    'upgradeApi.resetStatus',
    'upgradeApi.perform',
    'clearUpdateCheckCache',
    'manifestStatus',
    'manifestUrl',
    'deliveryMode',
    'runtimeImages',
    'releaseTag',
    'repository',
    'sourceArchiveUrl',
    'checksumUrl',
    'oneClickUpgradeSupported',
    'oneClickUpgradeAvailable',
    'oneClickUpgradeBlockedReason',
    'requiresManualIntervention',
    'recoveryMode',
    'syncVersionAfterUpgrade',
    'self-hosted-updater-runbook.md',
  ]) {
    assertIncludes(settingsPage, token, `settings update center ${token}`);
  }

  for (const endpoint of [
    "'/upgrade/version'",
    "'/upgrade/status'",
    "'/upgrade/status/reset'",
    "'/upgrade/perform'",
    "'/upgrade/check'",
    "'/upgrade/backup'",
  ]) {
    assertIncludes(api, endpoint, `upgrade API endpoint ${endpoint}`);
  }

  for (const token of [
    'releaseTag?: string | null',
    'repository?: string | null',
    "deliveryMode?: 'image-first' | 'source-archive' | null",
    'runtimeImages?: {',
    'sourceArchiveUrl?: string | null',
    'checksumUrl?: string | null',
  ]) {
    assertIncludes(api, token, `upgrade API release truth field ${token}`);
  }

  for (const token of [
    '`get.jiffoo.com` serves the same `latestVersion` and `releaseTag` as the GitHub release',
    'Runtime images for `api`, `admin`, `shop`, and `updater` exist and use the exact target version tag',
    '`core-update-manifest.json`, `jiffoo-source.tar.gz`, and `jiffoo-source.tar.gz.sha256` are present',
    'branded storefront runtime',
    'No local version metadata is advanced before live runtime verification succeeds',
  ]) {
    assertIncludes(selfHostedRunbook, token, `self-hosted updater runbook ${token}`);
  }
});

addCheck('admin API client exposes official market, plugin, and theme lifecycle methods', () => {
  const api = read('apps/admin/lib/api.ts');
  const hooks = read('apps/admin/lib/hooks/use-api.ts');

  for (const token of [
    'export const marketApi',
    'getOfficialCatalog',
    'installOfficialExtension',
    "'/admin/market/official-catalog'",
    '`/admin/market/extensions/${slug}/install`',
    'export const pluginsApi',
    'getInstalled',
    'updateConfig',
    'enable',
    'disable',
    'uninstall',
    'restore',
    'purge',
    'export const themesApi',
    'getInstalled',
    'getActive',
    'activate',
    'rollback',
    'updateConfig',
  ]) {
    assertIncludes(api, token, `Admin API lifecycle token ${token}`);
  }

  for (const hook of [
    'useOfficialCatalog',
    'useInstallOfficialExtension',
    'useInstalledPlugins',
    'useThemes',
    'useActiveTheme',
    'useActivateTheme',
    'useRollbackTheme',
    'refreshOfficialExtensionState',
    'queryClient.invalidateQueries({ queryKey: marketQueryKeys.all })',
  ]) {
    assertIncludes(hooks, hook, `Admin hook ${hook}`);
  }
});

addCheck('admin API contract tests protect update, market, and theme truth endpoints', () => {
  const contractTest = read('apps/admin/tests/lib/admin-api-contract.test.ts');

  for (const token of [
    'keeps release truth fields from the upgrade version endpoint intact',
    "expect(mocks.apiClient.get).toHaveBeenCalledWith('/upgrade/version')",
    "releaseTag: 'v1.0.35-opensource'",
    "deliveryMode: 'image-first'",
    "api: 'ghcr.io/thefreelight/jiffoo-api:1.0.35'",
    "updater: 'ghcr.io/thefreelight/jiffoo-updater:1.0.35'",
    "manifestUrl: 'https://get.jiffoo.com/releases/core/manifest.json'",
    'oneClickUpgradeAvailable: true',
    'oneClickUpgradeBlockedReason: null',
    'uses canonical upgrade action endpoints and target-version payloads',
    "expect(mocks.apiClient.post).toHaveBeenCalledWith('/upgrade/perform', { targetVersion: '1.0.36' })",
    'sends official market installs through the install handoff with version and activation intent',
    "expect(mocks.apiClient.post).toHaveBeenCalledWith(",
    "'/admin/market/extensions/modelsfind/install'",
    "version: '0.1.4'",
    'uses active installed theme endpoints without client-side slug/version rewrites',
    "expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/themes/shop/active')",
    "expect(mocks.apiClient.post).toHaveBeenCalledWith('/admin/themes/shop/modelsfind/activate'",
  ]) {
    assertIncludes(contractTest, token, `Admin API contract test ${token}`);
  }
});

addCheck('API market/theme/upgrade tests cover bound official install flow', () => {
  const packageJson = JSON.parse(read('package.json'));
  const releaseQualityGate = read('scripts/run-release-quality-gates.mjs');
  const adminMarketInstallTest = read('apps/api/tests/routes/admin-market-install.test.ts');
  const marketInstallBindingTest = read('apps/api/tests/routes/market-install-binding.test.ts');

  assertIncludes(
    packageJson.scripts?.['test:admin-market-theme-upgrade'] || '',
    'tests/routes/admin-market-install.test.ts',
    'root focused Admin market/theme/upgrade test script',
  );
  assertIncludes(
    releaseQualityGate,
    "['pnpm', ['test:admin-market-theme-upgrade']]",
    'release quality gate focused Admin market/theme/upgrade command',
  );

  for (const token of [
    'bindMarketplaceForInstallTests',
    "'platform.connection'",
    'instanceToken',
    'tenantBindingId',
    'installs official-market plugins into the real core installer and exposes readiness state',
    'installs and activates official-market theme %s through the real theme-management flow',
    'rejects official installs when entitlement authorization denies access',
  ]) {
    assertIncludes(adminMarketInstallTest, token, `bound official market install test ${token}`);
  }

  for (const token of [
    'blocks official marketplace install when the instance is not platform-bound',
    'blocks free official installs until the platform tenant is bound',
    'routes bound free official installs through market authorization',
    'recordInstall: vi.fn().mockResolvedValue',
    'cleanupDownloadedArtifact: vi.fn().mockResolvedValue',
  ]) {
    assertIncludes(marketInstallBindingTest, token, `market binding guard test ${token}`);
  }
});

addCheck('admin lifecycle mutations refresh canonical market, plugin, and theme state', () => {
  const hooks = read('apps/admin/lib/hooks/use-api.ts');

  const pluginRefresh = section(
    hooks,
    'function refreshPluginRuntimeState',
    'function refreshThemeRuntimeState',
    'plugin runtime refresh helper',
  );
  for (const token of [
    'pluginQueryKeys.installed()',
    'marketQueryKeys.all',
    'pluginQueryKeys.config(slug)',
    'pluginQueryKeys.instances(slug)',
  ]) {
    assertIncludes(pluginRefresh, token, `plugin runtime refresh ${token}`);
  }

  const themeRefresh = section(
    hooks,
    'function refreshThemeRuntimeState',
    'function refreshOfficialExtensionState',
    'theme runtime refresh helper',
  );
  for (const token of [
    'themeQueryKeys.all',
    'themeQueryKeys.installed(target)',
    'themeQueryKeys.active(target)',
    'marketQueryKeys.all',
  ]) {
    assertIncludes(themeRefresh, token, `theme runtime refresh ${token}`);
  }

  const officialRefresh = section(
    hooks,
    'function refreshOfficialExtensionState',
    'export function useManagedPackageBranding',
    'official extension refresh helper',
  );
  for (const token of [
    'marketQueryKeys.all',
    'pluginQueryKeys.installed()',
    'themeQueryKeys.all',
    'managedPackageQueryKeys.all',
  ]) {
    assertIncludes(officialRefresh, token, `official extension refresh ${token}`);
  }

  const officialInstall = section(
    hooks,
    'export function useInstallOfficialExtension',
    'export function useManagedPackageStatus',
    'official install mutation',
  );
  assertAtLeastOccurrences(
    officialInstall,
    'refreshOfficialExtensionState(queryClient)',
    3,
    'official install state refresh on success and recoverable failures',
  );

  for (const [hookName, expectedRefresh] of [
    ['useUpdatePluginConfig', 'refreshPluginRuntimeState(queryClient, variables.slug)'],
    ['useTogglePlugin', 'refreshPluginRuntimeState(queryClient, variables.slug)'],
    ['useUninstallPlugin', 'refreshPluginRuntimeState(queryClient, slug)'],
    ['useRestorePlugin', 'refreshPluginRuntimeState(queryClient, slug)'],
    ['usePurgePlugin', 'refreshPluginRuntimeState(queryClient, slug)'],
    ['useCreatePluginInstance', 'refreshPluginRuntimeState(queryClient, variables.slug)'],
    ['useUpdatePluginInstance', 'refreshPluginRuntimeState(queryClient, variables.slug)'],
    ['useDeletePluginInstance', 'refreshPluginRuntimeState(queryClient, variables.slug)'],
  ]) {
    const mutation = section(
      hooks,
      `export function ${hookName}`,
      `export function ${hookName === 'useDeletePluginInstance' ? 'useThemes' : ''}`,
      `${hookName} mutation`,
    );
    assertIncludes(mutation, expectedRefresh, `${hookName} canonical state refresh`);
  }

  const activateTheme = section(
    hooks,
    'export function useActivateTheme',
    'export function useRollbackTheme',
    'theme activate mutation',
  );
  assertIncludes(
    activateTheme,
    'refreshThemeRuntimeState(queryClient, variables.target)',
    'theme activation refreshes active/installed/catalog state',
  );

  const rollbackTheme = section(
    hooks,
    'export function useRollbackTheme',
    '// ==================== Inventory Forecasting Hooks ====================',
    'theme rollback mutation',
  );
  assertIncludes(
    rollbackTheme,
    'refreshThemeRuntimeState(queryClient, target)',
    'theme rollback refreshes active/installed/catalog state',
  );
});

for (const check of checks) {
  try {
    check.fn();
    console.log(`ok - ${check.name}`);
  } catch (error) {
    console.error(`not ok - ${check.name}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

console.log(`Admin quality gate passed (${checks.length} checks).`);
