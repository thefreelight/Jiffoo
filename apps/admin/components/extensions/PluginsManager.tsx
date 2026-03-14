'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pluginsApi, unwrapApiResponse } from '@/lib/api';
import type { OfficialCatalogItem } from '@/lib/api';
import { useInstalledPlugins, useInstallOfficialExtension, useOfficialCatalog, usePlatformConnectionStatus, usePurgePlugin, useTogglePlugin, useUpdatePluginConfig } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { AlertTriangle, Loader2, Settings, Upload } from 'lucide-react';
import { useT, useLocale } from 'shared/src/i18n/react';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { useRouter } from 'next/navigation';
import { OfficialPluginsCatalog } from '@/components/extensions/OfficialPluginsCatalog';
import { PlatformConnectionCard } from '@/components/extensions/PlatformConnectionCard';
import { ExtensionAvatar, OfficialBadge } from '@/components/extensions/ExtensionVisuals';
import { InstalledPluginsRail } from '@/components/extensions/InstalledPluginsRail';

type PluginConfigDescriptor = {
  type?: string;
  label?: string;
  description?: string;
  required?: boolean;
  enum?: string[];
};

type PluginConfigSchema = Record<string, PluginConfigDescriptor>;

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDescriptorType(descriptor: PluginConfigDescriptor | undefined): string {
  return typeof descriptor?.type === 'string' ? descriptor.type : 'string';
}

function getConfigFieldLabel(field: string, descriptor: PluginConfigDescriptor | undefined): string {
  return descriptor?.label || field;
}

