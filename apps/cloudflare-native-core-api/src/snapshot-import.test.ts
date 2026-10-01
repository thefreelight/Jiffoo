import { describe, expect, it, vi } from 'vitest';
import { isAllowedSnapshotPath } from './snapshot-import';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

describe('snapshot import path policy', () => {
  it('allows product list and detail snapshots', () => {
    expect(isAllowedSnapshotPath('/api/v1/products')).toBe(true);
    expect(isAllowedSnapshotPath('/api/v1/products/sku-123?locale=en')).toBe(true);
  });

  it('allows the canonical store and active theme snapshots', () => {
    expect(isAllowedSnapshotPath('/api/v1/store')).toBe(true);
    expect(isAllowedSnapshotPath('/api/v1/store/context')).toBe(true);
    expect(isAllowedSnapshotPath('/api/v1/themes/active')).toBe(true);
    expect(isAllowedSnapshotPath('/api/v1/themes/active?target=shop')).toBe(true);
    expect(isAllowedSnapshotPath('/api/v1/themes/active?target=admin')).toBe(true);
  });

  it('rejects arbitrary paths and origins', () => {
    expect(isAllowedSnapshotPath('/api/v1/store/context/extra')).toBe(false);
    expect(isAllowedSnapshotPath('https://example.com/api/v1/products')).toBe(false);
    expect(isAllowedSnapshotPath('/api/v1/products/../../admin')).toBe(false);
  });

  it('serves an imported store context from the same native snapshot key', async () => {
    const stored = new Map<string, { payload: string; status_code: number; content_type: string }>();
    type Statement = { sql: string; args: unknown[]; first: () => Promise<unknown> };
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
    const { default: worker } = await import('./index');
    const context = {
      success: true,
      data: {
        storeId: 'store-1',
        storeName: 'RemoteRadar',
        theme: { slug: 'remoteradar', version: '0.0.18' },
      },
    };

    const imported = await worker.fetch(new Request('https://api.example/api/v1/internal/snapshots/import', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-jiffoo-snapshot-import-token': 'test-token',
      },
      body: JSON.stringify({ snapshots: [{ path: '/api/v1/store/context', payload: context }] }),
    }), env as never, {} as ExecutionContext);

    expect(imported.status).toBe(200);
    await expect(imported.json()).resolves.toEqual({
      success: true,
      imported: ['/api/v1/store/context'],
    });
    expect(stored.has('core:snapshot:/api/v1/store/context')).toBe(true);

    const response = await worker.fetch(
      new Request('https://api.example/api/v1/store/context'),
      env as never,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1');
    await expect(response.json()).resolves.toEqual(context);
  });
});
