import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const isNativePluginEnabled = vi.fn();
vi.mock('./plugin-enabled', () => ({ isNativePluginEnabled }));

const getNativePluginConfig = vi.fn();
vi.mock('./plugin-settings', () => ({ getNativePluginConfig }));

const nativeWalletBalance = vi.fn();
const nativeWalletMutate = vi.fn();
vi.mock('./native-wallet', () => ({ nativeWalletBalance, nativeWalletMutate }));

const { tryNativeVideoAi, processNativeVideoTasks } = await import('./video-ai');

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

function user(id = 'user-1') {
  return { id, email: 'user@example.com', username: 'user' };
}

function videoConfig(enabled = true, extra: Record<string, unknown> = {}) {
  if (!enabled) return null;
  return {
    enabled: true,
    config: {
      baseUrl: 'https://gateway.example',
      apiKey: 'key-123',
      model: 'gpt-image-2',
      videoModel: 'sora-2',
      videoCost4: 5,
      videoCost8: 12,
      videoCost12: 20,
      ...extra,
    },
  };
}

function r2Bucket() {
  return {
    get: vi.fn(),
    put: vi.fn(async () => undefined),
  };
}

function envWith(db: ReturnType<typeof fakeDb>, bucket = r2Bucket()) {
  return { DB: db as never, ASSETS: bucket as never };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

beforeEach(() => {
  authenticateNativeUser.mockReset();
  isNativePluginEnabled.mockReset();
  getNativePluginConfig.mockReset();
  nativeWalletBalance.mockReset();
  nativeWalletMutate.mockReset();
  authenticateNativeUser.mockResolvedValue(user());
  isNativePluginEnabled.mockResolvedValue(true);
  nativeWalletBalance.mockResolvedValue({ balance: 50, reservedBalance: 0, availableBalance: 50, totalCredited: 50, totalDebited: 0 });
  nativeWalletMutate.mockResolvedValue({ balance: 45, reservedBalance: 0, availableBalance: 45, totalCredited: 50, totalDebited: 5 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('video-ai config', () => {
  it('reports videoReady with the configured model and tier costs', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/config'), envWith(fakeDb()));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, unknown> };
    expect(body.data.videoReady).toBe(true);
    expect(body.data.model).toBe('sora-2');
    expect(body.data.costs).toEqual({ 4: 5, 8: 12, 12: 20 });
    expect(body.data.durations).toEqual([4, 8, 12]);
  });

  it('reports videoReady=false when no video model is configured', async () => {
    getNativePluginConfig.mockResolvedValue({
      enabled: true,
      config: { baseUrl: 'https://gateway.example', apiKey: 'key-123', model: 'gpt-image-2' },
    });
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/config'), envWith(fakeDb()));
    const body = await response.json() as { data: Record<string, unknown> };
    expect(body.data.videoReady).toBe(false);
    expect(body.data.model).toBeNull();
  });

  it('returns 404 when the plugin is disabled', async () => {
    isNativePluginEnabled.mockResolvedValue(false);
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/config'), envWith(fakeDb()));
    expect(response.status).toBe(404);
  });
});

describe('video-ai generate', () => {
  it('queues a pending task with tiered cost and persists prompt info', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    const db = fakeDb();
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'drone shot over a harbor at dawn', durationSec: 8, ratio: '16:9', idempotencyKey: 'idem-1' }),
    }), envWith(db));
    expect(response.status).toBe(202);
    const body = await response.json() as { data: Record<string, unknown> };
    expect(body.data.status).toBe('pending');
    expect(body.data.cost).toBe(12);
    expect(body.data.prompt).toBe('drone shot over a harbor at dawn');
    expect(db.batch).toHaveBeenCalled();
    const batched = (db.batch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{ bind: (...args: unknown[]) => unknown }>;
    expect(batched.length).toBe(2);
  });

  it('rejects a duration outside the supported tiers', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x', durationSec: 6 }),
    }), envWith(fakeDb()));
    expect(response.status).toBe(400);
  });

  it('returns 402 when the balance cannot cover the tier cost', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    nativeWalletBalance.mockResolvedValue({ balance: 1, reservedBalance: 0, availableBalance: 1, totalCredited: 1, totalDebited: 0 });
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'cinematic teaser', durationSec: 12 }),
    }), envWith(fakeDb()));
    expect(response.status).toBe(402);
  });

  it('returns 503 when video is not configured', async () => {
    getNativePluginConfig.mockResolvedValue({
      enabled: true,
      config: { baseUrl: 'https://gateway.example', apiKey: 'key-123', model: 'gpt-image-2' },
    });
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'cinematic teaser' }),
    }), envWith(fakeDb()));
    expect(response.status).toBe(503);
  });

  it('returns an existing task for a repeated idempotency key', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    const existing = {
      id: 'video_task_existing', user_id: 'user-1', status: 'submitted', cost: 5,
      wallet_balance_after: null, error_code: null, upstream_task_id: 'up-1', upstream_status: 'queued',
      progress: null, created_at: '2026-09-17T00:00:00Z', completed_at: null,
    };
    const db = fakeDb({ 'WHERE idempotency_key = ?1': { firstResult: existing } });
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x', idempotencyKey: 'idem-2' }),
    }), envWith(db));
    const body = await response.json() as { data: Record<string, unknown> };
    expect(body.data.taskId).toBe('video_task_existing');
    expect(body.data.status).toBe('submitted');
  });
});

