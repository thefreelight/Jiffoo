import { afterEach, describe, expect, it, vi } from 'vitest';

const { modules } = vi.hoisted(() => ({ modules: [] as Array<Record<string, unknown>> }));
vi.mock('./native-plugin-modules/registry', () => ({ NATIVE_PLUGIN_MODULES: modules }));
// The marketplace route authenticates the administrator; the rest of the auth chain is not under test here.
const authenticateNativeAdmin = vi.fn(async () => true);
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const {
  compiledNativePluginModules,
  notifyNativePluginModules,
  runNativePluginModuleWork,
  tryNativePluginModuleRoutes,
} = await import('./native-plugin-modules/runtime');

const env = { DB: {} } as never;
const waitUntil = () => undefined;

function reset(): void {
  modules.length = 0;
}

describe('native plugin modules', () => {
  it('do nothing when the build compiled none in, which is the open-source build', async () => {
    reset();
    expect(compiledNativePluginModules()).toEqual([]);
    expect(await tryNativePluginModuleRoutes(new Request('https://api.example/api/v1/anything'), env, waitUntil)).toBeNull();
    expect(await notifyNativePluginModules(env, { type: 'order.created', payload: {} })).toEqual([]);
    expect(await runNativePluginModuleWork(env)).toEqual({});
  });

  it('answer with the first module that recognises the request', async () => {
    reset();
    const request = new Request('https://api.example/api/v1/extensions/plugin/first/api/admin/state');
    const answer = new Response('{}');
    const seen: string[] = [];
    modules.push({ id: 'silent', tryRoute: vi.fn(async () => null) });
    modules.push({ id: 'no-routes' });
    modules.push({ id: 'first', tryRoute: vi.fn(async () => { seen.push('first'); return answer; }) });
    modules.push({ id: 'later', tryRoute: vi.fn(async () => new Response('later')) });

    expect(await tryNativePluginModuleRoutes(request, env, waitUntil)).toBe(answer);
    expect(seen).toEqual(['first']);
    expect(modules[3]?.tryRoute).not.toHaveBeenCalled();
  });

  it('let a module that throws surface, as any other handler does', async () => {
    reset();
    modules.push({ id: 'broken', tryRoute: async () => { throw new Error('boom'); } });
    await expect(tryNativePluginModuleRoutes(new Request('https://api.example/x'), env, waitUntil)).rejects.toThrow('boom');
  });

  it('tell every listening module about a store event, and report one that fails without stopping the others', async () => {
    reset();
    const told: string[] = [];
    modules.push({ id: 'no-listener' });
    modules.push({ id: 'orders', onStoreEvent: async (_env, event) => { told.push(`orders:${event.type}`); return { queued: 1 }; } });
    modules.push({ id: 'broken', onStoreEvent: async () => { throw new Error('table missing'); } });
    modules.push({ id: 'later', onStoreEvent: async () => { told.push('later'); } });

    const event = { id: 'evt_1', type: 'order.paid', payload: { order: { id: 'ord_1' } } };
    expect(await notifyNativePluginModules(env, event)).toEqual([
      { id: 'orders', status: 'fulfilled' },
      { id: 'broken', status: 'rejected', error: 'table missing' },
      { id: 'later', status: 'fulfilled' },
    ]);
    expect(told).toEqual(['orders:order.paid', 'later']);
  });

  it('describe a failure that is not an Error by its text', async () => {
    reset();
    modules.push({ id: 'odd', onStoreEvent: async () => Promise.reject('not an error') });
    expect(await notifyNativePluginModules(env, { type: 'x', payload: null })).toEqual([{ id: 'odd', status: 'rejected', error: 'not an error' }]);
  });

  it('run each module\'s scheduled work and report every outcome', async () => {
    reset();
    const ran: string[] = [];
    modules.push({ id: 'quiet' });
    modules.push({ id: 'a', runScheduledWork: async () => { ran.push('a'); return { tried: 2 }; } });
    modules.push({ id: 'b', runScheduledWork: async () => { ran.push('b'); throw new Error('network'); } });
    modules.push({ id: 'c', runScheduledWork: async () => { ran.push('c'); return 'done'; } });

    expect(await runNativePluginModuleWork(env)).toEqual({ a: { tried: 2 }, b: { error: 'network' }, c: 'done' });
    expect(ran).toEqual(['a', 'b', 'c']);
  });

  it('name the compiled-in modules by slug for the health report', () => {
    reset();
    modules.push({ id: 'one' }, { id: 'two' });
    expect(compiledNativePluginModules()).toEqual(['one', 'two']);
    reset();
  });
});

describe('a compiled-in module on the install route', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function install(pricingModel: string) {
    const { tryNativeMarketplace } = await import('./marketplace');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [
      { slug: 'team-example', kind: 'plugin', installable: true, sellableVersion: '0.0.1', pricingModel, packageAccess: pricingModel === 'free' ? 'public' : 'license' },
    ] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/team-example/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin', version: '0.0.1' }),
    }), { DB: db } as never);
    return { response, run };
  }

  it('counts as implemented: a free one installs like the plugins listed by hand', async () => {
    reset();
    modules.push({ id: 'team-example' });
    const { response, run } = await install('free');
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { slug: 'team-example', version: '0.0.1' } });
    expect(run).toHaveBeenCalledOnce();
    reset();
  });

  it('is not installed on the module\'s say-so: a non-free one still needs what the platform accepts', async () => {
    reset();
    modules.push({ id: 'team-example' });
    const { response, run } = await install('member');
    expect(response?.status).toBe(402);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'MEMBERSHIP_REQUIRED' } });
    expect(run).not.toHaveBeenCalled();
    reset();
  });

  it('is not implemented when the build compiled none in', async () => {
    reset();
    const { response } = await install('free');
    expect(response?.status).toBe(501);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'NATIVE_PLUGIN_NOT_IMPLEMENTED' } });
  });
});
