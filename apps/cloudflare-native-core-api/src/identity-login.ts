import {
  authenticateNativeUser,
  findNativeUserByEmail,
  createNativeSession,
  type NativeAuthEnv,
  type PublicUser,
} from './auth';
import { openNativeAffiliatePartner } from './affiliate-open';
import {
  identityChallenge,
  identityHash,
  identitySecret,
  openIdentityMaterial,
  sealIdentityMaterial,
} from './identity-crypto';
import { appleClientSecret, OidcTokenError, verifyOidcToken, type OidcClaims } from './identity-oidc';
import { getNativePluginConfig, type PluginSettingsEnv } from './plugin-settings';
import { consumeVerificationRateLimit } from './auth-rate-limit';
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
 *   email; a known (issuer, subject) always logs in to its own account. A new
 *   (issuer, subject) whose verified email belongs to an existing account is
 *   linked to that account only when the account's own email is verified too;
 *   an unverified owner blocks the claim (IDENTITY_EMAIL_IN_USE).
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
// The shop storefront ships these locales (shared/src/i18n); returnTo and the
// finish redirect must accept every one of them, not just the ones that
// existed when identity login landed (the 7-language storefront came later).
const LOCALES = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'];
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

// Both unauthenticated entry points (/start and the native token channel) are
// throttled per IP and per provider so a flooding client cannot turn the
// instance into a free OAuth oracle.
async function enforceIdentityRateLimit(env: IdentityEnv, request: Request, providerSlug: string): Promise<void> {
  const result = await consumeVerificationRateLimit(request, env, 'social', providerSlug);
  if (!result.allowed) throw new IdentityError('IDENTITY_RATE_LIMITED', 429);
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

// --- Provider adapters (OAuth 2.0 / OIDC, settings-driven) ------------------
//
// Every provider is a ReadyProvider: the dispatch skeleton (routes, transac-
// tions, handoff, binding, sessions) is provider-agnostic and only ever sees
// slug/label/issuer/clientId plus the authorize/complete closures. Web flow
// ID tokens arrive over TLS from the provider token endpoint in exchange for
// our code + confidential client credential, so structural claim validation
// gates them; the NATIVE (app) channel additionally verifies signatures via
// identity-oidc because that token comes straight off the wire.

interface AuthorizeInput {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

interface CompleteInput {
  redirectUri: string;
  code: string;
  nonce: string;
  verifier: string;
}

interface ReadyProvider {
  slug: string;
  label: string;
  issuer: string;
  clientId: string;
  authorize: (input: AuthorizeInput) => Promise<string>;
  complete: (input: CompleteInput) => Promise<VerifiedIdentity>;
  /** Present when the provider can also verify app-native id_tokens. */
  native?: { jwksUri: string; audiences: () => Promise<string[]> };
}

interface OidcTokenResponse {
  id_token?: string;
  error?: string;
}

interface OidcIdTokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  nonce?: string;
  name?: string;
}

function tokenAudience(claims: OidcIdTokenClaims): string[] {
  return Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
}

function oidcEmailVerified(claims: OidcIdTokenClaims): boolean {
  // Google/Facebook send a boolean, Apple sends the string "true"/"false".
  return claims.email_verified === true || claims.email_verified === 'true';
}

// Shared structural ID-token gate for the web (TLS-confidential) channel.
function verifyWebClaims(claims: OidcIdTokenClaims, input: {
  issuers: string[];
  audience: string;
  nonce: string;
}): void {
  const expired = typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now();
  if (
    !input.issuers.includes(claims.iss ?? '')
    || !tokenAudience(claims).includes(input.audience)
    || typeof claims.sub !== 'string' || !claims.sub
    || typeof claims.email !== 'string' || !claims.email.includes('@')
    || !oidcEmailVerified(claims)
    || expired
    || claims.nonce !== input.nonce
  ) {
    throw new IdentityError('IDENTITY_REJECTED');
  }
}

function verifiedIdentity(claims: OidcIdTokenClaims, issuer: string): VerifiedIdentity {
  return {
    issuer,
    subject: claims.sub!,
    email: claims.email!.trim().toLowerCase(),
    emailVerified: true,
    displayName: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 200) : undefined,
  };
}

async function readProviderConfig(env: IdentityEnv, slug: string): Promise<Record<string, unknown> | null> {
  const stored = await getNativePluginConfig(env, slug);
  if (!stored?.enabled) return null;
  return stored.config as Record<string, unknown>;
}

function configString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

