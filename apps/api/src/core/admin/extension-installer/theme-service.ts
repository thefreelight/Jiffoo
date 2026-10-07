import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { themePackageStore } from '@/core/storage/plugin-package-store';
import { themePackageBlobStore } from '@/core/storage/theme-package-blob-store';
import { resolveThemePackage, ThemePackageResolutionError } from '@/core/storage/current-theme-package';
import { withThemeLeases, fenceThemeLeases } from '@/core/storage/theme-operation-lease';
import { packBuiltinPlugin } from './builtin-package';
import { ExtensionInstallerError } from './errors';
import { validateThemeFiles, validateThemeZip } from './theme-validator';
import { audit, validateConfig } from './theme-runtime';
import { validateHomeSections, type HomeSection } from './theme-home-sections';

function error(code: import('@/utils/api-errors').ErrorCode, message: string): never {
  throw new ExtensionInstallerError(message, { code });
}
function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

export async function installTheme(archive: Buffer, options: { source: 'builtin' | 'uploaded'; confirmUnsigned?: boolean; actorUserId?: string }) {
  const { manifest, files } = validateThemeZip(archive);
  const packageHash = createHash('sha256').update(archive).digest('hex');
  return withThemeLeases(manifest.target, manifest.slug, 'install', async leases => {
    const actor = options.source === 'uploaded' && options.actorUserId
      ? await prisma.user.findUnique({ where: { id: options.actorUserId } }) : null;
    if (options.source === 'uploaded' && (!options.confirmUnsigned || !actor))
      error('UNSIGNED_CONFIRMATION_REQUIRED', 'Unsigned themes require explicit merchant confirmation');
    const existing = await prisma.theme.findUnique({ where: { slug: manifest.slug } });
    if (existing?.source === 'builtin' && options.source !== 'builtin') error('THEME_BUILTIN_CONFLICT', 'Builtin theme cannot be replaced');
    if (existing && existing.target !== manifest.target) error('THEME_TARGET_CONFLICT', 'Theme cannot change target');
    if (existing) {
      const comparison = compareVersions(manifest.version, existing.version);
      if (options.source === 'builtin' && existing.source === 'builtin' && comparison < 0) return existing;
      if (comparison < 0 || comparison === 0 && (options.source !== 'builtin' || existing.packageHash !== packageHash))
        error('THEME_VERSION_CONFLICT', 'Theme changes require a higher version');
    }
    const directory = await themePackageStore.createTemporaryDirectory('theme-install');
    try {
      for (const [name, data] of files) {
        const destination = path.join(directory, name);
        await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, data);
      }
      await themePackageStore.put(manifest.slug, packageHash, directory);
      const candidate = { exists: async (name?: string) => name === undefined || files.has(name) };
      return await prisma.$transaction(async tx => {
        await fenceThemeLeases(tx, leases);
        const saved = await tx.theme.upsert({
          where: { slug: manifest.slug },
          create: { slug: manifest.slug, version: manifest.version, target: manifest.target, name: manifest.name,
            manifestJson: manifest as never, packageHash, source: options.source, trustLevel: options.source === 'builtin' ? 'builtin' : 'unsigned' },
          update: existing?.packageHash === packageHash ? {} : { version: manifest.version, name: manifest.name,
            manifestJson: manifest as never, packageHash, source: options.source, trustLevel: options.source === 'builtin' ? 'builtin' : 'unsigned' },
        });
        await themePackageBlobStore.put(tx, manifest.slug, packageHash, archive);
        if (existing?.packageHash === packageHash) return saved;
        if (actor) await tx.adminStaffAuditLog.create({ data: {
          staffUserId: actor.id, staffEmail: actor.email, staffUsername: actor.username,
          actorUserId: actor.id, actorEmail: actor.email, actorUsername: actor.username,
          action: 'THEME_UNSIGNED_INSTALL_CONFIRMED', metadata: { slug: manifest.slug, version: manifest.version, packageHash },
        } });
        const config = await tx.themeConfiguration.findUnique({ where: { slug: manifest.slug } });
        if (config) {
          const values: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(config.values as Record<string, unknown>)) {
            if (key === '$homeSections') {
              const retained: HomeSection[] = [];
              for (const [index, section] of (value as HomeSection[]).entries()) {
                try {
                  await validateHomeSections(manifest, [section], candidate, `/values/$homeSections/${index}`);
                  if (!retained.some(entry => entry.id === section.id)) retained.push(section);
                } catch (cause) { if (!(cause instanceof ExtensionInstallerError)) throw cause; }
              }
              values[key] = retained;
            } else {
              try { await validateConfig(manifest, { [key]: value }, candidate); values[key] = value; }
              catch (cause) { if (!(cause instanceof ExtensionInstallerError)) throw cause; }
            }
          }
          const revision = config.revision + 1;
          await tx.themeConfiguration.update({ where: { slug: manifest.slug }, data: { revision, values: values as never } });
          await tx.themeConfigRevision.create({ data: { slug: manifest.slug, revision, values: values as never } });
          await audit(tx, options.actorUserId ?? 'system', 'theme.config.migrated', manifest.slug, {
            revision, packageHash, dropped: Object.keys(config.values as object).filter(key => !(key in values)),
            droppedSections: '$homeSections' in values ? (config.values as Record<string, HomeSection[]>).$homeSections
              .filter(section => !(values.$homeSections as HomeSection[]).some(item => item.id === section.id)).map(section => section.id) : [],
          });
        }
        if ((await tx.themeActive.updateMany({ where: { slug: manifest.slug }, data: { packageHash } })).count) {
          await tx.themeActivation.create({ data: { target: manifest.target, slug: manifest.slug, packageHash, actorId: options.actorUserId ?? 'system' } });
        }
        await audit(tx, options.actorUserId ?? 'system', 'theme.install', manifest.slug, { version: manifest.version, source: options.source, packageHash });
        return saved;
      });
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
}

export async function installBuiltinTheme(directory: string) {
  await validateBuiltinTheme(directory);
  return installTheme((await packBuiltinPlugin(directory)).bytes, { source: 'builtin' });
}
export async function validateBuiltinTheme(directory: string) {
  const files = new Map<string, Buffer>();
  const visit = async (relative = ''): Promise<void> => {
    for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) files.set(name, await fs.readFile(path.join(directory, name)));
      else error('THEME_SYMLINK', name);
    }
  };
  await visit(); return validateThemeFiles(files);
}

