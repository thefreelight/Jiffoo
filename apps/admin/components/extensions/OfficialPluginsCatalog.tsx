'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, Search, Settings2, ShieldCheck, WifiOff } from 'lucide-react';
import type { OfficialCatalogItem } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExtensionAvatar, OfficialBadge } from '@/components/extensions/ExtensionVisuals';
import type { ManagedPackageDefinition } from '@/lib/managed-mode';

interface OfficialPluginsCatalogProps {
  locale: string;
  items: OfficialCatalogItem[];
  isLoading: boolean;
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  marketplaceReady: boolean;
  installingSlug?: string | null;
  isProvisioningPackage?: boolean;
  onInstall: (item: OfficialCatalogItem) => void;
  onEnable: (item: OfficialCatalogItem) => void;
  onConfigure: (item: OfficialCatalogItem) => void;
  onManage: (item: OfficialCatalogItem) => void;
  getText: (key: string, fallback: string) => string;
  managedPackage?: ManagedPackageDefinition | null;
}

function formatPrice(item: OfficialCatalogItem): string {
  if (item.pricingModel === 'free' || item.price <= 0) {
    return 'Free';
  }
  return `${item.pricingModel === 'subscription' ? 'Subscription' : 'One-time'} · ${item.currency} ${item.price}`;
}

