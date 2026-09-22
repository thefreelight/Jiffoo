import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { recordPluginFailure } from './plugin-failure';

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export async function handlePluginProcessFailure(errorValue: unknown, context: 'uncaughtException' | 'unhandledRejection'): Promise<void> {
  const error = toError(errorValue);
  const stack = error.stack ?? '';
  const candidatePaths = stack.match(/[A-Za-z]:[^\n()]+|\/[^\n()]+/g) ?? [];
  let slug: string | null = null;
  for (const candidatePath of candidatePaths) {
    slug = await pluginPackageStore.findSlugByFilePath(candidatePath.trim());
    if (slug) break;
  }
  console.error(JSON.stringify({ event: 'plugin_process_failure', context, slug, message: error.message }));
  if (slug) await recordPluginFailure(slug, error, 'process');
}

export function registerPluginProcessFailureHandlers(): void {
  process.on('uncaughtException', (error) => {
    void handlePluginProcessFailure(error, 'uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    void handlePluginProcessFailure(reason, 'unhandledRejection');
  });
}
