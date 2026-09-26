import { inflateRawSync } from 'zlib';
import Ajv from 'ajv';
import {
  themeManifestSchema, type ThemeManifest, SHOP_COLOR_ROLES, ADMIN_COLOR_ROLES,
  SHOP_LENGTH_ROLES, SECTION_TYPES, themeSectionSchemas,
} from '@jiffoo/shared';
import { ExtensionInstallerError } from './errors';

const MAX_PACKAGE = 20 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_FONT = 2 * 1024 * 1024;
const MAX_MANIFEST = 256 * 1024;
const MAX_ENTRIES = 200;
const imagePath = /^assets\/[a-zA-Z0-9_/-]+\.(png|jpe?g|webp)$/;
const fontPath = /^fonts\/[a-zA-Z0-9_/-]+\.woff2$/;
const safePath = /^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[a-zA-Z0-9_./-]+$/;
const coreFonts = new Set(['system-sans', 'system-serif', 'outfit']);
const ajv = new Ajv({ allErrors: true, strict: false });
const validateShop = ajv.compile(themeManifestSchema.oneOf[0]);
const validateAdmin = ajv.compile(themeManifestSchema.oneOf[1]);
const validateSections = Object.fromEntries(
  Object.entries(themeSectionSchemas).map(([type, schema]) => [type, ajv.compile(schema)]),
);

export type ValidatedTheme = { manifest: ThemeManifest; files: Map<string, Buffer> };

function fail(code: string, location: string, statusCode = 400): never {
  throw new ExtensionInstallerError(`${code}: ${location}`, { code, statusCode, details: { path: location } });
}

function checkMagic(name: string, bytes: Buffer): void {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const valid = ext === 'png'
    ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : ext === 'jpg' || ext === 'jpeg'
      ? bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
      : ext === 'webp'
        ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        : ext === 'woff2'
          ? bytes.toString('ascii', 0, 4) === 'wOF2'
          : true;
  if (!valid) fail('THEME_MAGIC_MISMATCH', name);
}

function checkPath(name: string, directory: boolean): void {
  const normalized = directory ? name.slice(0, -1) : name;
  if (!safePath.test(normalized) || normalized.includes('\\') || normalized.includes(':'))
    fail('THEME_UNSAFE_PATH', name);
  if (directory) {
    if (normalized !== 'assets' && normalized !== 'fonts'
      && !normalized.startsWith('assets/') && !normalized.startsWith('fonts/'))
      fail('THEME_FORBIDDEN_ENTRY', name);
  } else if (name !== 'theme.json' && name !== 'LICENSE' && name !== 'README.md'
    && !imagePath.test(name) && !fontPath.test(name)) {
    fail('THEME_FORBIDDEN_ENTRY', name);
  }
}