export async function uninstallTheme(slug: string, actorId = 'system') {
  const initial = await prisma.theme.findUnique({ where: { slug } });
  if (!initial) error('THEME_NOT_FOUND', 'Theme not found');
  return withThemeLeases(initial.target, slug, 'uninstall', leases => prisma.$transaction(async tx => {
    await fenceThemeLeases(tx, leases);
    const theme = await tx.theme.findUnique({ where: { slug } });
    if (!theme) error('THEME_NOT_FOUND', 'Theme not found');
    if (theme.source === 'builtin') error('THEME_BUILTIN_CONFLICT', 'Builtin themes cannot be uninstalled');
    if (await tx.themeActive.findFirst({ where: { slug } })) error('THEME_ACTIVE', 'Active themes cannot be uninstalled');
    await tx.theme.delete({ where: { slug } });
    await audit(tx, actorId, 'theme.uninstall', slug);
    return { slug, deleted: true };
  }));
}

export async function readThemeAsset(slug: string, packageHash: string, relative: string) {
  if (!/^[a-f0-9]{64}$/.test(packageHash) || !/^(?:assets\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)|fonts\/[a-zA-Z0-9_/-]+\.woff2)$/.test(relative)
    || relative.split('/').some(part => part === '..' || part === '.')) return null;
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme) return null;
  if (!await prisma.themePackageBlob.count({ where: { themeSlug: slug, packageHash } })) {
    if (theme.packageHash === packageHash) throw new ThemePackageResolutionError('THEME_PACKAGE_UNAVAILABLE');
    return null;
  }
  const pkg = await resolveThemePackage(slug, packageHash);
  if (!await pkg.exists(relative)) return null;
  const content = await fs.readFile(pkg.getEntryPath(relative));
  const type = relative.endsWith('.woff2') ? 'font/woff2' : relative.endsWith('.png') ? 'image/png' : relative.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return { content, type, etag: `"${createHash('sha256').update(content).digest('hex')}"` };
}
