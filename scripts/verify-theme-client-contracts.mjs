#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const strictCrossRepo = args.has('--strict-cross-repo');

const root = process.cwd();
const siblingRoot = path.resolve(root, '..');

const catalogPath = path.join(root, 'docs/theme-client-api-catalog.json');
const registryPath = path.join(root, 'docs/theme-client-adapter-registry.json');
const matrixPath = path.join(root, 'docs/theme-client-compatibility-matrix.md');
const themeSupportDocPath = path.join(root, 'docs/theme-client-official-theme-support.md');
const themeSupportJsonPath = path.join(root, 'docs/theme-client-official-theme-support.json');
const firstWaveRolloutPath = path.join(root, 'docs/theme-client-first-wave-rollout.md');
const firstWaveBacklogPath = path.join(root, 'docs/theme-client-first-wave-backlog.json');
const coreContractPath = path.join(root, 'docs/theme-client-platform-contract.md');
const endpointOverviewPath = path.join(root, 'docs/API_CORE_ENDPOINTS.md');

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readFile(filePath));
}

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${path.relative(root, filePath)}`);
    return false;
  }
  return true;
}

function normalizePathForCompare(input) {
  return input
    .replace(/\{[^/}]+\}/g, ':param')
    .replace(/:[A-Za-z0-9_]+/g, ':param')
    .replace(/\/+$/g, '')
    .replace(/\/+/g, '/');
}

function collectDocumentedPaths(markdown) {
  const result = new Set();
  const pattern = /`([^`]*?(\/(?:api|theme-app)[^`\s]*))`/g;
  for (const match of markdown.matchAll(pattern)) {
    result.add(normalizePathForCompare(match[2]));
  }
  return result;
}

function stripCodeTicks(value) {
  return value.replace(/`/g, '').trim();
}

function parseMatrix(markdown) {
  const rows = new Map();
  const lines = markdown.split('\n');
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith('## Initial Official Matrix')) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) {
      break;
    }
    if (!inSection || !line.startsWith('|')) {
      continue;
    }

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => stripCodeTicks(cell));

    if (cells.length < 5 || cells[0] === 'Theme Or Mode' || cells[0] === '---') {
      continue;
    }

    rows.set(cells[0], {
      web: cells[1].toLowerCase(),
      mobile: cells[2].toLowerCase(),
      desktop: cells[3].toLowerCase(),
      notes: cells[4],
    });
  }

  return rows;
}

function validateCatalog(catalog, documentedPaths) {
  if (catalog.version !== 1) {
    fail('theme-client-api-catalog.json must use version 1.');
  }

  const tiers = Array.isArray(catalog.tiers) ? catalog.tiers : [];
  const allowedTiers = new Set(['stable', 'experimental', 'internal']);
  for (const tier of tiers) {
    if (!allowedTiers.has(tier)) {
      fail(`Unknown catalog tier: ${tier}`);
    }
  }

  if (!Array.isArray(catalog.contracts) || catalog.contracts.length === 0) {
    fail('theme-client-api-catalog.json must declare at least one contract.');
    return;
  }

  const ids = new Set();
  for (const contract of catalog.contracts) {
    if (!contract.id || typeof contract.id !== 'string') {
      fail('Every contract must have a string id.');
      continue;
    }
    if (ids.has(contract.id)) {
      fail(`Duplicate contract id: ${contract.id}`);
    }
    ids.add(contract.id);

    if (!allowedTiers.has(contract.tier)) {
      fail(`Contract ${contract.id} has invalid tier ${contract.tier}`);
    }

    const declaredPaths = [];
    if (typeof contract.path === 'string') declaredPaths.push(contract.path);
    if (Array.isArray(contract.paths)) declaredPaths.push(...contract.paths);

    if (contract.tier === 'stable') {
      for (const declaredPath of declaredPaths) {
        if (!declaredPath.startsWith('/api/')) {
          continue;
        }
        const normalized = normalizePathForCompare(declaredPath);
        if (!documentedPaths.has(normalized)) {
          fail(`Stable contract path is not documented in docs/API_CORE_ENDPOINTS.md: ${declaredPath}`);
        }
      }
    }
  }
}

