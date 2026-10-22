import { notFound, redirect } from 'next/navigation';
import { storefrontPluginPages } from '@/lib/plugin-pages';
import { shopBootstrap } from '@/lib/server-bootstrap';
import { isShopLocale } from '@/lib/locale';
import { ShopPluginPage } from '@/components/plugin-page';
import { pluginShopPath } from 'shared/src/plugin-pages/labels';

export default async function PluginPage({ params }: { params: Promise<{ locale: string; slug: string; path?: string[] }> }) {
  const { locale, slug, path = [] } = await params;
  if (!isShopLocale(locale) || !/^[a-z][a-z0-9-]*$/.test(slug)) notFound();
  const declarations = await storefrontPluginPages();
  const page = declarations.find(plugin => plugin.slug === slug)?.pages.find(candidate => candidate.path === `/${path.join('/')}`);
  if (!page) notFound();
  const { context, profile } = await shopBootstrap();
  if (page.requiresLogin && !profile) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}${pluginShopPath(slug, page.path)}`)}`);
  return <ShopPluginPage slug={slug} page={page} declarations={declarations} locale={locale} currency={context.currency} storeName={context.storeName} />;
}
