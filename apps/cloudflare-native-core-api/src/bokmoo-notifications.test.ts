import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { authenticateNativeAdmin, authenticateNativeUser } = vi.hoisted(() => ({
  authenticateNativeAdmin: vi.fn(),
  authenticateNativeUser: vi.fn(),
}));
vi.mock('./auth', () => ({
  authenticateNativeAdmin,
  authenticateNativeUser,
  getNativeJwtSecret: vi.fn(),
  createNativeSession: vi.fn(),
  tryNativeAuth: vi.fn(),
}));

import { tryNativeBokmooNotifications } from './bokmoo-notifications';

const stored = {
  id: 'notif-1', user_id: 'user-1', type: 'announcement', title: '黑五开抢',
  body: '全场限时优惠', metadata_json: null, read_at: null,
  created_at: '2026-10-30T00:00:00.000Z',
};

function dbWith(rows: Record<string, unknown>[]) {
  const table = rows.map((row) => ({ ...row }));
  return {
    table,
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          if (sql.includes('COUNT(*) AS n FROM native_bokmoo_notifications WHERE user_id = ?1 AND read_at IS NULL')) {
            return { n: table.filter((row) => row.user_id === values[0] && !row.read_at).length };
          }
          if (sql.includes('COUNT(*) AS n FROM native_bokmoo_notifications WHERE user_id = ?1')) {
            return { n: table.filter((row) => row.user_id === values[0]).length };
          }
          if (sql.includes('COUNT(*) AS n FROM native_bokmoo_notifications')) return { n: table.length };
          if (sql.includes('WHERE id = ?1')) return table.find((row) => row.id === values[0]) ?? null;
          return null;
        },
        all: async () => ({ results: [...table] }),
        run: async () => {
          if (sql.startsWith('INSERT INTO')) {
            const [id, userId, type, title, body, metadata, createdAt] = values;
            table.push({ id, user_id: userId, type, title, body, metadata_json: metadata, read_at: null, created_at: createdAt });
          }
          if (sql.includes('SET read_at = ?1 WHERE user_id = ?2 AND read_at IS NULL')) {
            table.forEach((row) => { if (row.user_id === values[1] && !row.read_at) row.read_at = values[0] as string; });
          }
          if (sql.includes('SET read_at = ?1 WHERE id = ?2 AND user_id = ?3 AND read_at IS NULL')) {
            const row = table.find((entry) => entry.id === values[1] && entry.user_id === values[2]);
            if (row && !row.read_at) { row.read_at = values[0] as string; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          return { success: true };
        },
      }),
      first: async () => null,
      run: async () => ({ success: true }),
    }),
  };
}

function env(db: ReturnType<typeof dbWith>) {
  return { DB: db } as never;
}

function request(method: string, path: string, body?: unknown, bearer = 'token-1'): Request {
  return new Request(`https://api.bokmoo.com${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('tryNativeBokmooNotifications', () => {
  it('lists notifications with unread count for the authenticated user', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const db = dbWith([stored]);
    const response = await tryNativeBokmooNotifications(request('GET', '/api/v1/me/notifications'), env(db));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0].title).toBe('黑五开抢');
    expect(payload.data.unread).toBe(1);
  });

  it('rejects anonymous list access', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const response = await tryNativeBokmooNotifications(request('GET', '/api/v1/me/notifications'), env(dbWith([])));
    expect(response.status).toBe(401);
  });

  it('marks one notification read and reports missing rows', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const db = dbWith([stored]);
    const ok = await tryNativeBokmooNotifications(request('POST', '/api/v1/me/notifications/notif-1/read'), env(db));
    expect((await ok.json()).data.read).toBe('notif-1');
    expect(db.table[0].read_at).toBeTruthy();
    const missing = await tryNativeBokmooNotifications(request('POST', '/api/v1/me/notifications/nope/read'), env(dbWith([stored])));
    expect(missing.status).toBe(404);
  });

  it('marks all read', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const db = dbWith([stored]);
    const response = await tryNativeBokmooNotifications(request('POST', '/api/v1/me/notifications/read-all'), env(db));
    expect((await response.json()).data.read).toBe('all');
    expect(db.table[0].read_at).toBeTruthy();
  });

  it('creates an announcement via the admin endpoint', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    const db = dbWith([]);
    const response = await tryNativeBokmooNotifications(request('POST', '/api/v1/admin/notifications', {
      userId: 'user-1', title: '黑五开抢', body: '全场限时优惠', type: 'announcement',
      metadata: { campaign: 'black-friday-2026' },
    }), env(db));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.title).toBe('黑五开抢');
    expect(db.table).toHaveLength(1);
  });

  it('validates admin payloads', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
    const missing = await tryNativeBokmooNotifications(request('POST', '/api/v1/admin/notifications', { title: 'x' }), env(dbWith([])));
    expect(missing.status).toBe(400);
    const badType = await tryNativeBokmooNotifications(request('POST', '/api/v1/admin/notifications', {
      userId: 'u', title: 't', body: 'b', type: 'spam',
    }), env(dbWith([])));
    expect(badType.status).toBe(400);
  });

  it('rejects anonymous admin access', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeBokmooNotifications(request('POST', '/api/v1/admin/notifications', { userId: 'u', title: 't', body: 'b' }), env(dbWith([])));
    expect(response.status).toBe(401);
  });


  it('serves the short /api/notifications alias the apps call', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const db = dbWith([stored]);
    const response = await tryNativeBokmooNotifications(request('GET', '/api/notifications?page=1&limit=20'), env(db));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0].readAt).toBeNull();

    const read = await tryNativeBokmooNotifications(request('POST', '/api/notifications/notif-1/read'), env(db));
    expect((await read.json()).data.read).toBe('notif-1');
  });

  it('ignores unrelated routes', async () => {
    const response = await tryNativeBokmooNotifications(request('GET', '/api/v1/me/addresses'), env(dbWith([])));
    expect(response).toBeNull();
  });
});
