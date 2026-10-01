import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '../../src/config/database';

export async function seedBuiltinCache(): Promise<void> {
  const sourceRoot = process.env.JIFFOO_TEST_BUILTIN_SOURCE_ROOT;
  const targetRoot = process.env.EXTENSIONS_PATH;
  if (!sourceRoot || !targetRoot) return;
  const builtins = await prisma.pluginInstall.findMany({
    where: { source: 'builtin' }, select: { slug: true, zipHash: true },
  });
  for (const { slug, zipHash } of builtins) {
    if (!zipHash) continue;
    await fs.cp(
      path.join(sourceRoot, 'plugins', slug, zipHash),
      path.join(targetRoot, 'plugins', slug, zipHash),
      { recursive: true },
    );
  }
}