function readZip(buffer: Buffer): Map<string, Buffer> {
  if (buffer.length > MAX_PACKAGE) fail('THEME_PACKAGE_TOO_LARGE', 'archive', 413);
  const end = buffer.lastIndexOf(Buffer.from('504b0506', 'hex'));
  if (end < 0 || end + 22 > buffer.length || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length)
    fail('THEME_INVALID_ZIP', 'archive');
  const count = buffer.readUInt16LE(end + 10);
  if (count > MAX_ENTRIES) fail('THEME_TOO_MANY_ENTRIES', 'archive', 413);
  if (buffer.readUInt16LE(end + 8) !== count || buffer.readUInt16LE(end + 4) !== 0
    || buffer.readUInt16LE(end + 6) !== 0) fail('THEME_INVALID_ZIP', 'archive');
  let offset = buffer.readUInt32LE(end + 16);
  const centralEnd = offset + buffer.readUInt32LE(end + 12);
  if (centralEnd !== end) fail('THEME_INVALID_ZIP', 'archive');
  const files = new Map<string, Buffer>();
  const seen = new Set<string>();
  let totalExpanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      fail('THEME_INVALID_ZIP', 'archive');
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const external = buffer.readUInt32LE(offset + 38);
    const unixMode = external >>> 16;
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd + extraLength + commentLength > end || size === 0xffffffff
      || compressed === 0xffffffff || localOffset === 0xffffffff || flags & 1
      || (method !== 0 && method !== 8)) fail('THEME_INVALID_ZIP', 'archive');
    const name = buffer.toString('utf8', offset + 46, nameEnd);
    if (Buffer.from(name).length !== nameLength) fail('THEME_INVALID_ZIP', name);
    const directory = name.endsWith('/');
    checkPath(name, directory);
    if ((unixMode & 0xf000) === 0xa000 || ((unixMode & 0xf000) !== 0 && (unixMode & 0xf000) !== (directory ? 0x4000 : 0x8000)))
      fail('THEME_SYMLINK', name);
    if (seen.has(name.toLowerCase())) fail('THEME_DUPLICATE_ENTRY', name);
    seen.add(name.toLowerCase());
    offset = nameEnd + extraLength + commentLength;
    if (directory) continue;
    const limit = name === 'theme.json' ? MAX_MANIFEST : fontPath.test(name) ? MAX_FONT : MAX_IMAGE;
    if (size > limit) fail(name === 'theme.json' ? 'THEME_MANIFEST_TOO_LARGE' : fontPath.test(name) ? 'THEME_FONT_TOO_LARGE' : 'THEME_IMAGE_TOO_LARGE', name, 413);
    totalExpanded += size;
    if (totalExpanded > 100 * 1024 * 1024) fail('THEME_EXPANDED_TOO_LARGE', name, 413);
    if (localOffset + 30 > centralEnd || buffer.readUInt32LE(localOffset) !== 0x04034b50)
      fail('THEME_INVALID_ZIP', name);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const dataStart = localOffset + 30 + localNameLength + buffer.readUInt16LE(localOffset + 28);
    if (buffer.toString('utf8', localOffset + 30, localOffset + 30 + localNameLength) !== name
      || dataStart + compressed > centralEnd) fail('THEME_INVALID_ZIP', name);
    let bytes: Buffer;
    try {
      bytes = method === 0 ? buffer.subarray(dataStart, dataStart + compressed)
        : inflateRawSync(buffer.subarray(dataStart, dataStart + compressed), { maxOutputLength: limit + 1 });
    } catch {
      fail('THEME_INVALID_ZIP', name);
    }
    if (bytes.length !== size || bytes.length > limit) fail('THEME_INVALID_ZIP', name);
    checkMagic(name, bytes);
    files.set(name, bytes);
  }
  if (offset !== centralEnd) fail('THEME_INVALID_ZIP', 'archive');
  return files;
}

