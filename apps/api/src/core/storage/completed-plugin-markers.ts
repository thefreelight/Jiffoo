import { prisma } from '@/config/database';
type Completed = { slug: string; token: string; ownerBootNonce: string };
const completed = new Map<string, Completed>();
export function rememberCompletedPluginMarker(marker: Completed): void { completed.set(marker.token, marker); }
/** Only this live boot's actual settled invocations enter this queue. */
export async function flushCompletedPluginMarkers(): Promise<void> {
  for (const marker of [...completed.values()].slice(0, 100)) {
    await prisma.pluginOperationLease.deleteMany({ where: marker }); completed.delete(marker.token);
  }
}
