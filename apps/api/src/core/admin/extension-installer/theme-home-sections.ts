import Ajv from 'ajv';
import { merchantSectionSchemas, SECTION_TYPES, type ThemeManifest } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import type { ThemeFiles } from '@/core/storage/current-theme-package';
import { readMediaFile } from '@/core/storage/uploaded-media-set';
import { ExtensionInstallerError } from './errors';

export type HomeSection = { id: string; type: string; settings: Record<string, unknown> };
const validators = Object.fromEntries(Object.entries(merchantSectionSchemas)
  .map(([type, schema]) => [type, new Ajv({ strict: false, allErrors: true }).compile(schema)]));

const fail = (path: string): never => {
  throw new ExtensionInstallerError(`THEME_CONFIG_INVALID: ${path}`, {
    code: 'THEME_CONFIG_INVALID', statusCode: 400, details: { path },
  });
};

export function defaultHomeSections(manifest: ThemeManifest, values: Record<string, unknown>): HomeSection[] {
  if (manifest.target !== 'shop') return [];
  const defaults = Object.fromEntries(manifest.settings.map((setting) =>
    [setting.id, values[setting.id] ?? setting.default]));
  const literal = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(literal);
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (typeof record.$setting === 'string') return literal(defaults[record.$setting]);
      return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, literal(value)]));
    }
    return item;
  };
  return literal((manifest.layout as { pages: { home: { sections: HomeSection[] } } })
    .pages.home.sections) as HomeSection[];
}

export async function validateHomeSections(
  manifest: ThemeManifest, sections: unknown, pkg: ThemeFiles, base = '/homeSections',
): Promise<void> {
  if (manifest.target !== 'shop' || !Array.isArray(sections) || sections.length > 30) fail(base);
  const seen = new Set<string>();
  for (const [index, section] of (sections as unknown[]).entries()) {
    const path = `${base}/${index}`;
    const type = (section as HomeSection | null)?.type;
    if (!SECTION_TYPES.includes(type as typeof SECTION_TYPES[number])) fail(`${path}/type`);
    const validate = validators[type!];
    if (!validate(section)) {
      const error = validate.errors?.find((item) => !['anyOf', 'oneOf'].includes(item.keyword))
        ?? validate.errors?.[0];
      const property = error?.keyword === 'additionalProperties'
        ? `/${(error.params as { additionalProperty: string }).additionalProperty}` : '';
      fail(`${path}${error?.instancePath ?? ''}${property}`);
    }
    const item = section as HomeSection;
    if (seen.has(item.id)) fail(`${path}/id`);
    seen.add(item.id);
    const walk = async (value: unknown, location: string): Promise<void> => {
      if (Array.isArray(value)) {
        for (const [position, child] of value.entries()) await walk(child, `${location}/${position}`);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) await walk(child, `${location}/${key}`);
      } else if (typeof value === 'string' && value.startsWith('assets/')
        && (!pkg || !await pkg.exists(value))) fail(location);
      else if (typeof value === 'string' && value.startsWith('/uploads/')
        && !await readMediaFile(value.slice('/uploads/'.length))) fail(location);
    };
    await walk(item.settings, `${path}/settings`);
    const settings = item.settings;
    if (item.type === 'product-grid') {
      if (settings.source === 'category' && !settings.categoryId) fail(`${path}/settings/categoryId`);
      if (settings.source === 'manual' && !settings.productIds) fail(`${path}/settings/productIds`);
    }
    const categoryIds = [
      ...(item.type === 'category-list' ? (settings.categoryIds as string[] ?? []) : []),
      ...(item.type === 'product-grid' && settings.categoryId ? [settings.categoryId as string] : []),
    ];
    for (const [position, id] of categoryIds.entries()) {
      if (!await prisma.category.findUnique({ where: { id } }))
        fail(`${path}/settings/${item.type === 'category-list' ? `categoryIds/${position}` : 'categoryId'}`);
    }
    for (const [position, id] of ((settings.productIds as string[] | undefined) ?? []).entries()) {
      if (!await prisma.product.findUnique({ where: { id } }))
        fail(`${path}/settings/productIds/${position}`);
    }
  }
}
