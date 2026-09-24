import { getStoreContext } from '@/lib/catalog';
import { NotFoundContent } from '@/components/not-found-content';

export default async function NotFoundPage() {
  const context = await getStoreContext();
  return <NotFoundContent defaultLocale={context.defaultLocale} supportedLocales={context.supportedLocales} />;
}
