import {
  authenticateNativeUser,
  findNativeUserByEmail,
  createNativeSession,
  type NativeAuthEnv,
  type PublicUser,
} from './auth';
import {
  identityChallenge,
  identityHash,
  identitySecret,
  openIdentityMaterial,
  sealIdentityMaterial,
} from './identity-crypto';
import { getNativePluginConfig, type PluginSettingsEnv } from './plugin-settings';
import { recordNativeLoginSuccess } from './security-audit';

/**
 * Native identity login (identity v1 semantics ported from the self-hosted
 * line): OAuth-based customer sign-in and explicit account linking through
 * configured providers, with the Core owning every sensitive transition.
 *
 * Security properties carried over from the ported design:
 * - state, browser binding and handoff codes are stored ONLY as domain-
 *   separated HMAC digests; the PKCE verifier and nonce sit in an AES-256-GCM
 *   sealed payload that is wiped when the transaction is claimed or consumed.
 * - a callback claims its transaction atomically (UPDATE ... WHERE claimed_at
 *   IS NULL), so a replayed state can never complete twice; the handoff is
 *   consumed atomically the same way and expires after 60 seconds.
 * - verified claims become queryable only after the provider verified the
 *   email; accounts merge or log in strictly by (issuer, subject) — an
 *   identical email string on another account never merges (IDENTITY_EMAIL_IN_USE).
 * - staff and inactive accounts cannot obtain a customer identity session.
 * - returnTo must be a locale-prefixed in-app path (no open redirects); the
 *   finish origin is captured from the start request and re-validated before
 *   use, and the handoff code travels in the URL fragment so it never reaches
 *   a server other than the browser.
 * - a receipt of login never mints privileges beyond a plain shop session;
 *   identity-only accounts keep password_set = 0 and can never remove their
 *   last identity.
 */

interface IdentityEnv extends NativeAuthEnv, PluginSettingsEnv {}

export class IdentityError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
  }
}

interface ReadyProvider {
  slug: string;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
}

interface VerifiedIdentity {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

interface TransactionRow extends Record<string, unknown> {
  id: string;
  provider_slug: string;
  issuer: string;
  state_hash: string;
  binding_hash: string;
  encrypted_payload: string | null;
  intent: 'login' | 'link';
  return_to: string;
  locale: string;
  finish_origin: string;
  user_id: string | null;
  expires_at: string;
  claimed_at: string | null;
  verified_identity_json: string | null;
  handoff_hash: string | null;
  handoff_expires_at: string | null;
  consumed_at: string | null;
  created_at: string;
}

interface NativeUserRow extends Record<string, unknown> {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar: string | null;
  is_active: number;
  password_set: number;
  email_verified: number;
}

const RUNTIME = 'cloudflare-native-d1-identity-login';
const TRANSACTION_TTL_MS = 10 * 60_000;
const HANDOFF_TTL_MS = 60_000;
const BINDING_COOKIE = 'identity_binding';
const LOCALES = ['en', 'zh-Hans', 'zh-Hant'];
const FINISH_PATH = '/auth/identity/finish';

function json(data: unknown, status = 200, headers?: Headers): Response {
  return Response.json({ success: true, data }, { status, headers: mergeRuntime(headers) });
}

function fail(code: string, message: string, status: number, headers?: Headers): Response {
  return Response.json({ success: false, error: { code, message } }, { status, headers: mergeRuntime(headers) });
}

function mergeRuntime(headers?: Headers): Headers {
  const result = headers ?? new Headers();
  if (!result.has('x-jiffoo-runtime')) result.set('x-jiffoo-runtime', RUNTIME);
  result.set('cache-control', 'no-store');
  return result;
}

function requestOrigin(request: Request): string | null {
  const direct = request.headers.get('origin');
  if (direct) return validateFinishOrigin(direct);
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return validateFinishOrigin(new URL(referer).origin);
    } catch {
      return null;
    }
  }
  return null;
}

function validateFinishOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Ported from the self-hosted line: only locale-prefixed in-app paths are
// acceptable, decoded repeatedly to defeat double-encoding tricks.
function identityReturnPath(value: string, locale: string): string {
  if (!LOCALES.includes(locale)) throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  let decoded = value;
  try {
    for (let i = 0; i < 3; i += 1) decoded = decodeURIComponent(decoded);
  } catch {
    throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  }
  if (!value.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) {
    throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  }
  // No traversal: a locale-prefixed path that escapes the app via .. segments
  // is still an open redirect in spirit.
  if (decoded.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  }
  if (decoded !== `/${locale}` && !decoded.startsWith(`/${locale}/`)) {
    throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  }
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

// --- Provider adapter (Google OAuth 2.0 / OIDC, settings-driven) ------------

async function googleProvider(env: IdentityEnv): Promise<ReadyProvider | null> {
  const stored = await getNativePluginConfig(env, 'google-auth');
  if (!stored?.enabled) return null;
  const clientId = typeof stored.config.clientId === 'string' ? stored.config.clientId.trim() : '';
  const clientSecret = typeof stored.config.clientSecret === 'string' ? stored.config.clientSecret.trim() : '';
  if (!clientId || !clientSecret) return null;
  return { slug: 'google-auth', label: 'Google', issuer: 'https://accounts.google.com', clientId, clientSecret };
}

export async function readyIdentityProviders(env: IdentityEnv): Promise<ReadyProvider[]> {
  const provider = await googleProvider(env);
  return provider ? [provider] : [];
}

async function providerAuthorize(provider: ReadyProvider, redirectUri: string, state: string, nonce: string, codeChallenge: string): Promise<string> {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return url.href;
}

interface GoogleTokenResponse {
  id_token?: string;
  error?: string;
}

interface GoogleIdTokenClaims {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
  nonce?: string;
  name?: string;
}

// The ID token arrives over TLS from Google's token endpoint in exchange for
// our code + confidential client secret; structural claim validation (issuer,
// audience, expiry, nonce, verified email) gates every identity. Signature
// verification is unnecessary for this channel and not a substitute for the
// claim checks.
async function providerComplete(provider: ReadyProvider, redirectUri: string, code: string, nonce: string, verifier: string): Promise<VerifiedIdentity> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }).toString(),
  });
  if (!response.ok) throw new IdentityError('IDENTITY_REJECTED');
  const payload = await response.json<GoogleTokenResponse>().catch(() => ({}) as GoogleTokenResponse);
  if (!payload.id_token) throw new IdentityError('IDENTITY_REJECTED');
  const [, body] = payload.id_token.split('.');
  if (!body) throw new IdentityError('IDENTITY_REJECTED');
  let claims: GoogleIdTokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)))) as GoogleIdTokenClaims;
  } catch {
    throw new IdentityError('IDENTITY_REJECTED');
  }
  if (
    claims.iss !== provider.issuer && claims.iss !== 'https://accounts.google.com'
    || claims.aud !== provider.clientId
    || typeof claims.sub !== 'string' || !claims.sub
    || typeof claims.email !== 'string' || !claims.email.includes('@')
    || claims.email_verified !== true
    || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()
    || claims.nonce !== nonce
  ) {
    throw new IdentityError('IDENTITY_REJECTED');
  }
  return {
    issuer: provider.issuer,
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: true,
    displayName: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 200) : undefined,
  };
}

// --- Customer guards ---------------------------------------------------------

async function isStaffAccount(env: IdentityEnv, userId: string): Promise<boolean> {
  const membership = await env.DB.prepare(
    "SELECT role FROM native_admin_memberships WHERE user_id = ?1 AND status = 'ACTIVE' LIMIT 1",
  ).bind(userId).first<{ role: string }>();
  return Boolean(membership);
}

// Staff and inactive accounts can never hold a customer identity session.
async function requireCustomerUser(env: IdentityEnv, user: NativeUserRow | null): Promise<NativeUserRow> {
  if (!user || user.role !== 'USER' || !user.is_active) throw new IdentityError('IDENTITY_ACCOUNT_UNAVAILABLE');
  if (await isStaffAccount(env, user.id)) throw new IdentityError('IDENTITY_ACCOUNT_UNAVAILABLE');
  return user;
}

function identityAccountUnavailable(user: NativeUserRow | null): boolean {
  return !user || user.role !== 'USER' || !user.is_active;
}

// --- Transaction lifecycle ---------------------------------------------------

async function pruneExpiredTransactions(env: IdentityEnv): Promise<void> {
  await env.DB.prepare('DELETE FROM native_identity_transactions WHERE expires_at <= ?1 OR handoff_expires_at <= ?1')
    .bind(nowIso()).run();
}

