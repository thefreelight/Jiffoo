'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, Search, WifiOff } from 'lucide-react';
import type { OfficialCatalogItem } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExtensionAvatar, OfficialBadge } from '@/components/extensions/ExtensionVisuals';
import type { ManagedPackageDefinition } from '@/lib/managed-mode';

interface OfficialThemesCatalogProps {
  locale: string;
  target: 'shop' | 'admin';
  items: OfficialCatalogItem[];
  isLoading: boolean;
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  marketplaceReady: boolean;
  installingSlug?: string | null;
  isProvisioningPackage?: boolean;
  isActivating: boolean;
  onInstall: (item: OfficialCatalogItem) => void;
  onActivate: (item: OfficialCatalogItem) => void;
  getText: (key: string, fallback: string) => string;
  managedPackage?: ManagedPackageDefinition | null;
}

function formatPrice(item: OfficialCatalogItem): string {
  if (item.pricingModel === 'free' || item.price <= 0) {
    return 'Free';
  }
  return `${item.pricingModel === 'subscription' ? 'Subscription' : 'One-time'} · ${item.currency} ${item.price}`;
}

export function OfficialThemesCatalog({
  locale,
  target,
  items,
  isLoading,
  marketOnline,
  marketError,
  officialMarketOnly,
  marketplaceReady,
  installingSlug,
  isProvisioningPackage = false,
  isActivating,
  onInstall,
  onActivate,
  getText,
  managedPackage,
}: OfficialThemesCatalogProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const isThemeFirstSolution = managedPackage?.offerKind === 'theme_first_solution';

  const visibleItems = useMemo(() => {
    if (!managedPackage) {
      return items;
    }
    const allowed = new Set(managedPackage.includedThemes);
    return items.filter((item) => allowed.has(item.slug));
  }, [items, managedPackage]);

  const categories = useMemo(() => {
    return Array.from(new Set(visibleItems.map((item) => item.category).filter(Boolean))).sort();
  }, [visibleItems]);

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

  if (target !== 'shop') {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
        <p className="font-semibold text-slate-900">
          {getText('merchant.themes.noOfficialAdminThemes', 'No official Admin themes in this launch wave.')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {getText('merchant.themes.noOfficialAdminThemesDescription', 'The v1 official catalog only includes storefront themes for the Shop target.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-1">
          <h3 className="text-2xl font-bold tracking-tight text-slate-950">
            {managedPackage
              ? getText('merchant.themes.includedThemes', 'Included themes')
              : getText('merchant.themes.officialCatalog', 'Official theme marketplace')}
          </h3>
          <p className="text-sm text-slate-500">
            {managedPackage
              ? getText(
                  'merchant.themes.includedThemesDescription',
                  'These storefront themes are included in your managed package. Activate the approved theme directly from Merchant Admin.'
                )
              : getText(
                  'merchant.themes.officialCatalogDescription',
                  'Browse the official storefront themes and activate them directly from Merchant Admin.'
                )}
          </p>
        </div>

        {managedPackage ? (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <AlertTitle>{getText('merchant.themes.managedModeActive', 'Managed Mode active')}</AlertTitle>
            <AlertDescription>
              {isThemeFirstSolution
                ? `${managedPackage.displaySolutionName} is delivered as a theme-first solution package. Use the package workspace for guided setup and launch tasks.`
                : `${managedPackage.displaySolutionName} only exposes the licensed storefront themes.`}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !marketOnline ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.marketOffline', 'Official market is offline')}</AlertTitle>
            <AlertDescription>
              {marketError || getText('merchant.extensions.marketOfflineThemesDescription', 'Theme activation still works for installed themes, but new installs are unavailable right now.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && officialMarketOnly ? (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.officialOnly', 'Official catalog only')}</AlertTitle>
            <AlertDescription>
              {getText('merchant.extensions.officialOnlyThemesDescription', 'Local ZIP theme installs are disabled in this environment.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !marketplaceReady && !managedPackage && visibleItems.some((item) => item.pricingModel !== 'free') ? (
          <Alert className="border-slate-200 bg-slate-50 text-slate-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.platformConnectionRequired', 'Platform connection required')}</AlertTitle>
            <AlertDescription>
              {getText('merchant.extensions.platformConnectionRequiredThemesDescription', 'Connect this instance to Jiffoo Platform and bind the default store before installing official themes.')}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-5 flex flex-col gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={getText('merchant.extensions.searchOfficial', 'Search official themes')}
              className="h-11 rounded-lg border-slate-200 pl-11"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['all', ...categories].map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCategory(entry)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-colors ${category === entry ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
              >
                {entry === 'all' ? getText('common.labels.all', 'All') : entry}
              </button>
            ))}
            <span className="ml-auto hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 lg:inline-flex">Featured <span className="ml-2 text-slate-400">⌄</span></span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <Card key={`official-theme-skeleton-${index}`} className="rounded-lg border-gray-100">
              <CardHeader className="space-y-4">
                <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              </CardContent>
            </Card>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
            {managedPackage
              ? getText('merchant.extensions.noIncludedThemes', 'No licensed storefront themes are available for this package.')
              : getText('merchant.extensions.noOfficialMatches', 'No official themes match the current filter.')}
        </div>
        ) : (
          filteredItems.map((item) => {
            const solutionMeta = item.solutionPackage;
            const controlPlaneSolution = item.solutionOffer;
            const hasSolutionSemantics = solutionMeta?.offerKind === 'theme_first_solution' || controlPlaneSolution?.offerKind === 'theme_first_solution';
            const isInstalling = installingSlug === item.slug || (isProvisioningPackage && solutionMeta?.offerKind === 'theme_first_solution');
            const isManagedDefaultTheme = solutionMeta?.defaultTheme ?? managedPackage?.defaultThemeSlug === item.slug;
            const requiresPlatformBinding = item.pricingModel !== 'free';
            const canInstall =
              item.installState === 'not_installed' &&
              marketOnline &&
              item.availableInMarket &&
              (!requiresPlatformBinding || marketplaceReady);
            const isUpdateAction = Boolean(item.updateAvailable && item.installState !== 'not_installed');
            const effectiveCanInstall =
              managedPackage && item.installState === 'not_installed'
                ? managedPackage.status !== 'SUSPENDED'
                : canInstall;
            const isUpdateDisabled =
              isUpdateAction &&
              (!marketOnline || !item.availableInMarket || isInstalling || isActivating || managedPackage?.status === 'SUSPENDED');
            const actionLabel =
              isUpdateAction
                ? getText('merchant.themes.update', 'Update')
                : item.installState === 'active'
                ? getText('merchant.themes.active', 'Active')
                : item.installState === 'installed'
                  ? getText('merchant.themes.activate', 'Activate')
                  : hasSolutionSemantics
                    ? (controlPlaneSolution?.ctaLabel || getText('merchant.package.provisionSolution', 'Provision solution'))
                    : getText('merchant.themes.install', 'Install');

              const handlePrimaryAction = () => {
                if (item.installState === 'not_installed' || isUpdateAction) {
                  onInstall(item);
                  return;
                }

                onActivate(item);
              };

              const priceLabel = managedPackage
                ? getText('merchant.themes.includedInPackage', 'Included in package')
                : formatPrice(item);

              return (
              <Card key={item.slug} className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]" /> : <ExtensionAvatar slug={item.slug} name={item.name} kind="theme" className="h-full w-full rounded-none" />}
                  <div className="absolute left-3 top-3"><OfficialBadge compact /></div>
                  {item.installState === 'active' ? <Badge className="absolute right-3 top-3 rounded-lg bg-emerald-600 text-white">{getText('merchant.themes.active', 'Active')}</Badge> : null}
                </div>

                <CardHeader className="space-y-2 px-5 pb-0 pt-5">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-slate-950">{item.name}</CardTitle>
                    <p className="text-xs text-slate-500">v{item.version} <span className="mx-1">•</span> {item.category}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-lg capitalize border-slate-200 text-slate-600">
                      {item.releaseStatus === 'published'
                        ? getText('merchant.extensions.releasePublished', 'Published')
                        : item.releaseStatus === 'offline'
                          ? getText('merchant.extensions.releaseOffline', 'Offline')
                          : getText('merchant.extensions.releaseCatalogOnly', 'Catalog Only')}
                    </Badge>
                    {item.updateAvailable && item.latestVersion ? (
                      <Badge variant="outline" className="rounded-lg border-amber-200 bg-amber-50 text-amber-900">
                        {getText('merchant.themes.updateAvailable', 'Update available')} · v{item.latestVersion}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 px-5 pb-5 pt-4">
                  <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{item.description}</p>

                  {hasSolutionSemantics ? (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900">
                      {isManagedDefaultTheme
                        ? getText(
                            'merchant.package.defaultThemeExplanation',
                            'This theme is the default storefront surface for the managed solution package. Companion gateway capabilities and setup steps are handled from Your Package.'
                          )
                        : controlPlaneSolution?.summary ||
                          getText(
                            'merchant.package.includedThemeExplanation',
                            'This theme is included through the managed solution package. Install or activate it here, then continue setup from Your Package.'
                          )}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between text-xs text-slate-500"><span>{priceLabel}</span><span>{item.downloads ?? 0} downloads</span></div>

                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={handlePrimaryAction}
                      disabled={isUpdateDisabled || (!isUpdateAction && item.installState === 'active') || (item.installState === 'not_installed' && (!effectiveCanInstall || isInstalling)) || isActivating}
                      className="w-full rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isInstalling || isActivating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {actionLabel}
                    </Button>

                    {hasSolutionSemantics ? (
                      <Button asChild variant="outline" className="w-full rounded-lg">
                        <Link href={`/${locale}/package`}>
                          {getText('merchant.package.openPackageWorkspace', 'Open Your Package')}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
