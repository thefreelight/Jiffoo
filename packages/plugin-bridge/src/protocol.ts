export const CHANNEL = 'jiffoo.plugin';
export const VERSION = 1;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
export type Envelope = {
  channel: typeof CHANNEL; version: typeof VERSION; id: string; type: string;
  sessionId?: string; nonce?: string; payload?: Plain; result?: Plain;
  error?: { code: string; message: string };
};

/** Reject non-plain structured clones, cycles and excessive nesting before serialization. */
export function boundedPlain(value: unknown): value is Plain {
  let nodes = 0;
  let bytes = 0;
  const encoder = new TextEncoder();
  const active = new Set<object>();
  function visit(item: unknown, depth: number): boolean {
    if (++nodes > 8192 || depth > 16) return false;
    if (item === null || typeof item === 'boolean') return true;
    if (typeof item === 'string') {
      if (item.length > MAX_MESSAGE_BYTES) return false;
      bytes += encoder.encode(item).length;
      return bytes <= MAX_MESSAGE_BYTES;
    }
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item !== 'object' || active.has(item)) return false;
    if (Array.isArray(item) && item.length > 8192) return false;
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false;
    active.add(item);
    const keys = Object.keys(item);
    const valid = keys.every(key => {
      if (key.length > MAX_MESSAGE_BYTES || ['__proto__', 'constructor', 'prototype'].includes(key)) return false;
      bytes += encoder.encode(key).length;
      return bytes <= MAX_MESSAGE_BYTES;
    })
      && Object.values(item).every(child => visit(child, depth + 1));
    active.delete(item);
    return valid;
  }
  if (!visit(value, 0)) return false;
  return new TextEncoder().encode(JSON.stringify(value)).length <= MAX_MESSAGE_BYTES;
}

export function parseEnvelope(value: unknown): Envelope | null {
  if (!boundedPlain(value) || !value || Array.isArray(value) || typeof value !== 'object') return null;
  const item = value as Record<string, Plain>;
  if (Object.keys(item).some(key => !['channel', 'version', 'id', 'type', 'sessionId', 'nonce', 'payload', 'result', 'error'].includes(key))
    || item.channel !== CHANNEL || item.version !== VERSION || typeof item.id !== 'string'
    || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || typeof item.type !== 'string'
    || !/^[a-zA-Z][a-zA-Z.]{0,63}$/.test(item.type)) return null;
  if (item.type !== 'bridge.hello' && (typeof item.sessionId !== 'string' || item.sessionId.length < 1 || item.sessionId.length > 128
    || typeof item.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(item.nonce))) return null;
  if (item.result !== undefined && item.error !== undefined) return null;
  if (item.error !== undefined && (!item.error || Array.isArray(item.error) || typeof item.error !== 'object'
    || typeof item.error.code !== 'string' || typeof item.error.message !== 'string'
    || item.error.code.length > 80 || item.error.message.length > 300)) return null;
  return item as unknown as Envelope;
}

export function randomNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function messageBudget(limit = 30) {
  let windowStart = 0;
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - windowStart >= 1000) { windowStart = now; count = 0; }
    return ++count <= limit;
  };
}