async function beginIdentity(
  env: IdentityEnv,
  request: Request,
  input: { providerSlug?: string; intent?: string; returnTo?: string; locale?: string },
): Promise<{ response: Response; binding: string | null }> {
  await pruneExpiredTransactions(env);
  const slug = (input.providerSlug ?? '').trim();
  const intent = input.intent === 'link' ? 'link' : 'login';
  const locale = (input.locale ?? '').trim();
  const existingBinding = request.headers.get('cookie')?.match(new RegExp(`${BINDING_COOKIE}=([^;]+)`))?.[1];
  // The binding is a per-browser secret this endpoint mints: the first /start
  // call sets the HttpOnly cookie, later calls reuse it. Only the digest is
  // stored, so the transaction can only ever be exchanged by this browser.
  const binding = /^[A-Za-z0-9_-]{32,128}$/.test(existingBinding ?? '') ? existingBinding! : identitySecret();
  const returnTo = identityReturnPath((input.returnTo ?? '').trim(), locale);
  const finishOrigin = requestOrigin(request);
  if (!finishOrigin) throw new IdentityError('IDENTITY_TRANSACTION_INVALID');

  let session: PublicUser | null = null;
  if (intent === 'link') {
    session = await authenticateNativeUser(request, env);
    if (!session) throw new IdentityError('IDENTITY_ACCOUNT_UNAVAILABLE');
  }

  const provider = (await readyIdentityProviders(env)).find((candidate) => candidate.slug === slug);
  if (!provider) throw new IdentityError('IDENTITY_UNAVAILABLE', 503);

  const state = identitySecret();
  const nonce = identitySecret();
  const verifier = identitySecret();
  const bindingHash = await identityHash(env, binding, 'binding');
  const stateHash = await identityHash(env, state, 'state');
  const sealed = await sealIdentityMaterial(env, { nonce, verifier });
  const expiresAt = new Date(Date.now() + TRANSACTION_TTL_MS).toISOString();

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(`${finishOrigin}/api/v1/auth/identity/${encodeURIComponent(slug)}/callback`);
  } catch {
    throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  }
  let authorizationUrl: string;
  try {
    authorizationUrl = await providerAuthorize(provider, callbackUrl.href, state, nonce, await identityChallenge(verifier));
    const parsed = new URL(authorizationUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
      throw new IdentityError('IDENTITY_UNAVAILABLE', 503);
    }
  } catch (error) {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError('IDENTITY_UNAVAILABLE', 503);
  }

  await env.DB.prepare(
    `INSERT INTO native_identity_transactions
      (id, provider_slug, issuer, state_hash, binding_hash, encrypted_payload, intent, return_to, locale,
       finish_origin, user_id, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
  ).bind(
    crypto.randomUUID(), slug, provider.issuer, stateHash, bindingHash, sealed, intent, returnTo,
    locale, finishOrigin, session?.id ?? null, expiresAt,
  ).run();
  const headers = new Headers();
  headers.append('set-cookie', `${BINDING_COOKIE}=${binding}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax`);
  return { response: json({ authorizationUrl, intent, returnTo, locale }, 200, headers), binding };
}

function finishRedirect(transaction: TransactionRow, values: Record<string, string>): Response {
  const url = new URL(`${transaction.finish_origin}/${transaction.locale}${FINISH_PATH}`);
  for (const [key, value] of Object.entries(values)) {
    if (key === 'code') url.hash = new URLSearchParams({ code: value }).toString();
    else url.searchParams.set(key, value);
  }
  return new Response(null, { status: 302, headers: mergeRuntime(new Headers({ location: url.href })) });
}

async function identityCallback(env: IdentityEnv, slug: string, request: Request, state: string, error?: string): Promise<Response> {
  await pruneExpiredTransactions(env);
  const stateHash = await identityHash(env, state, 'state');
  const row = await env.DB.prepare(
    'SELECT * FROM native_identity_transactions WHERE state_hash = ?1 AND provider_slug = ?2',
  ).bind(stateHash, slug).first<TransactionRow>();
  // Without a transaction there is no trusted finish origin to bounce to, so
  // unknown/replayed/expired states answer as a plain JSON error instead of a
  // redirect.
  if (!row || !row.encrypted_payload || row.claimed_at || row.consumed_at || row.expires_at <= nowIso()) {
    return fail('IDENTITY_TRANSACTION_INVALID', identityErrorMessage('IDENTITY_TRANSACTION_INVALID'), 400);
  }
  if (!row.finish_origin) return fail('IDENTITY_TRANSACTION_INVALID', identityErrorMessage('IDENTITY_TRANSACTION_INVALID'), 400);

  let material: { nonce: string; verifier: string };
  try {
    material = await openIdentityMaterial(env, row.encrypted_payload);
  } catch {
    return finishRedirect(row, { error: 'IDENTITY_TRANSACTION_INVALID' });
  }

  // Atomic claim: a replayed state loses here no matter how many callers race.
  const claimed = await env.DB.prepare(
    `UPDATE native_identity_transactions SET claimed_at = ?1, encrypted_payload = NULL
     WHERE id = ?2 AND claimed_at IS NULL AND consumed_at IS NULL AND expires_at > ?1 AND encrypted_payload IS NOT NULL`,
  ).bind(nowIso(), row.id).run();
  if ((claimed.meta.changes ?? 0) !== 1) {
    return finishRedirect(row, { error: 'IDENTITY_TRANSACTION_INVALID' });
  }

  let identity: VerifiedIdentity;
  try {
    if (error) throw new IdentityError(error === 'access_denied' ? 'IDENTITY_CANCELLED' : 'IDENTITY_REJECTED');
    const provider = (await readyIdentityProviders(env)).find((candidate) => candidate.slug === slug && candidate.issuer === row.issuer);
    if (!provider) throw new IdentityError('IDENTITY_UNAVAILABLE', 503);
    identity = await providerComplete(provider, `${row.finish_origin}/api/v1/auth/identity/${encodeURIComponent(slug)}/callback`, state, material.nonce, material.verifier);
  } catch (claimError) {
    await env.DB.prepare('UPDATE native_identity_transactions SET consumed_at = ?1 WHERE id = ?2')
      .bind(nowIso(), row.id).run();
    return finishRedirect(row, { error: claimError instanceof IdentityError ? claimError.code : 'IDENTITY_REJECTED' });
  }

  const handoff = identitySecret();
  await env.DB.prepare(
    `UPDATE native_identity_transactions SET verified_identity_json = ?1, handoff_hash = ?2, handoff_expires_at = ?3
     WHERE id = ?4 AND consumed_at IS NULL`,
  ).bind(JSON.stringify(identity), await identityHash(env, handoff, 'handoff'), new Date(Date.now() + HANDOFF_TTL_MS).toISOString(), row.id).run();
  return finishRedirect(row, { code: handoff });
}

async function findUserRow(env: IdentityEnv, userId: string): Promise<NativeUserRow | null> {
  return env.DB.prepare('SELECT id, email, username, role, avatar, is_active, password_set, email_verified FROM native_users WHERE id = ?1')
    .bind(userId).first<NativeUserRow>();
}

async function exchangeIdentity(env: IdentityEnv, request: Request, code: string): Promise<Response> {
  const binding = request.headers.get('cookie')?.match(new RegExp(`${BINDING_COOKIE}=([^;]+)`))?.[1];
  const row = binding
    ? await env.DB.prepare('SELECT * FROM native_identity_transactions WHERE handoff_hash = ?1')
      .bind(await identityHash(env, code, 'handoff')).first<TransactionRow>()
    : null;
  const bindingHash = binding ? await identityHash(env, binding, 'binding') : '';
  if (
    !row || !binding || row.binding_hash !== bindingHash || !row.verified_identity_json
    || !row.handoff_expires_at || row.handoff_expires_at <= nowIso() || row.expires_at <= nowIso() || row.consumed_at
  ) {
    throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  }
  const identity = JSON.parse(row.verified_identity_json) as VerifiedIdentity;
  if (identity.emailVerified !== true || identity.issuer !== row.issuer) {
    throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  }

  // Atomic consume: the handoff works exactly once, for the bound browser,
  // inside its 60-second window.
  const consumed = await env.DB.prepare(
    `UPDATE native_identity_transactions SET consumed_at = ?1, verified_identity_json = NULL, handoff_hash = NULL
     WHERE id = ?2 AND consumed_at IS NULL AND handoff_expires_at > ?1 AND binding_hash = ?3`,
  ).bind(nowIso(), row.id, bindingHash).run();
  if ((consumed.meta.changes ?? 0) !== 1) throw new IdentityError('IDENTITY_TRANSACTION_INVALID');

  if (row.intent === 'link') {
    const session = await authenticateNativeUser(request, env);
    if (!session || session.id !== row.user_id) throw new IdentityError('IDENTITY_ACCOUNT_UNAVAILABLE');
    const user = await requireCustomerUser(env, await findUserRow(env, session.id));
    const existing = await env.DB.prepare(
      'SELECT id, user_id FROM native_external_identities WHERE issuer = ?1 AND subject = ?2',
    ).bind(identity.issuer, identity.subject).first<{ id: string; user_id: string }>();
    if (existing) throw new IdentityError('IDENTITY_ALREADY_LINKED', 409);
    await env.DB.prepare(
      'INSERT INTO native_external_identities (id, user_id, provider_slug, issuer, subject, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    ).bind(crypto.randomUUID(), user.id, row.provider_slug, identity.issuer, identity.subject, nowIso()).run();
    return json({ linked: true, returnTo: row.return_to });
  }

  let user: NativeUserRow;
  const existing = await env.DB.prepare(
    'SELECT id, user_id FROM native_external_identities WHERE issuer = ?1 AND subject = ?2',
  ).bind(identity.issuer, identity.subject).first<{ id: string; user_id: string }>();
  if (existing) {
    user = await requireCustomerUser(env, await findUserRow(env, existing.user_id));
    const stillBound = await env.DB.prepare(
      'SELECT id FROM native_external_identities WHERE id = ?1 AND user_id = ?2',
    ).bind(existing.id, user.id).first<{ id: string }>();
    if (!stillBound) throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  } else {
    // Identical email strings never merge accounts: a native_users row that
    // already owns the address (password account or another identity) blocks
    // the claim instead of silently attaching.
    const emailOwner = await findNativeUserByEmail(env, identity.email);
    if (emailOwner) throw new IdentityError('IDENTITY_EMAIL_IN_USE', 409);
    const display = (identity.displayName ?? 'Customer').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 30) || 'Customer';
    const username = `${display}-${identitySecret(12)}`;
    // Identity-only account: password_set = 0 with an unusable random hash so
    // password login can never succeed against it.
    const userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO native_users
        (id, email, username, role, avatar, password_salt, password_hash, password_iterations, is_active,
         email_verified, password_set, updated_at)
       VALUES (?1, ?2, ?3, 'USER', NULL, ?4, ?5, 100000, 1, 1, 0, CURRENT_TIMESTAMP)`,
    ).bind(
      userId,
      identity.email,
      username,
      base64Url(crypto.getRandomValues(new Uint8Array(32))),
      base64Url(crypto.getRandomValues(new Uint8Array(32))),
    ).run();
    await env.DB.prepare(
      'INSERT INTO native_external_identities (id, user_id, provider_slug, issuer, subject, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    ).bind(crypto.randomUUID(), userId, row.provider_slug, identity.issuer, identity.subject, nowIso()).run();
    user = (await findUserRow(env, userId))!;
  }
  user = await requireCustomerUser(env, user);
  await recordNativeLoginSuccess(env, {
    email: user.email,
    userId: user.id,
    source: 'storefront',
    ip: request.headers.get('cf-connecting-ip') ?? '',
    userAgent: request.headers.get('user-agent'),
  });
  const sessionUser: PublicUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    avatar: user.avatar,
    emailVerified: user.email_verified === 1,
  };
  const session = await createNativeSession(env, sessionUser, 'shop');
  return new Response(JSON.stringify(session.body), { status: 200, headers: session.headers });
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function identityConnections(env: IdentityEnv, request: Request): Promise<Response> {
  const session = await authenticateNativeUser(request, env);
  if (!session) throw new IdentityError('UNAUTHORIZED', 401);
  const rows = await env.DB.prepare(
    `SELECT id, provider_slug, issuer, subject, created_at FROM native_external_identities
     WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 20`,
  ).bind(session.id).all<{ id: string; provider_slug: string; issuer: string; subject: string; created_at: string }>();
  const providers = await readyIdentityProviders(env);
  return json({
    identities: (rows.results ?? []).map((row) => ({
      id: row.id,
      providerSlug: row.provider_slug,
      issuer: row.issuer,
      subject: row.subject,
      createdAt: row.created_at,
      label: providers.find((provider) => provider.slug === row.provider_slug)?.label ?? row.provider_slug,
      available: providers.some((provider) => provider.slug === row.provider_slug && provider.issuer === row.issuer),
    })),
  });
}

