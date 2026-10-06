import 'server-only';
import { cookies } from 'next/headers';
import { serverCoreResponse } from './core-transport';
import { withAvailability } from './availability-boundary';
import { ACCESS_COOKIE } from './auth-contract';
import { CoreHttpError, coreAuthRejection, coreNotFound } from './core-errors';

export async function accountProfile(): Promise<{ username: string; email: string; locale: string | null; emailVerified: boolean } | null> {
  return withAvailability(async () => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const response = await serverCoreResponse('/account/profile');
  if (await coreAuthRejection(response) || await coreNotFound(response)) return null;
  if (!response.ok) throw new CoreHttpError(response.status);
  const body = await response.json() as { data: { username: string; email: string; locale: string | null; emailVerified: boolean } };
  return body.data;
  });
}
