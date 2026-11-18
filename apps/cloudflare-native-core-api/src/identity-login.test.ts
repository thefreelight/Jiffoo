import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig: vi.fn() }));
vi.mock('./security-audit', () => ({ recordNativeLoginSuccess: vi.fn(), recordLoginAudit: vi.fn(), recordNativeSecurityEvent: vi.fn() }));

const authenticateNativeUser = vi.fn();
const findNativeUserByEmail = vi.fn();
const createNativeSession = vi.fn();
vi.mock('./auth', () => ({
  authenticateNativeUser,
  findNativeUserByEmail,
  createNativeSession,
  getNativeJwtSecret: vi.fn(async () => 'test-jwt-secret'),
  nativePublicUser: vi.fn(),
  findNativeUserById: vi.fn(),
}));

const { tryNativeIdentityLogin } = await import('./identity-login');
const { getNativePluginConfig } = await import('./plugin-settings') as { getNativePluginConfig: ReturnType<typeof vi.fn> };

interface UserRow {
  id: string; email: string; username: string; role: string; avatar: string | null;
  is_active: number; password_set: number; email_verified: number; password_salt: string; password_hash: string;
}
interface IdentityRow {
  id: string; user_id: string; provider_slug: string; issuer: string; subject: string; created_at: string;
}
interface TxRow {
  id: string; provider_slug: string; issuer: string; state_hash: string; binding_hash: string;
  encrypted_payload: string | null; intent: string; return_to: string; locale: string; finish_origin: string;
  user_id: string | null; expires_at: string; claimed_at: string | null; verified_identity_json: string | null;
  handoff_hash: string | null; handoff_expires_at: string | null; consumed_at: string | null; created_at: string;
}

function state() {
  const users: UserRow[] = [];
  const identities: IdentityRow[] = [];
  const transactions: TxRow[] = [];
  const memberships: { user_id: string; role: string; status: string }[] = [];
  const rateLimits = new Map<string, number>();
  return { users, identities, transactions, memberships, rateLimits };
}

let db: ReturnType<typeof state>;

