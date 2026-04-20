'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { themesApi, unwrapApiResponse } from '@/lib/api';
import type { OfficialCatalogItem } from '@/lib/api';
import { useActiveTheme, useActivateTheme, useInstallOfficialExtension, useOfficialCatalog, usePlatformConnectionStatus, useProvisionManagedPackage, useRollbackTheme, useThemes } from '@/lib/hooks/use-api';
import type { ActiveTheme, ThemeMeta } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import { Check, Loader2, RotateCcw, Upload } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { OfficialThemesCatalog } from '@/components/extensions/OfficialThemesCatalog';
import { PlatformConnectionCard } from '@/components/extensions/PlatformConnectionCard';
import { useManagedMode } from '@/lib/managed-mode';

export function ThemesManager() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useT();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [target, setTarget] = useState<'shop' | 'admin'>('shop');
  const [themeType, setThemeType] = useState<'pack' | 'app'>('pack');
  const [configText, setConfigText] = useState('{}');
  const [installingOfficialSlug, setInstallingOfficialSlug] = useState<string | null>(null);

  const { data: themeTargets } = useQuery({
    queryKey: ['themes', 'targets'],
    queryFn: async () => {
      const response = await themesApi.getTargets();
      return unwrapApiResponse(response);
    },
    staleTime: 5 * 60 * 1000,
  });

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const { data: installedThemes, isLoading: isLoadingThemes } = useThemes(target);
  const { data: activeTheme, isLoading: isLoadingActive } = useActiveTheme(target);
  const { data: officialCatalogData, isLoading: isOfficialCatalogLoading } = useOfficialCatalog();
  const { data: platformConnectionStatus } = usePlatformConnectionStatus();
  const installOfficialMutation = useInstallOfficialExtension();
  const provisionManagedPackageMutation = useProvisionManagedPackage();

  const availableTargets = useMemo(
    () => (themeTargets?.targets || ['shop', 'admin']) as Array<'shop' | 'admin'>,
    [themeTargets?.targets]
  );

  useEffect(() => {
    if (!availableTargets.includes(target) && availableTargets.length > 0) {
      setTarget(availableTargets[0]);
    }
  }, [availableTargets, target]);

  const installMutation = useMutation({
    mutationFn: (file: File) => (
      themeType === 'app'
        ? themesApi.installThemeAppFromZip(target, file)
        : themesApi.installFromZip(target, file)
    ).then(unwrapApiResponse),
    onSuccess: () => {
      toast.success(getText('merchant.themes.installSuccess', 'Theme installed successfully'));
      setUploadOpen(false);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['official-catalog'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.themes.installFailed', 'Installation failed'));
    },
  });

  const activateMutation = useActivateTheme();
  const rollbackMutation = useRollbackTheme();
  const uninstallMutation = useMutation({
    mutationFn: (theme: ThemeMeta) => themesApi.uninstall(target, theme.slug, theme.type ?? 'pack').then(unwrapApiResponse),
    onSuccess: () => {
      toast.success(getText('merchant.themes.uninstallSuccess', 'Theme uninstalled successfully'));
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['official-catalog'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.themes.uninstallFailed', 'Uninstall failed'));
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const response = await themesApi.updateConfig(config, target);
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      toast.success(getText('merchant.themes.updateConfigSuccess', 'Theme configuration updated successfully'));
      setConfigOpen(false);
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.themes.updateConfigFailed', 'Failed to update theme configuration'));
    },
  });

  const handleUpload = () => {
    if (!selectedFile) return;
    installMutation.mutate(selectedFile);
  };

  const themeList = installedThemes?.items || [];
  const currentActiveTheme = activeTheme;
  const officialThemeItems = (officialCatalogData?.items || []).filter(
    (item) => item.kind === 'theme' && (item.target || 'shop') === 'shop'
  );
  const activeOfficialTheme = useMemo(
    () => officialThemeItems.find((item) => item.slug === currentActiveTheme?.slug),
    [currentActiveTheme?.slug, officialThemeItems],
  );
  const { record } = useManagedMode();
  const managedThemeSlugs = useMemo(
    () => new Set(record?.includedThemes ?? []),
    [record]
  );
  const visibleThemeList = useMemo(
    () => (
      record && target === 'shop'
        ? themeList.filter((theme) => managedThemeSlugs.has(theme.slug))
        : themeList
    ),
    [managedThemeSlugs, record, target, themeList]
  );

  useEffect(() => {
    const sourceConfig = (currentActiveTheme?.config && typeof currentActiveTheme.config === 'object')
      ? currentActiveTheme.config
      : {};
    try {
      setConfigText(JSON.stringify(sourceConfig, null, 2));
    } catch {
      setConfigText('{}');
    }
  }, [currentActiveTheme, target]);

  const handleUpdateConfig = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configText) as Record<string, unknown>;
    } catch {
      toast.error(getText('merchant.themes.invalidConfigJson', 'Invalid JSON format in theme config'));
      return;
    }
    updateConfigMutation.mutate(parsed);
  };

  const handleInstallOfficialTheme = async (item: OfficialCatalogItem) => {
    setInstallingOfficialSlug(item.slug);
    try {
      if (item.solutionPackage?.offerKind === 'theme_first_solution' && record?.offerKind === 'theme_first_solution') {
        await provisionManagedPackageMutation.mutateAsync();
      } else {
        await installOfficialMutation.mutateAsync({
          slug: item.slug,
          kind: 'theme-shop',
          version: item.latestVersion || item.sellableVersion || item.version,
          activate: item.installState === 'active',
        });
      }
    } catch {
      // Mutations handle their own user feedback. Prevent bubbling unhandled promise rejections from button clicks.
    } finally {
      setInstallingOfficialSlug(null);
    }
  };

  return (
    <div className="space-y-6">
      {record ? null : <PlatformConnectionCard getText={getText} />}

      <div className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
            {getText('merchant.themes.management', 'Themes')}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {record
              ? getText('merchant.themes.licensedThemeCenter', 'Licensed themes')
              : currentActiveTheme?.slug
                ? getText('merchant.themes.currentThemeHeading', 'Current storefront theme')
                : getText('merchant.themes.themeLibraryHeading', 'Theme library')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {record
              ? getText(
                  'merchant.themes.licensedThemeCenterDescription',
                  'This managed workspace only surfaces the storefront themes included in your commercial package.'
                )
              : currentActiveTheme?.slug
                ? `${getText('merchant.themes.currentTheme', 'Current Theme')}: ${currentActiveTheme.slug}${
                    activeOfficialTheme?.latestVersion
                      ? ` · ${getText('merchant.themes.installedVersion', 'Installed')} v${activeOfficialTheme.installedVersion || currentActiveTheme.version} · ${getText('merchant.themes.latestVersion', 'Latest')} v${activeOfficialTheme.latestVersion}`
                      : ''
                  }`
                : getText('merchant.themes.subtitle', 'Customize your store appearance with beautiful themes')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {record?.offerKind === 'theme_first_solution' ? (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/${locale}/package`}>
                {getText('merchant.package.openPackageWorkspace', 'Open Your Package')}
              </Link>
            </Button>
          ) : null}
          <Tabs value={target} onValueChange={(v) => setTarget(v as any)}>
            <TabsList className="bg-slate-100/70 p-1 rounded-xl">
              {availableTargets.includes('shop') && (
                <TabsTrigger value="shop" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs font-bold uppercase tracking-wider px-5 py-2">{getText('merchant.themes.targetShop', 'Shop')}</TabsTrigger>
              )}
              {availableTargets.includes('admin') && (
                <TabsTrigger value="admin" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs font-bold uppercase tracking-wider px-5 py-2">{getText('merchant.themes.targetAdmin', 'Admin')}</TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!currentActiveTheme || updateConfigMutation.isPending} className="rounded-xl">
                {getText('merchant.themes.editConfig', 'Edit Config')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{getText('merchant.themes.editConfigTitle', 'Edit Theme Config')}</DialogTitle>
                <DialogDescription>
                  {getText('merchant.themes.editConfigDescription', 'Update active theme runtime configuration as JSON.')}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                <Label htmlFor="theme-config-json">{getText('merchant.themes.configJson', 'Config JSON')}</Label>
                <Textarea
                  id="theme-config-json"
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  className="min-h-56 font-mono text-xs rounded-xl"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigOpen(false)} className="rounded-xl">
                  {getText('common.actions.cancel', 'Cancel')}
                </Button>
                <Button onClick={handleUpdateConfig} disabled={updateConfigMutation.isPending} className="rounded-xl">
                  {updateConfigMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {getText('common.actions.saveChanges', 'Save Changes')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {currentActiveTheme?.previousSlug && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={rollbackMutation.isPending} className="rounded-xl">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {getText('merchant.themes.rollback', 'Rollback')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{getText('merchant.themes.rollbackTitle', 'Rollback to previous theme?')}</DialogTitle>
                  <DialogDescription>
                    {getText('merchant.themes.rollbackDescription', 'This will revert your active theme to the previously used one.')}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={(e: any) => {
                      const closeBtn = e.currentTarget
                        .closest('[role="dialog"]')
                        ?.querySelector('[data-radix-collection-item]');
                      if (closeBtn instanceof HTMLElement) closeBtn.click();
                    }}
                  >
                    {getText('common.actions.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={() => rollbackMutation.mutate(target)} className="rounded-xl">
                    {rollbackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : getText('common.actions.confirm', 'Confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {officialCatalogData?.officialMarketOnly || record ? null : (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-blue-500/20">
                  <Upload className="mr-2 h-4 w-4" />
                  {getText('merchant.themes.uploadTitle', 'Upload Theme')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{getText('merchant.themes.uploadTitle', 'Upload Theme')}</DialogTitle>
                  <DialogDescription>
                    {getText('merchant.themes.uploadDescription', 'Upload a .zip file containing the theme structure.')} {' '}
                    {getText('merchant.themes.uploadTarget', 'Target')}: <b>{target.toUpperCase()}</b>
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                    <Label className="text-left sm:text-right">{getText('merchant.themes.type', 'Type')}</Label>
                    <div className="sm:col-span-3">
                      <Select value={themeType} onValueChange={(v) => setThemeType(v as 'pack' | 'app')}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={getText('merchant.themes.type', 'Type')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="pack" className="rounded-lg">{getText('merchant.themes.typePack', 'Theme Pack (L3.5)')}</SelectItem>
                          <SelectItem value="app" className="rounded-lg">{getText('merchant.themes.typeApp', 'Theme App (L4)')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {themeType === 'app'
                          ? getText('merchant.themes.typeAppHint', 'Executable storefront (Next.js standalone build).')
                          : getText('merchant.themes.typePackHint', 'Static resources only (tokens/templates/assets).')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                    <Label htmlFor="theme-file" className="text-left sm:text-right">
                      {getText('common.labels.file', 'File')}
                    </Label>
                    <Input
                      id="theme-file"
                      type="file"
                      accept=".zip"
                      className="rounded-xl sm:col-span-3"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        if (file && /theme-app|themeapp/i.test(file.name)) {
                          setThemeType('app');
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadOpen(false)} className="rounded-xl">
                    {getText('common.actions.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={handleUpload} disabled={!selectedFile || installMutation.isPending} className="rounded-xl">
                    {installMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {getText('merchant.themes.install', 'Install')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <OfficialThemesCatalog
        locale={locale}
        target={target}
        items={officialThemeItems}
        isLoading={isOfficialCatalogLoading}
        marketOnline={officialCatalogData?.marketOnline ?? false}
        marketError={officialCatalogData?.marketError}
        officialMarketOnly={Boolean(officialCatalogData?.officialMarketOnly)}
        marketplaceReady={Boolean(platformConnectionStatus?.marketplaceReady)}
        installingSlug={installingOfficialSlug}
        isProvisioningPackage={provisionManagedPackageMutation.isPending}
        managedPackage={record}
        isActivating={activateMutation.isPending}
        onInstall={(item) => void handleInstallOfficialTheme(item)}
        onActivate={(item) => activateMutation.mutate({ slug: item.slug, target: 'shop', type: 'pack' })}
        getText={getText}
      />

      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">
            {record
              ? getText('merchant.themes.installedLicensedThemes', 'Installed licensed themes')
              : getText('merchant.themes.installedThemes', 'Installed themes')}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {record
              ? getText(
                  'merchant.themes.installedLicensedThemesDescription',
                  'Activate, configure, or remove the themes already included in this managed package.'
                )
              : getText('merchant.themes.installedThemesDescription', 'Switch the active storefront look, remove unused themes, and keep built-in themes available as fallbacks.')}
          </p>
        </div>

        {isLoadingThemes || isLoadingActive ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ThemeList
            themes={visibleThemeList}
            activeTheme={currentActiveTheme || null}
            locale={locale}
            managedPackage={record}
            getText={getText}
            onActivate={(theme) => activateMutation.mutate({ slug: theme.slug, target, type: theme.type })}
            isActivating={activateMutation.isPending}
            target={target}
            onUninstall={(theme) => uninstallMutation.mutate(theme)}
            isUninstalling={uninstallMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function getPreviewUrl(theme: ThemeMeta, target: 'shop' | 'admin') {
  const img = theme.previewImage;
  if (!img) return null;
  if (img.startsWith('http') || img.startsWith('/')) return img;
  return `/extensions/themes/${target}/${theme.slug}/${img}`;
}

function ThemeList({
  themes,
  activeTheme,
  locale,
  managedPackage,
  getText,
  onActivate,
  isActivating,
  target,
  onUninstall,
  isUninstalling,
}: {
  themes: ThemeMeta[];
  activeTheme: ActiveTheme | null;
  locale: string;
  managedPackage: ReturnType<typeof useManagedMode>['record'];
  getText: (key: string, fallback: string) => string;
  onActivate: (theme: ThemeMeta) => void;
  isActivating: boolean;
  target: 'shop' | 'admin';
  onUninstall: (theme: ThemeMeta) => void;
  isUninstalling: boolean;
}) {
  if (!themes.length) {
    return (
      <Card className="rounded-[2rem] border-dashed border-2 bg-gray-50/50">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <p className="font-medium">{getText('merchant.themes.noThemesInstalled', 'No themes installed.')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {themes.map((theme) => {
        const isActive = activeTheme?.slug === theme.slug && (activeTheme?.type ?? 'pack') === (theme.type ?? 'pack');
        const previewUrl = getPreviewUrl(theme, target);
        const isBuiltin = theme.source === 'builtin';
        const canUninstall = !isBuiltin && !isActive;
        const isThemeFirstSolution = managedPackage?.offerKind === 'theme_first_solution';
        const isDefaultPackageTheme = managedPackage?.defaultThemeSlug === theme.slug;

        return (
          <Card key={`${theme.slug}:${theme.type ?? 'pack'}`} className={`rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 ${isActive ? 'ring-2 ring-blue-500 shadow-xl shadow-blue-500/10' : 'hover:shadow-md'}`}>
            <div className="aspect-[16/9] bg-gray-100 relative group overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt={theme.name} className="object-cover w-full h-full transform transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gray-50 text-gray-400 text-sm font-medium uppercase tracking-widest">
                  {getText('merchant.themes.noPreview', 'No Preview')}
                </div>
              )}
              {isActive && (
                <div className="absolute top-4 right-4">
                  <Badge variant="default" className="bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] shadow-lg rounded-full px-3 py-1">
                    {getText('common.status.active', 'Active')}
                  </Badge>
                </div>
              )}
            </div>
            <CardHeader className="p-6 pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900">{theme.name}</CardTitle>
                  <CardDescription className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wide">
                    v{theme.version} {theme.author ? `${getText('common.labels.by', 'by')} ${theme.author}` : ''}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 py-2">
              <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px] leading-relaxed">
                {theme.description || getText('common.empty.noData', 'No description available')}
              </p>
              {isThemeFirstSolution ? (
                <p className="mt-3 text-sm leading-6 text-blue-700">
                  {isDefaultPackageTheme
                    ? getText(
                        'merchant.package.defaultThemeExplanation',
                        'This is the storefront surface your managed solution expects to run by default.'
                      )
                    : getText(
                        'merchant.package.includedThemeExplanation',
                        'This theme is included as part of the managed solution package and works together with companion runtime capability.'
                      )}
                </p>
              ) : null}
              <div className="flex gap-2 mt-3 flex-wrap">
                {theme.source === 'builtin' && (
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-lg bg-gray-100 text-gray-600 pointer-events-none">
                    {getText('common.labels.builtin', 'Built-in')}
                  </Badge>
                )}
                {isThemeFirstSolution ? (
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-lg bg-blue-100 text-blue-700 pointer-events-none">
                    {getText('merchant.package.solutionBadge', 'Theme-first solution')}
                  </Badge>
                ) : null}
                {isDefaultPackageTheme ? (
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-lg bg-emerald-100 text-emerald-700 pointer-events-none">
                    {getText('merchant.package.defaultThemeBadge', 'Default package theme')}
                  </Badge>
                ) : null}
                <Badge
                  variant="secondary"
                  className={`text-[10px] font-bold uppercase tracking-wider rounded-lg pointer-events-none ${
                    (theme.type ?? 'pack') === 'app'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {(theme.type ?? 'pack') === 'app' ? 'Theme App' : 'Theme Pack'}
                </Badge>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-4">
              {isActive ? (
                <Button className="w-full rounded-xl bg-blue-50 text-blue-600 font-bold hover:bg-blue-100" variant="ghost" disabled>
                  <Check className="mr-2 h-4 w-4" />
                  {getText('merchant.themes.currentTheme', 'Current Theme')}
                </Button>
              ) : (
                <div className="flex w-full gap-3">
                  {isThemeFirstSolution ? (
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href={`/${locale}/package`}>
                        {getText('merchant.package.openPackageWorkspace', 'Open Your Package')}
                      </Link>
                    </Button>
                  ) : null}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="flex-1 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200" disabled={isActivating}>
                        {getText('merchant.themes.activate', 'Activate')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {getText('merchant.themes.activate', 'Activate')} {theme.name}?
                        </DialogTitle>
                        <DialogDescription>
                          {getText('merchant.themes.activateDescription', "This will change your store's appearance immediately.")}
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={(e: any) => {
                            const closeBtn = e.currentTarget
                              .closest('[role="dialog"]')
                              ?.querySelector('[data-radix-collection-item]');
                            if (closeBtn instanceof HTMLElement) closeBtn.click();
                          }}
                        >
                          {getText('common.actions.cancel', 'Cancel')}
                        </Button>
                        <Button onClick={() => onActivate(theme)} className="rounded-xl">{getText('merchant.themes.activate', 'Activate')}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="flex-1 rounded-xl font-bold border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100" variant="outline" disabled={!canUninstall || isUninstalling}>
                        {getText('merchant.themes.uninstall', 'Uninstall')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {getText('merchant.themes.uninstall', 'Uninstall')} {theme.name}?
                        </DialogTitle>
                        <DialogDescription>
                          {canUninstall
                            ? getText('merchant.themes.uninstallDescription', 'This will remove the theme from the server.')
                            : isBuiltin
                              ? getText('merchant.themes.uninstallBuiltinDisabled', 'Built-in themes cannot be uninstalled.')
                              : getText('merchant.themes.uninstallActiveDisabled', 'Active theme cannot be uninstalled. Please activate another theme first.')}
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" className="rounded-xl">
                          {getText('common.actions.cancel', 'Cancel')}
                        </Button>
                        <Button
                          variant="destructive"
                          className="rounded-xl"
                          disabled={!canUninstall || isUninstalling}
                          onClick={() => onUninstall(theme)}
                        >
                          {isUninstalling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {getText('merchant.themes.uninstall', 'Uninstall')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