function checkReferences(manifest: ThemeManifest, files: Map<string, Buffer>): void {
  const fontIds = new Set(coreFonts);
  for (const [index, font] of manifest.fonts.entries()) {
    if (fontIds.has(font.id)) fail('THEME_DUPLICATE_ID', `/fonts/${index}/id`);
    fontIds.add(font.id);
    if (!files.has(font.file)) fail('THEME_MISSING_FILE', `/fonts/${index}/file`);
  }
  const settings = new Map<string, string>();
  for (const [index, setting] of manifest.settings.entries()) {
    if (setting.id.startsWith('$')) fail('THEME_INVALID_SETTING', `/settings/${index}/id`);
    if (settings.has(setting.id)) fail('THEME_DUPLICATE_ID', `/settings/${index}/id`);
    settings.set(setting.id, setting.type);
    if (setting.bindsToken) {
      const role = setting.bindsToken;
      const colors: readonly string[] = manifest.target === 'shop' ? SHOP_COLOR_ROLES : ADMIN_COLOR_ROLES;
      const number = manifest.target === 'shop' && ['type-scale', 'heading-weight'].includes(role);
      const selectable = manifest.target === 'shop'
        ? ['button-style', 'font-body', 'font-heading'].includes(role)
        : ['density', 'font-body'].includes(role);
      if (!((colors.includes(role) && setting.type === 'color')
        || (number && setting.type === 'number')
        || (selectable && setting.type === 'select')))
        fail('THEME_INVALID_BINDING', `/settings/${index}/bindsToken`);
    }
    if (setting.type === 'image' && typeof setting.default === 'string'
      && setting.default.startsWith('assets/') && !files.has(setting.default))
      fail('THEME_MISSING_FILE', `/settings/${index}/default`);
    if (setting.type === 'select' && !(setting.constraints as { options: string[] }).options.includes(setting.default as string))
      fail('THEME_INVALID_SETTING', `/settings/${index}/default`);
    if (setting.type === 'number') {
      const { min, max } = setting.constraints as { min: number; max: number };
      if (min > max || (setting.default as number) < min || (setting.default as number) > max)
        fail('THEME_INVALID_SETTING', `/settings/${index}/default`);
    }
  }
  for (const [role, raw] of Object.entries(manifest.tokens)) {
    if (role.startsWith('font-') && !fontIds.has(raw as string))
      fail('THEME_UNKNOWN_FONT', `/tokens/${role}`);
    if ((manifest.target === 'shop' && (SHOP_LENGTH_ROLES as readonly string[]).includes(role))
      || (manifest.target === 'admin' && ['radius-sm', 'radius-md', 'radius-lg'].includes(role))) {
      const match = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(raw as string);
      if (!match || Number(match[1]) > (role === 'container-width' && match[2] === 'px' ? 1600 : 128))
        fail('THEME_INVALID_TOKEN', `/tokens/${role}`);
    }
    if (role === 'card-shadow') {
      const shadow = raw as Record<string, string>;
      for (const key of ['x', 'y', 'blur', 'spread']) {
        const match = /^(-?\d+(?:\.\d+)?)(px|rem)$/.exec(shadow[key]);
        if (!match || Math.abs(Number(match[1])) > 128 || (key === 'blur' && Number(match[1]) < 0))
          fail('THEME_INVALID_TOKEN', `/tokens/${role}/${key}`);
      }
    }
  }
  for (const [key, asset] of Object.entries(manifest.assets))
    if (!files.has(asset)) fail('THEME_MISSING_FILE', `/assets/${key}`);
  const walk = (value: unknown, location: string, key = ''): void => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => walk(child, `${location}/${index}`, key));
    } else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if ('$setting' in record) {
        const referenced = settings.get(record.$setting as string);
        if (!referenced) fail('THEME_UNKNOWN_SETTING', `${location}/$setting`);
        const expected: Record<string, string> = {
          text: 'text', title: 'text', body: 'text', image: 'image', link: 'link',
          categoryId: 'category', productIds: 'product-list', source: 'select',
        };
        if (!expected[key] || expected[key] !== referenced)
          fail('THEME_SETTING_TYPE_MISMATCH', `${location}/$setting`);
      } else {
        for (const [childKey, child] of Object.entries(record))
          walk(child, `${location}/${childKey}`, childKey);
      }
    } else if (typeof value === 'string' && value.startsWith('assets/') && !files.has(value)) {
      fail('THEME_MISSING_FILE', location);
    }
  };
  if (manifest.layout) {
    const layout = manifest.layout as { pages: { home: { sections: Array<{ type: string; settings: Record<string, unknown> }> } } };
    const allSections = [
      ...layout.pages.home.sections,
      ...Object.values((manifest.layout as { slots: Record<string, Array<{ type: string; settings: Record<string, unknown> }>> }).slots).flat(),
    ];
    for (const section of allSections) {
      if (section.type !== 'product-grid') continue;
      if (section.settings.source === 'category' && !section.settings.categoryId)
        fail('THEME_INVALID_SECTION', `/layout/pages/home/sections/${layout.pages.home.sections.indexOf(section)}/settings/categoryId`);
      if (section.settings.source === 'manual' && !section.settings.productIds)
        fail('THEME_INVALID_SECTION', `/layout/pages/home/sections/${layout.pages.home.sections.indexOf(section)}/settings/productIds`);
    }
    walk(manifest.layout, '/layout');
  }
}

