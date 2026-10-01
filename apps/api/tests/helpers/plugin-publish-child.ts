import { pluginPackageStore } from '@/core/storage/plugin-package-store';

process.on('message', async (message: { kind?: string; slug?: string; zipHash?: string; source?: string }) => {
  if (message.kind === 'stop') {
    process.disconnect?.();
    return;
  }
  if (message.kind !== 'publish' || !message.slug || !message.zipHash || !message.source) return;
  try {
    const result = await pluginPackageStore.put(message.slug, message.zipHash, message.source);
    process.send?.({ kind: 'done', published: result.published });
  } catch (error) {
    process.send?.({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
process.send?.({ kind: 'ready' });
