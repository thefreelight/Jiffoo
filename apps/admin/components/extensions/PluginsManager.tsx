'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pluginsApi, unwrapApiResponse } from '@/lib/api';
import type { OfficialCatalogItem } from '@/lib/api';
import { useInstalledPlugins, useInstallOfficialExtension, useOfficialCatalog, usePlatformConnectionStatus, useProvisionManagedPackage, usePurgePlugin, useTogglePlugin } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Settings, Upload } from 'lucide-react';
import { useT, useLocale } from 'shared/src/i18n/react';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { useRouter } from 'next/navigation';
import { OfficialPluginsCatalog } from '@/components/extensions/OfficialPluginsCatalog';
import { useManagedMode } from '@/lib/managed-mode';

export function PluginsManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();
  const locale = useLocale();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [installType, setInstallType] = useState<'plugin' | 'bundle'>('plugin');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [purgingPlugin, setPurgingPlugin] = useState<any>(null);
  const [installingOfficialSlug, setInstallingOfficialSlug] = useState<string | null>(null);

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const { data: installedPlugins, isLoading } = useInstalledPlugins();
  const { data: officialCatalogData, isLoading: isOfficialCatalogLoading } = useOfficialCatalog();
  const { data: platformConnectionStatus } = usePlatformConnectionStatus();
  const installOfficialMutation = useInstallOfficialExtension();
  const provisionManagedPackageMutation = useProvisionManagedPackage();

  const installMutation = useMutation({
    mutationFn: (file: File) => (
      installType === 'bundle'
        ? pluginsApi.installBundleFromZip(file)
        : pluginsApi.installFromZip(file)
    ).then(unwrapApiResponse),
    onSuccess: () => {
      toast.success(
        installType === 'bundle'
          ? getText('merchant.plugins.bundleInstallSuccess', 'Bundle installed successfully')
          : getText('merchant.plugins.installSuccess', 'Plugin installed successfully')
      );
      setUploadOpen(false);
      setSelectedFile(null);
      setInstallType('plugin');
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['official-catalog'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.plugins.installFailed', 'Installation failed'));
    },
  });

  const toggleMutation = useTogglePlugin();
  const purgeMutation = usePurgePlugin();

  const handleUpload = () => {
    if (!selectedFile) return;
    installMutation.mutate(selectedFile);
  };

  const handleTogglePlugin = async (plugin: any, checked: boolean) => {
    if (checked && plugin?.configRequired && !plugin?.configReady) {
      const missingFields = Array.isArray(plugin?.missingConfigFields) ? plugin.missingConfigFields : [];
      const detail = missingFields.length > 0 ? `: ${missingFields.join(', ')}` : '';
      toast.error(`This plugin requires configuration before enabling${detail}`);
      await handleConfigOpen(plugin);
      return;
    }

    toggleMutation.mutate({ slug: plugin.slug, enabled: checked });
  };

  const handleConfigOpen = (plugin: { slug?: string }) => {
    if (!plugin?.slug) {
      toast.error(getText('merchant.plugins.loadConfigFailed', 'Failed to load configuration'));
      return;
    }

    router.push(`/${locale}/plugins/${plugin.slug}`);
  };

  const handleConfirmPurge = async () => {
    if (!purgingPlugin?.slug) return;
    try {
      await purgeMutation.mutateAsync(purgingPlugin.slug);
      setPurgingPlugin(null);
    } catch {
      // Toast is handled in usePurgePlugin hook.
    }
  };

  const pluginList = installedPlugins?.items || [];
  const officialPluginItems = (officialCatalogData?.items || []).filter((item) => item.kind === 'plugin');
  // The sidebar splits Plugins into 插件市场 (marketplace) and 已安装插件
  // (installed) entries that differ only by this query param — honor it so
  // each entry shows its own view instead of the same combined page.
  const searchParams = useSearchParams();
  const view: 'marketplace' | 'installed' = searchParams?.get('view') === 'installed' ? 'installed' : 'marketplace';
  const { record } = useManagedMode();
  const managedPluginSlugs = useMemo(
    () => new Set(record?.includedPlugins ?? []),
    [record]
  );
  const visiblePluginList = useMemo(
    () => (
      record
        ? pluginList.filter((plugin) => managedPluginSlugs.has(plugin.slug))
        : pluginList
    ),
    [managedPluginSlugs, pluginList, record]
  );

  const handleInstallOfficialPlugin = async (item: OfficialCatalogItem) => {
    setInstallingOfficialSlug(item.slug);
    try {
      if (item.solutionPackage?.offerKind === 'theme_first_solution' && record?.offerKind === 'theme_first_solution') {
        await provisionManagedPackageMutation.mutateAsync();
      } else {
        await installOfficialMutation.mutateAsync({
          slug: item.slug,
          kind: 'plugin',
          version: item.latestVersion || item.sellableVersion || item.version,
        });
      }
    } finally {
      setInstallingOfficialSlug(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
        <div className="relative rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Plugins</span><span>/</span><span className="text-slate-900">{view === 'installed' ? getText('merchant.plugins.installedCollection', 'Installed plugins') : getText('merchant.plugins.marketplace', 'Official plugin marketplace')}</span>
            </div>
            <h2 className="text-[28px] font-bold tracking-tight text-slate-950">
              {view === 'installed'
                ? getText('merchant.plugins.installedCollection', 'Installed plugins')
                : record
                  ? getText('merchant.plugins.licensedPluginCenter', 'Licensed plugins')
                  : getText('merchant.plugins.marketplace', 'Official plugin marketplace')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {view === 'installed'
                ? getText('merchant.plugins.installedCollectionDescription', 'Manage and update your installed plugins.')
                : record
                  ? getText(
                      'merchant.plugins.pluginCenterManagedIntro',
                      'This managed workspace only surfaces the plugins included in your commercial package.'
                    )
                  : getText(
                      'merchant.plugins.pluginCenterIntro',
                      'Installed plugins live in a dedicated control rail, while the official marketplace stays ready for the next capability you want to add.'
                    )}
            </p>
            </div>
            {view === 'marketplace' ? (
              <div className={platformConnectionStatus?.marketplaceReady
                ? 'inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700'
                : 'inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600'}>
                <span className={platformConnectionStatus?.marketplaceReady ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 rounded-full bg-slate-400'} />
                {platformConnectionStatus?.marketplaceReady
                  ? getText('merchant.extensions.marketplaceReadyChip', 'Marketplace ready')
                  : getText('merchant.extensions.platformUnboundShort', 'Not connected')}
              </div>
            ) : null}
          </div>

          {view === 'marketplace' && record?.offerKind === 'theme_first_solution' ? (
            <Button asChild variant="outline" className="rounded-lg">
              <Link href={`/${locale}/package`}>
                {getText('merchant.package.openPackageWorkspace', 'Open Your Package')}
              </Link>
            </Button>
          ) : null}

          {view === 'marketplace' && !(officialCatalogData?.officialMarketOnly || record) ? (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-lg shadow-lg shadow-blue-500/20">
                  <Upload className="mr-2 h-4 w-4" />
                  {getText('merchant.plugins.uploadTitle', 'Upload Plugin')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{getText('merchant.plugins.uploadTitle', 'Upload Plugin')}</DialogTitle>
                  <DialogDescription>
                    {getText('merchant.plugins.uploadDescription', 'Upload a .zip file containing the plugin structure.')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                    <Label htmlFor="plugin-file" className="text-left sm:text-right">
                      {getText('common.labels.file', 'File')}
                    </Label>
                    <Input
                      id="plugin-file"
                      type="file"
                      accept=".zip"
                      className="rounded-lg sm:col-span-3"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                    <Label className="text-left sm:text-right">
                      {getText('merchant.plugins.installType', 'Type')}
                    </Label>
                    <div className="sm:col-span-3">
                      <Select value={installType} onValueChange={(v) => setInstallType(v as 'plugin' | 'bundle')}>
                        <SelectTrigger className="rounded-lg">
                          <SelectValue placeholder={getText('merchant.plugins.installType', 'Type')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg">
                          <SelectItem value="plugin" className="rounded-lg">{getText('merchant.plugins.installTypePlugin', 'Plugin')}</SelectItem>
                          <SelectItem value="bundle" className="rounded-lg">{getText('merchant.plugins.installTypeBundle', 'Bundle')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadOpen(false)} className="rounded-lg">
                    {getText('common.actions.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={handleUpload} disabled={!selectedFile || installMutation.isPending} className="rounded-lg">
                    {installMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {getText('merchant.plugins.install', 'Install')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>

        {view === 'installed' ? (
          visiblePluginList.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visiblePluginList.map((plugin: any) => (
                <Link
                  key={plugin.slug}
                  href={`/${locale}/plugins/${plugin.slug}`}
                  className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-colors hover:border-blue-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Settings className="h-5 w-5" />
                    </div>
                    <Badge
                      variant="secondary"
                      className={plugin.enabled
                        ? 'rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700'
                        : 'rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500'}
                    >
                      {plugin.enabled
                        ? getText('merchant.plugins.statusEnabled', 'Enabled')
                        : getText('merchant.plugins.statusDisabled', 'Disabled')}
                    </Badge>
                  </div>
                  <h3 className="mt-3 truncate text-base font-bold text-slate-950">{plugin.name || plugin.slug}</h3>
                  <p className="mt-0.5 truncate text-sm text-slate-500">{plugin.slug}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <p className="text-sm text-slate-500">{getText('merchant.plugins.noPluginsInstalled', 'No plugins installed')}</p>
              <Button asChild variant="outline" className="mt-4 rounded-lg">
                <Link href={`/${locale}/plugins`}>
                  {getText('merchant.plugins.marketplace', 'Official plugin marketplace')}
                </Link>
              </Button>
            </div>
          )
        ) : null}

        {view === 'marketplace' ? (
          <>
        <div style={{ order: 2 }} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Settings className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-bold text-slate-950">{getText('merchant.plugins.installedCollection', 'Installed plugins')}</h3>
                <Badge variant="secondary" className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{isLoading ? '…' : visiblePluginList.length}</Badge>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-500">{getText('merchant.plugins.installedCollectionDescription', 'Manage and update your installed plugins.')}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0 rounded-lg">
            <Link href={`/${locale}/plugins?view=installed`}>
              {getText('merchant.plugins.viewInstalled', 'View installed plugins')}
              <Settings className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div style={{ order: 1 }}>
        <OfficialPluginsCatalog
          locale={locale}
          items={officialPluginItems}
          isLoading={isOfficialCatalogLoading}
          marketOnline={officialCatalogData?.marketOnline ?? false}
          marketError={officialCatalogData?.marketError}
          officialMarketOnly={Boolean(officialCatalogData?.officialMarketOnly)}
          marketplaceReady={Boolean(platformConnectionStatus?.marketplaceReady)}
          installingSlug={installingOfficialSlug || (installOfficialMutation.isPending ? installingOfficialSlug : null)}
          isProvisioningPackage={provisionManagedPackageMutation.isPending}
          managedPackage={record}
          onInstall={(item) => void handleInstallOfficialPlugin(item)}
          onEnable={(item) => void handleTogglePlugin(item, true)}
          onConfigure={(item) => void handleConfigOpen(item)}
          onManage={(item) => router.push(`/${locale}/plugins/${item.slug}`)}
          getText={getText}
        />
        </div>
          </>
        ) : null}
      <AlertDialog open={!!purgingPlugin} onOpenChange={(open) => !open && setPurgingPlugin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {getText('merchant.plugins.purgeTitle', 'Purge Plugin Permanently')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getText(
                'merchant.plugins.purgeDescription',
                'This permanently deletes plugin records and files. This action cannot be undone.'
              )}{" "}
              <span className="font-semibold">{purgingPlugin?.name || purgingPlugin?.slug}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgeMutation.isPending}>
              {getText('common.actions.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPurge}
              disabled={purgeMutation.isPending}
              className="bg-red-700 hover:bg-red-800"
            >
              {purgeMutation.isPending
                ? getText('common.actions.processing', 'Processing...')
                : getText('merchant.plugins.purge', 'Purge')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
