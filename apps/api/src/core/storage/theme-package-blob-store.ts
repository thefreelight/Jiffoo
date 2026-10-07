import { prisma } from '@/config/database';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const themePackageBlobStore = {
  async put(tx: Transaction, slug: string, packageHash: string, bytes: Buffer): Promise<void> {
    await tx.themePackageBlob.upsert({
      where: { themeSlug_packageHash: { themeSlug: slug, packageHash } },
      create: { themeSlug: slug, packageHash, bytes: Uint8Array.from(bytes), sizeBytes: bytes.length }, update: {},
    });
  },
  get: (slug: string, packageHash: string) => prisma.themePackageBlob.findUnique({ where: { themeSlug_packageHash: { themeSlug: slug, packageHash } } }),
};
