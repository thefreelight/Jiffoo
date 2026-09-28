import { redirect } from 'next/navigation';
import { getStoreContext } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const context = await getStoreContext();
  redirect(`/${context.defaultLocale}`);
}
