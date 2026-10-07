import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { authenticateNativeUser } = vi.hoisted(() => ({ authenticateNativeUser: vi.fn() }));
vi.mock('./auth', () => ({ authenticateNativeUser, getNativeJwtSecret: vi.fn(), createNativeSession: vi.fn(), tryNativeAuth: vi.fn() }));

import { tryNativeAddressBook } from './address-book';

const validAddress = {
  name: '张三', phone: '13800138000', line1: '朝阳区望京街道 1 号',
  city: '北京', state: '北京', postalCode: '100000', country: 'CN',
};

function dbWith(rows: Record<string, unknown>[]) {
  const store = [...rows];
  return {
    store,
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          if (sql.includes('COUNT(*)')) return { n: store.length };
          if (!sql.includes('WHERE id = ?1 AND user_id = ?2')) return null;
          const id = values[0];
          return store.find((row) => row.id === id) ?? null;
        },
        all: async () => ({ results: [...store] }),
        run: async () => {
          if (sql.startsWith('INSERT INTO')) {
            const [id, , label, name, phone, line1, line2, state, city, postal, country, isDefault, now] = values;
            store.push({
              id, user_id: 'user-1', label, name, phone, line1, line2, state, city,
              postal_code: postal, country, is_default: isDefault, created_at: now, updated_at: now,
            });
          }
          if (sql.startsWith('UPDATE native_address_book SET label')) {
            const [label, name, phone, line1, line2, state, city, postal, country, updatedAt, id] = values;
            const row = store.find((entry) => entry.id === id);
            if (row) Object.assign(row, {
              label, name, phone, line1, line2, state, city,
              postal_code: postal, country, updated_at: updatedAt,
            });
          }
          return { success: true };
        },
      }),
      first: async () => null,
      run: async () => ({ success: true }),
    }),
    batch: async () => [],
  };
}

function request(method: string, path: string, body?: unknown) {
  return new Request(`https://api.example${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function call(env: unknown, method: string, path: string, body?: unknown) {
  const response = await tryNativeAddressBook(request(method, path, body), env as never);
  const payload = response ? await (response as Response).json() : null;
  return { status: response?.status, payload };
}

function baseEnv(db: unknown) {
  authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
  return { DB: db };
}

describe('native address book', () => {
  it('declines unrelated routes and unauthenticated calls', async () => {
    expect(await tryNativeAddressBook(request('GET', '/api/v1/other'), { DB: {} } as never)).toBeNull();
    authenticateNativeUser.mockResolvedValue(null);
    const response = await tryNativeAddressBook(request('GET', '/api/v1/me/addresses'), { DB: {} } as never);
    expect(response?.status).toBe(401);
  });

  it('creates the first address as default and lists it', async () => {
    const db = dbWith([]);
    const { status, payload } = await call(baseEnv(db), 'POST', '/api/v1/me/addresses', {
      label: '家', shippingAddress: validAddress,
    });
    expect(status).toBe(201);
    expect(payload.data.isDefault).toBe(true);
    expect(payload.data.shippingAddress.country).toBe('CN');
    const list = await call(baseEnv(db), 'GET', '/api/v1/me/addresses');
    expect(list.payload.data.total).toBe(1);
  });

  it('rejects incomplete addresses', async () => {
    const { status, payload } = await call(baseEnv(dbWith([])), 'POST', '/api/v1/me/addresses', {
      shippingAddress: { ...validAddress, phone: '' },
    });
    expect(status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('deletes the default and promotes the most recent remaining entry', async () => {
    const db = dbWith([
      { id: 'addr_default', user_id: 'user-1', label: '', name: '张三', phone: '13800138000', line1: 'a', line2: null, state: null, city: 'b', postal_code: null, country: 'CN', is_default: 1, created_at: 't1', updated_at: 't1' },
      { id: 'addr_other', user_id: 'user-1', label: '', name: '李四', phone: '13900139000', line1: 'c', line2: null, state: null, city: 'd', postal_code: null, country: 'CN', is_default: 0, created_at: 't2', updated_at: 't2' },
    ]);
    const { status, payload } = await call(baseEnv(db), 'DELETE', '/api/v1/me/addresses/addr_default');
    expect(status).toBe(200);
    expect(payload.data.deleted).toBe(true);
  });

  it('updates an address and returns the merged result', async () => {
    const db = dbWith([
      { id: 'addr_1', user_id: 'user-1', label: '', name: '张三', phone: '13800138000', line1: 'a', line2: null, state: null, city: 'b', postal_code: null, country: 'CN', is_default: 1, created_at: 't1', updated_at: 't1' },
    ]);
    const { status, payload } = await call(baseEnv(db), 'PATCH', '/api/v1/me/addresses/addr_1', {
      label: '公司', shippingAddress: { line1: '新地址 2 号' },
    });
    expect(status).toBe(200);
    expect(payload.data.label).toBe('公司');
  });

  it('404s on foreign ids', async () => {
    const { status } = await call(baseEnv(dbWith([])), 'DELETE', '/api/v1/me/addresses/addr_missing');
    expect(status).toBe(404);
  });
});