// Generic OIDC authorization URL builder (Google/Facebook share it; Apple
// overrides authorize entirely for its form_post flow).
async function oidcAuthorize(input: {
  endpoint: string;
  clientId: string;
  scope: string;
  extraParams?: Record<string, string>;
}, providerInput: AuthorizeInput): Promise<string> {
  const url = new URL(input.endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', providerInput.redirectUri);
  url.searchParams.set('scope', input.scope);
  url.searchParams.set('state', providerInput.state);
  url.searchParams.set('nonce', providerInput.nonce);
  url.searchParams.set('code_challenge', providerInput.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  for (const [key, value] of Object.entries(input.extraParams ?? {})) url.searchParams.set(key, value);
  return url.href;
}

// Shared web-channel token exchange + structural claim gate.
async function oidcComplete(input: {
  tokenEndpoint: string;
  clientSecret: () => Promise<string>;
  issuers: string[];
  audience: string;
  includeVerifier: boolean;
}, providerInput: CompleteInput): Promise<VerifiedIdentity> {
  const clientSecret = await input.clientSecret();
  const body: Record<string, string> = {
    code: providerInput.code,
    client_id: input.audience,
    client_secret: clientSecret,
    redirect_uri: providerInput.redirectUri,
    grant_type: 'authorization_code',
  };
  if (input.includeVerifier) body.code_verifier = providerInput.verifier;
  const response = await fetch(input.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!response.ok) throw new IdentityError('IDENTITY_REJECTED');
  const payload = await response.json<OidcTokenResponse>().catch(() => ({}) as OidcTokenResponse);
  if (!payload.id_token) throw new IdentityError('IDENTITY_REJECTED');
  const [, encodedClaims] = payload.id_token.split('.');
  if (!encodedClaims) throw new IdentityError('IDENTITY_REJECTED');
  let claims: OidcIdTokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodedClaims.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)))) as OidcIdTokenClaims;
  } catch {
    throw new IdentityError('IDENTITY_REJECTED');
  }
  verifyWebClaims(claims, { issuers: input.issuers, audience: input.audience, nonce: providerInput.nonce });
  return verifiedIdentity(claims, input.issuers[0]!);
}

const FACEBOOK_API_VERSION = 'v21.0';

async function googleProvider(env: IdentityEnv): Promise<ReadyProvider | null> {
  const config = await readProviderConfig(env, 'google-auth');
  if (!config) return null;
  const clientId = configString(config, 'clientId');
  const clientSecret = configString(config, 'clientSecret');
  if (!clientId || !clientSecret) return null;
  const issuers = ['https://accounts.google.com'];
  return {
    slug: 'google-auth',
    label: 'Google',
    issuer: issuers[0]!,
    clientId,
    authorize: (providerInput) => oidcAuthorize({
      endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId,
      scope: 'openid email profile',
      extraParams: { prompt: 'select_account' },
    }, providerInput),
    complete: (providerInput) => oidcComplete({
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      clientSecret: async () => clientSecret,
      issuers,
      audience: clientId,
      includeVerifier: true,
    }, providerInput),
    // App channel: the same web client is not an accepted audience for SDK
    // tokens; Android/iOS clients are configured when the app goes live.
    native: {
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      audiences: async () => [configString(config, 'androidClientId'), configString(config, 'iosClientId')].filter(Boolean),
    },
  };
}

async function facebookProvider(env: IdentityEnv): Promise<ReadyProvider | null> {
  const config = await readProviderConfig(env, 'facebook-auth');
  if (!config) return null;
  const clientId = configString(config, 'appId');
  const clientSecret = configString(config, 'appSecret');
  if (!clientId || !clientSecret) return null;
  const issuers = ['https://facebook.com'];
  return {
    slug: 'facebook-auth',
    label: 'Facebook',
    issuer: issuers[0]!,
    clientId,
    authorize: (providerInput) => oidcAuthorize({
      endpoint: `https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth`,
      clientId,
      scope: 'openid email profile',
    }, providerInput),
    complete: (providerInput) => oidcComplete({
      tokenEndpoint: `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token`,
      clientSecret: async () => clientSecret,
      issuers,
      audience: clientId,
      includeVerifier: true,
    }, providerInput),
    // Facebook OIDC tokens carry the app id as audience, web and app alike.
    native: {
      jwksUri: 'https://www.facebook.com/.well-known/jwks.json',
      audiences: async () => [clientId],
    },
  };
}

