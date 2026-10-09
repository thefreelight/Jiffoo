import { randomUUID, createHash } from 'node:crypto';
import { hostname } from 'node:os';

export const PROCESS_REGISTRATION_LOCK_CLASS = 1_246_316_110;
export const PROCESS_REGISTRATION_LOCK_KEY = 1;
export const coreProcessIdentity = Object.freeze({ bootNonce: randomUUID(), instanceId: randomUUID(), hostname: hostname(), pid: process.pid });
export function processApplicationPrefix(bootNonce: string = coreProcessIdentity.bootNonce): string {
  return `jf:${Buffer.from(bootNonce.replaceAll('-', ''), 'hex').toString('base64url')}:`;
}
export function processDatabaseUrl(databaseUrl: string, kind: 'core' | 'runtime' | 'migration', operationId?: string, pg = false): string {
  const url = new URL(databaseUrl);
  if (pg) for (const parameter of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(parameter);
  const applicationName = processApplicationName(kind, coreProcessIdentity.bootNonce, operationId);
  if (Buffer.byteLength(applicationName) > 63) throw new Error('Core application name exceeds PostgreSQL limit');
  url.searchParams.set('application_name', applicationName);
  return url.toString();
}
export function processApplicationName(kind: 'core' | 'runtime' | 'migration', bootNonce: string, operationId?: string): string {
  return `${processApplicationPrefix(bootNonce)}${kind === 'migration' ? `m:${createHash('sha256').update(operationId!).digest('base64url').slice(0, 22)}` : kind}`;
}