function checkSectionSchemas(parsed: unknown): void {
  const manifest = parsed as { target?: string; layout?: {
    pages?: { home?: { sections?: unknown } }; slots?: Record<string, unknown>;
  } } | null;
  if (manifest?.target !== 'shop' || !manifest.layout) return;
  const locations: Array<[string, unknown]> = [
    ['/layout/pages/home/sections', manifest.layout.pages?.home?.sections],
    ...Object.entries(manifest.layout.slots ?? {}).map(([key, value]): [string, unknown] =>
      [`/layout/slots/${key}`, value]),
  ];
  for (const [location, list] of locations) {
    if (!Array.isArray(list)) continue;
    for (const [index, item] of list.entries()) {
      if (!item || typeof item !== 'object') continue;
      const type = (item as { type?: string }).type;
      if (!SECTION_TYPES.includes(type as typeof SECTION_TYPES[number]))
        fail('THEME_SCHEMA_INVALID', `${location}/${index}/type`);
      const validate = validateSections[type!];
      if (validate(item)) continue;
      const errors = validate.errors ?? [];
      const candidate = errors.find((entry) => !['anyOf', 'oneOf'].includes(entry.keyword)) ?? errors[0];
      const property = candidate?.keyword === 'additionalProperties'
        ? `/${(candidate.params as { additionalProperty: string }).additionalProperty}` : '';
      fail('THEME_SCHEMA_INVALID', `${location}/${index}${candidate?.instancePath ?? ''}${property}`);
    }
  }
}

export function validateThemeFiles(files: Map<string, Buffer>): ValidatedTheme {
  if (files.size > MAX_ENTRIES) fail('THEME_TOO_MANY_ENTRIES', 'archive', 413);
  for (const [name, bytes] of files) {
    checkPath(name, false);
    const limit = name === 'theme.json' ? MAX_MANIFEST : fontPath.test(name) ? MAX_FONT : MAX_IMAGE;
    if (bytes.length > limit) fail('THEME_FILE_TOO_LARGE', name, 413);
    checkMagic(name, bytes);
  }
  const bytes = files.get('theme.json');
  if (!bytes) fail('THEME_MISSING_MANIFEST', 'theme.json');
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { fail('THEME_INVALID_JSON', 'theme.json'); }
  const declaredSettings = (parsed as { settings?: Array<{ id?: unknown }> } | null)?.settings;
  if (Array.isArray(declaredSettings)) {
    for (const [index, setting] of declaredSettings.entries())
      if (typeof setting?.id === 'string' && setting.id.startsWith('$'))
        fail('THEME_INVALID_SETTING', `/settings/${index}/id`);
  }
  checkSectionSchemas(parsed);
  const validateSchema = (parsed as { target?: string } | null)?.target === 'admin'
    ? validateAdmin : validateShop;
  if (!validateSchema(parsed)) {
    const candidates = validateSchema.errors ?? [];
    const error = [...candidates]
      .filter((candidate) => !['const', 'oneOf', 'anyOf'].includes(candidate.keyword))
      .sort((left, right) => right.instancePath.length - left.instancePath.length)[0]
      ?? candidates.find((candidate) => candidate.keyword === 'const')
      ?? candidates[0];
    const location = `${error?.instancePath || ''}${error?.keyword === 'additionalProperties'
      ? `/${(error.params as { additionalProperty: string }).additionalProperty}` : ''}` || '/';
    fail('THEME_SCHEMA_INVALID', location);
  }
  const manifest = parsed as ThemeManifest;
  checkReferences(manifest, files);
  return { manifest, files };
}

export function validateThemeZip(buffer: Buffer): ValidatedTheme {
  return validateThemeFiles(readZip(buffer));
}
