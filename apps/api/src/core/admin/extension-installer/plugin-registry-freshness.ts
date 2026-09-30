import { prisma } from '@/config/database';
import { reconcileAllPluginState } from './plugin-reconciliation';

let reconciledVersion: number | null = null;
let inFlight: Promise<void> | null = null;
let resetEpoch = 0;

export async function ensurePluginRegistryFresh(): Promise<void> {
  while (true) {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: { pluginRegistryVersion: true },
    });
    const version = settings?.pluginRegistryVersion ?? 0;
    if (reconciledVersion === version && !inFlight) return;
    if (inFlight) {
      await inFlight;
      continue;
    }
    const epoch = resetEpoch;
    const operation = reconcileAllPluginState();
    inFlight = operation;
    try {
      await operation;
      if (resetEpoch === epoch) reconciledVersion = version;
    } finally {
      if (inFlight === operation) inFlight = null;
    }
  }
}

export function resetPluginRegistryFreshness(): void {
  resetEpoch++;
  reconciledVersion = null;
}
