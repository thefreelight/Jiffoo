/**
 * Minimal OIDC token verification for the native identity login surface.
 *
 * The web flow never needs this module: there the ID token arrives over TLS
 * from the provider's token endpoint in exchange for a confidential client
 * secret, so structural claim checks are sufficient. This module exists for
 * the NATIVE channel, where the app obtains the token itself (Sign in with
 * Apple, Google Identity SDK, Facebook OIDC) and posts it to Core — a token
 * from the wire MUST be signature-verified against the provider's JWKS
 * before any identity is minted from it.
 *
 * Everything here is dependency-free on purpose: the worker hand-rolls its
 * JWTs (HS256 via crypto.subtle) and pulling a JOSE library in for two verify
 * paths (ES256 + RS256) is not worth the supply-chain surface.
 */

export interface OidcClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iat?: number;
  nonce?: string;
  name?: string;
  is_private_email?: string | boolean;
}

export interface OidcVerifyInput {
  /** Provider JWKS document URL (fetched and cached in-memory per isolate). */
  jwksUri: string;
  /** Expected `iss` claim (exact match). */
  issuer: string;
  /** Accepted `aud` values — at least one must match (string or array aud). */
  audiences: string[];
  /** Optional replay guard: the token's `nonce` claim must equal this. */
  nonce?: string;
  /** Clock skew allowance in seconds (default 60). */
  skewSeconds?: number;
}

interface JwtParts {
  header: { alg?: string; kid?: string };
  claims: OidcClaims;
  signingInput: Uint8Array;
  signature: Uint8Array;
}

export class OidcTokenError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeJwt(token: string): JwtParts {
  const segments = token.trim().split('.');
  if (segments.length !== 3) throw new OidcTokenError('OIDC_TOKEN_MALFORMED');
  const [rawHeader, rawClaims, rawSignature] = segments as [string, string, string];
  let header: JwtParts['header'];
  let claims: OidcClaims;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(rawHeader))) as JwtParts['header'];
    claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(rawClaims))) as OidcClaims;
  } catch {
    throw new OidcTokenError('OIDC_TOKEN_MALFORMED');
  }
  return {
    header,
    claims,
    signingInput: new TextEncoder().encode(`${rawHeader}.${rawClaims}`),
    signature: base64UrlToBytes(rawSignature),
  };
}

interface CachedKeys {
  keys: Map<string, JsonWebKey>;
  fetchedAt: number;
}

// Per-isolate cache: JWKS rotate rarely; one hour is well inside every
// provider's guidance and bounds the damage of a stale key to an hour.
const JWKS_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map<string, CachedKeys>();

interface JwksDocument {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string }>;
}