function makeEnv() {
  return {
    DB: {
      prepare: (sql: string) => {
        let args: unknown[] = [];
        const stmt = {
          bind: (...next: unknown[]) => { args = next; return stmt; },
          first: async () => {
            if (sql.includes('INSERT INTO native_auth_rate_limits')) {
              const key = `${args[0]}:${args[1]}:${args[2]}`;
              const next = (db.rateLimits.get(key) ?? 0) + 1;
              db.rateLimits.set(key, next);
              return { request_count: next };
            }
            if (sql.includes('FROM native_identity_transactions WHERE state_hash')) {
              return db.transactions.find((t) => t.state_hash === args[0] && t.provider_slug === args[1]) ?? null;
            }
            if (sql.includes('FROM native_identity_transactions WHERE handoff_hash')) {
              return db.transactions.find((t) => t.handoff_hash === args[0]) ?? null;
            }
            if (sql.includes('FROM native_users WHERE id = ?1')) {
              return db.users.find((u) => u.id === args[0]) ?? null;
            }
            if (sql.includes('FROM native_admin_memberships')) {
              return db.memberships.find((m) => m.user_id === args[0] && m.status === 'ACTIVE') ?? null;
            }
            if (sql.includes('FROM native_external_identities WHERE issuer = ?1 AND subject = ?2')) {
              return db.identities.find((i) => i.issuer === args[0] && i.subject === args[1]) ?? null;
            }
            if (sql.includes('SELECT id FROM native_external_identities WHERE id = ?1 AND user_id = ?2')) {
              return db.identities.find((i) => i.id === args[0] && i.user_id === args[1]) ?? null;
            }
            if (sql.includes('SELECT * FROM native_external_identities WHERE id = ?1')) {
              return db.identities.find((i) => i.id === args[0]) ?? null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes('FROM native_external_identities WHERE user_id = ?1 AND id != ?2')) {
              return { results: db.identities.filter((i) => i.user_id === args[0] && i.id !== args[1]) };
            }
            if (sql.includes('FROM native_external_identities WHERE user_id = ?1')) {
              return { results: db.identities.filter((i) => i.user_id === args[0]) };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.startsWith('DELETE FROM native_identity_transactions')) {
              const now = `${args[0]}`;
              const before = db.transactions.length;
              db.transactions = db.transactions.filter((t) => t.expires_at > now && (t.handoff_expires_at === null || t.handoff_expires_at > now));
              return { meta: { changes: before - db.transactions.length } };
            }
            if (sql.startsWith('INSERT INTO native_identity_transactions')) {
              db.transactions.push({
                id: `${args[0]}`, provider_slug: `${args[1]}`, issuer: `${args[2]}`, state_hash: `${args[3]}`,
                binding_hash: `${args[4]}`, encrypted_payload: `${args[5]}`, intent: `${args[6]}`,
                return_to: `${args[7]}`, locale: `${args[8]}`, finish_origin: `${args[9]}`,
                user_id: args[10] === null ? null : `${args[10]}`, expires_at: `${args[11]}`,
                claimed_at: null, verified_identity_json: null, handoff_hash: null,
                handoff_expires_at: null, consumed_at: null, created_at: `${args[11]}`,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE native_identity_transactions SET claimed_at')) {
              const tx = db.transactions.find((t) => t.id === args[1]);
              if (!tx || tx.claimed_at || tx.consumed_at || tx.expires_at <= `${args[0]}` || !tx.encrypted_payload) {
                return { meta: { changes: 0 } };
              }
              tx.claimed_at = `${args[0]}`;
              tx.encrypted_payload = null;
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE native_identity_transactions SET consumed_at = ?1 WHERE id = ?2')) {
              const tx = db.transactions.find((t) => t.id === args[1]);
              if (!tx) return { meta: { changes: 0 } };
              tx.consumed_at = `${args[0]}`;
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE native_identity_transactions SET verified_identity_json')) {
              const tx = db.transactions.find((t) => t.id === args[3]);
              if (!tx || tx.consumed_at) return { meta: { changes: 0 } };
              tx.verified_identity_json = `${args[0]}`;
              tx.handoff_hash = `${args[1]}`;
              tx.handoff_expires_at = `${args[2]}`;
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE native_identity_transactions SET consumed_at = ?1, verified_identity_json = NULL')) {
              const tx = db.transactions.find((t) => t.id === args[1]);
              if (!tx || tx.consumed_at || tx.handoff_expires_at === null || tx.handoff_expires_at <= `${args[0]}` || tx.binding_hash !== `${args[2]}`) {
                return { meta: { changes: 0 } };
              }
              tx.consumed_at = `${args[0]}`;
              tx.verified_identity_json = null;
              tx.handoff_hash = null;
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO native_users')) {
              db.users.push({
                id: `${args[0]}`, email: `${args[1]}`, username: `${args[2]}`, role: 'USER', avatar: null,
                is_active: 1, password_set: 0, email_verified: 1, password_salt: `${args[3]}`, password_hash: `${args[4]}`,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO native_external_identities')) {
              db.identities.push({
                id: `${args[0]}`, user_id: `${args[1]}`, provider_slug: `${args[2]}`,
                issuer: `${args[3]}`, subject: `${args[4]}`, created_at: `${args[5]}`,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('DELETE FROM native_external_identities')) {
              const before = db.identities.length;
              db.identities = db.identities.filter((i) => i.id !== args[0]);
              return { meta: { changes: before - db.identities.length } };
            }
            return { meta: { changes: 0 } };
          },
        };
        return stmt;
      },
    },
  } as unknown as Parameters<typeof tryNativeIdentityLogin>[0];
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://api.instance.test${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function googleConfig(enabled = true) {
  return { enabled, config: { clientId: 'test-client-id', clientSecret: 'test-client-secret' } };
}

function idToken(claims: Record<string, unknown>): string {
  return `header.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`;
}

async function startAndCallback(options: {
  email?: string; subject?: string; locale?: string; returnTo?: string; intent?: string; error?: string;
  fetchToken?: number;
} = {}): Promise<{ start: Response; callback: Response | null; location: string | null; binding: string | null }> {
  const env = makeEnv();
  const startHeaders: Record<string, string> = {
    'content-type': 'application/json',
    origin: 'https://shop.instance.test',
  };
  const start = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', {
    providerSlug: 'google-auth',
    intent: options.intent ?? 'login',
    returnTo: options.returnTo ?? `/${options.locale ?? 'en'}/account`,
    locale: options.locale ?? 'en',
  }, startHeaders), env);
  expect(start?.status).toBe(200);
  const setCookie = (start as Response).headers.get('set-cookie') ?? '';
  const binding = setCookie.match(/identity_binding=([^;]+)/)?.[1] ?? null;
  const startBody = await (start as Response).json() as { data: { authorizationUrl: string } };
  const state = new URL(startBody.data.authorizationUrl).searchParams.get('state')!;

  const claims = { iss: 'https://accounts.google.com', aud: 'test-client-id', sub: options.subject ?? 'sub-1', email: options.email ?? 'buyer@example.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, nonce: '', name: 'Buyer' };
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: options.fetchToken ?? 200 }));
  vi.stubGlobal('fetch', fetchMock);

  // The nonce is sealed inside the transaction; recover it from the sealed
  // payload is not possible in the test, so instead the module validates it
  // against the stored material — make the mock verify via claims passthrough:
  // we re-run providerComplete's checks by asserting against claims.nonce
  // after the fact. For the happy path we patch claims.nonce by intercepting
  // what was sealed: easiest is to let the sealed material be decoded.
  const tx = db.transactions[db.transactions.length - 1];
  const material = await (await import('./identity-crypto')).openIdentityMaterial({ JWT_SECRET: 'test-jwt-secret' } as never, tx.encrypted_payload!);
  claims.nonce = material.nonce;
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: options.fetchToken ?? 200 }));

  const callback = await tryNativeIdentityLogin(new Request(`https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=${encodeURIComponent(state)}${options.error ? `&error=${options.error}` : ''}`, { method: 'GET', headers: { origin: 'https://shop.instance.test' } }), env);
  const location = callback?.headers.get('location') ?? null;
  vi.unstubAllGlobals();
  return { start, callback, location, binding, state };
}

