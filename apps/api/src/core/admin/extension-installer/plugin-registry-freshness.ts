import { prisma } from '@/config/database';
import { reconcileAllPluginState } from './plugin-reconciliation';
import { setPluginPackageRegistryVersion } from '@/core/storage/current-plugin-package';

let reconciledVersion: number | null = null;
let inFlight: Promise<Map<string, unknown>> | null = null;
let resetEpoch = 0;

export async function ensurePluginRegistryFresh(slug?: string): Promise<void> {
  while (true) {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: { pluginRegistryVersion: true },
    });
    const version = settings?.pluginRegistryVersion ?? 0;
    setPluginPackageRegistryVersion(version);
    if (reconciledVersion === version && !inFlight) return;
    if (inFlight) {
      const failures = await inFlight;
      if (slug && failures.has(slug)) throw failures.get(slug);
      continue;
    }
    const epoch = resetEpoch;
    const operation = reconcileAllPluginState();
    inFlight = operation;
    try {
      const currentFailures = await operation;
      if (resetEpoch === epoch) {
        reconciledVersion = version;
      }
      if (slug && currentFailures.has(slug)) throw currentFailures.get(slug);
    } finally {
      if (inFlight === operation) inFlight = null;
    }
  }
}

export function resetPluginRegistryFreshness(): void {
  resetEpoch++;
  reconciledVersion = null;
}
