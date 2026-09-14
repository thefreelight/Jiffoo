import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const isNativePluginEnabled = vi.fn();
vi.mock('./plugin-enabled', () => ({ isNativePluginEnabled }));

const getNativePluginConfig = vi.fn();
vi.mock('./plugin-settings', () => ({ getNativePluginConfig }));

const nativeWalletBalance = vi.fn();
const nativeWalletMutate = vi.fn();
vi.mock('./native-wallet', () => ({ nativeWalletBalance, nativeWalletMutate }));

const { tryNativeImagerAi } = await import('./imager-ai');

interface FakeStatement {
  rows: unknown[];
  firstResult: unknown;
  runResult: { meta: { changes: number } };
}

function fakeDb(handlers: Record<string, FakeStatement> = {}) {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const make = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => {
        calls.push({ sql, args });
        for (const [needle, statement] of Object.entries(handlers)) {
          if (sql.includes(needle)) return statement.firstResult ?? null;
        }
        return null;
      },
      all: async () => {
        calls.push({ sql, args });
        for (const [needle, statement] of Object.entries(handlers)) {
          if (sql.includes(needle)) return { results: statement.rows ?? [] };
        }
        return { results: [] };
      },
      run: async () => {
        calls.push({ sql, args });
        for (const [needle, statement] of Object.entries(handlers)) {
          if (sql.includes(needle)) return statement.runResult ?? { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      },
    }),
  });
  return {
    prepare: (sql: string) => make(sql),
    batch: vi.fn(async (statements: unknown[]) => {
      for (const statement of statements) {
        await (statement as { run?: () => Promise<unknown> }).run?.();
      }
      return statements;
    }),
    calls,
  };
}

