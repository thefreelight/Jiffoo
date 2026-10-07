import { prisma } from '@/config/database';
import { resolveThemePackage } from './current-theme-package';

export async function prewarmThemePackages(): Promise<void> {
  const active = await prisma.themeActive.findMany();
  await Promise.all(active.map(async theme => {
    try { await resolveThemePackage(theme.slug, theme.packageHash); }
    catch (error) { console.error('Theme package startup prewarm failed', { slug: theme.slug, packageHash: theme.packageHash, error }); }
  }));
}
