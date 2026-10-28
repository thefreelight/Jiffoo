import Ajv from 'ajv';
import type { Prisma } from '@prisma/client';
import { themeManifestSchema, builtinFontStacks, type ThemeManifest, type ThemeTarget } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { resolveThemePackage, type ThemeFiles } from '@/core/storage/current-theme-package';
import { withThemeLeases, fenceThemeLeases, type ThemeLease } from '@/core/storage/theme-operation-lease';
import { acquirePluginOperationLease, releasePluginOperationLease } from '@/core/storage/plugin-operation-lease';
import { readMediaFile } from '@/core/storage/uploaded-media-set';
import { AuditService, type AuditTx } from '@/core/audit/service';
import { ApiError } from '@/utils/api-errors';
import { ExtensionInstallerError } from '@/core/extensions/shared/errors';
import { validateThemeManifest } from '@/core/storage/theme-validator';
import { defaultHomeSections, validateHomeSections } from './theme-home-sections';
import { themePackageState } from './theme-package-state';

type Setting = ThemeManifest['settings'][number];
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * A transaction the caller owns.
 *
 * A caller that hands its own transaction to a theme operation owns the theme
 * operation leases as well: it acquires them before the transaction opens,
 * fences them inside the transaction and releases them after the transaction
 * resolved. A lease row that the transaction holds with `FOR UPDATE` cannot
 * be deleted by another connection, so the release has to wait for the commit.
 */
export type ThemeTransaction = { tx: Transaction; leases: ThemeLease[] };
const ajv = new Ajv({ strict: false, allErrors: true });
const settingSchemas = ((themeManifestSchema.oneOf[0].properties.settings as unknown as {
  items: { oneOf: object[] };
}).items.oneOf)
  .map((schema) => ajv.compile(schema));
const locales = ['en', 'zh-Hans', 'zh-Hant'];

function fail(code: import('@/utils/api-errors').ErrorCode, _statusCode: number, path: string): never {
  throw new ExtensionInstallerError(`${code}: ${path}`, { code, details: { path } });
}

export async function audit(tx: AuditTx, actorId: string, action: string, targetId: string, summary: object = {}, targetType = 'theme') {
  await AuditService.write(tx, { actorId, action, targetType, targetId, summary: summary as Prisma.InputJsonValue });
}

export async function validateConfig(manifest: ThemeManifest, values: Record<string, unknown>, pkg: ThemeFiles): Promise<void> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail('THEME_CONFIG_INVALID', 400, '/values');
  const settings = new Map(manifest.settings.map((setting) => [setting.id, setting]));
  for (const [key, value] of Object.entries(values)) {
    const path = `/values/${key}`;
    if (key === '$homeSections') {
      await validateHomeSections(manifest, value, pkg, path);
      continue;
    }
    const setting = settings.get(key);
    if (!setting) fail('THEME_CONFIG_INVALID', 400, path);
    const validator = settingSchemas.find((candidate) =>
      (candidate.schema as { properties: { type: { const: string } } }).properties.type.const === setting.type);
    if (!validator?.({ ...setting, default: value })) fail('THEME_CONFIG_INVALID', 400, path);
    if (setting.bindsToken) {
      const [group, role] = setting.bindsToken.split('.');
      const tokens = { core: { ...manifest.tokens.core }, extras: { ...manifest.tokens.extras } };
      tokens[group as 'core' | 'extras'][role] = value;
      try { validateThemeManifest({ ...manifest, tokens }); }
      catch (cause) { if (!(cause instanceof ExtensionInstallerError)) throw cause; fail('THEME_CONFIG_INVALID', 400, path); }
      if (group === 'core' && role.startsWith('font-') && ![...Object.keys(builtinFontStacks), ...manifest.fonts.map(font => font.id)].includes(value as string))
        fail('THEME_CONFIG_INVALID', 400, path);
    }
    const constraints = setting.constraints as Record<string, any>;
    if (setting.type === 'text') {
      if (locales.some((locale) => typeof (value as Record<string, unknown>)[locale] !== 'string'
        || ((value as Record<string, string>)[locale]).length > constraints.maxLength))
        fail('THEME_CONFIG_INVALID', 400, path);
    }
    if (setting.type === 'number') {
      const number = value as number;
      if (number < constraints.min || number > constraints.max
        || Math.abs((number - constraints.min) / constraints.step
          - Math.round((number - constraints.min) / constraints.step)) > 1e-8)
        fail('THEME_CONFIG_INVALID', 400, path);
    }
    if (setting.type === 'select' && !constraints.options.includes(value))
      fail('THEME_CONFIG_INVALID', 400, path);
    if (setting.type === 'product-list' && (value as unknown[]).length > constraints.maxItems)
      fail('THEME_CONFIG_INVALID', 400, path);
    if (setting.type === 'image' && typeof value === 'string' && value.startsWith('assets/')) {
      if (!pkg || !await pkg.exists(value)) fail('THEME_CONFIG_INVALID', 400, path);
    }
    if (setting.type === 'image' && typeof value === 'string' && value.startsWith('/uploads/')
      && !await readMediaFile(value.slice('/uploads/'.length)))
      fail('THEME_CONFIG_INVALID', 400, path);
    if (setting.type === 'category' && !await prisma.category.findUnique({ where: { id: value as string } }))
      fail('THEME_CONFIG_INVALID', 400, path);
    if (setting.type === 'product-list') {
      const ids = value as string[];
      if (await prisma.product.count({ where: { id: { in: ids } } }) !== new Set(ids).size)
        fail('THEME_CONFIG_INVALID', 400, path);
    }
  }
}

