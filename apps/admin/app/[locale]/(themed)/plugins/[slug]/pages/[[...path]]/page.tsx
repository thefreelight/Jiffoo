import { notFound } from 'next/navigation';
import { DeclaredPluginPage } from '@/components/plugins/DeclaredPluginPage';
import { pluginPageLabels, type PluginPageLocale } from 'shared/src/plugin-pages/labels';

export default async function PluginPage({ params }: { params: Promise<{ locale: string; slug: string; path?: string[] }> }) {
  const { locale, slug, path = [] } = await params;
  if (!Object.prototype.hasOwnProperty.call(pluginPageLabels, locale) || !/^[a-z][a-z0-9-]*$/.test(slug) || path.some(segment => !/^[a-z][a-z0-9-]*$/.test(segment))) notFound();
  return <DeclaredPluginPage slug={slug} path={`/${path.join('/')}`} locale={locale as PluginPageLocale} />;
}