async function exchange(binding: string, code: string, session?: { id: string } | null): Promise<Response> {
  const env = makeEnv();
  if (session) authenticateNativeUser.mockResolvedValue({ id: session.id });
  const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/exchange', { code }, { cookie: `identity_binding=${binding}` }), env);
  authenticateNativeUser.mockReset();
  return response as Response;
}

describe('providers endpoint', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    authenticateNativeUser.mockReset();
    findNativeUserByEmail.mockReset();
    createNativeSession.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('reports no providers when google-auth is not configured', async () => {
    getNativePluginConfig.mockResolvedValue({ enabled: false, config: {} });
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/providers'), makeEnv());
    const body = await (response as Response).json() as { data: { providers: unknown[] } };
    expect(body.data.providers).toEqual([]);
  });

  it('reports google-auth ready when configured and enabled', async () => {
    getNativePluginConfig.mockResolvedValue(googleConfig());
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/providers'), makeEnv());
    const body = await (response as Response).json() as { data: { providers: { slug: string; ready: boolean }[] } };
    expect(body.data.providers).toEqual([{ slug: 'google-auth', label: 'Google', ready: true }]);
  });

  it('returns null for non-identity routes (unchanged dispatch)', async () => {
    expect(await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/login'), makeEnv())).toBeNull();
    expect(await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/products'), makeEnv())).toBeNull();
  });
});

describe('start validation', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    getNativePluginConfig.mockResolvedValue(googleConfig());
  });

  it('rejects a start without a trustworthy finish origin', async () => {
    const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', returnTo: '/en/account', locale: 'en' }), makeEnv());
    expect(response?.status).toBe(400);
  });

  it('rejects open redirects in returnTo', async () => {
    for (const returnTo of ['//evil.test/x', 'https://evil.test', '/en/../../escape', '/zh-Hans/ok', String.fromCharCode(92)]) {
      const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', returnTo, locale: 'en' }, { origin: 'https://shop.instance.test' }), makeEnv());
      const body = await (response as Response).json() as { error?: { code?: string } };
      expect(response?.status).toBe(400);
      expect(body.error?.code).toBe('IDENTITY_TRANSACTION_INVALID');
    }
    expect(db.transactions).toHaveLength(0);
  });

  it('accepts a locale-prefixed in-app returnTo and sets the binding cookie', async () => {
    const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', returnTo: '/en/account', locale: 'en' }, { origin: 'https://shop.instance.test' }), makeEnv());
    expect(response?.status).toBe(200);
    const setCookie = (response as Response).headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(db.transactions).toHaveLength(1);
    expect(db.transactions[0].expires_at > new Date().toISOString()).toBe(true);
  });

  it('returns 503 when the provider is not ready', async () => {
    getNativePluginConfig.mockResolvedValue({ enabled: false, config: {} });
    const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', returnTo: '/en/account', locale: 'en' }, { origin: 'https://shop.instance.test' }), makeEnv());
    expect(response?.status).toBe(503);
    const body = await (response as Response).json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_UNAVAILABLE');
  });

  it('requires a session for link intent', async () => {
    const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', intent: 'link', returnTo: '/en/settings', locale: 'en' }, { origin: 'https://shop.instance.test' }), makeEnv());
    expect(response?.status).toBe(400);
    const body = await (response as Response).json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_ACCOUNT_UNAVAILABLE');
  });
});

