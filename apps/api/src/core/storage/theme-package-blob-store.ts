import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';

export type ThemePackageBlobMetadata = { themeSlug: string; packageHash: string; sizeBytes: number; actualBytes: number };

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const themePackageBlobStore = {
  async put(tx: Transaction, slug: string, packageHash: string, bytes: Buffer): Promise<void> {
    await tx.themePackageBlob.upsert({
      where: { themeSlug_packageHash: { themeSlug: slug, packageHash } },
      create: { themeSlug: slug, packageHash, bytes: Uint8Array.from(bytes), sizeBytes: bytes.length }, update: {},
    });
  },
  get: (slug: string, packageHash: string) => prisma.themePackageBlob.findUnique({ where: { themeSlug_packageHash: { themeSlug: slug, packageHash } } }),
  async headMany(packages: readonly { slug: string; packageHash: string }[]): Promise<ThemePackageBlobMetadata[]> {
    if (!packages.length) return [];
    const identities = packages.map(pkg => Prisma.sql`("themeSlug" = ${pkg.slug} AND "packageHash" = ${pkg.packageHash})`);
    return prisma.$queryRaw<ThemePackageBlobMetadata[]>(Prisma.sql`
      SELECT "themeSlug", "packageHash", "sizeBytes", octet_length(bytes) AS "actualBytes"
      FROM public.theme_package_blobs WHERE ${Prisma.join(identities, ' OR ')}
    `);
  },
};
