import 'server-only';
import { cookies } from 'next/headers';
import { shopApiHeaders } from './api-headers';
import { ACCESS_COOKIE } from './auth-contract';
import { classifyAvailability } from './availability';

export async function shopApi(path: string, token?: string, init: RequestInit = {}): Promise<Response> {
  const base = new URL(process.env.API_SERVICE_URL || 'http://127.0.0.1:3001');
  const url = new URL(`/api/v1${path}`, base);
  if (!path.startsWith('/') || path.startsWith('//') || url.origin !== base.origin || !url.pathname.startsWith('/api/v1/')) throw new Error('Invalid internal Core request path');
  const outgoing = await shopApiHeaders(new Headers(init.headers));
  outgoing.delete('Authorization');
  if (token) outgoing.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers: outgoing, cache: 'no-store', redirect: 'error' });
}

export async function serverCoreResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const response = await shopApi(path, token, init);
  const unavailable = await classifyAvailability(response);
  if (unavailable) throw unavailable;
  return response;
}