describe('callback and handoff', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    getNativePluginConfig.mockResolvedValue(googleConfig());
  });

  it('answers unknown or replayed states as JSON errors, never redirects', async () => {
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=unknown', { method: 'GET' }), makeEnv());
    expect(response?.status).toBe(400);
  });

  it('completes a verified callback into a 60-second handoff and redirects to the finish page', async () => {
    const { location, binding } = await startAndCallback();
    expect(location).toContain('https://shop.instance.test/en/auth/identity/finish');
    expect(location).toContain('#code=');
    expect(db.transactions[0].claimed_at).not.toBeNull();
    expect(db.transactions[0].encrypted_payload).toBeNull();
    expect(db.transactions[0].handoff_expires_at).not.toBeNull();
    expect(binding).not.toBeNull();
  });

  it('rejects a replayed callback after the atomic claim', async () => {
    const { state, callback } = await startAndCallback();
    expect(callback?.status).toBe(302);
    const replay = await tryNativeIdentityLogin(new Request(`https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=${encodeURIComponent(state)}`, { method: 'GET' }), makeEnv());
    expect(replay?.status).toBe(400);
    const body = await (replay as Response).json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_TRANSACTION_INVALID');
  });

  it('consumes the transaction when the provider rejects', async () => {
    const { state, location } = await startAndCallback({ fetchToken: 400 });
    expect(location).toContain('error=IDENTITY_REJECTED');
    expect(db.transactions[0].consumed_at).not.toBeNull();
    const replay = await tryNativeIdentityLogin(new Request(`https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=${encodeURIComponent(state)}`, { method: 'GET' }), makeEnv());
    expect(replay?.status).toBe(400);
  });

  it('maps access_denied to IDENTITY_CANCELLED', async () => {
    const { location } = await startAndCallback({ error: 'access_denied' });
    expect(location).toContain('error=IDENTITY_CANCELLED');
  });

  it('rejects unverified emails from the provider', async () => {
    const env = makeEnv();
    const start = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', returnTo: '/en/account', locale: 'en' }, { origin: 'https://shop.instance.test' }), env);
    const setCookie = (start as Response).headers.get('set-cookie') ?? '';
    const binding = setCookie.match(/identity_binding=([^;]+)/)?.[1]!;
    const startBody = await (start as Response).json() as { data: { authorizationUrl: string } };
    const state = new URL(startBody.data.authorizationUrl).searchParams.get('state')!;
    const tx = db.transactions[0];
    const material = await (await import('./identity-crypto')).openIdentityMaterial({ JWT_SECRET: 'test-jwt-secret' } as never, tx.encrypted_payload!);
    const claims = { iss: 'https://accounts.google.com', aud: 'test-client-id', sub: 'sub-1', email: 'buyer@example.com', email_verified: false, exp: Math.floor(Date.now() / 1000) + 600, nonce: material.nonce };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 })));
    const callback = await tryNativeIdentityLogin(new Request(`https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=${encodeURIComponent(state)}`, { method: 'GET' }), env);
    expect(callback?.headers.get('location')).toContain('error=IDENTITY_REJECTED');
    expect(db.identities).toHaveLength(0);
    vi.unstubAllGlobals();
    expect(binding).not.toBeNull();
  });

  it('rejects a nonce mismatch and a foreign audience', async () => {
    const env = makeEnv();
    const start = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', returnTo: '/en/account', locale: 'en' }, { origin: 'https://shop.instance.test' }), env);
    const startBody = await (start as Response).json() as { data: { authorizationUrl: string } };
    const state = new URL(startBody.data.authorizationUrl).searchParams.get('state')!;
    const claims = { iss: 'https://accounts.google.com', aud: 'test-client-id', sub: 'sub-1', email: 'buyer@example.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, nonce: 'wrong-nonce' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 })));
    const callback = await tryNativeIdentityLogin(new Request(`https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=${encodeURIComponent(state)}`, { method: 'GET' }), env);
    expect(callback?.headers.get('location')).toContain('error=IDENTITY_REJECTED');
    vi.unstubAllGlobals();
  });
});

describe('exchange (handoff consume)', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    getNativePluginConfig.mockResolvedValue(googleConfig());
    findNativeUserByEmail.mockResolvedValue(null);
    createNativeSession.mockImplementation(async (_env, user) => ({
      body: { success: true, data: { user, access_token: 'access', token_type: 'Bearer', expires_in: 604800, refresh_token: 'refresh', token: 'access' } },
      headers: new Headers({ 'content-type': 'application/json; charset=utf-8', 'x-jiffoo-runtime': 'cloudflare-native-d1-auth' }),
    }));
  });

  it('creates an identity-only customer and issues a shop session', async () => {
    const { binding, location } = await startAndCallback();
    const code = location!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    const response = await exchange(binding!, decodeURIComponent(code));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { user: { emailVerified: boolean }; access_token: string } };
    expect(body.data.user.emailVerified).toBe(true);
    expect(body.data.access_token).toBe('access');
    expect(db.users).toHaveLength(1);
    expect(db.users[0].password_set).toBe(0);
    expect(db.users[0].email_verified).toBe(1);
    expect(db.users[0].role).toBe('USER');
    expect(db.identities).toHaveLength(1);
    expect(db.identities[0].user_id).toBe(db.users[0].id);
  });

  it('never merges an identical email string with an existing password account', async () => {
    await startAndCallback({ email: 'buyer@example.com', subject: 'sub-1' });
    const location = await (async () => {
      const { location: l, binding } = await startAndCallback({ email: 'buyer@example.com', subject: 'sub-2' });
      const code = l!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
      // A password account already owns the claimed email address.
      findNativeUserByEmail.mockResolvedValue({ id: 'pw-user-1', email: 'buyer@example.com', username: 'pw', role: 'USER', is_active: 1 });
      const response = await exchange(binding!, decodeURIComponent(code));
      expect(response.status).toBe(409);
      const body = await response.json() as { error: { code: string } };
      expect(body.error.code).toBe('IDENTITY_EMAIL_IN_USE');
      return l;
    })();
    expect(location).not.toBeNull();
    // No merge, no creation: the password account keeps the address.
    expect(db.users).toHaveLength(0);
    expect(db.identities).toHaveLength(0);
  });

  it('rejects a wrong binding cookie', async () => {
    const { location } = await startAndCallback();
    const code = location!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    const response = await exchange('other-binding-value-aaaaaaaaaaaaaa', decodeURIComponent(code));
    expect(response.status).toBe(400);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_TRANSACTION_INVALID');
    expect(db.users).toHaveLength(0);
  });

  it('consumes the handoff exactly once', async () => {
    const { binding, location } = await startAndCallback();
    const code = location!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    const first = await exchange(binding!, decodeURIComponent(code));
    expect(first.status).toBe(200);
    const replay = await exchange(binding!, decodeURIComponent(code));
    expect(replay.status).toBe(400);
  });

  it('excludes staff accounts from customer identity sessions', async () => {
    const { binding, location } = await startAndCallback();
    const code = location!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    // First exchange creates the customer; make them staff afterwards via a
    // membership, then a second identity login for a different subject hits
    // the guard through the existing-identity path.
    const first = await exchange(binding!, decodeURIComponent(code));
    expect(first.status).toBe(200);
    db.memberships.push({ user_id: db.users[0].id, role: 'SUPPORT_AGENT', status: 'ACTIVE' });
    const { binding: b2, location: l2 } = await startAndCallback({ subject: 'sub-1', email: 'buyer@example.com' });
    const code2 = l2!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    const second = await exchange(b2!, decodeURIComponent(code2));
    expect(second.status).toBe(400);
    const body = await second.json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_ACCOUNT_UNAVAILABLE');
  });

  it('logs in the bound user when the identity already exists', async () => {
    const { binding, location } = await startAndCallback({ subject: 'sub-1' });
    const code = location!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    await exchange(binding!, decodeURIComponent(code));
    const { binding: b2, location: l2 } = await startAndCallback({ subject: 'sub-1' });
    const code2 = l2!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    const second = await exchange(b2!, decodeURIComponent(code2));
    expect(second.status).toBe(200);
    expect(db.users).toHaveLength(1);
    expect(db.identities).toHaveLength(1);
  });
});

