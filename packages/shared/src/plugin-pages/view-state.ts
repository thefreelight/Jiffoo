import { boundedPlain, type Plain } from '../../../plugin-bridge/src/protocol';

export function pageStateKey(store: string, admin: string, plugin: string, page: string) {
  return `jiffoo.plugin.page-state.v1:${JSON.stringify([store, admin, plugin, page])}`;
}

export function pageState(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, key: string, action: string, value?: Plain): Plain {
  if (action === 'pageState.clear') { storage.removeItem(key); return null; }
  if (action === 'pageState.set') {
    if (!boundedPlain(value) || JSON.stringify(value).length > 16384) throw new Error('VALIDATION_ERROR');
    storage.setItem(key, JSON.stringify(value)); return null;
  }
  const raw = storage.getItem(key);
  if (!raw) return null;
  try { const parsed: unknown = JSON.parse(raw); if (raw.length <= 16384 && boundedPlain(parsed)) return parsed; } catch { /* Invalid stored state is discarded. */ }
  storage.removeItem(key); return null;
}