export function PluginsManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();
  const locale = useLocale();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [installType, setInstallType] = useState<'plugin' | 'bundle'>('plugin');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPlugin, setEditingPlugin] = useState<any>(null);
  const [purgingPlugin, setPurgingPlugin] = useState<any>(null);
  const [configJson, setConfigJson] = useState('{}');
  const [configDraft, setConfigDraft] = useState<Record<string, any>>({});
  const [jsonFieldDrafts, setJsonFieldDrafts] = useState<Record<string, string>>({});
  const [jsonFieldErrors, setJsonFieldErrors] = useState<Record<string, string>>({});
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
  const updateConfigMutation = useUpdatePluginConfig();

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

  const handleConfigOpen = async (plugin: any) => {
    if (plugin?.adminUi) {
      router.push(`/${locale}/plugins/${plugin.slug}`);
      return;
    }

    try {
      const state = unwrapApiResponse(await pluginsApi.getConfig(plugin.slug));
      const nextConfig = isPlainObject(state.config) ? state.config : {};
      const nextSchema = isPlainObject(state.configSchema) ? state.configSchema : undefined;

      setEditingPlugin({
        ...plugin,
        configSchema: nextSchema,
      });
      setConfigDraft(nextConfig);
      setConfigJson(JSON.stringify(nextConfig, null, 2));
      setJsonFieldDrafts(
        Object.fromEntries(
          Object.entries(nextSchema || {})
            .filter(([, descriptor]) => {
              const type = getDescriptorType(descriptor as PluginConfigDescriptor);
              return type === 'object' || type === 'array';
            })
            .map(([key]) => [key, JSON.stringify(nextConfig[key] ?? (getDescriptorType(nextSchema?.[key]) === 'array' ? [] : {}), null, 2)])
        )
      );
      setJsonFieldErrors({});
      setConfigOpen(true);
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.plugins.loadConfigFailed', 'Failed to load configuration'));
    }
  };

  const handleSaveConfig = () => {
    if (!editingPlugin) return;

    if (Object.values(jsonFieldErrors).some(Boolean)) {
      toast.error(getText('common.validation.invalidFormat', 'Invalid format'));
      return;
    }

    if (editingPlugin.configSchema) {
      updateConfigMutation.mutate({
        slug: editingPlugin.slug,
        config: configDraft,
      });
      return;
    }

    try {
      const config = JSON.parse(configJson);
      updateConfigMutation.mutate({ slug: editingPlugin.slug, config });
    } catch {
      toast.error(getText('common.validation.invalidFormat', 'Invalid format'));
    }
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
  const officialPluginSlugs = useMemo(
    () => new Set(officialPluginItems.map((item) => item.slug)),
    [officialPluginItems]
  );
  const activeConfigSchema = isPlainObject(editingPlugin?.configSchema)
    ? (editingPlugin.configSchema as PluginConfigSchema)
    : undefined;

  const handleInstallOfficialPlugin = async (item: OfficialCatalogItem) => {
    setInstallingOfficialSlug(item.slug);
    try {
      await installOfficialMutation.mutateAsync({
        slug: item.slug,
        kind: 'plugin',
      });
    } finally {
      setInstallingOfficialSlug(null);
    }
  };

  const updateConfigField = (field: string, value: unknown) => {
    setConfigDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateJsonConfigField = (field: string, rawValue: string, expectedType: 'object' | 'array') => {
    setJsonFieldDrafts((current) => ({
      ...current,
      [field]: rawValue,
    }));

    const trimmed = rawValue.trim();
    if (!trimmed) {
      updateConfigField(field, expectedType === 'array' ? [] : {});
      setJsonFieldErrors((current) => ({
        ...current,
        [field]: '',
      }));
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      const valid = expectedType === 'array' ? Array.isArray(parsed) : isPlainObject(parsed);
      if (!valid) {
        throw new Error(`Value must be a JSON ${expectedType}`);
      }
      updateConfigField(field, parsed);
      setJsonFieldErrors((current) => ({
        ...current,
        [field]: '',
      }));
    } catch (error) {
      setJsonFieldErrors((current) => ({
        ...current,
        [field]: error instanceof Error ? error.message : 'Invalid JSON',
      }));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
      <InstalledPluginsRail
        locale={locale}
        plugins={pluginList}
        officialSlugs={officialPluginSlugs}
        getText={getText}
      />

      <div className="space-y-6">
        <PlatformConnectionCard getText={getText} />

        <div className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm lg:flex-row lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
              {getText('merchant.plugins.management', 'Plugins')}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {getText('merchant.plugins.pluginCenter', 'Plugin center')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {getText(
                'merchant.plugins.pluginCenterIntro',
                'Installed plugins live in a dedicated control rail, while the official marketplace stays ready for the next capability you want to add.'
              )}
            </p>
          </div>

          {officialCatalogData?.officialMarketOnly ? null : (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-blue-500/20">
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
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="plugin-file" className="text-right">
                      {getText('common.labels.file', 'File')}
                    </Label>
                    <Input
                      id="plugin-file"
                      type="file"
                      accept=".zip"
                      className="col-span-3 rounded-xl"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">
                      {getText('merchant.plugins.installType', 'Type')}
                    </Label>
                    <div className="col-span-3">
                      <Select value={installType} onValueChange={(v) => setInstallType(v as 'plugin' | 'bundle')}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={getText('merchant.plugins.installType', 'Type')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="plugin" className="rounded-lg">{getText('merchant.plugins.installTypePlugin', 'Plugin')}</SelectItem>
                          <SelectItem value="bundle" className="rounded-lg">{getText('merchant.plugins.installTypeBundle', 'Bundle')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadOpen(false)} className="rounded-xl">
                    {getText('common.actions.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={handleUpload} disabled={!selectedFile || installMutation.isPending} className="rounded-xl">
                    {installMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {getText('merchant.plugins.install', 'Install')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                {getText('merchant.plugins.installedCollection', 'Installed plugins')}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {getText('merchant.plugins.installedCollectionDescription', 'Open a plugin workspace, toggle availability, or finish configuration without leaving the plugin center.')}
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {pluginList.length}
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex h-24 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {getText('merchant.plugins.loading', 'Loading plugins...')}
            </div>
          ) : !pluginList || pluginList.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-muted-foreground">
              {getText('merchant.plugins.noPluginsInstalled', 'No plugins installed.')}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {pluginList.map((plugin, index) => {
                if (!plugin) return null;
                const safeKey = plugin.slug || `plugin-${index}`;
                const isOfficial = officialPluginSlugs.has(plugin.slug) || plugin.source === 'official-market';

                return (
                  <div key={safeKey} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 p-5">
                    <div className="flex items-start gap-4">
                      <ExtensionAvatar
                        slug={plugin.slug}
                        name={plugin.name}
                        kind="plugin"
                        className="h-14 w-14 shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-slate-950">{plugin.name}</h4>
                          {isOfficial ? <OfficialBadge compact /> : null}
                          <Badge variant="outline" className="rounded-full capitalize">
                            {plugin.source}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          v{plugin.version} {getText('common.labels.by', 'by')} {plugin.author}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {plugin.description || getText('merchant.plugins.defaultDescription', 'A merchant-facing plugin that extends your store operations.')}
                        </p>

                        {plugin.configRequired && !plugin.configReady ? (
                          <p className="mt-3 text-xs font-semibold text-amber-700">
                            {getText('merchant.plugins.needsConfiguration', 'Needs configuration before enabling')}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2">
                            <Switch
                              checked={plugin.enabled}
                              onCheckedChange={(checked) => void handleTogglePlugin(plugin, checked)}
                              disabled={toggleMutation.isPending}
                            />
                            <span className="text-sm font-medium text-slate-700">
                              {plugin.enabled
                                ? getText('merchant.plugins.enabled', 'Enabled')
                                : getText('merchant.plugins.disabled', 'Disabled')}
                            </span>
                          </div>

                          {plugin.adminUi ? (
                            <Button asChild className="rounded-xl">
                              <Link href={`/${locale}/plugins/${plugin.slug}`}>
                                <Settings className="mr-2 h-4 w-4" />
                                {getText('common.actions.manage', 'Manage')}
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => handleConfigOpen(plugin)}
                              className="rounded-xl"
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              {getText('common.actions.configure', 'Configure')}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            onClick={() => setPurgingPlugin(plugin)}
                            disabled={purgeMutation.isPending}
                            className="rounded-xl text-slate-500 hover:text-red-700"
                          >
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            {getText('merchant.plugins.remove', 'Remove')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <OfficialPluginsCatalog
          items={officialPluginItems}
          isLoading={isOfficialCatalogLoading}
          marketOnline={officialCatalogData?.marketOnline ?? false}
          marketError={officialCatalogData?.marketError}
          officialMarketOnly={Boolean(officialCatalogData?.officialMarketOnly)}
          marketplaceReady={Boolean(platformConnectionStatus?.marketplaceReady)}
          installingSlug={installingOfficialSlug || (installOfficialMutation.isPending ? installingOfficialSlug : null)}
          onInstall={(item) => void handleInstallOfficialPlugin(item)}
          onEnable={(item) => void handleTogglePlugin(item, true)}
          onConfigure={(item) => void handleConfigOpen(item)}
          onManage={(item) => router.push(`/${locale}/plugins/${item.slug}`)}
          getText={getText}
        />
      </div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {getText('common.actions.configure', 'Configure')} {editingPlugin?.name}
            </DialogTitle>
            <DialogDescription>
              {getText('merchant.plugins.configureDescription', 'Edit configuration JSON for this plugin.')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {activeConfigSchema ? (
              <div className="space-y-5">
                {Object.entries(activeConfigSchema).map(([field, descriptor]) => {
                  const type = getDescriptorType(descriptor);
                  const label = getConfigFieldLabel(field, descriptor);
                  const description = descriptor?.description;
                  const required = Boolean(descriptor?.required);
                  const value = configDraft[field];

                  if (Array.isArray(descriptor?.enum) && descriptor.enum.length > 0) {
                    const normalizedValue = typeof value === 'string' && descriptor.enum.includes(value)
                      ? value
                      : undefined;
                    return (
                      <div key={field} className="space-y-2">
                        <Label>
                          {label}
                          {required ? ' *' : ''}
                        </Label>
                        <Select
                          value={normalizedValue}
                          onValueChange={(nextValue) => updateConfigField(field, nextValue)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={label} />
                          </SelectTrigger>
                          <SelectContent>
                            {descriptor.enum.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                      </div>
                    );
                  }

                  if (type === 'boolean') {
                    return (
                      <div key={field} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1 pr-4">
                          <Label>
                            {label}
                            {required ? ' *' : ''}
                          </Label>
                          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                        </div>
                        <Switch
                          checked={Boolean(value)}
                          onCheckedChange={(checked) => updateConfigField(field, checked)}
                        />
                      </div>
                    );
                  }

                  if (type === 'object' || type === 'array') {
                    const error = jsonFieldErrors[field];
                    return (
                      <div key={field} className="space-y-2">
                        <Label>
                          {label}
                          {required ? ' *' : ''}
                        </Label>
                        <Textarea
                          value={jsonFieldDrafts[field] ?? JSON.stringify(value ?? (type === 'array' ? [] : {}), null, 2)}
                          onChange={(e) => updateJsonConfigField(field, e.target.value, type)}
                          className="font-mono min-h-[160px]"
                        />
                        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                        {error ? <p className="text-xs text-red-600">{error}</p> : null}
                      </div>
                    );
                  }

                  if (type === 'number' || type === 'integer') {
                    return (
                      <div key={field} className="space-y-2">
                        <Label>
                          {label}
                          {required ? ' *' : ''}
                        </Label>
                        <Input
                          type="number"
                          value={value ?? ''}
                          onChange={(e) => updateConfigField(field, e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                      </div>
                    );
                  }

                  const inputType = type === 'secret' ? 'password' : 'text';
                  return (
                    <div key={field} className="space-y-2">
                      <Label>
                        {label}
                        {required ? ' *' : ''}
                      </Label>
                      <Input
                        type={inputType}
                        value={value == null ? '' : String(value)}
                        onChange={(e) => updateConfigField(field, e.target.value)}
                      />
                      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                className="font-mono min-h-[300px]"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              {getText('common.actions.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSaveConfig} disabled={updateConfigMutation.isPending}>
              {getText('common.actions.saveChanges', 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
