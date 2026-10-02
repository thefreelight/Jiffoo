import { expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';

export async function snapshotPluginRows(slugs?: string[]) {
  return {
    installs: await prisma.pluginInstall.findMany({ where: slugs ? { slug: { in: slugs } } : {}, orderBy: { id: 'asc' } }),
    blobs: await prisma.pluginPackageBlob.findMany({ where: slugs ? { pluginSlug: { in: slugs } } : {}, orderBy: { id: 'asc' } }),
    installations: await prisma.pluginInstallation.findMany({ where: slugs ? { pluginSlug: { in: slugs } } : {}, orderBy: { id: 'asc' } }),
  };
}

export async function assertPluginRowsUnchanged(before: Awaited<ReturnType<typeof snapshotPluginRows>>, slugs?: string[]) {
  expect(await snapshotPluginRows(slugs)).toEqual(before);
}

// Restore only builtin fixture rows; caller-owned plugins use their existing cleanup.
export async function restoreBuiltinRows(before: Awaited<ReturnType<typeof snapshotPluginRows>>, slugs: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.pluginInstall.deleteMany({ where: { slug: { in: slugs }, id: { notIn: before.installs.map((row) => row.id) } } });
    for (const row of before.installs) {
      const data = { ...row, manifestJson: row.manifestJson ?? Prisma.DbNull, permissions: row.permissions ?? Prisma.DbNull } as Prisma.PluginInstallUncheckedCreateInput;
      await tx.pluginInstall.upsert({ where: { id: row.id }, create: data, update: data });
    }
    await tx.pluginPackageBlob.deleteMany({ where: { pluginSlug: { in: slugs }, id: { notIn: before.blobs.map((row) => row.id) } } });
    for (const row of before.blobs) await tx.pluginPackageBlob.upsert({ where: { id: row.id }, create: row, update: row });
    await tx.pluginInstallation.deleteMany({ where: { pluginSlug: { in: slugs }, id: { notIn: before.installations.map((row) => row.id) } } });
    for (const row of before.installations) {
      const data = { ...row, configJson: row.configJson ?? Prisma.DbNull, grantedPermissions: row.grantedPermissions ?? Prisma.DbNull } as Prisma.PluginInstallationUncheckedCreateInput;
      await tx.pluginInstallation.upsert({ where: { id: row.id }, create: data, update: data });
    }
  });
  await assertPluginRowsUnchanged(before, slugs);
}