function request(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

const STORE = 'https://api.example/api/v1/plugins/imager-ai/store';

beforeEach(() => {
  vi.clearAllMocks();
  isNativePluginEnabled.mockResolvedValue(true);
});

describe('native imager-ai contract', () => {
  it('ignores unrelated paths', async () => {
    const response = await tryNativeImagerAi(request('https://api.example/api/v1/plugins/coupon/api/redeem'), { DB: fakeDb() } as never);
    expect(response).toBeNull();
  });

  it('fails closed when the plugin is disabled', async () => {
    isNativePluginEnabled.mockResolvedValue(false);
    const response = await tryNativeImagerAi(request(`${STORE}/config`), { DB: fakeDb() } as never);
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'PLUGIN_NOT_ENABLED' } });
  });

  it('reports configured state from decrypted plugin config', async () => {
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: { baseUrl: 'https://provider.test/v1/', model: 'gpt-image-2', apiKey: 'sk-test', creditCost: 3 } });
    const response = await tryNativeImagerAi(request(`${STORE}/config`), { DB: fakeDb() } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      success: true,
      data: { configured: true, creditCost: 3, model: 'gpt-image-2', imageReady: true, generateEndpoint: '/api/v1/plugins/imager-ai/store/generate' },
    });
  });

  it('marks config not-ready when provider credentials are missing', async () => {
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: {} });
    const response = await tryNativeImagerAi(request(`${STORE}/config`), { DB: fakeDb() } as never);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { configured: false, imageReady: false } });
  });

  it('requires login for generate', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const response = await tryNativeImagerAi(request(`${STORE}/generate`, { method: 'POST', body: JSON.stringify({ prompt: 'x' }) }), { DB: fakeDb() } as never);
    expect(response?.status).toBe(401);
  });

  it('rejects empty prompts', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const response = await tryNativeImagerAi(request(`${STORE}/generate`, { method: 'POST', body: JSON.stringify({ prompt: '  ' }) }), { DB: fakeDb() } as never);
    expect(response?.status).toBe(400);
  });

  it('returns the existing task for a repeated idempotency key without calling the provider', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const db = fakeDb({
      'SELECT * FROM native_imager_tasks WHERE idempotency_key': {
        rows: [],
        firstResult: { id: 'imager_task_old', user_id: 'user-1', status: 'completed', cost: 1, wallet_balance_after: 9, error_code: null, idempotency_key: 'k1', created_at: '2026-09-01T00:00:00Z', completed_at: null },
      },
      'SELECT prompt, style, source_image_url FROM native_imager_results': { rows: [], firstResult: null },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await tryNativeImagerAi(request(`${STORE}/generate`, { method: 'POST', body: JSON.stringify({ prompt: 'again', idempotencyKey: 'k1' }) }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { taskId: 'imager_task_old', status: 'completed' } });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects foreign idempotency keys', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const db = fakeDb({
      'SELECT * FROM native_imager_tasks WHERE idempotency_key': {
        rows: [],
        firstResult: { id: 'imager_task_old', user_id: 'someone-else', status: 'completed', cost: 1, wallet_balance_after: 9, error_code: null, idempotency_key: 'k1', created_at: '2026-09-01T00:00:00Z', completed_at: null },
      },
    });
    const response = await tryNativeImagerAi(request(`${STORE}/generate`, { method: 'POST', body: JSON.stringify({ prompt: 'again', idempotencyKey: 'k1' }) }), { DB: db } as never);
    expect(response?.status).toBe(409);
  });

  it('blocks on insufficient balance before touching the provider', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: { baseUrl: 'https://provider.test/v1', model: 'm', apiKey: 'sk' } });
    nativeWalletBalance.mockResolvedValue({ userId: 'user-1', balance: 0, reservedBalance: 0, availableBalance: 0, totalCredited: 0, totalDebited: 0 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await tryNativeImagerAi(request(`${STORE}/generate`, { method: 'POST', body: JSON.stringify({ prompt: 'art' }) }), { DB: fakeDb() } as never);
    expect(response?.status).toBe(402);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('generates, debits once, and completes the task', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: { baseUrl: 'https://provider.test/v1', model: 'gpt-image-2', apiKey: 'sk-test', creditCost: 2 } });
    nativeWalletBalance.mockResolvedValue({ userId: 'user-1', balance: 10, reservedBalance: 0, availableBalance: 10, totalCredited: 10, totalDebited: 0 });
    nativeWalletMutate.mockResolvedValue({ userId: 'user-1', balance: 8, reservedBalance: 0, availableBalance: 8, totalCredited: 10, totalDebited: 2 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ output: [{ type: 'image_generation', result: 'https://cdn.test/image.png' }] }), { status: 200 }));
    const db = fakeDb();
    const response = await tryNativeImagerAi(request(`${STORE}/generate`, { method: 'POST', body: JSON.stringify({ prompt: 'a fox', style: 'ghibli' }) }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      success: true,
      data: { status: 'completed', imageUrl: 'https://cdn.test/image.png', resultImageUrl: 'https://cdn.test/image.png', walletBalanceAfter: 8, cached: false },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://provider.test/v1/responses');
    expect(String(init.body)).toContain('image_generation');
    expect(String(init.body)).toContain('a fox');
    expect(String((init.headers as Record<string, string>).authorization)).toBe('Bearer sk-test');
    expect(nativeWalletMutate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      operation: 'debit', amount: 2, type: 'generation', sourcePlugin: 'imager-ai', referenceId: expect.stringMatching(/^imager_task_/),
    }));
    const inserted = db.calls.find((call) => call.sql.includes('INSERT INTO native_imager_results'));
    expect(inserted).toBeTruthy();
    fetchSpy.mockRestore();
  });

  it('never debits when the provider fails and records the failure', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    getNativePluginConfig.mockResolvedValue({ enabled: true, config: { baseUrl: 'https://provider.test/v1', model: 'm', apiKey: 'sk', creditCost: 1 } });
    nativeWalletBalance.mockResolvedValue({ userId: 'user-1', balance: 10, reservedBalance: 0, availableBalance: 10, totalCredited: 10, totalDebited: 0 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'provider exploded' } }), { status: 500 }));
    const db = fakeDb();
    const response = await tryNativeImagerAi(request(`${STORE}/generate`, { method: 'POST', body: JSON.stringify({ prompt: 'boom' }) }), { DB: db } as never);
    expect(response?.status).toBe(502);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'IMAGER_GENERATION_FAILED', message: 'provider exploded' } });
    expect(nativeWalletMutate).not.toHaveBeenCalled();
    const failed = db.calls.find((call) => call.sql.includes("SET status = 'failed'"));
    expect(failed).toBeTruthy();
    fetchSpy.mockRestore();
  });

  it('reads task status for the owner and hides foreign tasks', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const own = fakeDb({
      'SELECT * FROM native_imager_tasks WHERE id': {
        rows: [],
        firstResult: { id: 'imager_task_1', user_id: 'user-1', status: 'completed', cost: 1, wallet_balance_after: 9, error_code: null, idempotency_key: null, created_at: 'x', completed_at: 'y' },
      },
      'SELECT prompt, style, source_image_url, result_image_url, model FROM native_imager_results': {
        rows: [],
        firstResult: { prompt: 'p', style: null, source_image_url: null, result_image_url: 'https://cdn.test/a.png', model: 'm' },
      },
    });
    const response = await tryNativeImagerAi(request(`${STORE}/tasks/imager_task_1`), { DB: own } as never);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { status: 'completed', imageUrl: 'https://cdn.test/a.png' } });
    const foreign = fakeDb({
      'SELECT * FROM native_imager_tasks WHERE id': {
        rows: [],
        firstResult: { id: 'imager_task_1', user_id: 'someone-else', status: 'completed', cost: 1, wallet_balance_after: 9, error_code: null, idempotency_key: null, created_at: 'x', completed_at: 'y' },
      },
    });
    const hidden = await tryNativeImagerAi(request(`${STORE}/tasks/imager_task_1`), { DB: foreign } as never);
    expect(hidden?.status).toBe(404);
  });

  it('lists history for the current user', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const db = fakeDb({
      'SELECT * FROM native_imager_tasks WHERE user_id': {
        rows: [{ id: 'imager_task_1', user_id: 'user-1', status: 'completed', cost: 1, wallet_balance_after: 9, error_code: null, idempotency_key: null, created_at: 'x', completed_at: 'y' }],
      },
      'FROM native_imager_results r JOIN native_imager_tasks t': {
        rows: [{ taskId: 'imager_task_1', prompt: 'hello', style: 'poster', source_image_url: null, result_image_url: 'https://cdn.test/h.png', model: 'm' }],
      },
    });
    const response = await tryNativeImagerAi(request(`${STORE}/history?limit=5`), { DB: db } as never);
    const payload = await response?.json();
    expect(Array.isArray(payload?.data)).toBe(true);
    expect(payload.data[0]).toMatchObject({ taskId: 'imager_task_1', prompt: 'hello', resultImageUrl: 'https://cdn.test/h.png' });
  });
});
