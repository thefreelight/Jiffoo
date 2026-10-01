import type { PluginPackageBlob } from '@prisma/client';
import { prisma } from '@/config/database';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface PluginPackageBlobStore {
  put(tx: Transaction, slug: string, zipHash: string, bytes: Buffer): Promise<void>;
  get(slug: string, zipHash: string): Promise<PluginPackageBlob | null>;
  has(slug: string, zipHash: string): Promise<boolean>;
  deleteExcept(tx: Transaction, slug: string, keepHash: string): Promise<void>;
  deleteAll(tx: Transaction, slug: string): Promise<void>;
}

class PostgresPluginPackageBlobStore implements PluginPackageBlobStore {
  async put(tx: Transaction, slug: string, zipHash: string, bytes: Buffer): Promise<void> {
    await tx.pluginPackageBlob.upsert({
      where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash } },
      create: { pluginSlug: slug, zipHash, bytes: Uint8Array.from(bytes), sizeBytes: bytes.length },
      update: {},
    });
  }

  get(slug: string, zipHash: string): Promise<PluginPackageBlob | null> {
    return prisma.pluginPackageBlob.findUnique({
      where: { pluginSlug_zipHash: { pluginSlug: slug, zipHash } },
    });
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