// Invalid persisted values are ignored without changing configuration or revision history.
export async function validStoredThemeValues(manifest: ThemeManifest, raw: unknown, pkg: ThemeFiles): Promise<Record<string, unknown>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    try { await validateConfig(manifest, { [key]: value }, pkg); values[key] = value; }
    catch (cause) { if (!(cause instanceof ExtensionInstallerError)) throw cause; }
  }
  return values;
}

export async function getThemeConfig(slug: string) {
  const theme = await prisma.theme.findUnique({ where: { slug }, include: { configuration: true } });
  if (!theme) fail('THEME_NOT_FOUND', 404, slug);
  return {
    settings: (theme.manifestJson as unknown as ThemeManifest).settings,
    values: (theme.configuration?.values ?? {}) as Record<string, unknown>,
    revision: theme.configuration?.revision ?? 0,
    configurationSavedAt: theme.configuration?.updatedAt.toISOString() ?? null,
    homeSections: defaultHomeSections(theme.manifestJson as unknown as ThemeManifest,
      (theme.configuration?.values ?? {}) as Record<string, unknown>),
  };
}

export async function saveThemeConfig(
  slug: string, values: Record<string, unknown>, expectedRevision: number, actorId: string,
  homeSections?: unknown,
) {
  return withThemeLeases(null, slug, 'config-update', async leases => {
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme) fail('THEME_NOT_FOUND', 404, slug);
  const manifest = theme.manifestJson as unknown as ThemeManifest;
  const pkg = await resolveThemePackage(slug, theme.packageHash);
  const current = await prisma.themeConfiguration.findUnique({ where: { slug } });
  const next = { ...values };
  if (homeSections !== undefined) {
    if (homeSections === null) delete next.$homeSections;
    else {
      await validateHomeSections(manifest, homeSections, pkg);
      next.$homeSections = homeSections;
    }
  } else if ('$homeSections' in ((current?.values ?? {}) as object))
    next.$homeSections = ((current!.values as Record<string, unknown>).$homeSections);
  await validateConfig(manifest, next, pkg);
  return prisma.$transaction(async (tx) => {
    await fenceThemeLeases(tx, leases);
    const current = await tx.themeConfiguration.findUnique({ where: { slug } });
    if ((current?.revision ?? 0) !== expectedRevision)
      fail('THEME_CONFIG_CONFLICT', 409, '/expectedRevision');
    const revision = expectedRevision + 1;
    if (current) {
      const changed = await tx.themeConfiguration.updateMany({
        where: { slug, revision: expectedRevision }, data: { revision, values: next as Prisma.InputJsonObject },
      });
      if (changed.count !== 1) fail('THEME_CONFIG_CONFLICT', 409, '/expectedRevision');
    } else {
      await tx.themeConfiguration.create({ data: { slug, revision, values: next as Prisma.InputJsonObject } });
      const defaults = Object.fromEntries(
        (theme.manifestJson as unknown as ThemeManifest).settings.map((setting) => [setting.id, setting.default]),
      );
      await tx.themeConfigRevision.create({
        data: { slug, revision: 0, values: defaults as Prisma.InputJsonObject },
      });
    }
    await tx.themeConfigRevision.create({ data: { slug, revision, values: next as Prisma.InputJsonObject } });
    await audit(tx, actorId, 'theme.config.update', slug, { revision });
    const saved = await tx.themeConfiguration.findUniqueOrThrow({ where: { slug } });
    return { settings: manifest.settings, values: next, revision, configurationSavedAt: saved.updatedAt.toISOString(),
      homeSections: defaultHomeSections(manifest, next) };
  });
  });
}