async function removeIdentity(env: IdentityEnv, request: Request, id: string): Promise<Response> {
  const session = await authenticateNativeUser(request, env);
  if (!session) throw new IdentityError('UNAUTHORIZED', 401);
  const found = await env.DB.prepare('SELECT * FROM native_external_identities WHERE id = ?1').bind(id)
    .first<{ id: string; user_id: string; issuer: string; subject: string }>();
  if (!found || found.user_id !== session.id) throw new IdentityError('IDENTITY_TRANSACTION_INVALID');
  const user = await requireCustomerUser(env, await findUserRow(env, session.id));
  if (!user.password_set) {
    const remaining = await env.DB.prepare(
      'SELECT provider_slug, issuer FROM native_external_identities WHERE user_id = ?1 AND id != ?2',
    ).bind(user.id, id).all<{ provider_slug: string; issuer: string }>();
    const providers = await readyIdentityProviders(env);
    const stillAvailable = (remaining.results ?? []).some((row) => providers.some((provider) => provider.slug === row.provider_slug && provider.issuer === row.issuer));
    if (!stillAvailable) throw new IdentityError('IDENTITY_LAST_METHOD');
  }
  await env.DB.prepare('DELETE FROM native_external_identities WHERE id = ?1').bind(id).run();
  return json({ removed: true });
}

