import { prisma } from '@/config/database';
import { reconcileAllPluginState } from './plugin-reconciliation';

let reconciledVersion: number | null = null;

export async function ensurePluginRegistryFresh(): Promise<void> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' },
    select: { pluginRegistryVersion: true },
  });
  const version = settings?.pluginRegistryVersion ?? 0;
  if (reconciledVersion === version) return;
  await reconcileAllPluginState();
  reconciledVersion = version;
}

export function resetPluginRegistryFreshness(): void {
  reconciledVersion = null;
}
