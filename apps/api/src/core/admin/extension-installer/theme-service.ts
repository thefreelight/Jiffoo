import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { themePackageStore } from '@/core/storage/plugin-package-store';
import { ExtensionInstallerError } from './errors';
import { validateThemeFiles, validateThemeZip } from './theme-validator';

function error(code: string, message: string, statusCode = 400): never {
  throw new ExtensionInstallerError(message, { code, statusCode });
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export async function installTheme(
  archive: Buffer,
  options: { source: 'builtin' | 'uploaded'; confirmUnsigned?: boolean; actorUserId?: string },
) {
  const { manifest, files } = validateThemeZip(archive);
  if (options.source === 'uploaded') {
    if (!options.confirmUnsigned || !options.actorUserId)
      error('UNSIGNED_CONFIRMATION_REQUIRED', 'Unsigned themes require explicit merchant confirmation');
    const actor = await prisma.user.findUnique({ where: { id: options.actorUserId } });
    if (!actor) error('UNSIGNED_CONFIRMATION_REQUIRED', 'An Admin actor is required');
    await prisma.adminStaffAuditLog.create({
      data: {
        staffUserId: actor.id, staffEmail: actor.email, staffUsername: actor.username,
        actorUserId: actor.id, actorEmail: actor.email, actorUsername: actor.username,
        action: 'THEME_UNSIGNED_INSTALL_CONFIRMED',
        metadata: { slug: manifest.slug, version: manifest.version },
      },
    });
  }
  const existing = await prisma.theme.findUnique({ where: { slug: manifest.slug } });
  if (existing && compareVersions(manifest.version, existing.version) <= 0)
    error('THEME_VERSION_CONFLICT', `Theme "${manifest.slug}" requires a higher version`, 409);
  if (existing?.source === 'builtin' && options.source !== 'builtin')
    error('THEME_BUILTIN_CONFLICT', `Builtin theme "${manifest.slug}" cannot be replaced by an upload`, 409);
  if (existing && existing.target !== manifest.target)
    error('THEME_TARGET_CONFLICT', `Theme "${manifest.slug}" cannot change target`, 409);
  const directory = await themePackageStore.createTemporaryDirectory('theme-install');
  let deployment: Awaited<ReturnType<typeof themePackageStore.put>> | null = null;
  try {
    for (const [name, data] of files) {
      const destination = path.join(directory, name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, data);
    }
    deployment = await themePackageStore.put(manifest.slug, directory);
    const record = await prisma.theme.upsert({
      where: { slug: manifest.slug },
      create: {
        slug: manifest.slug, version: manifest.version, target: manifest.target, name: manifest.name,
        manifestJson: manifest as never, packageHash: createHash('sha256').update(archive).digest('hex'),
        source: options.source, trustLevel: options.source === 'builtin' ? 'builtin' : 'unsigned',
      },
      update: {
        version: manifest.version, name: manifest.name, manifestJson: manifest as never,
        packageHash: createHash('sha256').update(archive).digest('hex'),
        source: options.source, trustLevel: options.source === 'builtin' ? 'builtin' : 'unsigned',
      },
    });
    await deployment.commit();
    deployment = null;
    return record;
  } catch (cause) {
    if (deployment) await deployment.rollback();
    throw cause;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
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
  await visit();
  return validateThemeFiles(files);
}

export async function uninstallTheme(slug: string) {
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme) error('THEME_NOT_FOUND', `Theme "${slug}" not found`, 404);
  if (theme.source === 'builtin') error('THEME_BUILTIN_CONFLICT', 'Builtin themes cannot be uninstalled', 409);
  await themePackageStore.delete(slug);
  await prisma.theme.delete({ where: { slug } });
  return { slug, deleted: true };
}

export async function readThemeAsset(slug: string, version: string, relative: string) {
  if (!/^(?:assets\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp)|fonts\/[a-zA-Z0-9_/-]+\.woff2)$/.test(relative)
    || relative.split('/').some((part) => part === '..' || part === '.'))
    return null;
  const theme = await prisma.theme.findUnique({ where: { slug } });
  if (!theme || theme.version !== version) return null;
  const pkg = await themePackageStore.get(slug);
  if (!pkg || !await pkg.exists(relative)) return null;
  const content = await fs.readFile(pkg.getEntryPath(relative));
  const type = relative.endsWith('.woff2') ? 'font/woff2'
    : relative.endsWith('.png') ? 'image/png'
      : relative.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return { content, type };
}
