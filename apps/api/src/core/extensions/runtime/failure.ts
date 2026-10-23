import { prisma } from '@/config/database';
import { registerPluginStateReset } from './plugin-state';
import { decryptPluginConfig } from '@/core/extensions/shared/config-crypto';
import { readStoredPluginManifest } from './stored-manifest';
import { sanitizePluginFailure, PLUGIN_FAILURE_HIDDEN_MESSAGE, type FailureContext } from './failure-sanitizer';
import type { Prisma } from '@prisma/client';

const lastRecordedAt = new Map<string, number>();
const THROTTLE_MS = 5_000;

type FailureRuntime = { config: Record<string, unknown>; manifest: { configSchema?: unknown } };
type StoredInstallation = Prisma.PluginInstallationGetPayload<{ include: { plugin: true } }>;

/**
 * Build a message that is safe to persist or show to an operator.
 *
 * A supplied runtime context already carries the decrypted configuration, so the
 * stored installation is not read again. When the stored configuration cannot be
 * read the message is replaced instead of leaking an unredacted detail.
 */
export async function redactPluginFailure(
  slug: string, error: unknown, installationId?: string,
  runtime?: FailureRuntime,
  client: Pick<typeof prisma, 'pluginInstallation'> = prisma,
): Promise<string> {
  const message = error instanceof Error ? error.message : String(error);
  if (runtime) return sanitizePluginFailure(message, [runtime]);
  let installation: StoredInstallation | null;
  try {
    installation = await client.pluginInstallation.findFirst({
      where: installationId ? { id: installationId } : { pluginSlug: slug, instanceKey: 'default' },
      include: { plugin: true },
    });
  } catch {
    // Without the stored configuration the message cannot be redacted.
    return PLUGIN_FAILURE_HIDDEN_MESSAGE;
  }
  const contexts: FailureContext[] = [];
  if (installation) {
    try {
      const manifest = readStoredPluginManifest(installation.plugin);
      const stored = installation.configJson as Record<string, unknown> | null;
      contexts.push({ config: decryptPluginConfig(manifest, stored ?? {}), manifest });
    } catch {
      if (installation.plugin.manifestJson && typeof installation.plugin.manifestJson === 'object') {
        const manifest = installation.plugin.manifestJson as { configSchema?: unknown };
        try {
          contexts.push({ config: decryptPluginConfig(manifest, (installation.configJson as Record<string, unknown>) ?? {}), manifest });
        } catch {
          if (manifest.configSchema !== undefined) return 'Plugin configuration cannot be decrypted; re-enter the sensitive value';
        }
      }
    }
  }
  return sanitizePluginFailure(message, contexts);
}

/**
 * Record a plugin failure for operator diagnostics.
 *
 * Recording is best effort. A failing diagnostic write must never interrupt the
 * caller, because the callers sit inside core request and transaction paths.
 */
export async function recordPluginFailure(
  slug: string, error: unknown, context: string, installationId?: string,
  runtime?: FailureRuntime,
  client: Pick<typeof prisma, 'pluginInstallation'> = prisma,
): Promise<void> {
  const now = Date.now();
  if (now - (lastRecordedAt.get(slug) ?? 0) < THROTTLE_MS) return;
  lastRecordedAt.set(slug, now);
  try {
    const message = await redactPluginFailure(slug, error, installationId, runtime, client);
    console.error(JSON.stringify({ event: 'plugin_failure', slug, context, message }));
    await client.pluginInstallation.updateMany({
      where: installationId ? { id: installationId } : { pluginSlug: slug, instanceKey: 'default' },
      data: { lastFailureAt: new Date(now), lastFailureMessage: message },
    });
  } catch (failure) {
    console.error(JSON.stringify({
      event: 'plugin_failure_record_failed',
      slug,
      context,
      reason: failure instanceof Error ? failure.name : 'unknown',
    }));
  }
}

registerPluginStateReset('failure-record-throttle', (slug) => {
  lastRecordedAt.delete(slug);
});