function validateRegistry(registry) {
  if (registry.version !== 1) {
    fail('theme-client-adapter-registry.json must use version 1.');
  }
  if (!Array.isArray(registry.entries) || registry.entries.length === 0) {
    fail('theme-client-adapter-registry.json must declare at least one entry.');
    return;
  }

  const labels = new Set();
  for (const entry of registry.entries) {
    if (!entry.matrixLabel || typeof entry.matrixLabel !== 'string') {
      fail('Every adapter registry entry must declare matrixLabel.');
    } else if (labels.has(entry.matrixLabel)) {
      fail(`Duplicate matrixLabel in adapter registry: ${entry.matrixLabel}`);
    } else {
      labels.add(entry.matrixLabel);
    }

    if (!entry.targets || typeof entry.targets !== 'object') {
      fail(`Registry entry ${entry.matrixLabel || entry.themeSlug || entry.themeMode} must declare targets.`);
      continue;
    }

    for (const target of ['web', 'mobile', 'desktop']) {
      if (!entry.targets[target]) {
        fail(`Registry entry ${entry.matrixLabel || entry.themeSlug || entry.themeMode} is missing target ${target}.`);
      }
    }
  }
}

function validateStorefrontProfile(profilePath, expectedFamily) {
  const profile = readJson(profilePath);

  if (profile.schemaVersion !== 1) {
    fail(`${profilePath} must use schemaVersion 1.`);
  }
  if (profile.family !== expectedFamily) {
    fail(`${profilePath} must declare family "${expectedFamily}".`);
  }
  if (!Array.isArray(profile.supportedThemeModes) || profile.supportedThemeModes.length === 0) {
    fail(`${profilePath} must declare supportedThemeModes.`);
  }
  if (!Array.isArray(profile.supportedExtensions) || profile.supportedExtensions.length === 0) {
    fail(`${profilePath} must declare supportedExtensions.`);
  }
  if (!Array.isArray(profile.capabilities) || profile.capabilities.length === 0) {
    fail(`${profilePath} must declare capabilities.`);
  }
  if (profile.sourceOfTruth !== 'Jiffoo') {
    fail(`${profilePath} must declare sourceOfTruth "Jiffoo".`);
  }
  if (profile.coreContractPath !== 'docs/theme-client-platform-contract.md') {
    fail(`${profilePath} must reference docs/theme-client-platform-contract.md as coreContractPath.`);
  }

  return profile;
}

function resolveCrossRepoProfile(profilePathRef) {
  const resolved = path.resolve(siblingRoot, profilePathRef);
  const topLevelDir = profilePathRef.split('/')[0];
  const repoPath = path.resolve(siblingRoot, topLevelDir);

  if (!fs.existsSync(repoPath)) {
    const message = `Cross-repo dependency not found locally: ${topLevelDir}`;
    if (strictCrossRepo) {
      fail(message);
    } else {
      warn(message);
    }
    return null;
  }

  if (!fs.existsSync(resolved)) {
    fail(`Referenced profilePath does not exist: ${profilePathRef}`);
    return null;
  }

  return resolved;
}

function checkMatrixAgainstRegistry(matrixRows, registry) {
  for (const entry of registry.entries) {
    const label = entry.matrixLabel;
    const matrixRow = matrixRows.get(label);
    if (!matrixRow) {
      fail(`Compatibility matrix is missing row: ${label}`);
      continue;
    }

    for (const target of ['web', 'mobile', 'desktop']) {
      const expected = String(entry.targets[target].status || '').toLowerCase();
      const actual = String(matrixRow[target] || '').toLowerCase();
      if (expected && actual && expected !== actual) {
        fail(`Compatibility matrix drift for ${label} (${target}): expected "${expected}", found "${actual}".`);
      }
    }
  }
}