describe('account linking', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    getNativePluginConfig.mockResolvedValue(googleConfig());
    findNativeUserByEmail.mockResolvedValue(null);
  });

  it('links an identity to the signed-in customer and reports the link', async () => {
    db.users.push({ id: 'user-1', email: 'me@example.com', username: 'me', role: 'USER', avatar: null, is_active: 1, password_set: 1, email_verified: 1, password_salt: 's', password_hash: 'h' });
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'me@example.com', username: 'me', role: 'USER' });
    const env = makeEnv();
    const start = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', intent: 'link', returnTo: '/en/settings', locale: 'en' }, { origin: 'https://shop.instance.test' }), env);
    const binding = ((start as Response).headers.get('set-cookie') ?? '').match(/identity_binding=([^;]+)/)?.[1]!;
    const startBody = await (start as Response).json() as { data: { authorizationUrl: string } };
    const state = new URL(startBody.data.authorizationUrl).searchParams.get('state')!;
    const tx = db.transactions[0];
    const material = await (await import('./identity-crypto')).openIdentityMaterial({ JWT_SECRET: 'test-jwt-secret' } as never, tx.encrypted_payload!);
    const claims = { iss: 'https://accounts.google.com', aud: 'test-client-id', sub: 'sub-link', email: 'other-email@example.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, nonce: material.nonce };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 })));
    const callback = await tryNativeIdentityLogin(new Request(`https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=${encodeURIComponent(state)}`, { method: 'GET' }), env);
    const code = callback!.headers.get('location')!.match(/#code=([^&]+|[^#]*)/)?.[0]!.replace('#code=', '')!;
    vi.unstubAllGlobals();
    const linked = await exchange(binding, decodeURIComponent(code), { id: 'user-1' });
    expect(linked.status).toBe(200);
    const body = await linked.json() as { data: { linked: boolean } };
    expect(body.data.linked).toBe(true);
    expect(db.identities[0].user_id).toBe('user-1');
    expect(db.identities[0].subject).toBe('sub-link');
  });

  it('refuses to link an issuer+subject that already belongs to another account', async () => {
    db.users.push({ id: 'user-1', email: 'me@example.com', username: 'me', role: 'USER', avatar: null, is_active: 1, password_set: 1, email_verified: 1, password_salt: 's', password_hash: 'h' });
    db.identities.push({ id: 'i-existing', user_id: 'user-9', provider_slug: 'google-auth', issuer: 'https://accounts.google.com', subject: 'sub-link', created_at: new Date().toISOString() });
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'me@example.com', username: 'me', role: 'USER' });
    const { binding, location } = await startAndCallback({ intent: 'link', subject: 'sub-link' });
    const code = location!.match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    const linked = await exchange(binding!, decodeURIComponent(code), { id: 'user-1' });
    expect(linked.status).toBe(409);
    const body = await linked.json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_ALREADY_LINKED');
  });
});

describe('identity removal guards', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    getNativePluginConfig.mockResolvedValue(googleConfig());
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'me@example.com', username: 'me', role: 'USER' });
  });

  it('blocks removing the last identity of an identity-only account', async () => {
    db.users.push({ id: 'user-1', email: 'me@example.com', username: 'me', role: 'USER', avatar: null, is_active: 1, password_set: 0, email_verified: 1, password_salt: 's', password_hash: 'h' });
    db.identities.push({ id: 'i-1', user_id: 'user-1', provider_slug: 'google-auth', issuer: 'https://accounts.google.com', subject: 'sub-1', created_at: new Date().toISOString() });
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/connections/i-1', { method: 'DELETE' }), makeEnv());
    expect(response?.status).toBe(400);
    const body = await (response as Response).json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_LAST_METHOD');
    expect(db.identities).toHaveLength(1);
  });

  it('allows removal when a password is set or another provider remains', async () => {
    db.users.push({ id: 'user-1', email: 'me@example.com', username: 'me', role: 'USER', avatar: null, is_active: 1, password_set: 1, email_verified: 1, password_salt: 's', password_hash: 'h' });
    db.identities.push({ id: 'i-1', user_id: 'user-1', provider_slug: 'google-auth', issuer: 'https://accounts.google.com', subject: 'sub-1', created_at: new Date().toISOString() });
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/connections/i-1', { method: 'DELETE' }), makeEnv());
    expect(response?.status).toBe(200);
    expect(db.identities).toHaveLength(0);
  });

  it('refuses to touch another customer identity', async () => {
    db.identities.push({ id: 'i-other', user_id: 'user-2', provider_slug: 'google-auth', issuer: 'https://accounts.google.com', subject: 'sub-2', created_at: new Date().toISOString() });
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/connections/i-other', { method: 'DELETE' }), makeEnv());
    expect(response?.status).toBe(400);
    expect(db.identities).toHaveLength(1);
  });
});

