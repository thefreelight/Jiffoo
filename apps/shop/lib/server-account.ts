import 'server-only';
import { cookies } from 'next/headers';
import { shopApiHeaders } from './api-headers';
import { ACCESS_COOKIE } from './auth-contract';

const apiBase = () => process.env.API_SERVICE_URL || 'http://127.0.0.1:3001';

export async function shopApi(path: string, token?: string, init: RequestInit = {}): Promise<Response> {
  const headers = await shopApiHeaders(new Headers(init.headers));
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(new URL(`/api/v1${path}`, apiBase()), { ...init, headers, cache: 'no-store' });
}

export async function accountProfile(): Promise<{ username: string; email: string; locale: string | null; emailVerified: boolean } | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const response = await shopApi('/account/profile', token);
  if (!response.ok) return null;
  const body = await response.json() as { data: { username: string; email: string; locale: string | null; emailVerified: boolean } };
  return body.data;
}
