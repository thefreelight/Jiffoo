import { redirect } from 'next/navigation';
import { getStoreContext } from '@/lib/catalog';
import { localizedAuthLink } from '@/lib/auth-link';

export default async function VerifyEmailRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getStoreContext();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
    else for (const item of value ?? []) query.append(key, item);
  }
  redirect(localizedAuthLink('verify-email', context.defaultLocale, query));
}