async function appleProvider(env: IdentityEnv): Promise<ReadyProvider | null> {
  const config = await readProviderConfig(env, 'apple-auth');
  if (!config) return null;
  const servicesId = configString(config, 'servicesId');
  const teamId = configString(config, 'teamId');
  const keyId = configString(config, 'keyId');
  const privateKeyPem = configString(config, 'privateKey');
  if (!servicesId || !teamId || !keyId || !privateKeyPem) return null;
  const issuers = ['https://appleid.apple.com'];
  return {
    slug: 'apple-auth',
    label: 'Apple',
    issuer: issuers[0]!,
    clientId: servicesId,
    authorize: async (providerInput) => {
      // Apple rejects PKCE and requires form_post for web flows; the callback
      // route already accepts POST with the state in the body. Nonce is
      // allowed on the authorize request and echoed inside the id_token.
      const url = new URL('https://appleid.apple.com/auth/authorize');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('response_mode', 'form_post');
      url.searchParams.set('client_id', servicesId);
      url.searchParams.set('redirect_uri', providerInput.redirectUri);
      url.searchParams.set('scope', 'name email');
      url.searchParams.set('state', providerInput.state);
      url.searchParams.set('nonce', providerInput.nonce);
      return url.href;
    },
    complete: (providerInput) => oidcComplete({
      tokenEndpoint: 'https://appleid.apple.com/auth/token',
      clientSecret: () => appleClientSecret({ teamId, keyId, servicesId, privateKeyPem }),
      issuers,
      audience: servicesId,
      // Apple does not support PKCE; the one-time code + rotating ES256
      // client secret carry the anti-replay role instead.
      includeVerifier: false,
    }, providerInput),
    native: {
      jwksUri: 'https://appleid.apple.com/auth/keys',
      audiences: async () => [configString(config, 'bundleId') || servicesId],
    },
  };
}

export async function readyIdentityProviders(env: IdentityEnv): Promise<ReadyProvider[]> {
  const providers = await Promise.all([googleProvider(env), facebookProvider(env), appleProvider(env)]);
  return providers.filter((provider): provider is ReadyProvider => provider !== null);
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
    authorizationUrl = await provider.authorize({
      redirectUri: callbackUrl.href,
      state,
      nonce,
      codeChallenge: await identityChallenge(verifier),
    });
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

async function identityCallback(env: IdentityEnv, slug: string, request: Request, input: { state: string; code: string }, error?: string): Promise<Response> {
  const { state, code } = input;
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
    identity = await provider.complete({
      redirectUri: `${row.finish_origin}/api/v1/auth/identity/${encodeURIComponent(slug)}/callback`,
      code,
      nonce: material.nonce,
      verifier: material.verifier,
    });
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

  return loginWithIdentity(env, request, identity, row.provider_slug);
}

// Shared login leg for the browser handoff (exchangeIdentity) and the native
// app channel (loginWithNativeToken): bind-or-create strictly by (issuer,
// subject), then mint a plain shop session.
async function loginWithIdentity(env: IdentityEnv, request: Request, identity: VerifiedIdentity, providerSlug: string): Promise<Response> {
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
    const emailOwner = await findNativeUserByEmail(env, identity.email);
    if (emailOwner) {
      // Link the identity to the account that owns the address only when both
      // sides verified it: the provider's claim got us here, so the gate is
      // the account's own email_verified flag. An unverified owner could be
      // anyone who typed the address at sign-up, and merging would hand that
      // person the real owner's session — so it keeps blocking the claim.
      if (emailOwner.email_verified !== 1) throw new IdentityError('IDENTITY_EMAIL_IN_USE', 409);
      user = await requireCustomerUser(env, await findUserRow(env, emailOwner.id));
      await env.DB.prepare(
        'INSERT INTO native_external_identities (id, user_id, provider_slug, issuer, subject, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
      ).bind(crypto.randomUUID(), user.id, providerSlug, identity.issuer, identity.subject, nowIso()).run();
    } else {
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
      ).bind(crypto.randomUUID(), userId, providerSlug, identity.issuer, identity.subject, nowIso()).run();
      user = (await findUserRow(env, userId))!;
    }
  }
  user = await requireCustomerUser(env, user);
  // A storefront account is a partner by default: an account made by signing in with a provider
  // is verified from the start, so it gets its partner account now.
  await openNativeAffiliatePartner(env, user);
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