// --- Route surface -----------------------------------------------------------

export async function tryNativeIdentityLogin(request: Request, env: IdentityEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/v1/auth/identity')) return null;

  try {
    if (request.method === 'GET' && path === '/api/v1/auth/identity/providers') {
      const providers = await readyIdentityProviders(env);
      return json({ providers: providers.map((provider) => ({ slug: provider.slug, label: provider.label, ready: true })) });
    }

    if (request.method === 'POST' && path === '/api/v1/auth/identity/start') {
      const body = await request.clone().json<{ providerSlug?: string; intent?: string; returnTo?: string; locale?: string }>().catch(() => ({}));
      const { response } = await beginIdentity(env, request, body);
      return response;
    }

    const callbackMatch = path.match(/^\/api\/v1\/auth\/identity\/([a-z0-9][a-z0-9-]{0,63})\/callback$/);
    if (callbackMatch && (request.method === 'GET' || request.method === 'POST')) {
      const state = url.searchParams.get('state') ?? (request.method === 'POST' ? await request.clone().json<{ state?: string }>().catch(() => ({}) as { state?: string }).then((body) => body.state ?? '') : '');
      if (!state) return fail('IDENTITY_TRANSACTION_INVALID', identityErrorMessage('IDENTITY_TRANSACTION_INVALID'), 400);
      return await identityCallback(env, callbackMatch[1], request, state, url.searchParams.get('error') ?? undefined);
    }

    if (request.method === 'POST' && path === '/api/v1/auth/identity/exchange') {
      const body = await request.clone().json<{ code?: string }>().catch(() => ({}) as { code?: string });
      if (!body.code) return fail('IDENTITY_TRANSACTION_INVALID', identityErrorMessage('IDENTITY_TRANSACTION_INVALID'), 400);
      try {
        return await exchangeIdentity(env, request, body.code);
      } catch (error) {
        if (!(error instanceof IdentityError)) throw error;
        const headers = new Headers();
        if (error.code === 'IDENTITY_TRANSACTION_INVALID') {
          headers.append('set-cookie', `${BINDING_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
        }
        return fail(error.code, identityErrorMessage(error.code), error.status, headers);
      }
    }

    if (request.method === 'GET' && path === '/api/v1/auth/identity/connections') {
      return await identityConnections(env, request);
    }

    const removeMatch = path.match(/^\/api\/v1\/auth\/identity\/connections\/([A-Za-z0-9-]+)$/);
    if (removeMatch && request.method === 'DELETE') {
      return await removeIdentity(env, request, removeMatch[1]);
    }

    return fail('NOT_FOUND', 'Unknown identity route', 404);
  } catch (error) {
    if (error instanceof IdentityError) {
      return fail(error.code, identityErrorMessage(error.code), error.status);
    }
    throw error;
  }
}

function identityErrorMessage(code: string): string {
  switch (code) {
    case 'IDENTITY_UNAVAILABLE': return 'No identity provider is available for this instance';
    case 'IDENTITY_TRANSACTION_INVALID': return 'The identity transaction is invalid or has expired';
    case 'IDENTITY_ACCOUNT_UNAVAILABLE': return 'This account cannot use identity login';
    case 'IDENTITY_EMAIL_IN_USE': return 'An account with this email already exists; sign in with the original method and link the identity from account settings';
    case 'IDENTITY_ALREADY_LINKED': return 'This external identity is already linked to an account';
    case 'IDENTITY_LAST_METHOD': return 'Set a password before removing the last sign-in method';
    case 'IDENTITY_CANCELLED': return 'Sign-in was cancelled';
    case 'IDENTITY_REJECTED': return 'The identity provider did not verify this sign-in';
    case 'UNAUTHORIZED': return 'Authentication is required';
    default: return 'Identity sign-in failed';
  }
}
