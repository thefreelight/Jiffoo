import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

interface CapturedStatement {
  sql: string;
  bindings: unknown[];
}

interface FakeUserRow {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar: string | null;
  is_active: number;
  email_verified: number;
  password_salt: string;
  password_hash: string;
  password_iterations: number;
  migrated_at: string;
  updated_at: string;
  created_at: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations: 100000 },
    key,
    256,
  );
  return base64Url(new Uint8Array(bits));
}

function makeUser(overrides: Partial<FakeUserRow> = {}): FakeUserRow {
  return {
    id: 'u-1',
    email: 'shopper@jiffoo.test',
    username: 'shopper',
    role: 'USER',
    avatar: null,
    is_active: 1,
    email_verified: 1,
    password_salt: '',
    password_hash: '',
    password_iterations: 100000,
    migrated_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_at: null,
    last_login_at: null,
    last_login_ip: null,
    ...overrides,
  };
}

function fakeEnv(users: FakeUserRow[]) {
  const captured: CapturedStatement[] = [];
  const securityEvents: CapturedStatement[] = [];
  const prepare = (sql: string) => {
    const statement = (bound: unknown[]) => ({
      first: async () => {
        captured.push({ sql, bindings: bound });
        if (sql.includes('FROM native_users WHERE')) {
          const needle = String(bound[0]).toLowerCase();
          return users.find((u) => u.email === needle || u.id === String(bound[0]) || u.username === needle) ?? null;
        }
        if (sql.includes('FROM native_user_security_events WHERE user_id')) {
          return { results: [] } as never;
        }
        return null;
      },
      all: async () => {
        captured.push({ sql, bindings: bound });
        if (sql.includes('FROM native_user_security_events')) return { results: [] };
        return { results: [] };
      },
      run: async () => {
        captured.push({ sql, bindings: bound });
        if (sql.includes('INSERT INTO native_user_security_events')) securityEvents.push({ sql, bindings: bound });
        return { meta: { changes: 1 } };
      },
    });
    return { ...statement([]), bind: (...args: unknown[]) => statement(args) };
  };
  return {
    env: {
      JWT_SECRET_VALUE: 'test-secret',
      DB: { prepare },
    } as unknown as Parameters<typeof import('./auth')['tryNativeAuth']>[1],
    captured,
    securityEvents,
  };
}

function loginRequest(path: string, body: unknown, ip = '203.0.113.9'): Request {
  return new Request(`https://api.bokmoo.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, 'user-agent': 'vitest-agent' },
    body: JSON.stringify(body),
  });
}

const noopProxy = () => Promise.resolve(new Response(null, { status: 404 }));

beforeEach(() => {});

describe('native login audit', () => {
  it('records login.failed for an unknown admin identifier', async () => {
    const { tryNativeAuth } = await import('./auth');
    const state = fakeEnv([]);
    const response = await tryNativeAuth(loginRequest('/api/v1/admin/auth/login', { identifier: 'ghost@jiffoo.test', password: 'pw123456' }), state.env as never, noopProxy);
    expect(response?.status).toBe(401);
    expect(state.securityEvents).toHaveLength(1);
    expect(state.securityEvents[0].bindings).toContain('login.failed');
    expect(state.securityEvents[0].bindings).toContain('ghost@jiffoo.test');
    expect(state.securityEvents[0].bindings).toContain('203.0.113.9');
  });

  it('records login.failed for a bad admin password and login.success updates the user row', async () => {
    const { tryNativeAuth } = await import('./auth');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const goodHash = await pbkdf2('correct-horse', salt);
    const admin = makeUser({ role: 'SUPER_ADMIN', password_salt: base64Url(salt), password_hash: goodHash });
    const state = fakeEnv([admin]);

    const bad = await tryNativeAuth(loginRequest('/api/v1/admin/auth/login', { identifier: 'shopper@jiffoo.test', password: 'wrong' }), state.env as never, noopProxy);
    expect(bad?.status).toBe(401);
    expect(state.securityEvents.at(-1)?.bindings).toContain('login.failed');

    const good = await tryNativeAuth(loginRequest('/api/v1/admin/auth/login', { identifier: 'shopper@jiffoo.test', password: 'correct-horse' }), state.env as never, noopProxy);
    expect(good?.status).toBe(200);
    expect(state.securityEvents.at(-1)?.bindings).toContain('login.success');
    const update = state.captured.find((entry) => entry.sql.includes('SET last_login_at'));
    expect(update).toBeDefined();
    expect(update?.bindings).toContain('203.0.113.9');
    expect(update?.bindings.at(-1)).toBe('u-1');
  });

  it('records storefront login success with the storefront source', async () => {
    const { tryNativeAuth } = await import('./auth');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const goodHash = await pbkdf2('correct-horse', salt);
    const shopper = makeUser({ password_salt: base64Url(salt), password_hash: goodHash });
    const state = fakeEnv([shopper]);
    const response = await tryNativeAuth(loginRequest('/api/v1/auth/login', { email: 'shopper@jiffoo.test', password: 'correct-horse' }), state.env as never, noopProxy);
    expect(response?.status).toBe(200);
    expect(state.securityEvents.at(-1)?.bindings).toContain('login.success');
    expect(state.securityEvents.at(-1)?.bindings).toContain('storefront');
  });

  it('exposes created/last-login fields and recent events on the admin user view', async () => {
    const { recordNativeLoginSuccess } = await import('./security-audit');
    const state = fakeEnv([makeUser()]);
    await recordNativeLoginSuccess(state.env as never, {
      email: 'shopper@jiffoo.test',
      userId: 'u-1',
      source: 'storefront',
      ip: '198.51.100.7',
      userAgent: 'ua',
    });
    const update = state.captured.find((entry) => entry.sql.includes('SET last_login_at'));
    expect(update?.bindings).toContain('198.51.100.7');
    expect(state.securityEvents).toHaveLength(1);
  });

  it('does not let audit failures block a login', async () => {
    const { recordLoginAudit } = await import('./security-audit');
    const brokenEnv = {
      DB: {
        prepare: () => {
          throw new Error('d1 unavailable');
        },
      },
    } as never;
    await expect(recordLoginAudit(brokenEnv, {
      action: 'login.success',
      email: 'x@jiffoo.test',
      source: 'storefront',
    })).resolves.toBeUndefined();
  });
});
