import 'server-only';
import { headers } from 'next/headers';

export async function requestClientIp(): Promise<string> {
  const value = (await headers()).get('x-forwarded-for');
  if (!value || value.includes(',')) throw new Error('Shop request missing sanitized client IP');
  return value;
}
