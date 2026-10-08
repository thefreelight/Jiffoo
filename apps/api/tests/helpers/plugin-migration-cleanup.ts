import { prisma } from '@/config/database';

export async function cleanupPluginMigrationFixture(slug: string): Promise<void> {
  const url = new URL(process.env.DATABASE_URL_TEST ?? '');
  if (process.env.NODE_ENV !== 'test' || decodeURIComponent(url.pathname.slice(1)) !== 'jiffoo_core_test') {
    throw new Error('Plugin fixture cleanup requires jiffoo_core_test in test mode.');
  }
  const database = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (database[0]?.name !== 'jiffoo_core_test') throw new Error('Plugin fixture cleanup connected to a non-test database.');
  const namespace = await prisma.pluginNamespace.findUnique({ where: { slug } });
  if (namespace) {
    if (!namespace.schemaName.startsWith('plugin_')) throw new Error('Fixture cleanup requires a plugin schema.');
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${namespace.schemaName.replaceAll('"', '""')}" CASCADE`);
    await prisma.pluginMigrationAttempt.deleteMany({ where: { namespaceId: namespace.id } });
    await prisma.pluginMigrationSuccess.deleteMany({ where: { namespaceId: namespace.id } });
    await prisma.pluginNamespace.delete({ where: { id: namespace.id } });
  }
  await prisma.pluginMigrationOperation.deleteMany({ where: { slug } });
}
