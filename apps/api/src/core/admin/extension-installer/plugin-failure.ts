import { prisma } from '@/config/database';
import { registerPluginStateReset } from './plugin-state';
import { decryptPluginConfig, redactPluginText } from '@/core/admin/plugin-management/config-crypto';
import { readStoredPluginManifest } from './stored-manifest';

const lastRecordedAt = new Map<string, number>();
const THROTTLE_MS = 5_000;

export async function redactPluginFailure(
  slug: string, error: unknown, installationId?: string,
  runtime?: { config: Record<string, unknown>; manifest: { configSchema?: unknown } },
): Promise<string> {
  let message = error instanceof Error ? error.message : String(error);
  if (runtime) message = redactPluginText(message, runtime.config, runtime.manifest);
  const installation = await prisma.pluginInstallation.findFirst({
    where: installationId ? { id: installationId } : { pluginSlug: slug, instanceKey: 'default' },
    include: { plugin: true },
  });
  if (installation) {
    try {
      const manifest = readStoredPluginManifest(installation.plugin);
      const stored = installation.configJson as Record<string, unknown> | null;
      message = redactPluginText(message, decryptPluginConfig(manifest, stored ?? {}), manifest);
    } catch {
      if (installation.plugin.manifestJson && typeof installation.plugin.manifestJson === 'object') {
        const manifest = installation.plugin.manifestJson as { configSchema?: unknown };
        try {
          message = redactPluginText(message, decryptPluginConfig(manifest, (installation.configJson as Record<string, unknown>) ?? {}), manifest);
        } catch {
          if (manifest.configSchema !== undefined) message = 'Plugin configuration cannot be decrypted; re-enter the sensitive value';
        }
      }
    }
  }
  return message;
}

export async function recordPluginFailure(
  slug: string, error: unknown, context: string, installationId?: string,
  runtime?: { config: Record<string, unknown>; manifest: { configSchema?: unknown } },
): Promise<void> {
  const now = Date.now();
  if (now - (lastRecordedAt.get(slug) ?? 0) < THROTTLE_MS) return;
  lastRecordedAt.set(slug, now);
  const message = await redactPluginFailure(slug, error, installationId, runtime);
  console.error(JSON.stringify({ event: 'plugin_failure', slug, context, message }));
  await prisma.pluginInstallation.updateMany({
    where: installationId ? { id: installationId } : { pluginSlug: slug, instanceKey: 'default' },
    data: { lastFailureAt: new Date(now), lastFailureMessage: message },
  });
}

registerPluginStateReset('failure-record-throttle', (slug) => {
  lastRecordedAt.delete(slug);
});
