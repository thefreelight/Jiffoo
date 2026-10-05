import 'server-only';
import { cookies } from 'next/headers';
import { serverCoreResponse } from './core-transport';
import { withAvailability } from './availability-boundary';
import { ACCESS_COOKIE } from './auth-contract';

export async function accountProfile(): Promise<{ username: string; email: string; locale: string | null; emailVerified: boolean } | null> {
  return withAvailability(async () => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const response = await serverCoreResponse('/account/profile');
  if (!response.ok) return null;
  const body = await response.json() as { data: { username: string; email: string; locale: string | null; emailVerified: boolean } };
  return body.data;
  });
}
