import { prisma } from '@/config/database';
import { validateDatabaseUrl, assertCurrentDatabase } from '../../src/config/test-lane';

export async function cleanupPluginMigrationFixture(slug: string): Promise<void> {
  validateDatabaseUrl(process.env.DATABASE_URL_TEST!);
  if (process.env.NODE_ENV !== 'test') throw new Error('Plugin fixture cleanup requires test mode.');
  const database = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  assertCurrentDatabase(database[0]?.name);
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
