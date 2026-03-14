'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { getAdminClient } from '@/lib/api';
import { useInstalledPlugins, useOfficialCatalog, usePluginConfig, usePluginInstances } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InstalledPluginsRail } from '@/components/extensions/InstalledPluginsRail';
import { OfficialBadge } from '@/components/extensions/ExtensionVisuals';

export default function PluginAdminHostPage() {
  const params = useParams<{ slug: string }>();
  const locale = useLocale();
  const t = useT();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const { data, isLoading, error } = usePluginConfig(slug);
  const { data: instancesData, isLoading: isInstancesLoading } = usePluginInstances(slug);
  const { data: installedPluginsData } = useInstalledPlugins();
  const { data: officialCatalogData } = useOfficialCatalog();
  const [selectedInstallationId, setSelectedInstallationId] = useState('default');
  const [accessToken, setAccessToken] = useState('');

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const instances = instancesData?.items || [];
  const installedPlugins = installedPluginsData?.items || [];
  const officialPluginSlugs = new Set((officialCatalogData?.items || []).filter((item) => item.kind === 'plugin').map((item) => item.slug));

  useEffect(() => {
    if (instances.length === 0) {
      setSelectedInstallationId('default');
      return;
    }

    const defaultInstance = instances.find((instance) => instance.instanceKey === 'default') || instances[0];
    setSelectedInstallationId((current) => {
      const exists = instances.some((instance) => instance.installationId === current);
      return exists ? current : defaultInstance.installationId;
    });
  }, [instances]);

  useEffect(() => {
    const token = getAdminClient().getToken() || '';
    setAccessToken(token);
  }, []);

  const iframeUrl = useMemo(() => {
    if (!slug || !accessToken) return '';
    const params = new URLSearchParams({
      installationId: selectedInstallationId,
      token: accessToken,
    });
    return `/${locale}/plugin-admin-ui/${slug}?${params.toString()}`;
  }, [accessToken, locale, selectedInstallationId, slug]);

  const selectedInstance = instances.find((instance) => instance.installationId === selectedInstallationId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading plugin app...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Plugin unavailable</h1>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            The plugin details could not be loaded.
          </p>
          <div className="mt-6">
            <Link href={`/${locale}/plugins`}>
              <Button variant="outline">Back to plugins</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data.adminUi) {
    return (
      <div className="min-h-screen p-6 md:p-8 bg-[#fcfdfe]">
        <div className="max-w-3xl rounded-[2rem] border bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-xl font-semibold">{data.name || slug}</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            This plugin does not provide a dedicated workspace yet. You can still manage configuration from the plugin center.
          </p>
          <div className="mt-6">
            <Link href={`/${locale}/plugins`}>
              <Button variant="outline">Back to plugins</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Authentication unavailable</h1>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            The admin access token is not available yet. Please refresh the page and sign in again if needed.
          </p>
          <div className="mt-6">
            <Link href={`/${locale}/plugins`}>
              <Button variant="outline">Back to plugins</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfe] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
        <InstalledPluginsRail
          locale={locale}
          plugins={installedPlugins}
          selectedSlug={slug}
          officialSlugs={officialPluginSlugs}
          getText={getText}
        />

        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                    {getText('merchant.plugins.pluginWorkspace', 'Plugin workspace')}
                  </p>
                  {officialPluginSlugs.has(slug) ? <OfficialBadge compact /> : null}
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {data.adminUi?.label || data.name || slug}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {getText('merchant.plugins.workspaceDescription', 'Manage plugin-specific configuration, instance targeting, and embedded admin surfaces from a dedicated workspace.')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 xl:justify-end">
                <div className="min-w-[240px]">
                  <Select
                    value={selectedInstallationId}
                    onValueChange={setSelectedInstallationId}
                    disabled={isInstancesLoading || instances.length === 0}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white">
                      <SelectValue placeholder={isInstancesLoading ? 'Loading instances...' : 'Select instance'} />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.length === 0 ? (
                        <SelectItem value="default">default</SelectItem>
                      ) : (
                        instances.map((instance) => (
                          <SelectItem key={instance.installationId} value={instance.installationId}>
                            {instance.instanceKey}
                            {instance.enabled ? '' : ' (disabled)'}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={`/${locale}/plugins`}>
                    {getText('merchant.plugins.backToMarketplace', 'Back to plugins')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span>
                <strong className="text-slate-900">Plugin:</strong> {data.name || slug}
              </span>
              <span>
                <strong className="text-slate-900">Instance:</strong> {selectedInstance?.instanceKey || 'default'}
              </span>
              <span>
                <strong className="text-slate-900">Installation ID:</strong> {selectedInstance?.installationId || 'default'}
              </span>
              <span>
                <strong className="text-slate-900">Status:</strong> {selectedInstance ? (selectedInstance.enabled ? 'Enabled' : 'Disabled') : 'Default'}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border bg-white shadow-sm">
            <iframe
              title={`${slug}-admin-ui`}
              src={iframeUrl}
              className="min-h-[calc(100vh-14rem)] w-full bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