export async function restoreThemeConfig(slug: string, actorId: string) {
  return withThemeLeases(null, slug, 'config-restore', async leases => {
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme) fail('THEME_NOT_FOUND', 404, slug);
  const pkg = await resolveThemePackage(slug, theme.packageHash);
  const candidateCurrent = await prisma.themeConfiguration.findUnique({ where: { slug } });
  if (!candidateCurrent) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
  const candidatePrior = await prisma.themeConfigRevision.findFirst({
    where: { slug, revision: { lt: candidateCurrent.revision } }, orderBy: { revision: 'desc' },
  });
  if (!candidatePrior) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
  await validateConfig(theme.manifestJson as unknown as ThemeManifest, candidatePrior.values as Record<string, unknown>, pkg);
  return prisma.$transaction(async (tx) => {
    await fenceThemeLeases(tx, leases);
    const currentTheme = await tx.theme.findUnique({ where: { slug } });
    if (!currentTheme) fail('THEME_NOT_FOUND', 404, slug);
    if (currentTheme.packageHash !== theme.packageHash
      || JSON.stringify(currentTheme.manifestJson) !== JSON.stringify(theme.manifestJson))
      fail('THEME_CONFIG_CONFLICT', 409, '/expectedRevision');
    const current = await tx.themeConfiguration.findUnique({ where: { slug } });
    if (!current) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
    if (current.revision !== candidateCurrent.revision)
      fail('THEME_CONFIG_CONFLICT', 409, '/expectedRevision');
    const prior = await tx.themeConfigRevision.findFirst({
      where: { slug, revision: { lt: current.revision } }, orderBy: { revision: 'desc' },
    });
    if (!prior) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
    if (prior.revision !== candidatePrior.revision
      || JSON.stringify(prior.values) !== JSON.stringify(candidatePrior.values))
      fail('THEME_CONFIG_CONFLICT', 409, '/expectedRevision');
    const revision = current.revision + 1;
    const saved = await tx.themeConfiguration.update({ where: { slug }, data: { revision, values: prior.values as Prisma.InputJsonValue } });
    await tx.themeConfigRevision.create({ data: { slug, revision, values: prior.values as Prisma.InputJsonValue } });
    await audit(tx, actorId, 'theme.config.restore', slug, { revision, fromRevision: prior.revision });
    return { values: prior.values, revision, configurationSavedAt: saved.updatedAt.toISOString() };
  });
  });
}

/**
 * A prepared theme activation.
 *
 * Preparing an activation reads the theme row and resolves its package. That
 * is filesystem work, so it happens outside every transaction. Writing the
 * activation switches the active pointer and writes its audit, and that is
 * the only part that belongs inside a transaction.
 */
export type ThemeActivationPlan = {
  target: ThemeTarget;
  slug: string;
  /** The outcome of an activation that writes nothing, or null when it writes. */
  unchanged: { target: ThemeTarget; slug: string; packageHash: string } | null;
  /** Switch the active pointer and write the audit inside the given transaction. */
  write(tx: Transaction, leases: ThemeLease[]): Promise<{ target: ThemeTarget; slug: string; packageHash: string }>;
};

/**
 * Prepare a theme activation outside every transaction.
 *
 * The preparation resolves the theme row and its package, so it never holds a
 * connection while it reads the package store. The write of the plan is the
 * only part that touches the database.
 */
export async function prepareThemeActivation(
  target: ThemeTarget,
  slug: string,
  actorId: string,
  action: string,
  onlyIfEmpty = false,
): Promise<ThemeActivationPlan> {
  if (onlyIfEmpty) {
    const current = await prisma.themeActive.findUnique({ where: { target } });
    if (current) {
      // The target already has an active theme: the activation writes nothing.
      const unchanged = { target, slug: current.slug, packageHash: current.packageHash };
      return { target, slug: current.slug, unchanged, write: async () => unchanged };
    }
  }
  const candidate = await prisma.theme.findUnique({ where: { slug } });
  if (!candidate) fail('THEME_NOT_FOUND', 404, slug);
  if (candidate.target !== target) fail('THEME_TARGET_MISMATCH', 409, slug);
  const state = await themePackageState(candidate, undefined, true);
  if (state.code) fail(state.code, 409, slug);
  validateThemeManifest(candidate.manifestJson);
  await resolveThemePackage(slug, candidate.packageHash);
  return {
    target,
    slug,
    unchanged: null,
    write: async (tx, leases) => {
      await fenceThemeLeases(tx, leases);
      if (onlyIfEmpty) {
        // An earlier activation of the same transaction may have activated a
        // theme for the target already.
        const current = await tx.themeActive.findUnique({ where: { target } });
        if (current) return { target, slug: current.slug, packageHash: current.packageHash };
      }
      const theme = await tx.theme.findUnique({ where: { slug } });
      if (!theme) fail('THEME_NOT_FOUND', 404, slug);
      if (theme.target !== target) fail('THEME_TARGET_MISMATCH', 409, slug);
      await tx.themeActive.upsert({
        where: { target }, create: { target, slug, packageHash: theme.packageHash }, update: { slug, packageHash: theme.packageHash },
      });
      await tx.themeActivation.create({ data: { target, slug, packageHash: theme.packageHash, actorId } });
      await audit(tx, actorId, action, slug, { target, packageHash: theme.packageHash });
      return { target, slug, packageHash: theme.packageHash };
    },
  };
}

