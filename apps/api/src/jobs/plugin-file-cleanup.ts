import { pluginStorage } from '@/core/plugin-storage/service';

/** Durable database claims coordinate cleanup across workers; stopping prevents new claims. */
export function cleanPluginFiles(isStopping: () => boolean) {
  return pluginStorage.cleanup(isStopping);
}