describe('video-ai task access control', () => {
  it('hides tasks owned by other users', async () => {
    const owned = {
      id: 'video_task_x', user_id: 'someone-else', status: 'completed', cost: 5,
      wallet_balance_after: 5, error_code: null, upstream_task_id: 'up-1', upstream_status: 'completed',
      progress: 100, created_at: '2026-09-17T00:00:00Z', completed_at: '2026-09-17T00:05:00Z',
    };
    const db = fakeDb({ 'FROM native_video_tasks WHERE id = ?1': { firstResult: owned } });
    const response = await tryNativeVideoAi(new Request('https://x/api/v1/plugins/imager-ai/store/video/tasks/video_task_x'), envWith(db));
    expect(response.status).toBe(404);
  });
});

describe('processNativeVideoTasks', () => {
  const resultRow = { prompt: 'drone shot', duration_sec: 4, ratio: '16:9', source_image_url: null, result_video_url: '', model: 'sora-2' };

  function dbWithTasks(rows: Record<string, unknown[]>) {
    const db = fakeDb();
    const allTasks = Object.values(rows).flat();
    const originalPrepare = db.prepare.bind(db);
    (db as { prepare: unknown }).prepare = (sql: string) => {
      const statement = originalPrepare(sql);
      return {
        bind: (...args: unknown[]) => ({
          first: async () => {
            db.calls.push({ sql, args });
            if (sql.includes('native_video_results')) return resultRow;
            if (sql.includes('FROM native_video_tasks WHERE id = ?1')) {
              for (const task of allTasks) {
                if ((task as { id: string }).id === args[0]) return task;
              }
            }
            return null;
          },
          all: async () => {
            db.calls.push({ sql, args });
            for (const [needle, list] of Object.entries(rows)) {
              if (sql.includes(needle)) return { results: list };
            }
            return { results: [] };
          },
          run: async () => {
            db.calls.push({ sql, args });
            return { meta: { changes: 1 } };
          },
        }),
      };
    };
    return db;
  }

  it('submits pending tasks to the upstream videos endpoint', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    const pending = {
      id: 'video_task_p1', user_id: 'user-1', status: 'pending', cost: 5,
      wallet_balance_after: null, error_code: null, upstream_task_id: null, upstream_status: null,
      progress: null, created_at: '2026-09-17T00:00:00Z', completed_at: null,
    };
    const db = dbWithTasks({ "status = 'pending' ORDER BY created_at": [pending] });
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const text = String(url);
      if (text.endsWith('/videos')) return jsonResponse({ id: 'up-9', status: 'queued' }, 201);
      throw new Error(`unexpected fetch ${text}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const summary = await processNativeVideoTasks(envWith(db));
    expect(summary.submitted).toBe(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://gateway.example/v1/videos');
  });

  it('downloads the finished video into R2 and debits the wallet exactly once', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    const submitted = {
      id: 'video_task_s1', user_id: 'user-1', status: 'submitted', cost: 5,
      wallet_balance_after: null, error_code: null, upstream_task_id: 'up-7', upstream_status: 'in_progress',
      progress: 40, created_at: new Date(Date.now() - 5 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 60000).toISOString(),
    };
    const bucket = r2Bucket();
    const db = dbWithTasks({ "status = 'submitted' ORDER BY updated_at": [submitted] });
    const videoBytes = new Uint8Array([0x66, 0x74, 0x79, 0x70]);
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const text = String(url);
      if (text.endsWith('/videos/up-7')) return jsonResponse({ id: 'up-7', status: 'completed', progress: 100 });
      if (text.endsWith('/videos/up-7/content')) return new Response(videoBytes, { status: 200 });
      throw new Error(`unexpected fetch ${text}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = envWith(db, bucket);
    const summary = await processNativeVideoTasks(env);
    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(bucket.put).toHaveBeenCalledTimes(1);
    const [key, body, options] = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Uint8Array, { httpMetadata: { contentType: string } }];
    expect(key).toMatch(/^uploads\/video-ai\/generated\/.+\.mp4$/);
    expect(body).toStrictEqual(videoBytes);
    expect(options.httpMetadata.contentType).toBe('video/mp4');
    expect(nativeWalletMutate).toHaveBeenCalledWith(env, expect.objectContaining({
      userId: 'user-1',
      amount: 5,
      operation: 'debit',
      idempotencyKey: 'video-ai:generation:video_task_s1',
    }));
  });

  it('marks a task failed without debiting when the upstream rejects it', async () => {
    getNativePluginConfig.mockResolvedValue(videoConfig());
    const pending = {
      id: 'video_task_p2', user_id: 'user-1', status: 'pending', cost: 5,
      wallet_balance_after: null, error_code: null, upstream_task_id: null, upstream_status: null,
      progress: null, created_at: '2026-09-17T00:00:00Z', completed_at: null,
    };
    const db = dbWithTasks({ "status = 'pending' ORDER BY created_at": [pending] });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'video model unavailable' } }, 503)));
    const summary = await processNativeVideoTasks(envWith(db));
    expect(summary.submitted).toBe(0);
    expect(summary.failed).toBe(1);
    expect(nativeWalletMutate).not.toHaveBeenCalled();
    const failedUpdate = db.calls.find((call) => call.sql.includes("status = 'failed'"));
    expect(failedUpdate).toBeTruthy();
    expect(String(failedUpdate?.args[1])).toContain('video model unavailable');
  });

  it('does nothing when video is not configured', async () => {
    getNativePluginConfig.mockResolvedValue(null);
    const summary = await processNativeVideoTasks(envWith(fakeDb()));
    expect(summary).toEqual({ submitted: 0, polled: 0, completed: 0, failed: 0 });
  });
});