async function loadJwks(jwksUri: string): Promise<Map<string, JsonWebKey>> {
  const cached = jwksCache.get(jwksUri);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
  const response = await fetch(jwksUri, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new OidcTokenError('OIDC_JWKS_UNAVAILABLE');
  const document = await response.json<JwksDocument>().catch(() => ({}) as JwksDocument);
  const keys = new Map<string, JsonWebKey>();
  for (const key of document.keys ?? []) {
    if (key.kid && (key.kty === 'EC' || key.kty === 'RSA')) keys.set(key.kid, key);
  }
  if (keys.size === 0) throw new OidcTokenError('OIDC_JWKS_UNAVAILABLE');
  jwksCache.set(jwksUri, { keys, fetchedAt: Date.now() });
  return keys;
}

async function importVerifyKey(jwk: JsonWebKey, alg: string): Promise<CryptoKey> {
  if (alg === 'ES256') {
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new OidcTokenError('OIDC_TOKEN_MALFORMED');
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  }
  if (alg === 'RS256') {
    if (jwk.kty !== 'RSA') throw new OidcTokenError('OIDC_TOKEN_MALFORMED');
    return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5' }, false, ['verify']);
  }
  throw new OidcTokenError('OIDC_TOKEN_MALFORMED');
}

function audienceMatches(claims: OidcClaims, audiences: string[]): boolean {
  const tokenAud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  return tokenAud.some((value) => audiences.includes(value));
}

function emailVerified(claims: OidcClaims): boolean {
  // Providers disagree on the representation: Google sends a boolean, Apple
  // sends the strings "true"/"false". Facebook OIDC follows the boolean form.
  return claims.email_verified === true || claims.email_verified === 'true';
}

export async function verifyOidcToken(token: string, input: OidcVerifyInput): Promise<OidcClaims> {
  const parts = decodeJwt(token);
  const alg = parts.header.alg;
  if (alg !== 'ES256' && alg !== 'RS256') throw new OidcTokenError('OIDC_TOKEN_MALFORMED');
  const kid = parts.header.kid;
  if (!kid) throw new OidcTokenError('OIDC_TOKEN_MALFORMED');

  const keys = await loadJwks(input.jwksUri);
  const jwk = keys.get(kid);
  if (!jwk) throw new OidcTokenError('OIDC_TOKEN_MALFORMED');
  const key = await importVerifyKey(jwk, alg);
  const algorithm = alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
  const valid = await crypto.subtle.verify(algorithm, key, parts.signature, parts.signingInput);
  if (!valid) throw new OidcTokenError('OIDC_TOKEN_SIGNATURE');

  const claims = parts.claims;
  const skew = (input.skewSeconds ?? 60) * 1000;
  const now = Date.now();
  if (claims.iss !== input.issuer) throw new OidcTokenError('OIDC_TOKEN_CLAIM');
  if (!audienceMatches(claims, input.audiences)) throw new OidcTokenError('OIDC_TOKEN_CLAIM');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now - skew) throw new OidcTokenError('OIDC_TOKEN_CLAIM');
  if (input.nonce !== undefined && claims.nonce !== input.nonce) throw new OidcTokenError('OIDC_TOKEN_CLAIM');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new OidcTokenError('OIDC_TOKEN_CLAIM');
  if (typeof claims.email !== 'string' || !claims.email.includes('@') || !emailVerified(claims)) {
    throw new OidcTokenError('OIDC_TOKEN_CLAIM');
  }
  return claims;
}

// --- Apple client secret (ES256 client_secret_jwt) --------------------------

interface AppleSecretInput {
  teamId: string;
  keyId: string;
  servicesId: string;
  /** Contents of the .p8 file (PEM, PKCS#8 EC P-256 private key). */
  privateKeyPem: string;
}

// The secret is a JWT valid up to 180 days; regenerate in memory well before
// that instead of caching forever, so a rotated .p8 takes effect within hours.
const APPLE_SECRET_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let appleSecret: { value: string; expiresAt: number } | null = null;
let appleSecretSource: string | null = null;

function pemToPkcs8(pem: string): Uint8Array {
  // .p8 files are standard base64 (PKCS#8 PEM), not base64url.
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!body) throw new OidcTokenError('OIDC_JWKS_UNAVAILABLE');
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

export async function appleClientSecret(input: AppleSecretInput): Promise<string> {
  const now = Date.now();
  const source = `${input.teamId}:${input.keyId}:${input.servicesId}:${input.privateKeyPem.length}`;
  if (appleSecret && appleSecret.expiresAt > now + APPLE_SECRET_TTL_MS / 4 && appleSecretSource === source) {
    return appleSecret.value;
  }
  let privateKey: CryptoKey;
  try {
    privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToPkcs8(input.privateKeyPem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  } catch {
    throw new OidcTokenError('OIDC_JWKS_UNAVAILABLE');
  }
  const iat = Math.floor(now / 1000);
  const exp = iat + 15552000; // 180 days, Apple's maximum client_secret lifetime
  const header = { alg: 'ES256', kid: input.keyId };
  const payload = { iss: input.teamId, iat, exp, aud: 'https://appleid.apple.com', sub: input.servicesId };
  const signingInput = `${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)))}.${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const value = `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
  appleSecret = { value, expiresAt: exp * 1000 };
  appleSecretSource = source;
  return value;
}