function getReleaseTone(item: OfficialCatalogItem): string {
  if (item.releaseStatus === 'published') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (item.releaseStatus === 'offline') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function getInstallTone(item: OfficialCatalogItem): string {
  if (item.installState === 'enabled' || item.installState === 'active') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (item.installState === 'installed') {
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
  return 'bg-white text-slate-500 border-slate-200';
}

export function OfficialPluginsCatalog({
  locale,
  items,
  isLoading,
  marketOnline,
  marketError,
  officialMarketOnly,
  marketplaceReady,
  installingSlug,
  isProvisioningPackage = false,
  onInstall,
  onEnable,
  onConfigure,
  onManage,
  getText,
  managedPackage,
}: OfficialPluginsCatalogProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const isThemeFirstSolution = managedPackage?.offerKind === 'theme_first_solution';

  const visibleItems = useMemo(() => {
    if (!managedPackage) {
      return items;
    }
    const allowed = new Set(managedPackage.includedPlugins);
    return items.filter((item) => allowed.has(item.slug));
  }, [items, managedPackage]);

  const categories = useMemo(
    () => Array.from(new Set(visibleItems.map((item) => item.category).filter(Boolean))).sort(),
    [visibleItems]
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return visibleItems.filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [item.name, item.slug, item.description, item.author, item.category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [category, visibleItems, search]);

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold tracking-tight">
            {managedPackage
              ? getText('merchant.plugins.includedPlugins', 'Included plugins')
              : getText('merchant.plugins.marketplace', 'Official plugin marketplace')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {managedPackage
              ? getText(
                  'merchant.plugins.includedPluginsDescription',
                  'These plugins are included in your managed package and can be installed or configured without exposing the public marketplace.'
                )
              : getText(
                  'merchant.plugins.officialCatalogDescription',
                  'Install, enable, and manage the launch plugins without leaving Merchant Admin.'
                )}
          </p>
        </div>

        {managedPackage ? (
          <Alert className="mt-4 border-blue-200 bg-blue-50 text-blue-900">
            <AlertTitle>{getText('merchant.plugins.managedModeActive', 'Managed Mode active')}</AlertTitle>
            <AlertDescription>
              {isThemeFirstSolution
                ? `${managedPackage.displaySolutionName} ships companion runtime capabilities through licensed plugins. Use Your Package for guided setup and recovery.`
                : `${managedPackage.displaySolutionName} unlocks the licensed plugin stack only.`}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !marketOnline ? (
          <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.marketOffline', 'Official market is offline')}</AlertTitle>
            <AlertDescription>
              {marketError || getText('merchant.extensions.marketOfflineDescription', 'Marketplace metadata is currently unavailable. Installed plugins continue to work, but new installs are paused.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && officialMarketOnly ? (
          <Alert className="mt-4 border-blue-200 bg-blue-50 text-blue-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.officialOnly', 'Official catalog only')}</AlertTitle>
            <AlertDescription>
              {getText('merchant.extensions.officialOnlyPluginsDescription', 'Direct ZIP installs are disabled in this environment.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && marketOnline && !marketplaceReady && !managedPackage && visibleItems.some((item) => item.pricingModel !== 'free') ? (
          <Alert className="mt-4 border-slate-200 bg-slate-50 text-slate-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.platformConnectionRequired', 'Platform connection required')}</AlertTitle>
            <AlertDescription>
              {getText('merchant.extensions.platformConnectionRequiredDescription', 'Connect this instance and bind the default store before installing official plugins.')}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={getText('merchant.extensions.searchOfficialPlugins', 'Search official plugins')}
              className="h-12 rounded-2xl border-slate-200 pl-11"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-12 w-full rounded-2xl border-slate-200 lg:w-[220px]">
              <SelectValue placeholder={getText('common.labels.category', 'Category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('common.labels.all', 'All')}</SelectItem>
              {categories.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`official-plugin-skeleton-${index}`} className="rounded-[1.75rem] border-gray-100">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-10 animate-pulse rounded-2xl bg-slate-100" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
          {managedPackage
            ? getText('merchant.extensions.noIncludedPlugins', 'No licensed plugins are available for this package.')
            : getText('merchant.extensions.noOfficialMatches', 'No official plugins match the current filter.')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const solutionMeta = item.solutionPackage;
            const controlPlaneSolution = item.solutionOffer;
            const hasSolutionSemantics = solutionMeta?.offerKind === 'theme_first_solution' || controlPlaneSolution?.offerKind === 'theme_first_solution';
            const isInstalling = installingSlug === item.slug || (isProvisioningPackage && solutionMeta?.offerKind === 'theme_first_solution');
            const showConfigure = item.installState === 'installed' && item.configRequired && !item.configReady;
            const requiresPlatformBinding = item.pricingModel !== 'free';
            const installDisabled =
              item.installState === 'not_installed' &&
              (!marketOnline || !item.availableInMarket || (requiresPlatformBinding && !marketplaceReady) || isInstalling);
            const effectiveInstallDisabled =
              managedPackage && item.installState === 'not_installed'
                ? isInstalling || managedPackage.status === 'SUSPENDED'
                : installDisabled;

            const primaryActionLabel =
              item.installState === 'not_installed'
                ? hasSolutionSemantics
                  ? (controlPlaneSolution?.ctaLabel || getText('merchant.package.provisionSolution', 'Provision solution'))
                  : getText('merchant.plugins.install', 'Install')
                : item.installState === 'installed'
                  ? showConfigure
                    ? getText('common.actions.configure', 'Configure')
                    : getText('merchant.plugins.enable', 'Enable')
                  : getText('common.actions.manage', 'Manage');

            const handlePrimaryAction = () => {
              if (item.installState === 'not_installed') {
                onInstall(item);
                return;
              }
              if (item.installState === 'installed') {
                if (showConfigure) {
                  onConfigure(item);
                  return;
                }
                onEnable(item);
                return;
              }
              onManage(item);
            };

            const priceLabel = managedPackage
              ? getText('merchant.plugins.includedInPackage', 'Included in package')
              : formatPrice(item);

            return (
              <Card key={item.slug} className="overflow-hidden rounded-[1.35rem] border-gray-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <ExtensionAvatar
                        slug={item.slug}
                        name={item.name}
                        kind="plugin"
                        thumbnailUrl={item.thumbnailUrl}
                        className="h-10 w-10 shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-slate-950">{item.name}</h4>
                          <OfficialBadge compact />
                          {hasSolutionSemantics ? (
                            <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                              {controlPlaneSolution?.badgeLabel || getText('merchant.package.solutionBadge', 'Theme-first solution')}
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className={`rounded-full capitalize ${getReleaseTone(item)}`}>
                            {item.releaseStatus === 'published'
                              ? getText('merchant.extensions.releasePublished', 'Published')
                              : item.releaseStatus === 'offline'
                                ? getText('merchant.extensions.releaseOffline', 'Offline')
                                : getText('merchant.extensions.releaseCatalogOnly', 'Catalog only')}
                          </Badge>
                          <Badge variant="outline" className={`rounded-full capitalize ${getInstallTone(item)}`}>
                            {item.installState.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>v{item.version}</span>
                          <span className="text-slate-300">•</span>
                          <span>{item.author}</span>
                          <span className="text-slate-300">•</span>
                          <span className="capitalize">{item.category}</span>
                        </div>

                        <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">{item.description}</p>

                        {hasSolutionSemantics ? (
                          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900">
                            {controlPlaneSolution?.summary ||
                              getText(
                                'merchant.package.includedPluginExplanation',
                                'This plugin is part of the managed solution package and powers companion runtime capability behind the storefront theme.'
                              )}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {priceLabel}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {getText('merchant.extensions.deliveryMode', 'Delivery')}: {item.deliveryMode}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {getText('merchant.extensions.downloads', 'Downloads')}: {item.downloads ?? 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-3">
                    <Button
                      onClick={handlePrimaryAction}
                      disabled={effectiveInstallDisabled}
                      className="w-full rounded-lg"
                    >
                      {isInstalling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
                      {primaryActionLabel}
                    </Button>

                    <div className="flex flex-wrap items-center gap-2">
                      {hasSolutionSemantics ? (
                        <Button asChild variant="outline" className="rounded-lg">
                          <Link href={`/${locale}/package`}>
                            {getText('merchant.package.openPackageWorkspace', 'Open Your Package')}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}

                      {item.configRequired && !item.configReady ? (
                        <p className="text-xs font-medium text-amber-700">
                          {getText('merchant.plugins.needsConfiguration', 'Needs configuration before it can be enabled.')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