/**
 * Activate a theme with the leases the caller owns.
 *
 * The preparation runs outside the transaction, so the transaction holds the
 * pointer switch and its audit only.
 */
async function activateWithLeases(target: ThemeTarget, slug: string, actorId: string, action: string, leases: ThemeLease[], onlyIfEmpty = false) {
  const plan = await prepareThemeActivation(target, slug, actorId, action, onlyIfEmpty);
  if (plan.unchanged) return plan.unchanged;
  return prisma.$transaction(tx => plan.write(tx, leases));
}

/**
 * The theme operation leases of a set of themes.
 *
 * The resources are the ones the theme operations fence: the target of the
 * theme and the package of the theme. Every caller acquires the target before
 * the package.
 */
export async function acquireThemeLeases(themes: Array<{ target: string; slug: string }>, operation = 'activate'): Promise<ThemeLease[]> {
  const resources: string[] = [];
  for (const theme of themes) {
    for (const resource of [`theme:target:${theme.target}`, `theme:package:${theme.slug}`]) {
      if (!resources.includes(resource)) resources.push(resource);
    }
  }
  const leases: ThemeLease[] = [];
  try {
    for (const resource of resources) {
      try { leases.push({ resource, token: await acquirePluginOperationLease(resource, operation) }); }
      catch (error) { mappedLeaseError(error); }
    }
    return leases;
  } catch (error) {
    await releaseThemeLeases(leases);
    throw error;
  }
}

/** Release the theme operation leases of a set of themes. */
export async function releaseThemeLeases(leases: ThemeLease[]): Promise<void> {
  for (const lease of [...leases].reverse()) await releasePluginOperationLease(lease.resource, lease.token);
}

function mappedLeaseError(error: unknown): never {
  if (error instanceof ApiError && error.code === 'PLUGIN_OPERATION_IN_PROGRESS') throw new ApiError('THEME_OPERATION_IN_PROGRESS');
  if (error instanceof ApiError && error.code === 'PLUGIN_OPERATION_LEASE_LOST') throw new ApiError('THEME_OPERATION_LEASE_LOST');
  throw error;
}

/**
 * Activate a theme.
 *
 * Without a transaction of its own the activation runs in a short transaction
 * of its own. A caller that owns a transaction prepares the activation outside
 * it and hands the plan over with its theme operation leases, so the pointer
 * switch and its audit join that transaction.
 */
export async function activateTheme(
  target: ThemeTarget,
  slug: string,
  actorId: string,
  action = 'theme.activate',
  onlyIfEmpty = false,
  options?: {
    /** A transaction the caller owns. The pointer switch and its audit join it. */
    transaction?: ThemeTransaction;
    /** The activation the caller prepared outside the transaction. */
    plan?: ThemeActivationPlan;
  },
) {
  const run = async (leases: ThemeLease[]) => {
    const plan = options?.plan ?? await prepareThemeActivation(target, slug, actorId, action, onlyIfEmpty);
    if (plan.unchanged) return plan.unchanged;
    if (options?.transaction) return plan.write(options.transaction.tx, options.transaction.leases);
    return prisma.$transaction(tx => plan.write(tx, leases));
  };
  if (options?.transaction) return run(options.transaction.leases);
  return withThemeLeases(target, slug, 'activate', run);
}

export async function restorePreviousTheme(target: ThemeTarget, actorId: string) {
  return withThemeLeases(target, null, 'restore-previous', async targetLeases => {
  const active = await prisma.themeActive.findUnique({ where: { target } });
  const history = await prisma.themeActivation.findMany({
    where: { target }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  for (const entry of history) {
    if (entry.slug === active?.slug) continue;
    if (await prisma.theme.findUnique({ where: { slug: entry.slug } }))
      return withThemeLeases(null, entry.slug, 'restore-previous', leases => activateWithLeases(target, entry.slug, actorId, 'theme.restore_previous', [...targetLeases, ...leases]));
  }
  fail('THEME_NO_PREVIOUS', 409, target);
  });
}
