import Ajv from 'ajv';
import type { Prisma } from '@prisma/client';
import { themeManifestSchema, type ThemeManifest, type ThemeTarget } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { resolveThemePackage, type ThemeFiles } from '@/core/storage/current-theme-package';
import { withThemeLeases, fenceThemeLeases, type ThemeLease } from '@/core/storage/theme-operation-lease';
import { readMediaFile } from '@/core/storage/uploaded-media-set';
import { ExtensionInstallerError } from './errors';
import { defaultHomeSections, validateHomeSections } from './theme-home-sections';

type Setting = ThemeManifest['settings'][number];
const ajv = new Ajv({ strict: false, allErrors: true });
const settingSchemas = ((themeManifestSchema.oneOf[0].properties.settings as unknown as {
  items: { oneOf: object[] };
}).items.oneOf)
  .map((schema) => ajv.compile(schema));
const locales = ['en', 'zh-Hans', 'zh-Hant'];

function fail(code: import('@/utils/api-errors').ErrorCode, _statusCode: number, path: string): never {
  throw new ExtensionInstallerError(`${code}: ${path}`, { code, details: { path } });
}

export async function audit(tx: { adminAuditEvent: { create: (args: any) => Promise<unknown> } }, actorId: string, action: string, targetId: string, summary: object = {}, targetType = 'theme') {
  await tx.adminAuditEvent.create({
    data: { actorId, action, targetType, targetId, summary },
  });
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

export async function getThemeConfig(slug: string) {
  const theme = await prisma.theme.findUnique({ where: { slug }, include: { configuration: true } });
  if (!theme) fail('THEME_NOT_FOUND', 404, slug);
  return {
    settings: (theme.manifestJson as unknown as ThemeManifest).settings,
    values: (theme.configuration?.values ?? {}) as Record<string, unknown>,
    revision: theme.configuration?.revision ?? 0,
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
    return { settings: manifest.settings, values: next, revision,
      homeSections: defaultHomeSections(manifest, next) };
  });
  });
}

export async function restoreThemeConfig(slug: string, actorId: string) {
  return withThemeLeases(null, slug, 'config-restore', async leases => {
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme) fail('THEME_NOT_FOUND', 404, slug);
  const pkg = await resolveThemePackage(slug, theme.packageHash);
  return prisma.$transaction(async (tx) => {
    await fenceThemeLeases(tx, leases);
    const current = await tx.themeConfiguration.findUnique({ where: { slug } });
    if (!current) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
    const prior = await tx.themeConfigRevision.findFirst({
      where: { slug, revision: { lt: current.revision } }, orderBy: { revision: 'desc' },
    });
    if (!prior) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
    await validateConfig(theme.manifestJson as unknown as ThemeManifest, prior.values as Record<string, unknown>, pkg);
    const revision = current.revision + 1;
    await tx.themeConfiguration.update({ where: { slug }, data: { revision, values: prior.values as Prisma.InputJsonValue } });
    await tx.themeConfigRevision.create({ data: { slug, revision, values: prior.values as Prisma.InputJsonValue } });
    await audit(tx, actorId, 'theme.config.restore', slug, { revision, fromRevision: prior.revision });
    return { values: prior.values, revision };
  });
  });
}

async function activateWithLeases(target: ThemeTarget, slug: string, actorId: string, action: string, leases: ThemeLease[], onlyIfEmpty = false) {
  if (onlyIfEmpty) {
    const current = await prisma.themeActive.findUnique({ where: { target } });
    if (current) return { target, slug: current.slug, packageHash: current.packageHash };
  }
  const candidate = await prisma.theme.findUnique({ where: { slug } });
  if (!candidate) fail('THEME_NOT_FOUND', 404, slug);
  if (candidate.target !== target) fail('THEME_TARGET_MISMATCH', 409, slug);
  await resolveThemePackage(slug, candidate.packageHash);
  return prisma.$transaction(async (tx) => {
    await fenceThemeLeases(tx, leases);
    const theme = await tx.theme.findUnique({ where: { slug } });
    if (!theme) fail('THEME_NOT_FOUND', 404, slug);
    if (theme.target !== target) fail('THEME_TARGET_MISMATCH', 409, slug);
    await tx.themeActive.upsert({
      where: { target }, create: { target, slug, packageHash: theme.packageHash }, update: { slug, packageHash: theme.packageHash },
    });
    await tx.themeActivation.create({ data: { target, slug, packageHash: theme.packageHash, actorId } });
    await audit(tx, actorId, action, slug, { target, packageHash: theme.packageHash });
    return { target, slug, packageHash: theme.packageHash };
  });
}

export async function activateTheme(target: ThemeTarget, slug: string, actorId: string, action = 'theme.activate', onlyIfEmpty = false) {
  return withThemeLeases(target, slug, 'activate', leases => activateWithLeases(target, slug, actorId, action, leases, onlyIfEmpty));
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
