import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations: 100000 },
    key,
    256,
  );
  return base64Url(new Uint8Array(bits));
}

const { tryNativeAuth } = await import('./auth');

const JSON_HEADERS = { 'content-type': 'application/json' };
const RUNTIME_HEADER = 'cloudflare-native-d1-admin-auth';

function loginRequest(body: unknown): Request {
  return new Request('https://api.example/api/v1/admin/auth/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

type FirstResult = Record<string, unknown> | null;

function makeDb(firstResults: FirstResult[]) {
  const state = { index: 0 };
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          const value = state.index < firstResults.length ? firstResults[state.index] : null;
          state.index += 1;
          return value ?? null;
        }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ meta: {} })),
      })),
    })),
  };
}

function nativeUserRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'user-1',
    email: 'user@example.com',
    username: 'user',
    role: 'SUPER_ADMIN',
    avatar: null,
    password_salt: base64Url(crypto.getRandomValues(new Uint8Array(16))),
    password_hash: 'not-a-real-hash',
    password_iterations: 100000,
    is_active: 1,
    migrated_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    email_verified: 1,
    verification_code_hash: null,
    verification_expires_at: null,
    verification_attempts: 0,
    ...overrides,
  };
}

async function expectNativeLoginFailure(response: Response | null): Promise<void> {
  expect(response?.status).toBe(401);
  expect(response?.headers.get('x-jiffoo-runtime')).toBe(RUNTIME_HEADER);
  await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'LOGIN_FAILED' } });
}

describe('native admin login fallback', () => {
  it('returns a structured 401 when the account is unknown and the legacy origin answers 522', async () => {
    const db = makeDb([null]);
    const proxyRequest = vi.fn().mockResolvedValue(new Response('<html>522</html>', { status: 522 }));
    const response = await tryNativeAuth(
      loginRequest({ email: 'ghost@remoteradar.cc', password: 'whatever-secret' }),
      { DB: db, JWT_SECRET_VALUE: 'test-secret' } as never,
      proxyRequest,
    );
    await expectNativeLoginFailure(response);
    expect(proxyRequest).toHaveBeenCalledTimes(1);
  });

  it('returns a structured 401 when the legacy origin fetch throws', async () => {
    const db = makeDb([null]);
    const proxyRequest = vi.fn().mockRejectedValue(new TypeError('network error'));
    const response = await tryNativeAuth(
      loginRequest({ email: 'ghost@remoteradar.cc', password: 'whatever-secret' }),
      { DB: db, JWT_SECRET_VALUE: 'test-secret' } as never,
      proxyRequest,
    );
    await expectNativeLoginFailure(response);
  });

  it('returns a structured 401 when the legacy origin answers ok but with non-JSON body', async () => {
    const db = makeDb([null]);
    const proxyRequest = vi.fn().mockResolvedValue(new Response('<html>ok</html>', { status: 200 }));
    const response = await tryNativeAuth(
      loginRequest({ email: 'ghost@remoteradar.cc', password: 'whatever-secret' }),
      { DB: db, JWT_SECRET_VALUE: 'test-secret' } as never,
      proxyRequest,
    );
    await expectNativeLoginFailure(response);
  });

  it('returns a structured 401 when the legacy account is not an administrator', async () => {
    const db = makeDb([null]);
    const proxyRequest = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { user: { id: 'u1', email: 'u@example.com', role: 'USER' } } }),
      { status: 200, headers: JSON_HEADERS },
    ));
    const response = await tryNativeAuth(
      loginRequest({ email: 'u@example.com', password: 'whatever-secret' }),
      { DB: db, JWT_SECRET_VALUE: 'test-secret' } as never,
      proxyRequest,
    );
    await expectNativeLoginFailure(response);
  });

  it('still bridges a legacy SUPER_ADMIN through a healthy upstream', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const bridged = nativeUserRow({
      id: 'legacy-1',
      email: 'legacy@example.com',
      password_salt: base64Url(salt),
      password_hash: await derive('legacy-pass', salt),
    });
    const db = makeDb([null, bridged]);
    const proxyRequest = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { user: { id: 'legacy-1', email: 'legacy@example.com', username: 'legacy', role: 'SUPER_ADMIN' } } }),
      { status: 200, headers: JSON_HEADERS },
    ));
    const response = await tryNativeAuth(
      loginRequest({ email: 'legacy@example.com', password: 'legacy-pass' }),
      { DB: db, JWT_SECRET_VALUE: 'test-secret' } as never,
      proxyRequest,
    );
    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body?.data?.user).toMatchObject({ email: 'legacy@example.com', role: 'SUPER_ADMIN' });
    expect(body?.data?.access_token).toBeTruthy();
  });

  it('rejects a login without identifier or password with a structured 400 and no fallback call', async () => {
    const db = makeDb([]);
    const proxyRequest = vi.fn();
    const response = await tryNativeAuth(
      loginRequest({ email: '', password: '' }),
      { DB: db, JWT_SECRET_VALUE: 'test-secret' } as never,
      proxyRequest,
    );
    expect(response?.status).toBe(400);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe(RUNTIME_HEADER);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(proxyRequest).not.toHaveBeenCalled();
  });

  it('rejects a malformed JSON body with a structured 400 instead of a Worker exception', async () => {
    const db = makeDb([]);
    const proxyRequest = vi.fn();
    const response = await tryNativeAuth(
      loginRequest('not-json'),
      { DB: db, JWT_SECRET_VALUE: 'test-secret' } as never,
      proxyRequest,
    );
    expect(response?.status).toBe(400);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe(RUNTIME_HEADER);
    await expect(response?.json()).resolves.toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    expect(proxyRequest).not.toHaveBeenCalled();
  });
});
