import { Prisma, type PluginPackageBlob } from '@prisma/client';
import { prisma } from '@/config/database';
import { createHash } from 'node:crypto';
import { ApiError } from '@/utils/api-errors';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type PluginPackageBlobMetadata = { pluginSlug: string; zipHash: string; sizeBytes: number; actualBytes: number };

export interface PluginPackageBlobStore {
  put(tx: Transaction, slug: string, zipHash: string, bytes: Buffer): Promise<void>;
  get(slug: string, zipHash: string): Promise<PluginPackageBlob | null>;
  headMany(packages: readonly { slug: string; zipHash: string }[]): Promise<PluginPackageBlobMetadata[]>;
  has(slug: string, zipHash: string): Promise<boolean>;
  deleteExcept(tx: Transaction, slug: string, keepHash: string): Promise<void>;
  deleteAll(tx: Transaction, slug: string): Promise<void>;
}

class PostgresPluginPackageBlobStore implements PluginPackageBlobStore {
  async put(tx: Transaction, slug: string, zipHash: string, bytes: Buffer): Promise<void> {
    if (createHash('sha256').update(bytes).digest('hex') !== zipHash) throw new ApiError('PLUGIN_PACKAGE_CORRUPT');
    await tx.pluginPackageBlob.upsert({
      where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash } },
      create: { pluginSlug: slug, zipHash, bytes: Uint8Array.from(bytes), sizeBytes: bytes.length },
      update: {},
    });
    const stored = await tx.pluginPackageBlob.findUniqueOrThrow({ where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash } } });
    if (stored.sizeBytes !== stored.bytes.length || createHash('sha256').update(stored.bytes).digest('hex') !== zipHash) throw new ApiError('PLUGIN_PACKAGE_CORRUPT');
  }

  get(slug: string, zipHash: string): Promise<PluginPackageBlob | null> {
    return prisma.pluginPackageBlob.findUnique({
      where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash } },
    });
  }

  async headMany(packages: readonly { slug: string; zipHash: string }[]): Promise<PluginPackageBlobMetadata[]> {
    if (!packages.length) return [];
    // octet_length reads the stored bytea size without transferring archive bytes.
    const identities = packages.map(pkg => Prisma.sql`("pluginSlug" = ${pkg.slug} AND "zipHash" = ${pkg.zipHash})`);
    return prisma.$queryRaw<PluginPackageBlobMetadata[]>(Prisma.sql`
      SELECT "pluginSlug", "zipHash", "sizeBytes", octet_length(bytes) AS "actualBytes"
      FROM public.plugin_package_blobs WHERE ${Prisma.join(identities, ' OR ')}
    `);
  }

  async has(slug: string, zipHash: string): Promise<boolean> {
    return (await prisma.pluginPackageBlob.count({ where: { pluginSlug: slug, zipHash } })) > 0;
  }

  async deleteExcept(tx: Transaction, slug: string, keepHash: string): Promise<void> {
    await tx.pluginPackageBlob.deleteMany({ where: { pluginSlug: slug, zipHash: { not: keepHash } } });
  }

  async deleteAll(tx: Transaction, slug: string): Promise<void> {
    await tx.pluginPackageBlob.deleteMany({ where: { pluginSlug: slug } });
  }
}

export const pluginPackageBlobStore: PluginPackageBlobStore = new PostgresPluginPackageBlobStore();
