'use client';

import { useEffect, useRef, useState } from 'react';
import { CHANNEL, VERSION, messageBudget, parseEnvelope, randomNonce, type Envelope, type Plain } from '../../../plugin-bridge/src/protocol';
import type { PageContext } from '../../../plugin-bridge/src/index';

export type ShellSession = { sessionId: string; frameUrl: string; pluginToken: string; expiresAt: string;
  guestSecret: string | null; context: Pick<PageContext, 'customer' | 'admin' | 'page'> };
export type ShellTransport = (path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown) => Promise<unknown>;
export type ShellLabels = { loading: string; unavailable: string; retry: string; save: string; cancel: string; download: string };
type Props = { slug: string; pageId: string; title: string; surface: 'shop' | 'admin'; locale: string;
  currency: string; store: PageContext['store']; allowedPaths: string[]; labels: ShellLabels;
  transport: ShellTransport; navigate: (path: string) => void; signIn: () => void; checkout: (id: string) => void };

function object(value: Plain | undefined): Record<string, Plain> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('VALIDATION_ERROR');
  return value;
}
function exact(value: Record<string, Plain>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('VALIDATION_ERROR');
}

/** The frame exists only within this dedicated page component. */
export function PluginPageShell(props: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const downloadDialog = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState<ShellSession | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [height, setHeight] = useState(600);
  const [notice, setNotice] = useState('');
  const [prompt, setPrompt] = useState<{ reference: string; sessionId: string } | null>(null);
  const control = useRef<{ loaded: () => void; changed: () => void; save: (reference: string) => Promise<void> } | null>(null);
  const currentProps = useRef(props);
  currentProps.current = props;

  useEffect(() => {
    let disposed = false;
    let active: ShellSession | null = null;
    let binding: { source: Window; nonce: string; sessionId: string } | null = null;
    let loadCount = 0;
    let outstanding = 0;
    const pendingIds = new Set<string>();
    let subscribed = false;
    let revision = 0;
    const inbound = messageBudget();
    const outbound = messageBudget();
    const resizeRate = messageBudget(10);
    const toastRate = messageBudget(3);
    const downloadRate = messageBudget(3);
    const base = `/plugin-pages/${props.slug}`;
    const path = (suffix = '') => `${base}/sessions/${active!.sessionId}${suffix}`;
    const auth = () => active?.guestSecret ? { guestSecret: active.guestSecret } : {};

    function post(message: Omit<Envelope, 'channel' | 'version' | 'sessionId' | 'nonce'>, expected = binding) {
      if (!disposed && expected && expected === binding && frame.current?.contentWindow === expected.source && outbound()) {
        const envelope = { channel: CHANNEL, version: VERSION, sessionId: expected.sessionId, nonce: expected.nonce, ...message };
        if (parseEnvelope(envelope)) expected.source.postMessage(envelope, '*');
      }
    }
    function stop(showError = false) {
      if (disposed) return;
      post({ id: crypto.randomUUID(), type: 'bridge.close' });
      disposed = true;
      binding = null;
      setSession(null); setPrompt(null);
      if (showError) setError(true);
      if (active) void currentProps.current.transport(path(), 'DELETE', auth()).catch(() => undefined);
      active = null;
    }
    function context(): PageContext {
      const { locale, currency, store, surface } = currentProps.current;
      const css = getComputedStyle(document.documentElement);
      const themeTokens = Object.fromEntries(['--background', '--foreground', '--primary', '--primary-foreground', '--shop-primary', '--shop-background', '--shop-text']
        .map(name => [name, css.getPropertyValue(name).trim().slice(0, 200)]));
      return { ...active!.context, locale, currency, store: { ...store, url: new URL(store.url, location.origin).href }, themeTokens,
        colorMode: css.colorScheme === 'dark' ? 'dark' : 'light',
        capabilities: ['context.get', 'context.subscribe', 'token.refresh', 'navigate', 'auth.signIn', 'frame.resize', 'toast.show', 'file.download',
          ...(surface === 'shop' ? ['cart.add', 'checkout.open'] : [])] };
    }
    function changed() {
      if (active && subscribed) post({ id: crypto.randomUUID(), type: 'context.changed', payload: { revision: ++revision, context: context() as unknown as Plain } });
    }
    async function refresh(expected: typeof binding) {
      if (!active || !expected) throw new Error('SESSION_REVOKED');
      const result = await currentProps.current.transport(path('/refresh'), 'POST', auth()) as { pluginToken: string; expiresAt: string; context: ShellSession['context'] };
      if (disposed || binding !== expected || frame.current?.contentWindow !== expected.source) throw new Error('SESSION_REVOKED');
      active.pluginToken = result.pluginToken;
      active.expiresAt = result.expiresAt;
      active.context = result.context;
      changed();
      return { pluginToken: result.pluginToken, expiresAt: result.expiresAt };
    }
    async function action(message: Envelope): Promise<Plain> {
      switch (message.type) {
        case 'context.get': return context() as unknown as Plain;
        case 'context.subscribe': subscribed = true; changed(); return { subscribed: true };
        case 'token.refresh': return await refresh(binding);
        case 'frame.resize': {
          const args = object(message.payload); exact(args, ['height']);
          if (!Number.isInteger(args.height) || typeof args.height !== 'number') throw new Error('VALIDATION_ERROR');
          if (resizeRate()) setHeight(Math.max(240, Math.min(2000, args.height)));
          return null;
        }
        case 'toast.show': {
          const args = object(message.payload); exact(args, ['message', 'severity']);
          if (typeof args.message !== 'string' || args.message.length > 300 || /[<>\u0000-\u001f]/.test(args.message)
            || !['info', 'success', 'error'].includes(String(args.severity))) throw new Error('VALIDATION_ERROR');
          if (toastRate()) setNotice(args.message);
          return null;
        }
        case 'navigate': {
          const args = object(message.payload); exact(args, ['path']);
          if (typeof args.path !== 'string' || !args.path.startsWith('/') || /[%\\?#:]|\/\/|\.{2}|[\u0000-\u0020]/.test(args.path)
            || !currentProps.current.allowedPaths.includes(args.path)) throw new Error('FORBIDDEN');
          currentProps.current.navigate(args.path); stop(); return null;
        }
        case 'auth.signIn': currentProps.current.signIn(); stop(); return null;
        case 'cart.add': {
          if (props.surface !== 'shop') throw new Error('FORBIDDEN');
          if (!active?.context.customer) { currentProps.current.signIn(); stop(); return null; }
          const args = object(message.payload); exact(args, ['variantId', 'quantity']);
          if (typeof args.variantId !== 'string' || !/^c[a-z0-9]{24}$/.test(args.variantId)
            || typeof args.quantity !== 'number' || !Number.isSafeInteger(args.quantity) || args.quantity < 1 || args.quantity > 999) throw new Error('VALIDATION_ERROR');
          await currentProps.current.transport(path('/cart'), 'POST', args);
          if (disposed) throw new Error('SESSION_REVOKED');
          window.dispatchEvent(new Event('cart-updated'));
          return { added: true };
        }
        case 'checkout.open': {
          if (props.surface !== 'shop') throw new Error('FORBIDDEN');
          if (!active?.context.customer) { currentProps.current.signIn(); stop(); return null; }
          const origin = await currentProps.current.transport(`${base}/purchase-origins`, 'POST', { pageId: props.pageId, path: active.context.page.path }) as { id: string };
          if (disposed) throw new Error('SESSION_REVOKED');
          currentProps.current.checkout(origin.id); stop(); return null;
        }
        case 'file.download': {
          const args = object(message.payload); exact(args, ['reference']);
          if (!active || !active.context.customer && !active.context.admin) throw new Error('FORBIDDEN');
          if (typeof args.reference !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(args.reference)) throw new Error('VALIDATION_ERROR');
          if (!downloadRate()) throw new Error('RATE_LIMITED');
          setPrompt({ reference: args.reference, sessionId: active.sessionId });
          return { prompted: true };
        }
        case 'bridge.close': stop(); return null;
        default: throw new Error('FORBIDDEN');
      }
    }
    function receive(event: MessageEvent) {
      if (disposed || !active || loadCount !== 1 || event.origin !== 'null' || event.source !== frame.current?.contentWindow || !inbound()) return;
      const message = parseEnvelope(event.data);
      if (!message) return;
      if (message.type === 'bridge.hello') {
        if (binding) return;
        const payload = message.payload as Record<string, Plain> | undefined;
        if (!payload || !Array.isArray(payload.supportedVersions) || !payload.supportedVersions.includes(1)) return;
        if (!binding) binding = { source: event.source as Window, nonce: randomNonce(), sessionId: active.sessionId };
        post({ id: message.id, type: 'bridge.welcome', payload: { context: context() as unknown as Plain, pluginToken: active.pluginToken, expiresAt: active.expiresAt } });
        return;
      }
      if (!binding || message.sessionId !== binding.sessionId || message.nonce !== binding.nonce || outstanding >= 32 || pendingIds.has(message.id)) return;
      const expected = binding;
      outstanding++;
      pendingIds.add(message.id);
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('ACTION_TIMEOUT')), 10_000); });
      void Promise.race([action(message), timeout]).then(result => post({ id: message.id, type: message.type, result }, expected), () => {
        post({ id: message.id, type: message.type, error: { code: 'PLUGIN_PAGE_ACTION_FAILED', message: 'The action could not be completed.' } }, expected);
        if (message.type === 'token.refresh') stop(true);
      }).finally(() => { clearTimeout(timer); outstanding--; pendingIds.delete(message.id); });
    }
    const observer = new MutationObserver(changed);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode', 'data-shop-dark-available', 'data-admin-dark-available'] });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener('change', changed);
    window.addEventListener('message', receive);
    const signOut = () => stop();
    window.addEventListener('jiffoo:identity-changing', signOut);
    const refreshTimer = setInterval(() => { if (binding) void refresh(binding).catch(() => stop(true)); }, 60_000);
    control.current = { loaded: () => { if (++loadCount > 1) stop(true); }, changed, save: async reference => {
      const expected = binding;
      if (!active || !expected) return;
      const result = await currentProps.current.transport(path('/download'), 'POST', { ...auth(), reference }) as { url: string };
      if (disposed || expected !== binding) return;
      const url = new URL(result.url, location.origin);
      if (url.origin !== location.origin || !/^\/plugin-downloads\/[a-zA-Z0-9_-]+$/.test(url.pathname)) throw new Error('FORBIDDEN');
      const anchor = document.createElement('a'); anchor.href = url.href; anchor.download = ''; anchor.rel = 'noreferrer';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setPrompt(null);
    } };
    setError(false);
    void props.transport(`${base}/session`, 'POST', { surface: props.surface, pageId: props.pageId }).then(result => {
      const next = result as ShellSession;
      if (disposed) { void props.transport(`${base}/sessions/${next.sessionId}`, 'DELETE', next.guestSecret ? { guestSecret: next.guestSecret } : {}).catch(() => undefined); return; }
      const url = new URL(next.frameUrl);
      if (url.origin !== location.origin || !/^\/api\/v1\/plugin-assets\/[^/]+\/[a-f0-9]{64}\/.+\.html$/.test(url.pathname)) throw new Error('FORBIDDEN');
      active = next; setSession(next);
    }).catch(() => { if (!disposed) stop(true); });
    return () => { stop(); observer.disconnect(); clearInterval(refreshTimer); window.removeEventListener('message', receive);
      colorScheme.removeEventListener('change', changed);
      window.removeEventListener('jiffoo:identity-changing', signOut); control.current = null; };
  }, [props.slug, props.pageId, props.surface, attempt]);

  useEffect(() => { control.current?.changed(); }, [props.locale, props.currency, props.store]);
  useEffect(() => {
    const dialog = downloadDialog.current;
    if (!dialog || !prompt || prompt.sessionId !== session?.sessionId) return;
    dialog.showModal();
    return () => dialog.close();
  }, [prompt, session?.sessionId]);

  return <section aria-label={props.title}>
    <h1>{props.title}</h1>
    {error ? <div role="alert"><p>{props.labels.unavailable}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{props.labels.retry}</button></div>
      : !session ? <p role="status">{props.labels.loading}</p>
        : <iframe ref={frame} role="document" aria-label={props.title} title={props.title} src={session.frameUrl} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer"
          onLoad={() => control.current?.loaded()} style={{ width: '100%', height, border: 0 }} />}
    {notice && <p role="status">{notice}</p>}
    {prompt && prompt.sessionId === session?.sessionId && <dialog ref={downloadDialog} aria-label={props.labels.download}
      onCancel={() => setPrompt(null)} style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))', padding: 24, borderRadius: 8, background: 'Canvas', color: 'CanvasText' }}>
      <p>{props.labels.download}</p><div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" onClick={() => void control.current?.save(prompt.reference).catch(() => { setPrompt(null); setNotice(props.labels.unavailable); })}>{props.labels.save}</button>
        <button type="button" onClick={() => setPrompt(null)}>{props.labels.cancel}</button>
      </div>
    </dialog>}
  </section>;
}
