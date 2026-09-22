import { prisma } from '@/config/database';
import { registerPluginStateReset } from './plugin-state';

const lastRecordedAt = new Map<string, number>();
const THROTTLE_MS = 5_000;

export async function recordPluginFailure(slug: string, error: unknown, context: string): Promise<void> {
  const now = Date.now();
  if (now - (lastRecordedAt.get(slug) ?? 0) < THROTTLE_MS) return;
  lastRecordedAt.set(slug, now);
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event: 'plugin_failure', slug, context, message }));
  await prisma.pluginInstallation.updateMany({
    where: { pluginSlug: slug, instanceKey: 'default' },
    data: { lastFailureAt: new Date(now), lastFailureMessage: message },
  });
}

registerPluginStateReset('failure-record-throttle', (slug) => {
  lastRecordedAt.delete(slug);
});
