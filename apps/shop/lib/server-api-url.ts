import { headers } from 'next/headers';

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function toApiPath(path: string): string {
  if (path.startsWith('/api/')) {
    return path;
  }

  return path.startsWith('/') ? `/api${path}` : `/api/${path}`;
}

async function readRequestOrigin(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const forwardedHost = requestHeaders.get('x-forwarded-host');
    const host = forwardedHost || requestHeaders.get('host');

    if (host) {
      const forwardedProto = requestHeaders.get('x-forwarded-proto');
      const proto = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
      return `${proto}://${host}`;
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolvePublicOrigin(): Promise<string> {
  const requestOrigin = await readRequestOrigin();
  if (requestOrigin) {
    return requestOrigin;
  }

  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL;
  if (shopUrl) {
    return stripTrailingSlash(shopUrl);
  }

  return process.env.NODE_ENV === 'production' ? 'https://localhost' : 'http://localhost:3003';
}

export async function resolveServerApiOrigin(): Promise<string> {
  const apiServiceUrl = process.env.API_SERVICE_URL;
  if (apiServiceUrl) {
    return stripTrailingSlash(apiServiceUrl);
  }

  const requestOrigin = await readRequestOrigin();
  if (requestOrigin) {
    return requestOrigin;
  }

  throw new Error('Unable to resolve server API origin');
}

export async function buildServerApiUrl(path: string): Promise<string> {
  const origin = await resolveServerApiOrigin();
  return new URL(toApiPath(path), origin).toString();
}