// --- Native (app) channel ----------------------------------------------------
//
// Mobile apps sign the visitor in with the provider's own SDK and hand Core
// the resulting id_token. Unlike the web flow, that token comes straight from
// the wire, so it is signature-verified against the provider's JWKS before
// any account is touched. The response is a plain shop session (Bearer body
// plus cookies), so both native shells and webviews can adopt it. The
// fullName is display-only (Apple only reveals it on first authorization and
// never inside the token); identity binding always uses (issuer, subject).

async function loginWithNativeToken(
  env: IdentityEnv,
  request: Request,
  input: { providerSlug?: string; idToken?: string; nonce?: string; fullName?: string },
): Promise<Response> {
  const slug = (input.providerSlug ?? '').trim();
  const idToken = (input.idToken ?? '').trim();
  if (!idToken) throw new IdentityError('IDENTITY_REJECTED');
  const provider = (await readyIdentityProviders(env)).find((candidate) => candidate.slug === slug);
  if (!provider?.native) throw new IdentityError('IDENTITY_UNAVAILABLE', 503);
  const audiences = (await provider.native.audiences()).filter(Boolean);
  if (audiences.length === 0) throw new IdentityError('IDENTITY_UNAVAILABLE', 503);
  let claims: OidcClaims;
  try {
    claims = await verifyOidcToken(idToken, {
      jwksUri: provider.native.jwksUri,
      issuer: provider.issuer,
      audiences,
      nonce: input.nonce?.trim() || undefined,
    });
  } catch (error) {
    if (error instanceof OidcTokenError) {
      if (error.code === 'OIDC_JWKS_UNAVAILABLE') throw new IdentityError('IDENTITY_UNAVAILABLE', 503);
      throw new IdentityError('IDENTITY_REJECTED');
    }
    throw error;
  }
  const identity: VerifiedIdentity = {
    issuer: provider.issuer,
    subject: claims.sub!,
    email: claims.email!.trim().toLowerCase(),
    emailVerified: true,
    displayName: typeof input.fullName === 'string' && input.fullName.trim()
      ? input.fullName.trim().slice(0, 200)
      : typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 200) : undefined,
  };
  return loginWithIdentity(env, request, identity, provider.slug);
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
      const body = await request.clone().json<{ providerSlug?: string; intent?: string; returnTo?: string; locale?: string }>().catch(() => ({}) as { providerSlug?: string; intent?: string; returnTo?: string; locale?: string });
      await enforceIdentityRateLimit(env, request, (body.providerSlug ?? '').trim() || 'unknown');
      const { response } = await beginIdentity(env, request, body);
      return response;
    }

    if (request.method === 'POST' && path === '/api/v1/auth/identity/native') {
      const body = await request.clone().json<{ providerSlug?: string; idToken?: string; nonce?: string; fullName?: string }>().catch(() => ({}) as { providerSlug?: string; idToken?: string; nonce?: string; fullName?: string });
      await enforceIdentityRateLimit(env, request, (body.providerSlug ?? '').trim() || 'unknown');
      return await loginWithNativeToken(env, request, body);
    }

    const callbackMatch = path.match(/^\/api\/v1\/auth\/identity\/([a-z0-9][a-z0-9-]{0,63})\/callback$/);
    if (callbackMatch && (request.method === 'GET' || request.method === 'POST')) {
      // GET callbacks (Google/Facebook) carry state+code in the query; Apple's
      // form_post delivers them as an urlencoded POST body. JSON bodies remain
      // supported for the programmatic path.
      let state = url.searchParams.get('state') ?? '';
      let code = url.searchParams.get('code') ?? '';
      const errorParam = url.searchParams.get('error') ?? undefined;
      if (request.method === 'POST' && (!state || !code)) {
        const contentType = request.headers.get('content-type') ?? '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const form = await request.clone().formData().catch(() => null);
          if (form) {
            state = state || (form.get('state') as string | null) || '';
            code = code || (form.get('code') as string | null) || '';
          }
        } else {
          const body = await request.clone().json<{ state?: string; code?: string }>().catch(() => ({}) as { state?: string; code?: string });
          state = state || body.state || '';
          code = code || body.code || '';
        }
      }
      if (!state) return fail('IDENTITY_TRANSACTION_INVALID', identityErrorMessage('IDENTITY_TRANSACTION_INVALID'), 400);
      return await identityCallback(env, callbackMatch[1], request, { state, code }, errorParam);
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
    case 'IDENTITY_RATE_LIMITED': return 'Too many sign-in attempts; please retry later';
    case 'UNAUTHORIZED': return 'Authentication is required';
    default: return 'Identity sign-in failed';
  }
}