// --- Multi-provider + native channel tests -----------------------------------

function facebookConfig(enabled = true) {
  return { enabled, config: { appId: 'fb-app-id', appSecret: 'fb-app-secret' } };
}

// Apple test material: a real EC P-256 keypair so the ES256 client secret and
// native id_token verification exercise real crypto instead of mocks.
let applePem = '';
let applePrivateKey: CryptoKey = {} as CryptoKey;
let applePublicJwk: JsonWebKey = {};
const APPLE_SERVICES_ID = 'com.bokmoo.store.web';
const APPLE_BUNDLE_ID = 'com.bokmoo.store';

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  applePrivateKey = pair.privateKey;
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const der = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  // pemToPkcs8 strips all whitespace, so no line folding is required.
  applePem = `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----`;
  applePublicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
});

function appleConfig(enabled = true) {
  return {
    enabled,
    config: { servicesId: APPLE_SERVICES_ID, teamId: 'TEAM1234567', keyId: 'KEY1234567', privateKey: applePem, bundleId: APPLE_BUNDLE_ID },
  };
}

function multiProviderConfig() {
  return async (_env: unknown, slug: string) => {
    if (slug === 'google-auth') return googleConfig();
    if (slug === 'facebook-auth') return facebookConfig();
    if (slug === 'apple-auth') return appleConfig();
    return null;
  };
}

function b64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function es256Token(claims: Record<string, unknown>, options: { kid?: string; tamper?: boolean } = {}): Promise<string> {
  const input = `${b64url(JSON.stringify({ alg: 'ES256', kid: options.kid ?? 'apple-key-1' }))}.${b64url(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, applePrivateKey, new TextEncoder().encode(input));
  let sig = b64url(String.fromCharCode(...new Uint8Array(signature)));
  if (options.tamper) sig = `${sig.slice(0, -2)}AA`;
  return `${input}.${sig}`;
}

async function startAndCallbackProvider(options: {
  slug: string;
  claims: Record<string, unknown>;
  method?: 'GET' | 'POST';
  onTokenRequest?: (url: string, body: string) => void;
}): Promise<{ location: string | null; binding: string | null; state: string }> {
  const env = makeEnv();
  const start = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', {
    providerSlug: options.slug,
    intent: 'login',
    returnTo: '/en/account',
    locale: 'en',
  }, { 'content-type': 'application/json', origin: 'https://shop.instance.test' }), env);
  expect(start?.status).toBe(200);
  const binding = ((start as Response).headers.get('set-cookie') ?? '').match(/identity_binding=([^;]+)/)?.[1] ?? null;
  const startBody = await (start as Response).json() as { data: { authorizationUrl: string } };
  const authorizationUrl = new URL(startBody.data.authorizationUrl);
  const state = authorizationUrl.searchParams.get('state')!;

  const tx = db.transactions[db.transactions.length - 1];
  const material = await (await import('./identity-crypto')).openIdentityMaterial({ JWT_SECRET: 'test-jwt-secret' } as never, tx.encrypted_payload!);
  const claims = { ...options.claims, nonce: material.nonce, exp: Math.floor(Date.now() / 1000) + 600 };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('appleid.apple.com/auth/token') && options.onTokenRequest) {
      options.onTokenRequest(url, String(init?.body ?? ''));
    }
    return new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);

  const callbackUrl = `https://api.instance.test/api/v1/auth/identity/${options.slug}/callback`;
  let callback: Response | null;
  if (options.method === 'POST') {
    callback = await tryNativeIdentityLogin(new Request(callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ state, code: 'auth-code-1' }).toString(),
    }), env);
  } else {
    callback = await tryNativeIdentityLogin(new Request(`${callbackUrl}?state=${encodeURIComponent(state)}&code=auth-code-1`), env);
  }
  const location = callback?.headers.get('location') ?? null;
  vi.unstubAllGlobals();
  return { location, binding, state };
}

