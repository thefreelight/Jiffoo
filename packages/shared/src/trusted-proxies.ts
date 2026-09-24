import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';
import proxyaddr from '@fastify/proxy-addr';

export function parseTrustedProxies(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((part) => {
    const entry = part.trim();
    const [address, prefix, extra] = entry.split('/');
    const family = isIP(address);
    if (!family || extra !== undefined || (prefix !== undefined &&
      (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)))) {
      throw new Error(`Invalid TRUSTED_PROXIES entry: ${entry || '(empty)'}`);
    }
    try {
      proxyaddr.compile(entry);
    } catch {
      throw new Error(`Invalid TRUSTED_PROXIES entry: ${entry}`);
    }
    return entry;
  });
}

export function clientIp(peer: string, forwarded: string | string[] | undefined, trusted: readonly string[]): string {
  const headers = { 'x-forwarded-for': Array.isArray(forwarded) ? forwarded.join(',') : forwarded };
  const selected = proxyaddr({ socket: { remoteAddress: peer }, headers } as unknown as IncomingMessage, proxyaddr.compile([...trusted]));
  return isIP(selected) ? selected : peer;
}