function validateProfilesAgainstRegistry(profilesByTarget, registry) {
  for (const entry of registry.entries) {
    for (const target of ['mobile', 'desktop']) {
      const profile = profilesByTarget[target];
      if (!profile) {
        continue;
      }

      const targetConfig = entry.targets[target];
      const status = String(targetConfig.status || '').toLowerCase();
      if (status === 'unsupported' || status === '') {
        continue;
      }

      if (entry.themeSlug === 'builtin-default' && targetConfig.rendererMode === 'native-adapter') {
        if (!profile.supportedThemeModes.includes('native-adapter')) {
          fail(`${target} profile must declare native-adapter support for builtin-default.`);
        }
      }

      if (entry.themeMode === 'downloaded-theme-pack' && !profile.supportedThemeModes.includes('pack')) {
        fail(`${target} profile must declare pack support.`);
      }

      if (entry.themeMode === 'embedded-renderer-hint' && !profile.supportedThemeModes.includes('embedded')) {
        fail(`${target} profile must declare embedded support.`);
      }

      if (entry.themeMode === 'theme-app' && !profile.supportedThemeModes.includes('theme-app')) {
        fail(`${target} profile must declare theme-app support.`);
      }

      if (Array.isArray(targetConfig.requires)) {
        for (const capability of targetConfig.requires) {
          if (!profile.capabilities.includes(capability)) {
            fail(`${target} profile is missing required capability "${capability}" for ${entry.matrixLabel}.`);
          }
        }
      }

      if (Array.isArray(targetConfig.requiresExtensions)) {
        for (const extension of targetConfig.requiresExtensions) {
          if (!profile.supportedExtensions.includes(extension)) {
            fail(`${target} profile is missing required extension "${extension}" for ${entry.matrixLabel}.`);
          }
        }
      }
    }
  }
}

function validateThemeSupportInventory(themeSupport, themeSupportDoc) {
  if (themeSupport.version !== 1) {
    fail('theme-client-official-theme-support.json must use version 1.');
  }

  const allowedStatuses = new Set(themeSupport.allowedStatuses || []);
  const expectedStatuses = ['implemented', 'planned', 'limited', 'experimental', 'unsupported'];
  for (const status of expectedStatuses) {
    if (!allowedStatuses.has(status)) {
      fail(`Theme support inventory must allow status ${status}.`);
    }
  }

  const themeRoot = path.join(root, 'packages/shop-themes');
  const packageSlugs = fs.readdirSync(themeRoot).filter((entry) => {
    const packagePath = path.join(themeRoot, entry);
    return fs.statSync(packagePath).isDirectory() && fs.existsSync(path.join(packagePath, 'package.json'));
  });

  const listedSlugs = new Set();
  const listedPackageSlugs = new Set();
  for (const entry of themeSupport.themes || []) {
    if (!entry.slug || typeof entry.slug !== 'string') {
      fail('Every theme support entry must declare slug.');
      continue;
    }

    listedSlugs.add(entry.slug);

    const packageSlug = entry.packageSlug || entry.slug;
    listedPackageSlugs.add(packageSlug);

    if (!packageSlugs.includes(packageSlug)) {
      fail(`Theme support entry references unknown packageSlug: ${packageSlug}`);
      continue;
    }

    const packagePath = path.join(root, entry.packagePath || '');
    if (!fs.existsSync(packagePath)) {
      fail(`Theme support entry ${entry.slug} references missing packagePath: ${entry.packagePath}`);
    }

    const hasSrc = fs.existsSync(path.join(packagePath, 'src'));
    const hasThemePack = fs.existsSync(path.join(packagePath, 'theme-pack'));
    const packaging = entry.packaging;

    if (packaging === 'embedded-only' && (!hasSrc || hasThemePack)) {
      fail(`Theme ${entry.slug} packaging drift: expected embedded-only.`);
    }
    if (packaging === 'theme-pack-only' && (hasSrc || !hasThemePack)) {
      fail(`Theme ${entry.slug} packaging drift: expected theme-pack-only.`);
    }
    if (packaging === 'embedded+theme-pack' && (!hasSrc || !hasThemePack)) {
      fail(`Theme ${entry.slug} packaging drift: expected embedded+theme-pack.`);
    }

    for (const target of ['web', 'mobile', 'desktop']) {
      const status = entry[target]?.status;
      if (!allowedStatuses.has(status)) {
        fail(`Theme ${entry.slug} has invalid ${target} status: ${status}`);
      }
    }
  }

  for (const slug of packageSlugs) {
    if (!listedPackageSlugs.has(slug)) {
      fail(`Theme support inventory is missing theme slug: ${slug}`);
    }
  }

  for (const entry of themeSupport.themes || []) {
    if (!themeSupportDoc.includes(`\`${entry.slug}\``)) {
      fail(`Theme support markdown is missing slug row: ${entry.slug}`);
    }
  }
}