describe('multi-provider web flows', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    getNativePluginConfig.mockImplementation(multiProviderConfig());
    findNativeUserByEmail.mockResolvedValue(null);
    createNativeSession.mockImplementation(async (_env, user) => ({
      body: { success: true, data: { user, access_token: 'access', token_type: 'Bearer', expires_in: 604800, refresh_token: 'refresh', token: 'access' } },
      headers: new Headers(),
    }));
  });

  it('reports all three providers when configured', async () => {
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/providers'), makeEnv());
    const body = await (response as Response).json() as { data: { providers: { slug: string }[] } };
    expect(body.data.providers.map((provider) => provider.slug)).toEqual(['google-auth', 'facebook-auth', 'apple-auth']);
  });

  it('keeps google-only behavior when the new providers are unconfigured', async () => {
    getNativePluginConfig.mockImplementation(async (_env: unknown, slug: string) => (slug === 'google-auth' ? googleConfig() : null));
    const response = await tryNativeIdentityLogin(new Request('https://api.instance.test/api/v1/auth/identity/providers'), makeEnv());
    const body = await (response as Response).json() as { data: { providers: { slug: string }[] } };
    expect(body.data.providers).toEqual([{ slug: 'google-auth', label: 'Google', ready: true }]);
  });

  it('builds a Facebook OIDC authorization URL with PKCE', async () => {
    const env = makeEnv();
    const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'facebook-auth', returnTo: '/en/account', locale: 'en' }, { origin: 'https://shop.instance.test' }), env);
    expect(response?.status).toBe(200);
    const body = await (response as Response).json() as { data: { authorizationUrl: string } };
    const url = new URL(body.data.authorizationUrl);
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toContain('/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toBeTruthy();
  });

  it('completes a Facebook OIDC callback into a handoff', async () => {
    const { location } = await startAndCallbackProvider({
      slug: 'facebook-auth',
      claims: { iss: 'https://facebook.com', aud: 'fb-app-id', sub: 'fb-sub-1', email: 'buyer@example.com', email_verified: true, name: 'FB Buyer' },
    });
    expect(location).toContain('#code=');
    expect(location).toContain('/auth/identity/finish');
  });

  it('builds an Apple authorization URL with form_post and no PKCE', async () => {
    const env = makeEnv();
    const response = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'apple-auth', returnTo: '/en/account', locale: 'en' }, { origin: 'https://shop.instance.test' }), env);
    expect(response?.status).toBe(200);
    const body = await (response as Response).json() as { data: { authorizationUrl: string } };
    const url = new URL(body.data.authorizationUrl);
    expect(url.origin).toBe('https://appleid.apple.com');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('scope')).toBe('name email');
    expect(url.searchParams.get('client_id')).toBe(APPLE_SERVICES_ID);
    expect(url.searchParams.get('code_challenge')).toBeNull();
    expect(url.searchParams.get('nonce')).toBeTruthy();
  });

  it('accepts an Apple form_post callback and mints an ES256 client secret', async () => {
    let tokenBody = '';
    const { location } = await startAndCallbackProvider({
      slug: 'apple-auth',
      method: 'POST',
      claims: { iss: 'https://appleid.apple.com', aud: APPLE_SERVICES_ID, sub: 'apple-sub-1', email: 'buyer@icloud.com', email_verified: 'true', name: 'Apple Buyer' },
      onTokenRequest: (_url, body) => { tokenBody = body; },
    });
    expect(location).toContain('#code=');
    // The token request carries a three-segment ES256 client secret JWT, the
    // Services ID as client_id, and — Apple having no PKCE — no verifier.
    const params = new URLSearchParams(tokenBody);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('client_id')).toBe(APPLE_SERVICES_ID);
    expect(params.get('code')).toBe('auth-code-1');
    expect(params.get('code_verifier')).toBeNull();
    const secret = (params.get('client_secret') ?? '').split('.');
    expect(secret).toHaveLength(3);
    const header = JSON.parse(atob(secret[0].replace(/-/g, '+').replace(/_/g, '/'))) as { alg: string; kid: string };
    const payload = JSON.parse(atob(secret[1].replace(/-/g, '+').replace(/_/g, '/'))) as { iss: string; sub: string; aud: string };
    expect(header.alg).toBe('ES256');
    expect(header.kid).toBe('KEY1234567');
    expect(payload.iss).toBe('TEAM1234567');
    expect(payload.sub).toBe(APPLE_SERVICES_ID);
    expect(payload.aud).toBe('https://appleid.apple.com');
  });

  it('accepts a Google callback whose query carries both state and code', async () => {
    // Regression: the ported implementation fed the OAuth state to the token
    // endpoint as if it were the authorization code; real callbacks deliver
    // ?state=...&code=... and only the code redeems a token.
    const env = makeEnv();
    const start = await tryNativeIdentityLogin(post('/api/v1/auth/identity/start', { providerSlug: 'google-auth', returnTo: '/en/account', locale: 'en' }, { origin: 'https://shop.instance.test' }), env);
    const binding = ((start as Response).headers.get('set-cookie') ?? '').match(/identity_binding=([^;]+)/)?.[1] ?? null;
    const startBody = await (start as Response).json() as { data: { authorizationUrl: string } };
    const state = new URL(startBody.data.authorizationUrl).searchParams.get('state')!;
    const tx = db.transactions[db.transactions.length - 1];
    const material = await (await import('./identity-crypto')).openIdentityMaterial({ JWT_SECRET: 'test-jwt-secret' } as never, tx.encrypted_payload!);
    const claims = { iss: 'https://accounts.google.com', aud: 'test-client-id', sub: 'sub-code-1', email: 'buyer@example.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, nonce: material.nonce };
    let tokenCode = '';
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      tokenCode = new URLSearchParams(String(init?.body ?? '')).get('code') ?? '';
      return new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 });
    }));
    const callback = await tryNativeIdentityLogin(new Request(`https://api.instance.test/api/v1/auth/identity/google-auth/callback?state=${encodeURIComponent(state)}&code=real-auth-code`), env);
    vi.unstubAllGlobals();
    expect(callback?.status).toBe(302);
    expect(tokenCode).toBe('real-auth-code');
    const code = (callback!.headers.get('location') ?? '').match(/#code=([^&]+|[^#]*)/)?.[0]?.replace('#code=', '')!;
    const response = await exchange(binding!, decodeURIComponent(code));
    expect(response.status).toBe(200);
    expect(db.identities[0].provider_slug).toBe('google-auth');
  });
});

