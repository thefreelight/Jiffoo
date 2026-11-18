import { getNativeJwtSecret, type NativeAuthEnv } from './auth';

/**
 * Identity login crypto for the native line (WebCrypto port of the
 * self-hosted line's identity material handling).
 *
 * Every derived value is domain-separated from the instance's JWT secret:
 * HMAC keys hash OAuth state, browser bindings and handoff codes (only their
 * digests are stored, never the values), and a dedicated AES-256-GCM key
 * seals the per-transaction OAuth material (nonce, PKCE verifier) at rest.
 */

const encoder = new TextEncoder();

async function hmacKey(secret: string, domain: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`${domain}:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function identityHash(env: NativeAuthEnv, value: string, domain: 'state' | 'binding' | 'handoff'): Promise<string> {
  const secret = await getNativeJwtSecret(env);
  const key = await hmacKey(secret, `identity:${domain}`);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`identity:seal:${secret}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Base64url of the plaintext JSON: {nonce, verifier}. The ciphertext is
// self-describing (iv prefixed) and only meaningful with the instance secret.
export async function sealIdentityMaterial(env: NativeAuthEnv, material: { nonce: string; verifier: string }): Promise<string> {
  const key = await aesKey(await getNativeJwtSecret(env));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(material))),
  );
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);
  return btoa(String.fromCharCode(...packed)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function openIdentityMaterial(env: NativeAuthEnv, sealed: string): Promise<{ nonce: string; verifier: string }> {
  const key = await aesKey(await getNativeJwtSecret(env));
  const packed = Uint8Array.from(atob(sealed.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
  const iv = packed.slice(0, 12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    packed.slice(12) as unknown as BufferSource,
  );
  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as { nonce?: unknown; verifier?: unknown };
  if (typeof parsed.nonce !== 'string' || typeof parsed.verifier !== 'string') throw new Error('identity material shape');
  return { nonce: parsed.nonce, verifier: parsed.verifier };
}

// URL-safe random secret for state / nonce / PKCE verifier / handoff codes.
export function identitySecret(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// S256 PKCE challenge of a verifier.
export async function identityChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export { sha256Hex };