function validateFirstWaveBacklog(backlog, backlogDoc, themeSupport) {
  if (backlog.version !== 1) {
    fail('theme-client-first-wave-backlog.json must use version 1.');
  }

  const allowedStatuses = new Set(backlog.allowedStatuses || []);
  for (const status of ['todo', 'in-progress', 'done', 'blocked']) {
    if (!allowedStatuses.has(status)) {
      fail(`First-wave backlog must allow status ${status}.`);
    }
  }

  const supportedThemes = new Map((themeSupport.themes || []).map((entry) => [entry.slug, entry]));
  const firstWaveThemeSet = new Set();

  for (const theme of backlog.themes || []) {
    firstWaveThemeSet.add(theme.slug);

    if (!supportedThemes.has(theme.slug)) {
      fail(`First-wave backlog references unknown theme slug: ${theme.slug}`);
      continue;
    }

    const supportEntry = supportedThemes.get(theme.slug);
    if (supportEntry.rolloutPriority !== 'first-wave') {
      fail(`First-wave backlog theme ${theme.slug} is not marked first-wave in theme support inventory.`);
    }

    if (!backlogDoc.includes(`\`${theme.slug}\``)) {
      fail(`First-wave rollout markdown is missing theme slug: ${theme.slug}`);
    }
  }

  const ids = new Set();
  for (const item of backlog.workItems || []) {
    if (!item.id || ids.has(item.id)) {
      fail(`Invalid or duplicate first-wave work item id: ${item.id}`);
      continue;
    }
    ids.add(item.id);

    if (!allowedStatuses.has(item.status)) {
      fail(`First-wave work item ${item.id} has invalid status ${item.status}`);
    }

    if (!firstWaveThemeSet.has(item.themeSlug)) {
      fail(`First-wave work item ${item.id} references theme outside first-wave scope: ${item.themeSlug}`);
    }

    if (!['Jiffoo', 'jiffoo-mall-mobile', 'jiffoo-mall-desktop'].includes(item.repo)) {
      fail(`First-wave work item ${item.id} has unknown repo ${item.repo}`);
    }
  }
}

if (
  ensureFile(catalogPath)
  && ensureFile(registryPath)
  && ensureFile(matrixPath)
  && ensureFile(themeSupportDocPath)
  && ensureFile(themeSupportJsonPath)
  && ensureFile(firstWaveRolloutPath)
  && ensureFile(firstWaveBacklogPath)
  && ensureFile(coreContractPath)
  && ensureFile(endpointOverviewPath)
) {
  const catalog = readJson(catalogPath);
  const registry = readJson(registryPath);
  const themeSupport = readJson(themeSupportJsonPath);
  const firstWaveBacklog = readJson(firstWaveBacklogPath);
  const documentedPaths = collectDocumentedPaths(readFile(endpointOverviewPath));
  const matrixRows = parseMatrix(readFile(matrixPath));
  const themeSupportDoc = readFile(themeSupportDocPath);
  const firstWaveRolloutDoc = readFile(firstWaveRolloutPath);

  validateCatalog(catalog, documentedPaths);
  validateRegistry(registry);
  checkMatrixAgainstRegistry(matrixRows, registry);
  validateThemeSupportInventory(themeSupport, themeSupportDoc);
  validateFirstWaveBacklog(firstWaveBacklog, firstWaveRolloutDoc, themeSupport);

  const profilesByTarget = {};

  for (const entry of registry.entries) {
    for (const target of ['mobile', 'desktop']) {
      if (profilesByTarget[target]) {
        continue;
      }
      const profilePathRef = entry.targets?.[target]?.profilePath;
      if (!profilePathRef) {
        continue;
      }
      const resolved = resolveCrossRepoProfile(profilePathRef);
      if (!resolved) {
        continue;
      }
      profilesByTarget[target] = validateStorefrontProfile(resolved, target);

      if (target === 'desktop' && profilesByTarget[target]?.linkedDesktopProfile) {
        const linkedPath = path.resolve(path.dirname(resolved), profilesByTarget[target].linkedDesktopProfile);
        if (!fs.existsSync(linkedPath)) {
          fail(`Desktop storefront profile references missing desktop profile: ${linkedPath}`);
        }
      }
    }
  }

  validateProfilesAgainstRegistry(profilesByTarget, registry);
}

if (warnings.length > 0) {
  for (const message of warnings) {
    console.warn(`WARN: ${message}`);
  }
}

if (failures.length > 0) {
  for (const message of failures) {
    console.error(`ERROR: ${message}`);
  }
  process.exit(1);
}

console.log('Theme client contracts look valid.');
if (warnings.length > 0) {
  console.log(`Completed with ${warnings.length} warning(s).`);
}
