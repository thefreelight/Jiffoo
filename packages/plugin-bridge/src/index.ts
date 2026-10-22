import { CHANNEL, VERSION, messageBudget, parseEnvelope, type Envelope, type Plain } from './protocol.js';
export { boundedPlain, parseEnvelope } from './protocol.js';
export type { Plain } from './protocol.js';

export interface PageContext {
  customer: { id: string; displayName: string | null; email: string } | null;
  admin: { id: string; displayName: string | null; email: string } | null;
  locale: string; currency: string; colorMode: 'light' | 'dark';
  themeTokens: Record<string, string>; store: { id: string; name: string; url: string };
  page: { id: string; path: string }; capabilities: string[];
}

function isContext(value: Plain | undefined): value is Plain & PageContext {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const identity = (item: Plain | undefined) => item === null || Boolean(item && typeof item === 'object' && !Array.isArray(item)
    && typeof item.id === 'string' && typeof item.email === 'string' && (item.displayName === null || typeof item.displayName === 'string'));
  const store = value.store, page = value.page, theme = value.themeTokens;
  return identity(value.customer) && identity(value.admin) && !(value.customer && value.admin)
    && typeof value.locale === 'string' && typeof value.currency === 'string'
    && ['light', 'dark'].includes(String(value.colorMode))
    && Boolean(store && typeof store === 'object' && !Array.isArray(store) && typeof store.id === 'string' && typeof store.name === 'string' && typeof store.url === 'string')
    && Boolean(page && typeof page === 'object' && !Array.isArray(page) && typeof page.id === 'string' && typeof page.path === 'string')
    && Boolean(theme && typeof theme === 'object' && !Array.isArray(theme) && Object.values(theme).every(token => typeof token === 'string'))
    && Array.isArray(value.capabilities) && value.capabilities.every(capability => typeof capability === 'string');
}

/** One client per iframe document. Core credentials never enter this client. */
export function createPluginBridge() {
  const shellOrigin = new URL(location.href).searchParams.get('shellOrigin');
  if (!shellOrigin || new URL(shellOrigin).origin !== shellOrigin || parent === window) throw new Error('A Core page shell is required');
  let binding: { sessionId: string; nonce: string } | undefined;
  let closed = false;
  let token = '';
  let context: PageContext | undefined;
  let revision = -1;
  const acceptRate = messageBudget();
  const sendRate = messageBudget();
  const listeners = new Set<(context: PageContext) => void>();
  const pending = new Map<string, { resolve: (result: Plain) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let welcomeResolve: () => void;
  let welcomeReject: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { welcomeResolve = resolve; welcomeReject = reject; });
  const welcomeTimer = setTimeout(() => dispose(new Error('Bridge handshake timed out')), 10_000);
  // Prevent an unobserved rejection when the document closes before the first request.
  void ready.catch(() => undefined);

  function dispose(reason = new Error('Bridge closed')) {
    if (closed) return;
    closed = true;
    token = '';
    binding = undefined;
    context = undefined;
    clearTimeout(welcomeTimer);
    clearInterval(helloTimer);
    welcomeReject(reason);
    window.removeEventListener('message', receive);
    window.removeEventListener('pagehide', onPageHide);
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(reason); }
    pending.clear();
    listeners.clear();
  }

  function receive(event: MessageEvent) {
    if (closed || event.source !== parent || event.origin !== shellOrigin || !acceptRate()) return;
    const message = parseEnvelope(event.data);
    if (!message) return;
    if (!binding && message.type === 'bridge.welcome') {
      const payload = message.payload as Record<string, Plain> | undefined;
      if (!message.sessionId || !message.nonce || !payload || typeof payload.pluginToken !== 'string'
        || !isContext(payload.context)) return;
      binding = { sessionId: message.sessionId, nonce: message.nonce };
      token = payload.pluginToken;
      context = payload.context as unknown as PageContext;
      clearTimeout(welcomeTimer);
      clearInterval(helloTimer);
      welcomeResolve();
      return;
    }
    if (!binding || message.sessionId !== binding.sessionId || message.nonce !== binding.nonce) return;
    if (message.type === 'bridge.close') { dispose(); return; }
    if (message.type === 'context.changed') {
      const payload = message.payload as Record<string, Plain> | undefined;
      if (payload && typeof payload.revision === 'number' && Number.isSafeInteger(payload.revision) && payload.revision > revision && isContext(payload.context)) {
        revision = payload.revision;
        context = payload.context as unknown as PageContext;
        for (const listener of listeners) listener(context);
      }
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.code));
    else entry.resolve(message.result ?? null);
  }
  window.addEventListener('message', receive);
  function onPageHide() { dispose(); }
  window.addEventListener('pagehide', onPageHide, { once: true });
  const hello = () => parent.postMessage({ channel: CHANNEL, version: VERSION, id: crypto.randomUUID(), type: 'bridge.hello', payload: { supportedVersions: [1] } }, shellOrigin);
  const helloTimer = setInterval(hello, 500);
  hello();

  async function request(type: string, payload: Plain = null): Promise<Plain> {
    await ready;
    if (closed || !binding || pending.size >= 32 || !sendRate()) throw new Error('Bridge unavailable');
    const message: Envelope = { channel: CHANNEL, version: VERSION, ...binding, id: crypto.randomUUID(), type, payload };
    if (!parseEnvelope(message)) throw new Error('Invalid bridge request');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(message.id); reject(new Error('Bridge request timed out')); }, 10_000);
      pending.set(message.id, { resolve, reject, timer });
      parent.postMessage(message, shellOrigin!);
    });
  }
  return {
    ready, request,
    context: async () => { await ready; if (closed) throw new Error('Bridge closed'); return context!; },
    subscribe: async (listener: (context: PageContext) => void) => {
      await ready;
      if (closed) throw new Error('Bridge closed');
      listeners.add(listener);
      try { await request('context.subscribe'); }
      catch (error) { listeners.delete(listener); throw error; }
      if (closed) throw new Error('Bridge closed');
      return () => { listeners.delete(listener); };
    },
    token: async () => { await ready; if (closed) throw new Error('Bridge closed'); return token; },
    refreshToken: async () => {
      const result = await request('token.refresh') as Record<string, Plain>;
      if (closed) throw new Error('Bridge closed');
      if (typeof result.pluginToken !== 'string') throw new Error('Invalid token response');
      token = result.pluginToken;
      return token;
    },
    close: async () => { try { await request('bridge.close'); } finally { dispose(); } },
  };
}
