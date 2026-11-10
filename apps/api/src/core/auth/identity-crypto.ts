import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '@/config/env';

const purpose = 'jiffoo:identity-transaction:v1';
const key = () => createHash('sha256').update(purpose + ':' + env.JWT_SECRET).digest();
export const identitySecret = () => randomBytes(32).toString('base64url');
export const identityHash = (value: string, domain: 'state' | 'binding' | 'handoff') => createHmac('sha256', env.JWT_SECRET).update(purpose + ':' + domain + ':' + value).digest('hex');
export const identityChallenge = (value: string) => createHash('sha256').update(value).digest('base64url');
export function sealIdentityMaterial(material: { nonce: string; verifier: string; callbackMethod: 'GET' | 'POST'; providerToken: string; installationId: string }): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(JSON.stringify(material), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function openIdentityMaterial(value: string): { nonce: string; verifier: string; callbackMethod: 'GET' | 'POST'; providerToken: string; installationId: string } {
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < 29) throw new Error('IDENTITY_TRANSACTION_INVALID');
  const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(purpose));
  cipher.setAuthTag(bytes.subarray(12, 28));
  const result: unknown = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'));
  if (!result || typeof result !== 'object' || !('nonce' in result) || !('verifier' in result) || !('callbackMethod' in result) || !('providerToken' in result) || !('installationId' in result) || typeof result.nonce !== 'string' || typeof result.verifier !== 'string' || typeof result.providerToken !== 'string' || typeof result.installationId !== 'string' || result.callbackMethod !== 'GET' && result.callbackMethod !== 'POST') throw new Error('IDENTITY_TRANSACTION_INVALID');
  return { nonce: result.nonce, verifier: result.verifier, callbackMethod: result.callbackMethod, providerToken: result.providerToken, installationId: result.installationId };
}
