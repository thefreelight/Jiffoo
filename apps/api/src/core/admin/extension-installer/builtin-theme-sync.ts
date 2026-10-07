import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { installBuiltinTheme } from './theme-service';
import { activateTheme } from './theme-runtime';

const LOCK = 824_301_552;

export async function syncBuiltinThemes(root: string): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK})::text`;
    for (const entry of (await fs.readdir(root, { withFileTypes: true })).filter((item) => item.isDirectory())) {
      const installed = await installBuiltinTheme(path.join(root, entry.name));
      await activateTheme(installed.target as 'shop' | 'admin', installed.slug, 'system', 'theme.activate', true);
    }
  }, { timeout: 120000 });
}
