import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

type Statement = { sql: string; args: unknown[]; first: () => Promise<unknown> };

function makeEnv() {
  const stored = new Map<string, { payload: string; status_code: number; content_type: string }>();
  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]): Statement => ({
        sql,
        args,
        first: async () => stored.get(String(args[0])) ?? null,
      }),
    }),
    batch: async (statements: Statement[]) => {
      for (const statement of statements) {
        const [key, , payload, statusCode, contentType] = statement.args;
        stored.set(String(key), {
          payload: String(payload),
          status_code: Number(statusCode),
          content_type: String(contentType),
        });
      }
      return [];
    },
  };
  const env = {
    DB: db,
    CACHE: { put: vi.fn().mockResolvedValue(undefined) },
    SNAPSHOT_IMPORT_TOKEN: 'test-token',
  };
  return { env, stored };
}

async function importSnapshots(env: { SNAPSHOT_IMPORT_TOKEN: string }, snapshots: Array<{ path: string; payload: unknown }>) {
  const { default: worker } = await import('./index');
  return worker.fetch(new Request('https://api.example/api/v1/internal/snapshots/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jiffoo-snapshot-import-token': env.SNAPSHOT_IMPORT_TOKEN },
    body: JSON.stringify({ snapshots }),
  }), env as never, {} as ExecutionContext);
}

describe('theme-extensions embeds read', () => {
  it('answers the empty set with 200 when no embeds snapshot exists', async () => {
    const { env } = makeEnv();
    const { default: worker } = await import('./index');

    const response = await worker.fetch(
      new Request('https://api.example/api/v1/extensions/theme-extensions/embeds'),
      env as never,
      { waitUntil: () => {} } as unknown as ExecutionContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { items: [] } });
  });

  it('serves an imported embeds snapshot as usual', async () => {
    const { env, stored } = makeEnv();
    const context = { success: true, data: { items: [{ id: 'e1', targetPosition: 'home-hero' }] } };
    stored.set('core:snapshot:/api/v1/extensions/theme-extensions/embeds', {
      payload: JSON.stringify(context),
      status_code: 200,
      content_type: 'application/json',
    });

    const { default: worker } = await import('./index');
    const response = await worker.fetch(
      new Request('https://api.example/api/v1/extensions/theme-extensions/embeds'),
      env as never,
      { waitUntil: () => {} } as unknown as ExecutionContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(context);
  });

  it('keeps the missing-snapshot 503 for every other native read', async () => {
    const { env } = makeEnv();
    const { default: worker } = await import('./index');

    const response = await worker.fetch(
      new Request('https://api.example/api/v1/store/context'),
      env as never,
      { waitUntil: () => {} } as unknown as ExecutionContext,
    );

    expect(response.status).toBe(503);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('NATIVE_SNAPSHOT_UNAVAILABLE');
  });
});
