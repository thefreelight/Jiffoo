import Ajv from 'ajv';
import type { Prisma } from '@prisma/client';
import { themeManifestSchema, type ThemeManifest, type ThemeTarget } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { themePackageStore } from '@/core/storage/plugin-package-store';
import { uploadedFileStore } from '@/core/storage/uploaded-file-store';
import { ExtensionInstallerError } from './errors';

type Setting = ThemeManifest['settings'][number];
const ajv = new Ajv({ strict: false, allErrors: true });
const settingSchemas = ((themeManifestSchema.oneOf[0].properties.settings as unknown as {
  items: { oneOf: object[] };
}).items.oneOf)
  .map((schema) => ajv.compile(schema));
const locales = ['en', 'zh-Hans', 'zh-Hant'];

function fail(code: string, statusCode: number, path: string): never {
  throw new ExtensionInstallerError(`${code}: ${path}`, { code, statusCode, details: { path } });
}

export async function audit(tx: { adminAuditEvent: { create: (args: any) => Promise<unknown> } }, actorId: string, action: string, targetId: string, summary: object = {}) {
  await tx.adminAuditEvent.create({
    data: { actorId, action, targetType: 'theme', targetId, summary },
  });
}

export async function validateConfig(manifest: ThemeManifest, values: Record<string, unknown>): Promise<void> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail('THEME_CONFIG_INVALID', 400, '/values');
  const settings = new Map(manifest.settings.map((setting) => [setting.id, setting]));
  for (const [key, value] of Object.entries(values)) {
    const path = `/values/${key}`;
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
      const pkg = await themePackageStore.get(manifest.slug);
      if (!pkg || !await pkg.exists(value)) fail('THEME_CONFIG_INVALID', 400, path);
    }
    if (setting.type === 'image' && typeof value === 'string' && value.startsWith('/uploads/')
      && !await uploadedFileStore.get(value.slice('/uploads/'.length)))
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
  };
}

export async function saveThemeConfig(slug: string, values: Record<string, unknown>, expectedRevision: number, actorId: string) {
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme) fail('THEME_NOT_FOUND', 404, slug);
  await validateConfig(theme.manifestJson as unknown as ThemeManifest, values);
  return prisma.$transaction(async (tx) => {
    const current = await tx.themeConfiguration.findUnique({ where: { slug } });
    if ((current?.revision ?? 0) !== expectedRevision)
      fail('THEME_CONFIG_CONFLICT', 409, '/expectedRevision');
    const revision = expectedRevision + 1;
    if (current) {
      const changed = await tx.themeConfiguration.updateMany({
        where: { slug, revision: expectedRevision }, data: { revision, values: values as Prisma.InputJsonObject },
      });
      if (changed.count !== 1) fail('THEME_CONFIG_CONFLICT', 409, '/expectedRevision');
    } else {
      await tx.themeConfiguration.create({ data: { slug, revision, values: values as Prisma.InputJsonObject } });
    }
    await tx.themeConfigRevision.create({ data: { slug, revision, values: values as Prisma.InputJsonObject } });
    await audit(tx, actorId, 'theme.config.update', slug, { revision });
    return { settings: (theme.manifestJson as unknown as ThemeManifest).settings, values, revision };
  });
}

export async function restoreThemeConfig(slug: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.themeConfiguration.findUnique({ where: { slug } });
    if (!current) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
    const prior = await tx.themeConfigRevision.findFirst({
      where: { slug, revision: { lt: current.revision } }, orderBy: { revision: 'desc' },
    });
    if (!prior) fail('THEME_CONFIG_NO_PREVIOUS', 409, slug);
    const revision = current.revision + 1;
    await tx.themeConfiguration.update({ where: { slug }, data: { revision, values: prior.values as Prisma.InputJsonValue } });
    await tx.themeConfigRevision.create({ data: { slug, revision, values: prior.values as Prisma.InputJsonValue } });
    await audit(tx, actorId, 'theme.config.restore', slug, { revision, fromRevision: prior.revision });
    return { values: prior.values, revision };
  });
}

export async function activateTheme(target: ThemeTarget, slug: string, actorId: string, action = 'theme.activate') {
  return prisma.$transaction(async (tx) => {
    const theme = await tx.theme.findUnique({ where: { slug } });
    if (!theme) fail('THEME_NOT_FOUND', 404, slug);
    if (theme.target !== target) fail('THEME_TARGET_MISMATCH', 409, slug);
    await tx.themeActive.upsert({
      where: { target }, create: { target, slug }, update: { slug },
    });
    await tx.themeActivation.create({ data: { target, slug, actorId } });
    await audit(tx, actorId, action, slug, { target });
    return { target, slug };
  });
}

export async function restorePreviousTheme(target: ThemeTarget, actorId: string) {
  const active = await prisma.themeActive.findUnique({ where: { target } });
  const history = await prisma.themeActivation.findMany({
    where: { target }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  for (const entry of history) {
    if (entry.slug === active?.slug) continue;
    if (await prisma.theme.findUnique({ where: { slug: entry.slug } }))
      return activateTheme(target, entry.slug, actorId, 'theme.restore_previous');
  }
  fail('THEME_NO_PREVIOUS', 409, target);
}