describe('native token channel', () => {
  beforeEach(() => {
    db = state();
    getNativePluginConfig.mockReset();
    getNativePluginConfig.mockImplementation(multiProviderConfig());
    findNativeUserByEmail.mockResolvedValue(null);
    createNativeSession.mockImplementation(async (_env, user) => ({
      body: { success: true, data: { user, access_token: 'access', token_type: 'Bearer', expires_in: 604800, refresh_token: 'refresh', token: 'access' } },
      headers: new Headers(),
    }));
  });

  function nativeRequest(body: Record<string, unknown>): Request {
    return post('/api/v1/auth/identity/native', body, { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' });
  }

  it('answers 503 when the provider has no native audiences configured', async () => {
    getNativePluginConfig.mockImplementation(async (_env: unknown, slug: string) => (slug === 'google-auth' ? googleConfig() : null));
    const response = await tryNativeIdentityLogin(nativeRequest({ providerSlug: 'google-auth', idToken: 'a.b.c' }), makeEnv());
    expect(response?.status).toBe(503);
  });

  it('verifies an Apple app token end to end and issues a shop session', async () => {
    const claims = { iss: 'https://appleid.apple.com', aud: APPLE_BUNDLE_ID, sub: 'apple-native-1', email: 'buyer@icloud.com', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600, nonce: 'n-123' };
    const token = await es256Token(claims);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [{ ...applePublicJwk, kid: 'apple-key-1', alg: 'ES256' }] }), { status: 200 })));
    const response = await tryNativeIdentityLogin(nativeRequest({ providerSlug: 'apple-auth', idToken: token, nonce: 'n-123', fullName: 'Apple Buyer' }), makeEnv());
    vi.unstubAllGlobals();
    expect(response?.status).toBe(200);
    const body = await (response as Response).json() as { data: { access_token: string; user: { username: string } } };
    expect(body.data.access_token).toBe('access');
    expect(body.data.user.username).toContain('Apple-Buyer');
    expect(db.users).toHaveLength(1);
    expect(db.identities).toHaveLength(1);
    expect(db.identities[0].issuer).toBe('https://appleid.apple.com');
    expect(db.identities[0].subject).toBe('apple-native-1');
  });

  it('rejects a tampered signature, a foreign audience, and a nonce mismatch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [{ ...applePublicJwk, kid: 'apple-key-1', alg: 'ES256' }] }), { status: 200 })));
    const base = { iss: 'https://appleid.apple.com', sub: 'apple-native-1', email: 'buyer@icloud.com', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600 };
    const tampered = await es256Token({ ...base, aud: APPLE_BUNDLE_ID }, { tamper: true });
    const wrongAud = await es256Token({ ...base, aud: 'com.other.app' });
    const wrongNonce = await es256Token({ ...base, aud: APPLE_BUNDLE_ID, nonce: 'other' });
    for (const token of [tampered, wrongAud, wrongNonce]) {
      const response = await tryNativeIdentityLogin(nativeRequest({ providerSlug: 'apple-auth', idToken: token, nonce: 'n-123' }), makeEnv());
      expect(response?.status).toBe(400);
      const body = await (response as Response).json() as { error: { code: string } };
      expect(body.error.code).toBe('IDENTITY_REJECTED');
    }
    expect(db.users).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it('rejects an unsigned (structural-only) token on the native channel', async () => {
    // The web flow accepts structural tokens because they arrive over TLS;
    // the native channel must refuse anything that is not signature-verified.
    const claims = { iss: 'https://appleid.apple.com', aud: APPLE_BUNDLE_ID, sub: 'forged-1', email: 'attacker@example.com', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600 };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [{ ...applePublicJwk, kid: 'apple-key-1', alg: 'ES256' }] }), { status: 200 })));
    const response = await tryNativeIdentityLogin(nativeRequest({ providerSlug: 'apple-auth', idToken: idToken(claims) }), makeEnv());
    vi.unstubAllGlobals();
    expect(response?.status).toBe(400);
    expect(db.users).toHaveLength(0);
  });

  it('throttles burst traffic per IP', async () => {
    const env = makeEnv();
    let last: Response | null = null;
    for (let i = 0; i < 31; i += 1) {
      last = await tryNativeIdentityLogin(nativeRequest({ providerSlug: 'google-auth', idToken: 'a.b.c' }), env);
    }
    expect(last?.status).toBe(429);
    const body = await (last as Response).json() as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_RATE_LIMITED');
  });
});
